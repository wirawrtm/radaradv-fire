import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  db,
  handleFirestoreError,
  isBootstrappedAdminEmail,
  OperationType,
} from "../firebase";
import {
  clampStr,
  FISCAL_MONTH_COLS,
  toIsoDateStr,
  toStrictDivision,
  toValidDocId,
  type DivisionStrict,
  type DrShipmentFsDoc,
  type EmployeeFsDoc,
  type HybridFsDoc,
  type LotFsDoc,
  type MonthlyOpnameCell,
  type NormalizedDataset,
  type OpnameLogFsDoc,
  type PartnerFsDoc,
} from "../utils/firestoreNormalization";
import { cleanForMatch, extractExpFromLot, getValidCategory } from "../utils/formatters";

export interface FirestoreAllData {
  dataset: NormalizedDataset;
  accessRules: Record<string, Record<string, boolean>>;
}

const getScopedQuery = (colName: string, _user?: User | null) => {
  return collection(db, colName);
};

const bootstrapInFlight = new Map<string, Promise<void>>();

export async function ensureUserBootstrap(user: User): Promise<void> {
  if (!user?.uid || !user.email) return;

  const existingPromise = bootstrapInFlight.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const run = (async () => {
    const isAdm = isBootstrappedAdminEmail(user.email);

    // 1. Ensure /admins/{uid} if bootstrapped admin
    if (isAdm) {
      const adminPath = `admins/${user.uid}`;
      try {
        const adminRef = doc(db, "admins", user.uid);
        const snap = await getDoc(adminRef);
        if (!snap.exists()) {
          await setDoc(adminRef, {
            uid: user.uid,
            email: clampStr(user.email, 120),
            role: "admin",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, adminPath);
      }
    }

    // 2. Ensure /users/{uid} profile doc
    const userPath = `users/${user.uid}`;
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: clampStr(user.email, 120),
          displayName: clampStr(user.displayName || user.email.split("@")[0], 120, "User"),
          divisionGroup: "All",
          roleLevel: isAdm ? 5 : 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  })();

  bootstrapInFlight.set(user.uid, run);
  try {
    await run;
  } finally {
    bootstrapInFlight.delete(user.uid);
  }
}

export function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as any)?.code || "").toLowerCase();
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return (
    code.includes("permission-denied") ||
    msg.includes("permission") ||
    msg.includes("insufficient")
  );
}

const SKU_DELIM = "__SKU__";

export function packHybridNameWithSku(hybridName: string, sku?: string | null): string {
  const baseName = String(hybridName || "")
    .split(SKU_DELIM)[0]
    .trim()
    .toUpperCase();
  const cleanSku = clampStr(String(sku || "").trim().toUpperCase(), 35);
  if (!cleanSku) {
    return clampStr(baseName, 100, "ADV808");
  }
  const clampedBase = clampStr(baseName, 55, "ADV808");
  return `${clampedBase}${SKU_DELIM}${cleanSku}`;
}

export function unpackHybridDoc(raw: any): HybridFsDoc {
  const rawName = String(raw?.hybrid_name || "");
  if (rawName.includes(SKU_DELIM)) {
    const [namePart, skuPart] = rawName.split(SKU_DELIM);
    const cleanSku = String(raw?.sku || skuPart || "").trim();
    return {
      ...raw,
      doc_id: raw.doc_id,
      hybrid_name: namePart.trim(),
      ...(cleanSku ? { sku: cleanSku } : {}),
      crop_type: toStrictDivision(raw?.crop_type),
    };
  }
  const fallbackSku = String(raw?.sku || skuMetaStore.hybrids.get(raw?.doc_id) || "").trim();
  return {
    ...raw,
    doc_id: raw.doc_id,
    hybrid_name: rawName.trim(),
    ...(fallbackSku ? { sku: fallbackSku } : {}),
    crop_type: toStrictDivision(raw?.crop_type),
  };
}

const knownSkuMetaDocIds = new Set<string>();
const skuMetaStore: {
  hybrids: Map<string, string>;
  lots: Map<string, string>;
  dr_shipments: Map<string, string>;
  opname_logs: Map<string, string>;
} = {
  hybrids: new Map(),
  lots: new Map(),
  dr_shipments: new Map(),
  opname_logs: new Map(),
};

function getSkuMetaDocId(prefix: "LOT" | "DR" | "LOG" | "HYB", targetId: string): string {
  return toValidDocId(`SKU_${prefix}_${targetId}`).slice(0, 120);
}

function buildSkuMetaOp(
  ownerUid: string,
  prefix: "LOT" | "DR" | "LOG" | "HYB",
  targetId: string,
  skuVal: string,
): {
  type: "create" | "update" | "delete";
  colName: string;
  docId: string;
  data?: Record<string, any>;
} | null {
  if (!targetId) return null;
  const metaDocId = getSkuMetaDocId(prefix, targetId);
  const targetMap =
    prefix === "LOT"
      ? skuMetaStore.lots
      : prefix === "DR"
        ? skuMetaStore.dr_shipments
        : prefix === "LOG"
          ? skuMetaStore.opname_logs
          : skuMetaStore.hybrids;

  const cleanSku = clampStr(String(skuVal || "").trim().toUpperCase(), 80);
  if (cleanSku) {
    targetMap.set(targetId, cleanSku);
    if (knownSkuMetaDocIds.has(metaDocId)) {
      return {
        type: "update",
        colName: "access_rules",
        docId: metaDocId,
        data: {
          position: cleanSku,
        },
      };
    }
    knownSkuMetaDocIds.add(metaDocId);
    return {
      type: "create",
      colName: "access_rules",
      docId: metaDocId,
      data: {
        doc_id: metaDocId,
        position: cleanSku,
        home: false,
        partner: false,
        stock: false,
        pog: false,
        overview: false,
        temp: false,
        access: false,
        ownerUid,
      },
    };
  } else if (knownSkuMetaDocIds.has(metaDocId)) {
    knownSkuMetaDocIds.delete(metaDocId);
    targetMap.delete(targetId);
    return {
      type: "delete",
      colName: "access_rules",
      docId: metaDocId,
    };
  }
  return null;
}

function parseAccessAndSkuMetaDocs(accessDocs: any[]): Record<string, Record<string, boolean>> {
  const accessRules: Record<string, Record<string, boolean>> = {};
  knownSkuMetaDocIds.clear();
  skuMetaStore.hybrids.clear();
  skuMetaStore.lots.clear();
  skuMetaStore.dr_shipments.clear();
  skuMetaStore.opname_logs.clear();

  accessDocs.forEach((docItem) => {
    const id = String(docItem?.doc_id || "");
    const posVal = String(docItem?.position || "").trim();
    if (id.startsWith("SKU_LOT_")) {
      knownSkuMetaDocIds.add(id);
      const targetId = id.slice("SKU_LOT_".length);
      if (targetId && posVal) skuMetaStore.lots.set(targetId, posVal);
      return;
    }
    if (id.startsWith("SKU_DR_")) {
      knownSkuMetaDocIds.add(id);
      const targetId = id.slice("SKU_DR_".length);
      if (targetId && posVal) skuMetaStore.dr_shipments.set(targetId, posVal);
      return;
    }
    if (id.startsWith("SKU_LOG_")) {
      knownSkuMetaDocIds.add(id);
      const targetId = id.slice("SKU_LOG_".length);
      if (targetId && posVal) skuMetaStore.opname_logs.set(targetId, posVal);
      return;
    }
    if (id.startsWith("SKU_HYB_")) {
      knownSkuMetaDocIds.add(id);
      const targetId = id.slice("SKU_HYB_".length);
      if (targetId && posVal) skuMetaStore.hybrids.set(targetId, posVal);
      return;
    }
    if (posVal) {
      accessRules[posVal] = {
        home: !!docItem.home,
        partner: !!docItem.partner,
        stock: !!docItem.stock,
        pog: !!docItem.pog,
        overview: !!docItem.overview,
        temp: !!docItem.temp,
        access: !!docItem.access,
      };
    }
  });

  return accessRules;
}

function enrichLotsWithSku(rawLots: LotFsDoc[]): LotFsDoc[] {
  return rawLots.map((l) => {
    const sku = String(l.sku || skuMetaStore.lots.get(l.doc_id) || "").trim();
    return sku ? { ...l, sku } : l;
  });
}

function enrichDrWithSku(rawDrs: DrShipmentFsDoc[]): DrShipmentFsDoc[] {
  return rawDrs.map((d) => {
    const sku = String(
      d.sku || skuMetaStore.dr_shipments.get(d.doc_id) || skuMetaStore.lots.get(d.lot_no) || "",
    ).trim();
    return sku ? { ...d, sku } : d;
  });
}

function enrichLogsWithSku(rawLogs: OpnameLogFsDoc[]): OpnameLogFsDoc[] {
  return rawLogs.map((l) => {
    const sku = String(
      l.sku || skuMetaStore.opname_logs.get(l.doc_id) || skuMetaStore.lots.get(l.lot_no) || "",
    ).trim();
    return {
      ...l,
      ...(sku ? { sku } : {}),
      _key: l.doc_id,
    };
  });
}

export async function fetchAllFirestoreData(user: User | null): Promise<FirestoreAllData> {
  const fetchCol = async <T,>(colName: string): Promise<T[]> => {
    try {
      const snap = await getDocs(getScopedQuery(colName, user));
      return snap.docs.map((d) => ({ doc_id: d.id, ...(d.data() as any) })) as T[];
    } catch (err) {
      if (!user && isPermissionDeniedError(err)) {
        throw err;
      }
      handleFirestoreError(err, OperationType.LIST, colName);
    }
  };

  // Preflight a single collection in public mode so unpublished Console rules fail cleanly in 1 request without 7x error spam
  let preflightAccessDocs: any[] | null = null;
  if (!user) {
    preflightAccessDocs = await fetchCol<any>("access_rules");
  }

  const [employees, partners, rawHybrids, rawLots, rawDrShipments, rawOpnameLogs, accessDocs] =
    await Promise.all([
      fetchCol<EmployeeFsDoc>("employees"),
      fetchCol<PartnerFsDoc>("partners"),
      fetchCol<HybridFsDoc>("hybrids"),
      fetchCol<LotFsDoc>("lots"),
      fetchCol<DrShipmentFsDoc>("dr_shipments"),
      fetchCol<OpnameLogFsDoc>("opname_logs"),
      preflightAccessDocs !== null ? Promise.resolve(preflightAccessDocs) : fetchCol<any>("access_rules"),
    ]);

  const accessRules = parseAccessAndSkuMetaDocs(accessDocs);
  const hybrids = rawHybrids.map(unpackHybridDoc);
  const lots = enrichLotsWithSku(rawLots);
  const dr_shipments = enrichDrWithSku(rawDrShipments);
  const opname_logs = enrichLogsWithSku(rawOpnameLogs);

  return {
    dataset: {
      employees,
      partners,
      hybrids,
      lots,
      dr_shipments,
      opname_logs,
    },
    accessRules,
  };
}

export function subscribeToFirestoreCollections(
  user: User | null,
  onUpdate: (partial: Partial<FirestoreAllData>) => void,
  onError?: (error: unknown, colName: string) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  let cachedHybrids: any[] | null = null;
  let cachedLots: LotFsDoc[] | null = null;
  let cachedDrs: DrShipmentFsDoc[] | null = null;
  let cachedLogs: OpnameLogFsDoc[] | null = null;

  const listen = (colName: string, apply: (docs: any[]) => void) => {
    const q = getScopedQuery(colName, user);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ doc_id: d.id, ...(d.data() as any) }));
        apply(docs);
      },
      (error) => {
        if (onError) {
          onError(error, colName);
        } else {
          handleFirestoreError(error, OperationType.LIST, colName);
        }
      },
    );
    unsubs.push(unsub);
  };

  listen("employees", (docs) => onUpdate({ dataset: { employees: docs } as any }));
  listen("partners", (docs) => onUpdate({ dataset: { partners: docs } as any }));
  listen("hybrids", (docs) => {
    cachedHybrids = docs;
    onUpdate({ dataset: { hybrids: docs.map(unpackHybridDoc) } as any });
  });
  listen("lots", (docs) => {
    cachedLots = docs;
    onUpdate({
      dataset: {
        lots: enrichLotsWithSku(docs),
        ...(cachedDrs ? { dr_shipments: enrichDrWithSku(cachedDrs) } : {}),
        ...(cachedLogs ? { opname_logs: enrichLogsWithSku(cachedLogs) } : {}),
      } as any,
    });
  });
  listen("dr_shipments", (docs) => {
    cachedDrs = docs;
    onUpdate({ dataset: { dr_shipments: enrichDrWithSku(docs) } as any });
  });
  listen("opname_logs", (docs) => {
    cachedLogs = docs;
    onUpdate({
      dataset: {
        opname_logs: enrichLogsWithSku(docs),
      } as any,
    });
  });
  listen("access_rules", (docs) => {
    const accessRules = parseAccessAndSkuMetaDocs(docs);
    onUpdate({
      accessRules,
      dataset: {
        ...(cachedHybrids ? { hybrids: cachedHybrids.map(unpackHybridDoc) } : {}),
        ...(cachedLots ? { lots: enrichLotsWithSku(cachedLots) } : {}),
        ...(cachedDrs ? { dr_shipments: enrichDrWithSku(cachedDrs) } : {}),
        ...(cachedLogs ? { opname_logs: enrichLogsWithSku(cachedLogs) } : {}),
      } as any,
    });
  });

  return () => unsubs.forEach((u) => u());
}

/**
 * Commit array of write operations in rule-safe batches.
 * Note: Firestore allows at most 20 get()/exists()/existsAfter() evaluations across a single batch/transaction.
 * Keep chunkSize <= 6 when documents trigger up to 3 existsAfter() lookups (e.g. opname_logs),
 * and <= 8 when documents trigger up to 2 existsAfter() lookups (e.g. dr_shipments).
 */
async function commitInChunks(
  ops: Array<{
    type: "create" | "update" | "delete";
    colName: string;
    docId: string;
    data?: Record<string, any>;
  }>,
  chunkSize = 6,
) {
  if (ops.length === 0) return;

  const chunks: Array<typeof ops> = [];
  for (let i = 0; i < ops.length; i += chunkSize) {
    chunks.push(ops.slice(i, i + chunkSize));
  }

  const CONCURRENCY = 5;
  for (let w = 0; w < chunks.length; w += CONCURRENCY) {
    const wave = chunks.slice(w, w + CONCURRENCY);
    await Promise.all(
      wave.map(async (slice) => {
        const batch = writeBatch(db);
        slice.forEach((op) => {
          const ref = doc(db, op.colName, op.docId);
          if (op.type === "delete") {
            batch.delete(ref);
          } else if (op.type === "create") {
            batch.set(ref, {
              ...(op.data || {}),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const updatePayload = { ...(op.data || {}) };
            delete updatePayload.doc_id;
            delete updatePayload.ownerUid;
            delete updatePayload.createdAt;
            batch.update(ref, {
              ...updatePayload,
              updatedAt: serverTimestamp(),
            });
          }
        });
        try {
          await batch.commit();
        } catch (err) {
          const sampleOp = slice[0];
          const samplePath = sampleOp ? `${sampleOp.colName}/${sampleOp.docId}` : "batch";
          const opType =
            sampleOp?.type === "delete"
              ? OperationType.DELETE
              : sampleOp?.type === "update"
                ? OperationType.UPDATE
                : OperationType.WRITE;
          handleFirestoreError(err, opType, samplePath);
        }
      }),
    );
  }
}

async function getExistingDocIds(colName: string, user?: User | null): Promise<Set<string>> {
  try {
    const snap = await getDocs(getScopedQuery(colName, user));
    return new Set(snap.docs.map((d) => d.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colName);
  }
}

/**
 * Practical & Efficient Full Migration into the 6 normalized collections + access_rules.
 * Executes in 3 referentially safe stages (existsAfter constraints satisfied at every step).
 */
export async function migrateNormalizedDatasetToFirestore(
  user: User | null | undefined,
  dataset: NormalizedDataset,
  accessRules: Record<string, Record<string, boolean>>,
  onStage?: (msg: string) => void,
): Promise<{ totalDocs: number }> {
  if (user?.uid && user?.email) {
    await ensureUserBootstrap(user);
  }
  const ownerUid = user?.uid || "public";

  onStage?.("Memeriksa dokumen existing di Firestore...");
  const [
    existingEmp,
    existingPartner,
    existingHybrid,
    existingLot,
    existingDr,
    existingLogs,
    existingAccess,
  ] = await Promise.all([
    getExistingDocIds("employees", user),
    getExistingDocIds("partners", user),
    getExistingDocIds("hybrids", user),
    getExistingDocIds("lots", user),
    getExistingDocIds("dr_shipments", user),
    getExistingDocIds("opname_logs", user),
    getExistingDocIds("access_rules", user),
  ]);

  let totalDocs = 0;

  // STAGE 1: hybrids, employees, access_rules
  onStage?.("Tahap 1/3: Migrasi hybrids, employees & access_rules...");
  const stage1: Array<{
    type: "create" | "update";
    colName: string;
    docId: string;
    data: Record<string, any>;
  }> = [];

  dataset.hybrids.forEach((h) => {
    const docId = toValidDocId(h.doc_id);
    stage1.push({
      type: existingHybrid.has(docId) ? "update" : "create",
      colName: "hybrids",
      docId,
      data: {
        doc_id: docId,
        hybrid_name: clampStr(h.hybrid_name, 100, docId),
        crop_type: toStrictDivision(h.crop_type),
        ownerUid,
      },
    });
  });

  dataset.employees.forEach((e) => {
    const docId = toValidDocId(e.doc_id);
    stage1.push({
      type: existingEmp.has(docId) ? "update" : "create",
      colName: "employees",
      docId,
      data: {
        doc_id: docId,
        username: clampStr(e.username, 80),
        full_name: clampStr(e.full_name, 120, docId),
        position: clampStr(e.position, 100, "Business Solution"),
        role_level: Math.min(5, Math.max(1, Math.round(Number(e.role_level) || 1))),
        upline_id: e.upline_id ? toValidDocId(e.upline_id) : null,
        subordinate_ids: (e.subordinate_ids || []).map((id) => toValidDocId(id)).slice(0, 200),
        access_scope_ids: (e.access_scope_ids || []).map((id) => toValidDocId(id)).slice(0, 200),
        division_group: e.division_group === "All" ? "All" : toStrictDivision(e.division_group),
        province: clampStr(e.province, 80, "-"),
        area: clampStr(e.area, 80, "-"),
        status: e.status === "Nonaktif" ? "Nonaktif" : "Aktif",
        ownerUid,
      },
    });
  });

  Object.entries(accessRules || {}).forEach(([position, perms]) => {
    const docId = toValidDocId(position, "ROLE");
    stage1.push({
      type: existingAccess.has(docId) ? "update" : "create",
      colName: "access_rules",
      docId,
      data: {
        doc_id: docId,
        position: clampStr(position, 100, docId),
        home: !!perms.home,
        partner: !!perms.partner,
        stock: !!perms.stock,
        pog: !!perms.pog,
        overview: !!perms.overview,
        temp: !!perms.temp,
        access: !!perms.access,
        ownerUid,
      },
    });
  });

  await commitInChunks(stage1, 15);
  totalDocs += stage1.length;

  // STAGE 2: partners & lots (up to 1 existsAfter per doc -> max 15 <= 20)
  onStage?.("Tahap 2/3: Migrasi partners & lots...");
  const stage2: typeof stage1 = [];

  dataset.partners.forEach((p) => {
    const docId = toValidDocId(p.doc_id);
    stage2.push({
      type: existingPartner.has(docId) ? "update" : "create",
      colName: "partners",
      docId,
      data: {
        doc_id: docId,
        partner_name: clampStr(p.partner_name, 160, docId),
        category: clampStr(p.category, 40),
        pic_employee_id: p.pic_employee_id ? toValidDocId(p.pic_employee_id) : null,
        pic_name: clampStr(p.pic_name, 120),
        division_group: toStrictDivision(p.division_group),
        province: clampStr(p.province, 80, "-"),
        area: clampStr(p.area, 80, "-"),
        ownerUid,
      },
    });
  });

  dataset.lots.forEach((l) => {
    const docId = toValidDocId(l.doc_id);
    const numDr = Number(l.initial_dr_kg);
    stage2.push({
      type: existingLot.has(docId) ? "update" : "create",
      colName: "lots",
      docId,
      data: {
        doc_id: docId,
        hybrid_id: l.hybrid_id ? toValidDocId(l.hybrid_id) : null,
        shipping_date: clampStr(l.shipping_date, 20),
        exp_date: clampStr(l.exp_date, 20),
        initial_dr_kg: Number.isFinite(numDr) && numDr > 0 ? numDr : 0,
        ownerUid,
      },
    });
  });

  await commitInChunks(stage2, 15);
  totalDocs += stage2.length;

  // STAGE 3: dr_shipments & opname_logs (up to 3 existsAfter per doc -> max 6 per batch <= 20)
  onStage?.("Tahap 3/3: Migrasi dr_shipments & opname_logs...");
  const stage3: typeof stage1 = [];

  dataset.dr_shipments.forEach((dr) => {
    const docId = toValidDocId(dr.doc_id);
    const numQty = Number(dr.shipped_qty_kg);
    stage3.push({
      type: existingDr.has(docId) ? "update" : "create",
      colName: "dr_shipments",
      docId,
      data: {
        doc_id: docId,
        shipping_date: clampStr(dr.shipping_date, 20, "2026-01-01"),
        partner_id: dr.partner_id ? toValidDocId(dr.partner_id) : null,
        lot_no: toValidDocId(dr.lot_no),
        exp_date: clampStr(dr.exp_date, 20),
        shipped_qty_kg: Number.isFinite(numQty) && numQty > 0 ? numQty : 0,
        ownerUid,
      },
    });
  });

  dataset.opname_logs.forEach((log) => {
    const docId = toValidDocId(log.doc_id);
    const payload: Record<string, any> = {
      doc_id: docId,
      partner_id: log.partner_id ? toValidDocId(log.partner_id) : null,
      lot_no: toValidDocId(log.lot_no),
      checker_id: log.checker_id ? toValidDocId(log.checker_id) : null,
      crop_year: clampStr(log.crop_year, 12, "FY2026"),
      ownerUid,
    };
    FISCAL_MONTH_COLS.forEach(({ key }) => {
      const c = log[key];
      if (c) {
        const cIn = Number(c.in);
        const cIdle = Number(c.idle);
        const cPog = Number(c.pog);
        payload[key] = {
          in: Number.isFinite(cIn) && cIn > 0 ? cIn : 0,
          idle: Number.isFinite(cIdle) && cIdle > 0 ? cIdle : 0,
          pog: Number.isFinite(cPog) && cPog > 0 ? cPog : 0,
        };
      } else {
        payload[key] = null;
      }
    });

    stage3.push({
      type: existingLogs.has(docId) ? "update" : "create",
      colName: "opname_logs",
      docId,
      data: payload,
    });
  });

  await commitInChunks(stage3, 6);
  totalDocs += stage3.length;

  return { totalDocs };
}

// ============================================================================
// DIRECT FIRESTORE CRUD HELPERS (OPEN ACCESS: WORKS WITH OR WITHOUT SIGN-IN)
// ============================================================================

export async function saveAccessRulesFirestore(
  user: User | null | undefined,
  rules: Record<string, Record<string, boolean>>,
): Promise<void> {
  const ownerUid = user?.uid || "public";
  const existing = await getExistingDocIds("access_rules", user);
  const ops = Object.entries(rules).map(([position, perms]) => {
    const docId = toValidDocId(position, "ROLE");
    return {
      type: existing.has(docId) ? ("update" as const) : ("create" as const),
      colName: "access_rules",
      docId,
      data: {
        doc_id: docId,
        position: clampStr(position, 100, docId),
        home: !!perms.home,
        partner: !!perms.partner,
        stock: !!perms.stock,
        pog: !!perms.pog,
        overview: !!perms.overview,
        temp: !!perms.temp,
        access: !!perms.access,
        ownerUid,
      },
    };
  });
  await commitInChunks(ops, 15);
}

export async function upsertPartnerFirestore(
  user: User | null | undefined,
  partner: {
    doc_id: string;
    partner_name: string;
    category: string;
    pic_employee_id: string | null;
    pic_name: string;
    division_group: DivisionStrict;
    province: string;
    area: string;
  },
  isCreate: boolean,
): Promise<void> {
  const ownerUid = user?.uid || "public";
  const docId = toValidDocId(partner.doc_id);
  const path = `partners/${docId}`;
  const ref = doc(db, "partners", docId);
  try {
    if (isCreate) {
      await setDoc(ref, {
        doc_id: docId,
        partner_name: clampStr(partner.partner_name, 160, docId),
        category: clampStr(partner.category, 40),
        pic_employee_id: partner.pic_employee_id ? toValidDocId(partner.pic_employee_id) : null,
        pic_name: clampStr(partner.pic_name, 120),
        division_group: toStrictDivision(partner.division_group),
        province: clampStr(partner.province, 80, "-"),
        area: clampStr(partner.area, 80, "-"),
        ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        partner_name: clampStr(partner.partner_name, 160, docId),
        category: clampStr(partner.category, 40),
        pic_employee_id: partner.pic_employee_id ? toValidDocId(partner.pic_employee_id) : null,
        pic_name: clampStr(partner.pic_name, 120),
        division_group: toStrictDivision(partner.division_group),
        province: clampStr(partner.province, 80, "-"),
        area: clampStr(partner.area, 80, "-"),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deletePartnerFirestore(docId: string): Promise<void> {
  const cleanId = toValidDocId(docId);
  const path = `partners/${cleanId}`;
  try {
    await deleteDoc(doc(db, "partners", cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function upsertEmployeeFirestore(
  user: User | null | undefined,
  emp: EmployeeFsDoc,
  isCreate: boolean,
): Promise<void> {
  const ownerUid = user?.uid || "public";
  const docId = toValidDocId(emp.doc_id);
  const path = `employees/${docId}`;
  const ref = doc(db, "employees", docId);
  const baseFields = {
    username: clampStr(emp.username, 80),
    full_name: clampStr(emp.full_name, 120, docId),
    position: clampStr(emp.position, 100, "Business Solution"),
    role_level: Math.min(5, Math.max(1, Math.round(Number(emp.role_level) || 1))),
    upline_id: emp.upline_id ? toValidDocId(emp.upline_id) : null,
    subordinate_ids: (emp.subordinate_ids || []).map((id) => toValidDocId(id)).slice(0, 200),
    access_scope_ids: (emp.access_scope_ids || []).map((id) => toValidDocId(id)).slice(0, 200),
    division_group: emp.division_group === "All" ? "All" : toStrictDivision(emp.division_group),
    province: clampStr(emp.province, 80, "-"),
    area: clampStr(emp.area, 80, "-"),
    status: emp.status === "Nonaktif" ? "Nonaktif" : "Aktif",
  };

  try {
    if (isCreate) {
      await setDoc(ref, {
        doc_id: docId,
        ...baseFields,
        ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...baseFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteEmployeeFirestore(docId: string): Promise<void> {
  const cleanId = toValidDocId(docId);
  const path = `employees/${cleanId}`;
  try {
    await deleteDoc(doc(db, "employees", cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save DR Spreadsheet upload directly to Firestore (hybrids -> partners & lots -> dr_shipments).
 */
export async function saveUploadedDrToFirestore(
  user: User | null | undefined,
  parsedRows: Array<{
    channel: string;
    lot: string;
    sku?: string;
    qty: number;
    drDate: string;
    expired: string;
    hybrid: string;
    crops: DivisionStrict;
  }>,
  currentDataset: NormalizedDataset,
): Promise<{ uploadedCount: number; createdPartners: number }> {
  const ownerUid = user?.uid || "public";
  const existingPartnersByClean = new Map<string, PartnerFsDoc>();
  const existingPartnerIds = new Set<string>();
  currentDataset.partners.forEach((p) => {
    existingPartnersByClean.set(cleanForMatch(p.partner_name), p);
    existingPartnerIds.add(toValidDocId(p.doc_id));
  });

  const existingHybridsByClean = new Map<string, HybridFsDoc>();
  const existingHybridIds = new Set<string>();
  currentDataset.hybrids.forEach((h) => {
    existingHybridsByClean.set(cleanForMatch(h.hybrid_name), h);
    existingHybridIds.add(toValidDocId(h.doc_id));
  });

  const existingLotsById = new Map<string, LotFsDoc>();
  const existingLotsByClean = new Map<string, LotFsDoc>();
  currentDataset.lots.forEach((l) => {
    const id = toValidDocId(l.doc_id);
    existingLotsById.set(id, l);
    const cl = cleanForMatch(id);
    if (cl) existingLotsByClean.set(cl, l);
  });

  const existingDrIds = new Set(currentDataset.dr_shipments.map((d) => toValidDocId(d.doc_id)));

  let nextPrtNum = currentDataset.partners.length + 1;
  let nextHybNum = currentDataset.hybrids.length + 1;
  let nextDrNum = currentDataset.dr_shipments.length + 1;
  let createdPartners = 0;

  const hybridOps: any[] = [];
  const partnerOps: any[] = [];
  const lotOps: any[] = [];
  const drOps: any[] = [];

  const createdHybridKeys = new Set<string>();
  const createdPartnerKeys = new Set<string>();
  const touchedLotIds = new Set<string>();

  for (const row of parsedRows) {
    const rawLotNo = toValidDocId(String(row.lot || "").toUpperCase(), "");
    if (!rawLotNo) continue;
    const rowSku = clampStr(row.sku, 80);

    // 1. Ensure Hybrid
    const hybName = clampStr(String(row.hybrid || "ADV808").toUpperCase(), 100, "ADV808");
    const hybKey = cleanForMatch(hybName);
    let hybDoc = existingHybridsByClean.get(hybKey);
    if (!hybDoc && !createdHybridKeys.has(hybKey)) {
      let hybId = `HYB-${String(nextHybNum++).padStart(3, "0")}`;
      while (existingHybridIds.has(hybId)) {
        hybId = `HYB-${String(nextHybNum++).padStart(3, "0")}`;
      }
      existingHybridIds.add(hybId);
      hybDoc = {
        doc_id: hybId,
        hybrid_name: hybName,
        ...(rowSku ? { sku: rowSku } : {}),
        crop_type: toStrictDivision(row.crops),
      };
      existingHybridsByClean.set(hybKey, hybDoc);
      createdHybridKeys.add(hybKey);
      hybridOps.push({
        type: "create",
        colName: "hybrids",
        docId: hybId,
        data: {
          doc_id: hybId,
          hybrid_name: packHybridNameWithSku(hybName, rowSku),
          crop_type: hybDoc.crop_type,
          ownerUid,
        },
      });
    }

    // 2. Ensure Partner
    const pName = clampStr(row.channel, 160);
    const pKey = cleanForMatch(pName);
    let pDoc = existingPartnersByClean.get(pKey);
    if (!pDoc && pKey && !createdPartnerKeys.has(pKey)) {
      let prtId = `PRT-${String(nextPrtNum++).padStart(3, "0")}`;
      while (existingPartnerIds.has(prtId)) {
        prtId = `PRT-${String(nextPrtNum++).padStart(3, "0")}`;
      }
      existingPartnerIds.add(prtId);
      pDoc = {
        doc_id: prtId,
        partner_name: pName,
        category: getValidCategory("Distributor", undefined, pName),
        pic_employee_id: null,
        pic_name: "",
        division_group: toStrictDivision(row.crops),
        province: "-",
        area: "-",
      };
      existingPartnersByClean.set(pKey, pDoc);
      createdPartnerKeys.add(pKey);
      createdPartners++;
      partnerOps.push({
        type: "create",
        colName: "partners",
        docId: prtId,
        data: {
          doc_id: prtId,
          partner_name: pDoc.partner_name,
          category: pDoc.category,
          pic_employee_id: null,
          pic_name: "",
          division_group: pDoc.division_group,
          province: "-",
          area: "-",
          ownerUid,
        },
      });
    }

    // 3. Ensure Lot
    const shippingDate = clampStr(toIsoDateStr(row.drDate), 20, "2026-01-01");
    const expDate = clampStr(toIsoDateStr(row.expired || extractExpFromLot(row.lot)), 20);
    const rawQty = Number(row.qty);
    const qtyKg = Number.isFinite(rawQty) && rawQty > 0 ? numQtySafe(rawQty) : 0;

    function numQtySafe(n: number) {
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    const cleanLotKey = cleanForMatch(rawLotNo);
    const existingLot = existingLotsById.get(rawLotNo) || existingLotsByClean.get(cleanLotKey);
    const lotNo = existingLot ? toValidDocId(existingLot.doc_id) : rawLotNo;
    const effectiveSku = rowSku || existingLot?.sku || hybDoc?.sku || "";

    if (!existingLot && !touchedLotIds.has(lotNo)) {
      const newLot: LotFsDoc = {
        doc_id: lotNo,
        hybrid_id: hybDoc ? hybDoc.doc_id : null,
        ...(effectiveSku ? { sku: effectiveSku } : {}),
        shipping_date: shippingDate,
        exp_date: expDate,
        initial_dr_kg: qtyKg,
      };
      existingLotsById.set(lotNo, newLot);
      if (cleanLotKey) existingLotsByClean.set(cleanLotKey, newLot);
      touchedLotIds.add(lotNo);
      lotOps.push({
        type: "create",
        colName: "lots",
        docId: lotNo,
        data: {
          doc_id: lotNo,
          hybrid_id: newLot.hybrid_id,
          shipping_date: shippingDate,
          exp_date: expDate,
          initial_dr_kg: qtyKg,
          ownerUid,
        },
      });
      if (effectiveSku) {
        const skuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, effectiveSku);
        if (skuOp) lotOps.push(skuOp);
      }
    } else if (existingLot && !touchedLotIds.has(lotNo)) {
      touchedLotIds.add(lotNo);
      lotOps.push({
        type: "update",
        colName: "lots",
        docId: lotNo,
        data: {
          hybrid_id: existingLot.hybrid_id || (hybDoc ? hybDoc.doc_id : null),
          shipping_date: existingLot.shipping_date || shippingDate,
          exp_date: existingLot.exp_date || expDate,
          initial_dr_kg: (existingLot.initial_dr_kg || 0) + qtyKg,
        },
      });
      if (effectiveSku) {
        const skuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, effectiveSku);
        if (skuOp) lotOps.push(skuOp);
      }
    }

    // 4. Create DR Shipment
    let drId = `DR-${String(nextDrNum++).padStart(4, "0")}`;
    while (existingDrIds.has(drId)) {
      drId = `DR-${String(nextDrNum++).padStart(4, "0")}`;
    }
    existingDrIds.add(drId);
    drOps.push({
      type: "create",
      colName: "dr_shipments",
      docId: drId,
      data: {
        doc_id: drId,
        shipping_date: shippingDate,
        partner_id: pDoc ? pDoc.doc_id : null,
        lot_no: lotNo,
        exp_date: expDate,
        shipped_qty_kg: qtyKg,
        ownerUid,
      },
    });
    if (effectiveSku) {
      const drSkuOp = buildSkuMetaOp(ownerUid, "DR", drId, effectiveSku);
      if (drSkuOp) drOps.push(drSkuOp);
    }
  }

  if (hybridOps.length > 0) await commitInChunks(hybridOps, 15);
  if (partnerOps.length > 0 || lotOps.length > 0) await commitInChunks([...partnerOps, ...lotOps], 15);
  if (drOps.length > 0) await commitInChunks(drOps, 8);

  return { uploadedCount: drOps.length, createdPartners };
}

/**
 * Persist HomeTab batch opname submission into Firestore (hybrids/lots if new + opname_logs).
 */
export async function saveBatchActivityToFirestore(
  user: User | null | undefined,
  params: {
    kioskName: string;
    checkerName: string;
    items: any[];
    currentDataset: NormalizedDataset;
  },
): Promise<void> {
  const { kioskName, checkerName, items, currentDataset } = params;
  const ownerUid = user?.uid || "public";

  const partner = currentDataset.partners.find(
    (p) => cleanForMatch(p.partner_name) === cleanForMatch(kioskName),
  );
  const checker = currentDataset.employees.find(
    (e) =>
      cleanForMatch(e.full_name) === cleanForMatch(checkerName) ||
      cleanForMatch(e.username) === cleanForMatch(checkerName),
  );

  const existingHybrids = new Map(
    currentDataset.hybrids.map((h) => [cleanForMatch(h.hybrid_name), h]),
  );
  const existingHybridIds = new Set(currentDataset.hybrids.map((h) => toValidDocId(h.doc_id)));
  const existingLots = new Set(currentDataset.lots.map((l) => toValidDocId(l.doc_id)));
  const existingLogsMap = new Map(
    currentDataset.opname_logs.map((l) => [toValidDocId(l.doc_id), l]),
  );

  let nextHybNum = currentDataset.hybrids.length + 1;
  const stage1Hybrids: any[] = [];
  const stage2Lots: any[] = [];
  const stage3Logs: any[] = [];

  for (const item of items) {
    const lotNo = toValidDocId(String(item.lot || "").toUpperCase(), "");
    if (!lotNo) continue;

    // Ensure Hybrid
    const hybName = clampStr(String(item.hybrid || "UNKNOWN").toUpperCase(), 100, "UNKNOWN");
    const hybClean = cleanForMatch(hybName);
    let hyb = existingHybrids.get(hybClean);
    if (!hyb) {
      let hybId = `HYB-${String(nextHybNum++).padStart(3, "0")}`;
      while (existingHybridIds.has(hybId)) {
        hybId = `HYB-${String(nextHybNum++).padStart(3, "0")}`;
      }
      existingHybridIds.add(hybId);
      hyb = { doc_id: hybId, hybrid_name: hybName, crop_type: toStrictDivision(item.crops) };
      existingHybrids.set(hybClean, hyb);
      stage1Hybrids.push({
        type: "create",
        colName: "hybrids",
        docId: hybId,
        data: { ...hyb, ownerUid },
      });
    }

    // Ensure Lot
    if (!existingLots.has(lotNo)) {
      existingLots.add(lotNo);
      stage2Lots.push({
        type: "create",
        colName: "lots",
        docId: lotNo,
        data: {
          doc_id: lotNo,
          hybrid_id: hyb.doc_id,
          shipping_date: clampStr(toIsoDateStr(item.drDate), 20),
          exp_date: clampStr(toIsoDateStr(item.expired || extractExpFromLot(item.lot)), 20),
          initial_dr_kg: 0,
          ownerUid,
        },
      });
    }

    // Compute Fiscal Apr->Mar monthly cells from item month values
    const logId = toValidDocId(
      `${partner ? partner.doc_id : toValidDocId(kioskName, "NO_PRT")}_${lotNo}_FY2026`,
    );
    const existingLog = existingLogsMap.get(logId);

    const monthPayload: Record<string, MonthlyOpnameCell | null> = {};
    let prev: number | null = null;
    FISCAL_MONTH_COLS.forEach(({ key }) => {
      const val = Number(item[key]);
      const hasVal = item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== "" && val > 0;
      const prevCell = existingLog?.[key];
      if (hasVal || prevCell) {
        const qty = hasVal ? Math.max(0, val) : Math.max(0, prevCell?.idle || 0);
        const inKg = prev === null ? qty : qty > prev ? qty - prev : 0;
        const pogKg = prev !== null && qty < prev ? prev - qty : 0;
        monthPayload[key] = { in: inKg, idle: qty, pog: pogKg };
        prev = qty;
      } else {
        monthPayload[key] = null;
      }
    });

    stage3Logs.push({
      type: existingLog ? "update" : "create",
      colName: "opname_logs",
      docId: logId,
      data: {
        doc_id: logId,
        partner_id: partner ? partner.doc_id : null,
        lot_no: lotNo,
        checker_id: checker ? checker.doc_id : existingLog?.checker_id || null,
        crop_year: "FY2026",
        ...monthPayload,
        ownerUid,
      },
    });
  }

  if (stage1Hybrids.length > 0) await commitInChunks(stage1Hybrids, 15);
  if (stage2Lots.length > 0) await commitInChunks(stage2Lots, 15);
  if (stage3Logs.length > 0) await commitInChunks(stage3Logs, 6);
}

/**
 * Add a single Hybrid document directly to Firestore (/hybrids/{doc_id}).
 */
export async function addHybridFirestore(
  user: User | null | undefined,
  params: {
    hybrid_name: string;
    sku?: string | null;
    crop_type: DivisionStrict;
    existingHybrids: HybridFsDoc[];
  },
): Promise<HybridFsDoc> {
  const ownerUid = user?.uid || "public";
  const cleanName = clampStr(params.hybrid_name.toUpperCase(), 100);
  if (!cleanName) throw new Error("Nama hybrid tidak boleh kosong.");
  const skuVal = clampStr(params.sku, 80);

  const existingIds = new Set(params.existingHybrids.map((h) => toValidDocId(h.doc_id)));
  let nextNum = params.existingHybrids.length + 1;
  let docId = `HYB-${String(nextNum++).padStart(3, "0")}`;
  while (existingIds.has(docId)) {
    docId = `HYB-${String(nextNum++).padStart(3, "0")}`;
  }

  const crop = toStrictDivision(params.crop_type);
  const newDoc: HybridFsDoc = {
    doc_id: docId,
    hybrid_name: cleanName,
    ...(skuVal ? { sku: skuVal } : {}),
    crop_type: crop,
  };

  try {
    await setDoc(doc(db, "hybrids", docId), {
      doc_id: docId,
      hybrid_name: packHybridNameWithSku(cleanName, skuVal),
      crop_type: crop,
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `hybrids/${docId}`);
  }
}

/**
 * Add a single Lot document directly to Firestore (/lots/{lot_no}).
 * Automatically creates a new hybrid atomically in the same batch if hybrid_name is supplied.
 */
export async function addLotFirestore(
  user: User | null | undefined,
  params: {
    lot_no: string;
    hybrid_id: string | null;
    sku?: string | null;
    new_hybrid_name?: string;
    crop_type?: DivisionStrict;
    shipping_date: string;
    exp_date: string;
    initial_dr_kg: number;
    existingHybrids: HybridFsDoc[];
    existingLots?: LotFsDoc[];
  },
): Promise<LotFsDoc> {
  const ownerUid = user?.uid || "public";
  const lotNo = toValidDocId(String(params.lot_no || "").toUpperCase(), "");
  if (!lotNo) throw new Error("Nomor Lot tidak boleh kosong.");
  const skuVal = clampStr(params.sku, 80);

  const ops: any[] = [];
  let finalHybridId = params.hybrid_id ? toValidDocId(params.hybrid_id) : null;

  if (!finalHybridId && params.new_hybrid_name?.trim()) {
    const hybName = clampStr(params.new_hybrid_name.toUpperCase(), 100);
    const existing = params.existingHybrids.find(
      (h) => cleanForMatch(h.hybrid_name) === cleanForMatch(hybName),
    );
    if (existing) {
      finalHybridId = existing.doc_id;
    } else {
      const existingIds = new Set(params.existingHybrids.map((h) => toValidDocId(h.doc_id)));
      let nextNum = params.existingHybrids.length + 1;
      let hybId = `HYB-${String(nextNum++).padStart(3, "0")}`;
      while (existingIds.has(hybId)) {
        hybId = `HYB-${String(nextNum++).padStart(3, "0")}`;
      }
      finalHybridId = hybId;
      ops.push({
        type: "create" as const,
        colName: "hybrids",
        docId: hybId,
        data: {
          doc_id: hybId,
          hybrid_name: packHybridNameWithSku(hybName, skuVal),
          crop_type: toStrictDivision(params.crop_type),
          ownerUid,
        },
      });
    }
  }

  const numDr = Number(params.initial_dr_kg);
  const newLot: LotFsDoc = {
    doc_id: lotNo,
    hybrid_id: finalHybridId,
    ...(skuVal ? { sku: skuVal } : {}),
    shipping_date: clampStr(toIsoDateStr(params.shipping_date), 20),
    exp_date: clampStr(toIsoDateStr(params.exp_date || extractExpFromLot(lotNo)), 20),
    initial_dr_kg: Number.isFinite(numDr) && numDr >= 0 ? numDr : 0,
  };

  const existingLot = (params.existingLots || []).find((l) => toValidDocId(l.doc_id) === lotNo);
  ops.push({
    type: (existingLot ? "update" : "create") as "create" | "update",
    colName: "lots",
    docId: lotNo,
    data: {
      doc_id: lotNo,
      hybrid_id: newLot.hybrid_id,
      shipping_date: newLot.shipping_date,
      exp_date: newLot.exp_date,
      initial_dr_kg: newLot.initial_dr_kg,
      ownerUid,
    },
  });
  const lotSkuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, skuVal);
  if (lotSkuOp) ops.push(lotSkuOp);

  await commitInChunks(ops, 15);
  return newLot;
}

/**
 * Add a single DR Shipment document directly to Firestore (/dr_shipments/{doc_id}).
 * Atomically ensures referenced /lots/{lot_no} exists so existsAfter() succeeds.
 */
export async function addDrShipmentFirestore(
  user: User | null | undefined,
  params: {
    shipping_date: string;
    partner_id: string | null;
    lot_no: string;
    sku?: string | null;
    exp_date: string;
    shipped_qty_kg: number;
    hybrid_id?: string | null;
    existingLots: LotFsDoc[];
    existingDrShipments: DrShipmentFsDoc[];
  },
): Promise<DrShipmentFsDoc> {
  const ownerUid = user?.uid || "public";
  const lotNo = toValidDocId(String(params.lot_no || "").toUpperCase(), "");
  if (!lotNo) throw new Error("Nomor Lot wajib diisi.");
  const skuVal = clampStr(params.sku, 80);

  const shippingDate = clampStr(
    toIsoDateStr(params.shipping_date) || new Date().toISOString().slice(0, 10),
    20,
    "2026-01-01",
  );
  const expDate = clampStr(toIsoDateStr(params.exp_date || extractExpFromLot(lotNo)), 20);
  const numQty = Number(params.shipped_qty_kg);
  const qtyKg = Number.isFinite(numQty) && numQty >= 0 ? numQty : 0;

  const existingLot = params.existingLots.find((l) => toValidDocId(l.doc_id) === lotNo);
  const existingDrIds = new Set(params.existingDrShipments.map((d) => toValidDocId(d.doc_id)));
  let nextDrNum = params.existingDrShipments.length + 1;
  let drId = `DR-${String(nextDrNum++).padStart(4, "0")}`;
  while (existingDrIds.has(drId)) {
    drId = `DR-${String(nextDrNum++).padStart(4, "0")}`;
  }

  const ops: any[] = [];
  if (!existingLot) {
    ops.push({
      type: "create" as const,
      colName: "lots",
      docId: lotNo,
      data: {
        doc_id: lotNo,
        hybrid_id: params.hybrid_id ? toValidDocId(params.hybrid_id) : null,
        shipping_date: shippingDate,
        exp_date: expDate,
        initial_dr_kg: qtyKg,
        ownerUid,
      },
    });
  } else {
    ops.push({
      type: "update" as const,
      colName: "lots",
      docId: lotNo,
      data: {
        initial_dr_kg: (existingLot.initial_dr_kg || 0) + qtyKg,
      },
    });
  }
  if (skuVal) {
    const lotSkuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, skuVal);
    if (lotSkuOp) ops.push(lotSkuOp);
  }

  const newDr: DrShipmentFsDoc = {
    doc_id: drId,
    shipping_date: shippingDate,
    partner_id: params.partner_id ? toValidDocId(params.partner_id) : null,
    lot_no: lotNo,
    ...(skuVal ? { sku: skuVal } : {}),
    exp_date: expDate,
    shipped_qty_kg: qtyKg,
  };

  ops.push({
    type: "create" as const,
    colName: "dr_shipments",
    docId: drId,
    data: {
      doc_id: drId,
      shipping_date: shippingDate,
      partner_id: newDr.partner_id,
      lot_no: lotNo,
      exp_date: expDate,
      shipped_qty_kg: qtyKg,
      ownerUid,
    },
  });
  if (skuVal) {
    const drSkuOp = buildSkuMetaOp(ownerUid, "DR", drId, skuVal);
    if (drSkuOp) ops.push(drSkuOp);
  }

  await commitInChunks(ops, 10);
  return newDr;
}

/**
 * Add or update a single Opname Log document in Firestore (/opname_logs/{doc_id}).
 */
export async function addOpnameLogFirestore(
  user: User | null | undefined,
  params: {
    partner_id: string | null;
    lot_no: string;
    sku?: string | null;
    checker_id: string | null;
    crop_year: string;
    monthKey: (typeof FISCAL_MONTH_COLS)[number]["key"];
    inKg: number;
    idleKg: number;
    pogKg: number;
    existingLots: LotFsDoc[];
    existingLogs: OpnameLogFsDoc[];
  },
): Promise<void> {
  const ownerUid = user?.uid || "public";
  const lotNo = toValidDocId(String(params.lot_no || "").toUpperCase(), "");
  if (!lotNo) throw new Error("Nomor Lot wajib diisi.");
  const skuVal = clampStr(params.sku, 80);

  const partnerId = params.partner_id ? toValidDocId(params.partner_id) : null;
  const checkerId = params.checker_id ? toValidDocId(params.checker_id) : null;
  const cropYear = clampStr(params.crop_year || "FY2026", 12, "FY2026");
  const logId = toValidDocId(`${partnerId || "NO_PRT"}_${lotNo}_${cropYear}`);

  const cell: MonthlyOpnameCell = {
    in: Math.max(0, Number(params.inKg) || 0),
    idle: Math.max(0, Number(params.idleKg) || 0),
    pog: Math.max(0, Number(params.pogKg) || 0),
  };

  const existingLot = params.existingLots.find((l) => toValidDocId(l.doc_id) === lotNo);
  const existingLog = params.existingLogs.find((l) => toValidDocId(l.doc_id) === logId);

  const ops: any[] = [];
  if (!existingLot) {
    ops.push({
      type: "create" as const,
      colName: "lots",
      docId: lotNo,
      data: {
        doc_id: lotNo,
        hybrid_id: null,
        shipping_date: "",
        exp_date: clampStr(toIsoDateStr(extractExpFromLot(lotNo)), 20),
        initial_dr_kg: 0,
        ownerUid,
      },
    });
  }
  if (skuVal) {
    const lotSkuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, skuVal);
    if (lotSkuOp) ops.push(lotSkuOp);
  }

  if (existingLog) {
    ops.push({
      type: "update" as const,
      colName: "opname_logs",
      docId: logId,
      data: {
        partner_id: partnerId,
        lot_no: lotNo,
        checker_id: checkerId ?? existingLog.checker_id ?? null,
        crop_year: cropYear,
        [params.monthKey]: cell,
      },
    });
  } else {
    const payload: Record<string, any> = {
      doc_id: logId,
      partner_id: partnerId,
      lot_no: lotNo,
      checker_id: checkerId,
      crop_year: cropYear,
      ownerUid,
    };
    FISCAL_MONTH_COLS.forEach(({ key }) => {
      payload[key] = key === params.monthKey ? cell : null;
    });
    ops.push({
      type: "create" as const,
      colName: "opname_logs",
      docId: logId,
      data: payload,
    });
  }
  if (skuVal) {
    const logSkuOp = buildSkuMetaOp(ownerUid, "LOG", logId, skuVal);
    if (logSkuOp) ops.push(logSkuOp);
  }

  await commitInChunks(ops, 8);
}

/**
 * Ensure Super User employee `adityahead` (Business Analyst, Lv.5) exists in Firestore /employees.
 */
export async function ensureSuperUserAdityaFirestore(
  user: User | null | undefined,
  existingEmployees: EmployeeFsDoc[],
): Promise<boolean> {
  const alreadyExists = existingEmployees.some(
    (e) =>
      cleanForMatch(e.username) === "adityahead" ||
      e.doc_id === "EMP-ADITYAHEAD",
  );
  if (alreadyExists) return false;

  const existingIds = new Set(existingEmployees.map((e) => e.doc_id));
  let docId = "EMP-001";
  if (existingIds.has(docId)) {
    docId = "EMP-ADITYAHEAD";
  }

  const subIds = existingEmployees
    .filter((e) => e.doc_id !== docId)
    .map((e) => toValidDocId(e.doc_id))
    .slice(0, 200);

  await upsertEmployeeFirestore(
    user,
    {
      doc_id: docId,
      username: "adityahead",
      full_name: "Aditya Wiratama",
      position: "Business Analyst",
      role_level: 5,
      upline_id: null,
      subordinate_ids: subIds,
      access_scope_ids: [docId, ...subIds].slice(0, 200),
      division_group: "All",
      province: "Head Office",
      area: "Head Office",
      status: "Aktif",
    },
    true,
  );
  return true;
}

/**
 * Bulk add multiple Hybrid rows into Firestore /hybrids.
 */
export async function bulkAddHybridsFirestore(
  user: User | null | undefined,
  rows: Array<{ hybrid_name: string; sku?: string | null; crop_type: DivisionStrict }>,
  existingHybrids: HybridFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingIds = new Set(existingHybrids.map((h) => toValidDocId(h.doc_id)));
  const existingByPair = new Map(
    existingHybrids.map((h) => [
      `${cleanForMatch(h.hybrid_name)}__${cleanForMatch(h.sku || "")}`,
      h,
    ]),
  );

  let nextNum = existingHybrids.length + 1;
  const opsMap = new Map<string, any>();

  for (const r of rows) {
    const cleanName = clampStr(String(r.hybrid_name || "").split(SKU_DELIM)[0].trim().toUpperCase(), 100);
    if (!cleanName) continue;
    const skuVal = clampStr(r.sku, 80);
    const pairKey = `${cleanForMatch(cleanName)}__${cleanForMatch(skuVal)}`;
    const crop = toStrictDivision(r.crop_type);

    const existingExact = existingByPair.get(pairKey);
    if (existingExact) {
      opsMap.set(existingExact.doc_id, {
        type: "update" as const,
        colName: "hybrids",
        docId: existingExact.doc_id,
        data: {
          hybrid_name: packHybridNameWithSku(cleanName, skuVal),
          crop_type: crop,
        },
      });
      continue;
    }

    let docId = `HYB-${String(nextNum++).padStart(3, "0")}`;
    while (existingIds.has(docId)) {
      docId = `HYB-${String(nextNum++).padStart(3, "0")}`;
    }
    existingIds.add(docId);

    const newHybrid: HybridFsDoc = {
      doc_id: docId,
      hybrid_name: cleanName,
      ...(skuVal ? { sku: skuVal } : {}),
      crop_type: crop,
    };
    existingByPair.set(pairKey, newHybrid);

    opsMap.set(docId, {
      type: "create" as const,
      colName: "hybrids",
      docId,
      data: {
        doc_id: docId,
        hybrid_name: packHybridNameWithSku(cleanName, skuVal),
        crop_type: crop,
        ownerUid,
      },
    });
  }

  const ops = Array.from(opsMap.values());
  if (ops.length === 0) throw new Error("Isi minimal 1 nama hybrid yang valid.");
  await commitInChunks(ops, 15);
  return ops.length;
}

/**
 * Bulk add or update multiple Lot rows into Firestore /lots.
 */
export async function bulkAddLotsFirestore(
  user: User | null | undefined,
  rows: Array<{
    lot_no: string;
    hybrid_id: string | null;
    sku?: string | null;
    shipping_date: string;
    exp_date: string;
    initial_dr_kg: number;
  }>,
  existingLots: LotFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingLotMap = new Map(existingLots.map((l) => [toValidDocId(l.doc_id), l]));
  const opsMap = new Map<string, any>();
  const skuOpsMap = new Map<string, any>();

  for (const r of rows) {
    const lotNo = toValidDocId(String(r.lot_no || "").toUpperCase(), "");
    if (!lotNo) continue;
    const numDr = Number(r.initial_dr_kg);
    const existingLot = existingLotMap.get(lotNo);
    const isUpdate = Boolean(existingLot);
    const skuVal = clampStr(r.sku, 80);
    opsMap.set(lotNo, {
      type: (isUpdate ? "update" : "create") as "create" | "update",
      colName: "lots",
      docId: lotNo,
      data: {
        doc_id: lotNo,
        hybrid_id: r.hybrid_id ? toValidDocId(r.hybrid_id) : null,
        shipping_date: clampStr(toIsoDateStr(r.shipping_date), 20),
        exp_date: clampStr(toIsoDateStr(r.exp_date || extractExpFromLot(lotNo)), 20),
        initial_dr_kg: Number.isFinite(numDr) && numDr >= 0 ? numDr : 0,
        ownerUid,
      },
    });
    const skuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, skuVal);
    if (skuOp) skuOpsMap.set(skuOp.docId, skuOp);
  }

  const ops = [...Array.from(opsMap.values()), ...Array.from(skuOpsMap.values())];
  if (opsMap.size === 0) throw new Error("Isi minimal 1 nomor Lot yang valid.");
  await commitInChunks(ops, 15);
  return opsMap.size;
}

/**
 * Bulk add multiple DR Shipment rows into Firestore /dr_shipments.
 * Stage 1 ensures all referenced /lots/{lot_no} exist/updated, Stage 2 writes DR rows.
 */
export async function bulkAddDrShipmentsFirestore(
  user: User | null | undefined,
  rows: Array<{
    shipping_date: string;
    partner_id: string | null;
    lot_no: string;
    sku?: string | null;
    exp_date: string;
    shipped_qty_kg: number;
  }>,
  existingLots: LotFsDoc[],
  existingDrShipments: DrShipmentFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingLotMap = new Map(existingLots.map((l) => [toValidDocId(l.doc_id), l]));
  const existingDrIds = new Set(existingDrShipments.map((d) => toValidDocId(d.doc_id)));
  let nextDrNum = existingDrShipments.length + 1;

  const lotDelta = new Map<
    string,
    {
      exists: boolean;
      baseKg: number;
      addKg: number;
      shippingDate: string;
      expDate: string;
      hybridId: string | null;
      sku: string;
    }
  >();
  const drOps: any[] = [];
  const skuOpsMap = new Map<string, any>();

  for (const r of rows) {
    const lotNo = toValidDocId(String(r.lot_no || "").toUpperCase(), "");
    if (!lotNo) continue;

    const shippingDate = clampStr(
      toIsoDateStr(r.shipping_date) || new Date().toISOString().slice(0, 10),
      20,
      "2026-01-01",
    );
    const expDate = clampStr(toIsoDateStr(r.exp_date || extractExpFromLot(lotNo)), 20);
    const numQty = Number(r.shipped_qty_kg);
    const qtyKg = Number.isFinite(numQty) && numQty >= 0 ? numQty : 0;
    const skuVal = clampStr(r.sku, 80);

    const existingLot = existingLotMap.get(lotNo);
    const prevPending = lotDelta.get(lotNo);
    if (prevPending) {
      prevPending.addKg += qtyKg;
      if (!prevPending.sku && skuVal) prevPending.sku = skuVal;
    } else {
      lotDelta.set(lotNo, {
        exists: Boolean(existingLot),
        baseKg: existingLot?.initial_dr_kg || 0,
        addKg: qtyKg,
        shippingDate: existingLot?.shipping_date || shippingDate,
        expDate: existingLot?.exp_date || expDate,
        hybridId: existingLot?.hybrid_id || null,
        sku: clampStr(existingLot?.sku || skuVal, 80),
      });
    }

    let drId = `DR-${String(nextDrNum++).padStart(4, "0")}`;
    while (existingDrIds.has(drId)) {
      drId = `DR-${String(nextDrNum++).padStart(4, "0")}`;
    }
    existingDrIds.add(drId);

    drOps.push({
      type: "create" as const,
      colName: "dr_shipments",
      docId: drId,
      data: {
        doc_id: drId,
        shipping_date: shippingDate,
        partner_id: r.partner_id ? toValidDocId(r.partner_id) : null,
        lot_no: lotNo,
        exp_date: expDate,
        shipped_qty_kg: qtyKg,
        ownerUid,
      },
    });
    if (skuVal) {
      const drSkuOp = buildSkuMetaOp(ownerUid, "DR", drId, skuVal);
      if (drSkuOp) skuOpsMap.set(drSkuOp.docId, drSkuOp);
    }
  }

  if (drOps.length === 0) throw new Error("Isi minimal 1 baris DR Shipment dengan Nomor Lot.");

  const lotOps: any[] = [];
  lotDelta.forEach((info, lotNo) => {
    lotOps.push({
      type: (info.exists ? "update" : "create") as "create" | "update",
      colName: "lots",
      docId: lotNo,
      data: {
        doc_id: lotNo,
        hybrid_id: info.hybridId,
        shipping_date: info.shippingDate,
        exp_date: info.expDate,
        initial_dr_kg: info.baseKg + info.addKg,
        ownerUid,
      },
    });
    if (info.sku) {
      const lotSkuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, info.sku);
      if (lotSkuOp) skuOpsMap.set(lotSkuOp.docId, lotSkuOp);
    }
  });

  if (lotOps.length > 0) await commitInChunks(lotOps, 15);
  await commitInChunks(drOps, 8);
  if (skuOpsMap.size > 0) await commitInChunks(Array.from(skuOpsMap.values()), 15);
  return drOps.length;
}

/**
 * Bulk add or update multiple Opname Log rows (supports multiple monthly columns per row) in Firestore.
 */
export async function bulkAddOpnameLogsFirestore(
  user: User | null | undefined,
  rows: Array<{
    partner_id: string | null;
    lot_no: string;
    sku?: string | null;
    checker_id: string | null;
    crop_year: string;
    months: Partial<Record<(typeof FISCAL_MONTH_COLS)[number]["key"], MonthlyOpnameCell | null>>;
  }>,
  existingLots: LotFsDoc[],
  existingLogs: OpnameLogFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingLotIds = new Set(existingLots.map((l) => toValidDocId(l.doc_id)));
  const existingLogsMap = new Map(existingLogs.map((l) => [toValidDocId(l.doc_id), l]));

  const newLotOpsMap = new Map<string, any>();
  const logOpsMap = new Map<string, any>();
  const skuOpsMap = new Map<string, any>();

  for (const r of rows) {
    const lotNo = toValidDocId(String(r.lot_no || "").toUpperCase(), "");
    if (!lotNo) continue;
    const skuVal = clampStr(r.sku, 80);

    if (!existingLotIds.has(lotNo) && !newLotOpsMap.has(lotNo)) {
      newLotOpsMap.set(lotNo, {
        type: "create" as const,
        colName: "lots",
        docId: lotNo,
        data: {
          doc_id: lotNo,
          hybrid_id: null,
          shipping_date: "",
          exp_date: clampStr(toIsoDateStr(extractExpFromLot(lotNo)), 20),
          initial_dr_kg: 0,
          ownerUid,
        },
      });
    }
    if (skuVal) {
      const lotSkuOp = buildSkuMetaOp(ownerUid, "LOT", lotNo, skuVal);
      if (lotSkuOp) skuOpsMap.set(lotSkuOp.docId, lotSkuOp);
    }

    const partnerId = r.partner_id ? toValidDocId(r.partner_id) : null;
    const checkerId = r.checker_id ? toValidDocId(r.checker_id) : null;
    const cropYear = clampStr(r.crop_year || "FY2026", 12, "FY2026");
    const logId = toValidDocId(`${partnerId || "NO_PRT"}_${lotNo}_${cropYear}`);
    const existingLog = existingLogsMap.get(logId);

    if (existingLog) {
      const updateData: Record<string, any> = {
        partner_id: partnerId,
        lot_no: lotNo,
        checker_id: checkerId ?? existingLog.checker_id ?? null,
        crop_year: cropYear,
      };
      FISCAL_MONTH_COLS.forEach(({ key }) => {
        const cell = r.months[key];
        if (cell) {
          updateData[key] = {
            in: Math.max(0, Number(cell.in) || 0),
            idle: Math.max(0, Number(cell.idle) || 0),
            pog: Math.max(0, Number(cell.pog) || 0),
          };
        }
      });
      logOpsMap.set(logId, {
        type: "update" as const,
        colName: "opname_logs",
        docId: logId,
        data: updateData,
      });
    } else {
      const createData: Record<string, any> = {
        doc_id: logId,
        partner_id: partnerId,
        lot_no: lotNo,
        checker_id: checkerId,
        crop_year: cropYear,
        ownerUid,
      };
      FISCAL_MONTH_COLS.forEach(({ key }) => {
        const cell = r.months[key];
        createData[key] = cell
          ? {
              in: Math.max(0, Number(cell.in) || 0),
              idle: Math.max(0, Number(cell.idle) || 0),
              pog: Math.max(0, Number(cell.pog) || 0),
            }
          : null;
      });
      logOpsMap.set(logId, {
        type: "create" as const,
        colName: "opname_logs",
        docId: logId,
        data: createData,
      });
    }
    if (skuVal) {
      const logSkuOp = buildSkuMetaOp(ownerUid, "LOG", logId, skuVal);
      if (logSkuOp) skuOpsMap.set(logSkuOp.docId, logSkuOp);
    }
  }

  const lotOps = Array.from(newLotOpsMap.values());
  const logOps = Array.from(logOpsMap.values());
  if (logOps.length === 0) throw new Error("Isi minimal 1 baris Opname Log dengan Nomor Lot.");

  if (lotOps.length > 0) await commitInChunks(lotOps, 15);
  await commitInChunks(logOps, 6);
  if (skuOpsMap.size > 0) await commitInChunks(Array.from(skuOpsMap.values()), 15);
  return logOps.length;
}

/**
 * Bulk add multiple Partner rows directly into Firestore /partners.
 */
export async function bulkAddPartnersFirestore(
  user: User | null | undefined,
  rows: Array<{
    partner_name: string;
    category: string;
    pic_employee_id: string | null;
    division_group: DivisionStrict;
    province: string;
    area: string;
  }>,
  existingPartners: PartnerFsDoc[],
  existingEmployees: EmployeeFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingIds = new Set(existingPartners.map((p) => toValidDocId(p.doc_id)));
  const empById = new Map(existingEmployees.map((e) => [toValidDocId(e.doc_id), e]));
  let nextNum = existingPartners.length + 1;
  const ops: any[] = [];

  for (const r of rows) {
    const partnerName = clampStr(r.partner_name, 160);
    if (!partnerName) continue;

    let docId = `PRT-${String(nextNum++).padStart(3, "0")}`;
    while (existingIds.has(docId)) {
      docId = `PRT-${String(nextNum++).padStart(3, "0")}`;
    }
    existingIds.add(docId);

    const picId = r.pic_employee_id ? toValidDocId(r.pic_employee_id) : null;
    const picEmp = picId ? empById.get(picId) : undefined;
    ops.push({
      type: "create" as const,
      colName: "partners",
      docId,
      data: {
        doc_id: docId,
        partner_name: partnerName,
        category: clampStr(r.category || "R1", 40),
        pic_employee_id: picId,
        pic_name: clampStr(picEmp?.full_name || "", 120),
        division_group: toStrictDivision(r.division_group),
        province: clampStr(r.province, 80, "-"),
        area: clampStr(r.area || r.province, 80, "-"),
        ownerUid,
      },
    });
  }

  if (ops.length === 0) throw new Error("Isi minimal 1 Nama Partner.");
  await commitInChunks(ops, 15);
  return ops.length;
}

/**
 * Bulk add multiple Employee rows directly into Firestore /employees.
 */
export async function bulkAddEmployeesFirestore(
  user: User | null | undefined,
  rows: Array<{
    username: string;
    full_name: string;
    position: string;
    role_level: number;
    upline_id: string | null;
    division_group: DivisionStrict | "All";
    province: string;
    area: string;
    password?: string;
  }>,
  existingEmployees: EmployeeFsDoc[],
): Promise<Array<{ doc_id: string; username: string; password: string }>> {
  const ownerUid = user?.uid || "public";
  const existingIds = new Set(existingEmployees.map((e) => toValidDocId(e.doc_id)));
  let nextNum = existingEmployees.length + 1;
  const ops: any[] = [];
  const createdCreds: Array<{ doc_id: string; username: string; password: string }> = [];

  for (const r of rows) {
    const fullName = clampStr(r.full_name, 120);
    if (!fullName) continue;

    let docId = `EMP-${String(nextNum++).padStart(3, "0")}`;
    while (existingIds.has(docId)) {
      docId = `EMP-${String(nextNum++).padStart(3, "0")}`;
    }
    existingIds.add(docId);

    const username = clampStr(
      (r.username || fullName.replace(/\s+/g, "").toLowerCase()).toLowerCase(),
      80,
    );
    const divGroup = r.division_group === "All" ? "All" : toStrictDivision(r.division_group);
    const roleLevel = Math.min(5, Math.max(1, Math.round(Number(r.role_level) || 1)));

    ops.push({
      type: "create" as const,
      colName: "employees",
      docId,
      data: {
        doc_id: docId,
        username,
        full_name: fullName,
        position: clampStr(r.position || "Business Solution", 100, "Business Solution"),
        role_level: roleLevel,
        upline_id: r.upline_id ? toValidDocId(r.upline_id) : null,
        subordinate_ids: [],
        access_scope_ids: [docId],
        division_group: divGroup,
        province: clampStr(r.province, 80, "-"),
        area: clampStr(r.area || r.province, 80, "-"),
        status: "Aktif",
        ownerUid,
      },
    });
    createdCreds.push({
      doc_id: docId,
      username,
      password: String(r.password || "123"),
    });
  }

  if (ops.length === 0) throw new Error("Isi minimal 1 Nama Lengkap Employee.");
  await commitInChunks(ops, 15);
  return createdCreds;
}

/**
 * Bulk delete documents from any of the 6 operational collections in Firestore.
 */
export async function bulkDeleteCollectionDocsFirestore(
  colName: "opname_logs" | "dr_shipments" | "lots" | "hybrids" | "partners" | "employees",
  docIds: string[],
): Promise<number> {
  const uniqueIds = Array.from(
    new Set(docIds.map((id) => toValidDocId(id, "")).filter(Boolean)),
  );
  if (uniqueIds.length === 0) throw new Error("Tidak ada dokumen valid untuk dihapus.");

  const ops: any[] = uniqueIds.map((docId) => ({
    type: "delete" as const,
    colName,
    docId,
  }));

  if (colName === "lots" || colName === "dr_shipments" || colName === "opname_logs") {
    const prefix = colName === "lots" ? "LOT" : colName === "dr_shipments" ? "DR" : "LOG";
    uniqueIds.forEach((docId) => {
      const skuOp = buildSkuMetaOp("public", prefix, docId, "");
      if (skuOp) ops.push(skuOp);
    });
  }

  await commitInChunks(ops, 15);
  return uniqueIds.length;
}

/**
 * Bulk update existing Hybrid documents in Firestore /hybrids.
 */
export async function bulkUpdateHybridsFirestore(
  rows: Array<{ doc_id: string; hybrid_name: string; sku?: string | null; hadSku?: boolean; crop_type: DivisionStrict }>,
): Promise<number> {
  const ops = rows
    .filter((r) => toValidDocId(r.doc_id, "") && clampStr(r.hybrid_name, 100))
    .map((r) => {
      const skuVal = clampStr(r.sku, 80);
      return {
        type: "update" as const,
        colName: "hybrids",
        docId: toValidDocId(r.doc_id),
        data: {
          hybrid_name: packHybridNameWithSku(r.hybrid_name, skuVal),
          crop_type: toStrictDivision(r.crop_type),
        },
      };
    });

  if (ops.length === 0) throw new Error("Isi nama hybrid yang valid untuk disimpan.");
  await commitInChunks(ops, 15);
  return ops.length;
}

/**
 * Bulk update existing Lot documents in Firestore /lots.
 */
export async function bulkUpdateLotsFirestore(
  rows: Array<{
    doc_id: string;
    hybrid_id: string | null;
    sku?: string | null;
    hadSku?: boolean;
    shipping_date: string;
    exp_date: string;
    initial_dr_kg: number;
  }>,
): Promise<number> {
  const ops: any[] = [];
  const skuOps: any[] = [];

  rows
    .filter((r) => toValidDocId(r.doc_id, ""))
    .forEach((r) => {
      const lotId = toValidDocId(r.doc_id);
      const numDr = Number(r.initial_dr_kg);
      const skuVal = clampStr(r.sku, 80);
      ops.push({
        type: "update" as const,
        colName: "lots",
        docId: lotId,
        data: {
          hybrid_id: r.hybrid_id ? toValidDocId(r.hybrid_id) : null,
          shipping_date: clampStr(toIsoDateStr(r.shipping_date), 20),
          exp_date: clampStr(toIsoDateStr(r.exp_date || extractExpFromLot(lotId)), 20),
          initial_dr_kg: Number.isFinite(numDr) && numDr >= 0 ? numDr : 0,
        },
      });
      const skuOp = buildSkuMetaOp("public", "LOT", lotId, skuVal);
      if (skuOp) skuOps.push(skuOp);
    });

  if (ops.length === 0) throw new Error("Tidak ada data Lot valid untuk diperbarui.");
  await commitInChunks([...ops, ...skuOps], 15);
  return ops.length;
}

/**
 * Bulk update existing DR Shipment documents in Firestore /dr_shipments.
 */
export async function bulkUpdateDrShipmentsFirestore(
  user: User | null | undefined,
  rows: Array<{
    doc_id: string;
    shipping_date: string;
    partner_id: string | null;
    lot_no: string;
    sku?: string | null;
    hadSku?: boolean;
    exp_date: string;
    shipped_qty_kg: number;
  }>,
  existingLots: LotFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingLotIds = new Set(existingLots.map((l) => toValidDocId(l.doc_id)));
  const newLotOps = new Map<string, any>();
  const drOps: any[] = [];
  const skuOpsMap = new Map<string, any>();

  for (const r of rows) {
    const docId = toValidDocId(r.doc_id, "");
    const lotNo = toValidDocId(String(r.lot_no || "").toUpperCase(), "");
    if (!docId || !lotNo) continue;

    const shippingDate = clampStr(
      toIsoDateStr(r.shipping_date) || new Date().toISOString().slice(0, 10),
      20,
      "2026-01-01",
    );
    const expDate = clampStr(toIsoDateStr(r.exp_date || extractExpFromLot(lotNo)), 20);
    const numQty = Number(r.shipped_qty_kg);
    const qtyKg = Number.isFinite(numQty) && numQty >= 0 ? numQty : 0;
    const skuVal = clampStr(r.sku, 80);

    if (!existingLotIds.has(lotNo) && !newLotOps.has(lotNo)) {
      newLotOps.set(lotNo, {
        type: "create" as const,
        colName: "lots",
        docId: lotNo,
        data: {
          doc_id: lotNo,
          hybrid_id: null,
          shipping_date: shippingDate,
          exp_date: expDate,
          initial_dr_kg: qtyKg,
          ownerUid,
        },
      });
    }

    drOps.push({
      type: "update" as const,
      colName: "dr_shipments",
      docId,
      data: {
        shipping_date: shippingDate,
        partner_id: r.partner_id ? toValidDocId(r.partner_id) : null,
        lot_no: lotNo,
        exp_date: expDate,
        shipped_qty_kg: qtyKg,
      },
    });
    const drSkuOp = buildSkuMetaOp(ownerUid, "DR", docId, skuVal);
    if (drSkuOp) skuOpsMap.set(drSkuOp.docId, drSkuOp);
  }

  if (drOps.length === 0) throw new Error("Nomor Lot wajib diisi pada DR Shipment yang diedit.");
  if (newLotOps.size > 0) await commitInChunks(Array.from(newLotOps.values()), 15);
  await commitInChunks(drOps, 15);
  if (skuOpsMap.size > 0) await commitInChunks(Array.from(skuOpsMap.values()), 15);
  return drOps.length;
}

/**
 * Bulk update existing Opname Log documents in Firestore /opname_logs.
 */
export async function bulkUpdateOpnameLogsFirestore(
  user: User | null | undefined,
  rows: Array<{
    doc_id: string;
    partner_id: string | null;
    lot_no: string;
    sku?: string | null;
    hadSku?: boolean;
    checker_id: string | null;
    crop_year: string;
    months: Partial<Record<(typeof FISCAL_MONTH_COLS)[number]["key"], MonthlyOpnameCell | null>>;
  }>,
  existingLots: LotFsDoc[],
): Promise<number> {
  const ownerUid = user?.uid || "public";
  const existingLotIds = new Set(existingLots.map((l) => toValidDocId(l.doc_id)));
  const newLotOps = new Map<string, any>();
  const logOps: any[] = [];
  const skuOpsMap = new Map<string, any>();

  for (const r of rows) {
    const docId = toValidDocId(r.doc_id, "");
    const lotNo = toValidDocId(String(r.lot_no || "").toUpperCase(), "");
    if (!docId || !lotNo) continue;
    const skuVal = clampStr(r.sku, 80);

    if (!existingLotIds.has(lotNo) && !newLotOps.has(lotNo)) {
      newLotOps.set(lotNo, {
        type: "create" as const,
        colName: "lots",
        docId: lotNo,
        data: {
          doc_id: lotNo,
          hybrid_id: null,
          shipping_date: "",
          exp_date: clampStr(toIsoDateStr(extractExpFromLot(lotNo)), 20),
          initial_dr_kg: 0,
          ownerUid,
        },
      });
    }

    const updateData: Record<string, any> = {
      partner_id: r.partner_id ? toValidDocId(r.partner_id) : null,
      lot_no: lotNo,
      checker_id: r.checker_id ? toValidDocId(r.checker_id) : null,
      crop_year: clampStr(r.crop_year || "FY2026", 12, "FY2026"),
    };

    FISCAL_MONTH_COLS.forEach(({ key }) => {
      const cell = r.months[key];
      updateData[key] = cell
        ? {
            in: Math.max(0, Number(cell.in) || 0),
            idle: Math.max(0, Number(cell.idle) || 0),
            pog: Math.max(0, Number(cell.pog) || 0),
          }
        : null;
    });

    logOps.push({
      type: "update" as const,
      colName: "opname_logs",
      docId,
      data: updateData,
    });
    const logSkuOp = buildSkuMetaOp(ownerUid, "LOG", docId, skuVal);
    if (logSkuOp) skuOpsMap.set(logSkuOp.docId, logSkuOp);
  }

  if (logOps.length === 0) throw new Error("Nomor Lot wajib diisi pada Opname Log yang diedit.");
  if (newLotOps.size > 0) await commitInChunks(Array.from(newLotOps.values()), 15);
  await commitInChunks(logOps, 10);
  if (skuOpsMap.size > 0) await commitInChunks(Array.from(skuOpsMap.values()), 15);
  return logOps.length;
}

/**
 * Bulk update existing Partner documents in Firestore /partners.
 */
export async function bulkUpdatePartnersFirestore(
  rows: Array<{
    doc_id: string;
    partner_name: string;
    category: string;
    pic_employee_id: string | null;
    division_group: DivisionStrict;
    province: string;
    area: string;
  }>,
  existingEmployees: EmployeeFsDoc[],
): Promise<number> {
  const empById = new Map(existingEmployees.map((e) => [toValidDocId(e.doc_id), e]));
  const ops = rows
    .filter((r) => toValidDocId(r.doc_id, "") && clampStr(r.partner_name, 160))
    .map((r) => {
      const docId = toValidDocId(r.doc_id);
      const picId = r.pic_employee_id ? toValidDocId(r.pic_employee_id) : null;
      const picEmp = picId ? empById.get(picId) : undefined;
      return {
        type: "update" as const,
        colName: "partners",
        docId,
        data: {
          partner_name: clampStr(r.partner_name, 160),
          category: clampStr(r.category || "R1", 40),
          pic_employee_id: picId,
          pic_name: clampStr(picEmp?.full_name || "", 120),
          division_group: toStrictDivision(r.division_group),
          province: clampStr(r.province, 80, "-"),
          area: clampStr(r.area || r.province, 80, "-"),
        },
      };
    });

  if (ops.length === 0) throw new Error("Nama Partner wajib diisi.");
  await commitInChunks(ops, 15);
  return ops.length;
}

/**
 * Bulk update existing Employee documents in Firestore /employees.
 */
export async function bulkUpdateEmployeesFirestore(
  rows: Array<{
    doc_id: string;
    username: string;
    full_name: string;
    position: string;
    role_level: number;
    upline_id: string | null;
    subordinate_ids?: string[];
    access_scope_ids?: string[];
    division_group: DivisionStrict | "All";
    province: string;
    area: string;
    status?: "Aktif" | "Nonaktif";
    password?: string;
  }>,
): Promise<Array<{ doc_id: string; username: string; password?: string }>> {
  const ops: any[] = [];
  const updatedCreds: Array<{ doc_id: string; username: string; password?: string }> = [];

  for (const r of rows) {
    const docId = toValidDocId(r.doc_id, "");
    const fullName = clampStr(r.full_name, 120);
    if (!docId || !fullName) continue;

    const username = clampStr(String(r.username || "").toLowerCase(), 80);
    const divGroup = r.division_group === "All" ? "All" : toStrictDivision(r.division_group);
    const roleLevel = Math.min(5, Math.max(1, Math.round(Number(r.role_level) || 1)));
    const subIds = (r.subordinate_ids || []).map((id) => toValidDocId(id)).slice(0, 200);
    const scopeIds = (r.access_scope_ids && r.access_scope_ids.length > 0
      ? r.access_scope_ids
      : [docId, ...subIds]
    )
      .map((id) => toValidDocId(id))
      .slice(0, 200);

    ops.push({
      type: "update" as const,
      colName: "employees",
      docId,
      data: {
        username,
        full_name: fullName,
        position: clampStr(r.position || "Business Solution", 100, "Business Solution"),
        role_level: roleLevel,
        upline_id: r.upline_id ? toValidDocId(r.upline_id) : null,
        subordinate_ids: subIds,
        access_scope_ids: scopeIds,
        division_group: divGroup,
        province: clampStr(r.province, 80, "-"),
        area: clampStr(r.area || r.province, 80, "-"),
        status: r.status === "Nonaktif" ? "Nonaktif" : "Aktif",
      },
    });
    updatedCreds.push({
      doc_id: docId,
      username,
      password: r.password,
    });
  }

  if (ops.length === 0) throw new Error("Nama Lengkap Employee wajib diisi.");
  await commitInChunks(ops, 15);
  return updatedCreds;
}
