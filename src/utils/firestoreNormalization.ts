import { cleanForMatch, extractExpFromLot, getValidCategory, safeParseFloat } from "./formatters";
import { MONTH_KEYS } from "./constants";

export type DivisionStrict = "Field Corn" | "Fresh Corn" | "Vegetables";

export interface MonthlyOpnameCell {
  in: number;
  idle: number;
  pog: number;
}

export interface EmployeeFsDoc {
  doc_id: string;
  username: string;
  full_name: string;
  position: string;
  role_level: number;
  upline_id: string | null;
  subordinate_ids: string[];
  access_scope_ids: string[];
  division_group: DivisionStrict | "All";
  province: string;
  area: string;
  status: "Aktif" | "Nonaktif";
  picEmail?: string | null;
  _raw?: any;
  _password?: string;
}

export interface PartnerFsDoc {
  doc_id: string;
  partner_name: string;
  category: string;
  pic_employee_id: string | null;
  pic_name: string;
  division_group: DivisionStrict;
  province: string;
  area: string;
  picEmail?: string | null;
  _raw?: any;
}

export interface HybridFsDoc {
  doc_id: string;
  hybrid_name: string;
  sku?: string | null;
  crop_type: DivisionStrict;
}

export interface LotFsDoc {
  doc_id: string;
  hybrid_id: string | null;
  sku?: string | null;
  shipping_date: string;
  exp_date: string;
  initial_dr_kg: number;
}

export interface DrShipmentFsDoc {
  doc_id: string;
  shipping_date: string;
  partner_name?: string | null;
  partner_id: string | null;
  lot_no: string;
  sku?: string | null;
  exp_date: string;
  shipped_qty_kg: number;
}

export interface OpnameLogFsDoc {
  doc_id: string;
  _key: string;
  partner_id: string | null;
  lot_no: string;
  sku?: string | null;
  checker_id: string | null;
  crop_year: string;
  apr: MonthlyOpnameCell | null;
  mei: MonthlyOpnameCell | null;
  jun: MonthlyOpnameCell | null;
  jul: MonthlyOpnameCell | null;
  ags: MonthlyOpnameCell | null;
  sep: MonthlyOpnameCell | null;
  okt: MonthlyOpnameCell | null;
  nov: MonthlyOpnameCell | null;
  des: MonthlyOpnameCell | null;
  jan: MonthlyOpnameCell | null;
  feb: MonthlyOpnameCell | null;
  mar: MonthlyOpnameCell | null;
}

export interface NormalizedDataset {
  employees: EmployeeFsDoc[];
  partners: PartnerFsDoc[];
  hybrids: HybridFsDoc[];
  lots: LotFsDoc[];
  dr_shipments: DrShipmentFsDoc[];
  opname_logs: OpnameLogFsDoc[];
}

export const padFsId = (prefix: string, num: number, len = 3): string =>
  `${prefix}-${String(num).padStart(len, "0")}`;

export const toValidDocId = (raw: string, fallback = "DOC"): string => {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 128);
  return cleaned || fallback;
};

export const clampStr = (raw: any, maxLen: number, fallback = ""): string => {
  const trimmed = String(raw ?? "").trim();
  const s = trimmed || String(fallback ?? "").trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

export const toStrictDivision = (raw: any): DivisionStrict => {
  const s = String(raw || "").toLowerCase();
  if (s.includes("fresh")) return "Fresh Corn";
  if (s.includes("veg")) return "Vegetables";
  return "Field Corn";
};

export const toIsoDateStr = (raw: any): string => {
  if (!raw || raw === "N/A" || raw === "-") return "";
  const str = String(raw).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", mei: "05",
    jun: "06", jul: "07", aug: "08", ags: "08", agu: "08", sep: "09",
    oct: "10", okt: "10", nov: "11", dec: "12", des: "12",
  };

  const parts = str.split(/[\s/\-.:]+/);
  if (parts.length >= 3) {
    const p0 = parts[0].padStart(2, "0");
    const p1 = parts[1].toLowerCase();
    let month = "01";
    if (/^\d+$/.test(p1)) {
      month = String(Math.min(12, Math.max(1, parseInt(p1, 10)))).padStart(2, "0");
    } else {
      const matched = Object.keys(monthMap).find((k) => p1.startsWith(k));
      if (matched) month = monthMap[matched];
    }
    let year = parts[2];
    if (year.length === 2) year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    else if (year.length > 4) year = year.slice(0, 4);
    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(p0)) return `${year}-${month}-${p0}`;
  }
  return str.slice(0, 20);
};

export const FISCAL_MONTH_COLS: Array<{
  key: "apr" | "mei" | "jun" | "jul" | "ags" | "sep" | "okt" | "nov" | "des" | "jan" | "feb" | "mar";
  label: string;
  mIdx: number;
  period: string;
}> = [
  { key: "apr", label: "apr (2026-04)", mIdx: 3, period: "2026-04" },
  { key: "mei", label: "mei (2026-05)", mIdx: 4, period: "2026-05" },
  { key: "jun", label: "jun (2026-06)", mIdx: 5, period: "2026-06" },
  { key: "jul", label: "jul (2026-07)", mIdx: 6, period: "2026-07" },
  { key: "ags", label: "ags (2026-08)", mIdx: 7, period: "2026-08" },
  { key: "sep", label: "sep (2026-09)", mIdx: 8, period: "2026-09" },
  { key: "okt", label: "okt (2026-10)", mIdx: 9, period: "2026-10" },
  { key: "nov", label: "nov (2026-11)", mIdx: 10, period: "2026-11" },
  { key: "des", label: "des (2026-12)", mIdx: 11, period: "2026-12" },
  { key: "jan", label: "jan (2027-01)", mIdx: 0, period: "2027-01" },
  { key: "feb", label: "feb (2027-02)", mIdx: 1, period: "2027-02" },
  { key: "mar", label: "mar (2027-03)", mIdx: 2, period: "2027-03" },
];

const CROP_YEAR_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

export function buildNormalizedCollections(params: {
  employees: any[];
  kiosks: any[];
  workingRows: any[];
  drSalesRows: any[];
}): NormalizedDataset {
  const { employees = [], kiosks = [], workingRows = [], drSalesRows = [] } = params;

  // 1. EMPLOYEES
  const tempIdByClean = new Map<string, string>();
  employees.forEach((e, idx) => {
    const docId = toValidDocId(e.doc_id || padFsId("EMP", idx + 1, 3), padFsId("EMP", idx + 1, 3));
    const cn = cleanForMatch(e.name || e.full_name || "");
    const cu = cleanForMatch(e.user || e.username || "");
    if (cn) tempIdByClean.set(cn, docId);
    if (cu) tempIdByClean.set(cu, docId);
  });

  const getRoleLevel = (posRaw: string, rawLvl: any): number => {
    const p = String(posRaw || "").toLowerCase();
    if (p.includes("admin") || p.includes("country head") || p.includes("business analyst")) return 5;
    if (p.includes("commercial lead") || (p.includes("sales manager") && !p.includes("area"))) return 4;
    if (p.includes("area sales manager")) return 3;
    if (p.includes("sales agronomist")) return 2;
    if (p.includes("business solution")) return 1;
    const n = Number(rawLvl);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : 1;
  };

  const baseEmpDocs: EmployeeFsDoc[] = employees.map((e, idx) => {
    const doc_id = toValidDocId(e.doc_id || padFsId("EMP", idx + 1, 3), padFsId("EMP", idx + 1, 3));
    const uplineClean = cleanForMatch(e.upline || "");
    const upline_id = e.upline_id
      ? toValidDocId(e.upline_id)
      : uplineClean && tempIdByClean.has(uplineClean)
        ? tempIdByClean.get(uplineClean)!
        : null;
    const position = clampStr(e.position || "Business Solution", 100, "Business Solution");
    const role_level = getRoleLevel(position, e.level ?? e.role_level);
    const rawDivStr = String(e.group || e.division_group || "").trim();
    const division_group =
      rawDivStr.toLowerCase() === "all"
        ? ("All" as const)
        : toStrictDivision(rawDivStr || position);

    return {
      doc_id,
      username: clampStr(String(e.user || e.username || e.email || "").toLowerCase(), 80),
      full_name: clampStr(e.name || e.full_name || doc_id, 120, doc_id),
      position,
      role_level,
      upline_id,
      subordinate_ids: [],
      access_scope_ids: [],
      division_group,
      province: clampStr(e.province || "-", 80, "-"),
      area: clampStr(e.area || e.province || "-", 80, "-"),
      status: String(e.status || "").toLowerCase().includes("non") ? "Nonaktif" : "Aktif",
      _raw: e,
      _password: String(e.password || "123").trim(),
    };
  });

  const childrenByUpline = new Map<string, string[]>();
  baseEmpDocs.forEach((d) => {
    if (d.upline_id) {
      const list = childrenByUpline.get(d.upline_id) || [];
      list.push(d.doc_id);
      childrenByUpline.set(d.upline_id, list);
    }
  });

  const empDocs: EmployeeFsDoc[] = baseEmpDocs.map((d) => {
    if (d.role_level >= 5) {
      const divSubs = baseEmpDocs
        .filter(
          (other) =>
            other.doc_id !== d.doc_id &&
            (d.division_group === "All" || other.division_group === d.division_group),
        )
        .map((other) => other.doc_id)
        .slice(0, 200);
      return {
        ...d,
        subordinate_ids: divSubs,
        access_scope_ids: [d.doc_id, ...divSubs].slice(0, 200),
      };
    }
    const subs: string[] = [];
    const visited = new Set<string>([d.doc_id]);
    const queue = [...(childrenByUpline.get(d.doc_id) || [])];
    while (queue.length > 0 && subs.length < 200) {
      const curr = queue.shift()!;
      if (!visited.has(curr)) {
        visited.add(curr);
        const childDoc = baseEmpDocs.find((x) => x.doc_id === curr);
        if (!childDoc || childDoc.division_group === d.division_group) {
          subs.push(curr);
        }
        queue.push(...(childrenByUpline.get(curr) || []));
      }
    }
    return {
      ...d,
      subordinate_ids: subs.slice(0, 200),
      access_scope_ids: [d.doc_id, ...subs].slice(0, 200),
    };
  });

  const empByClean = new Map<string, EmployeeFsDoc>();
  empDocs.forEach((d) => {
    if (d.full_name) empByClean.set(cleanForMatch(d.full_name), d);
    if (d.username) empByClean.set(cleanForMatch(d.username), d);
  });

  // 2. PARTNERS
  const seenPartners = new Set<string>();
  const partnerDocs: PartnerFsDoc[] = [];

  const registerPartner = (
    docIdHint: string | undefined,
    nameRaw: string,
    catRaw: any,
    picRaw: string,
    provRaw: string,
    areaRaw: string,
    groupRaw: string,
    rawObj: any,
  ) => {
    const name = clampStr(nameRaw, 160);
    const ck = cleanForMatch(name);
    if (!ck || seenPartners.has(ck)) return;
    seenPartners.add(ck);

    const category = clampStr(getValidCategory(catRaw, undefined, name), 40);
    const emp = empByClean.get(cleanForMatch(picRaw));
    const doc_id = toValidDocId(docIdHint || padFsId("PRT", partnerDocs.length + 1, 3), padFsId("PRT", partnerDocs.length + 1, 3));

    partnerDocs.push({
      doc_id,
      partner_name: name,
      category,
      pic_employee_id: emp ? emp.doc_id : null,
      pic_name: clampStr(emp ? emp.full_name : picRaw || "", 120),
      division_group: emp ? (emp.division_group === "All" ? toStrictDivision(groupRaw) : emp.division_group) : toStrictDivision(groupRaw),
      province: clampStr(provRaw || emp?.province || "-", 80, "-"),
      area: clampStr(areaRaw || provRaw || emp?.area || "-", 80, "-"),
      _raw: rawObj,
    });
  };

  kiosks.forEach((k) =>
    registerPartner(k.doc_id, k.name || k.partner_name, k.category, k.pic || k.pic_name, k.province, k.area, k.group || k.division_group, k),
  );
  workingRows.forEach((w) =>
    registerPartner(undefined, w.kiosk || w.channel || w.toko, w.category, w.user || w.pic, w.province, w.area, w.crops, w),
  );
  drSalesRows.forEach((d) =>
    registerPartner(undefined, d.channel, "Distributor", d.pic || "", d.province || "", d.area || "", d.crops, d),
  );

  const partnerByClean = new Map<string, PartnerFsDoc>();
  partnerDocs.forEach((p) => partnerByClean.set(cleanForMatch(p.partner_name), p));

  // 3. HYBRIDS
  const hybMap = new Map<string, { hybrid_name: string; crop_type: DivisionStrict }>();
  drSalesRows.forEach((d) => {
    const hName = clampStr(String(d.hybrid || "").toUpperCase(), 100);
    if (!hName) return;
    const ck = cleanForMatch(hName);
    if (!hybMap.has(ck)) hybMap.set(ck, { hybrid_name: hName, crop_type: toStrictDivision(d.crops) });
  });
  workingRows.forEach((w) => {
    const hName = clampStr(String(w.hybrid || "").toUpperCase(), 100);
    if (!hName) return;
    const ck = cleanForMatch(hName);
    if (!hybMap.has(ck)) hybMap.set(ck, { hybrid_name: hName, crop_type: toStrictDivision(w.crops) });
  });

  const hybridDocs: HybridFsDoc[] = Array.from(hybMap.values())
    .sort((a, b) => a.hybrid_name.localeCompare(b.hybrid_name))
    .map((h, i) => ({
      doc_id: padFsId("HYB", i + 1, 3),
      hybrid_name: h.hybrid_name,
      crop_type: h.crop_type,
    }));

  const hybridByClean = new Map<string, HybridFsDoc>();
  hybridDocs.forEach((h) => hybridByClean.set(cleanForMatch(h.hybrid_name), h));

  // 4. LOTS & 5. DR_SHIPMENTS
  const lotMap = new Map<string, LotFsDoc>();
  const seenDr = new Set<string>();
  const drDocs: DrShipmentFsDoc[] = [];

  const stripCorpPrefix = (s: string) =>
    cleanForMatch(s).replace(/^(pt|cv|ud|toko|kios|udt|pd)+/, "");

  const findPartnerByName = (rawName: string) => {
    const ck = cleanForMatch(rawName);
    if (!ck) return undefined;
    const exact = partnerByClean.get(ck);
    if (exact) return exact;
    const stripped = stripCorpPrefix(rawName);
    if (!stripped) return undefined;
    for (const [, pDoc] of partnerByClean.entries()) {
      if (stripCorpPrefix(pDoc.partner_name) === stripped) return pDoc;
    }
    return undefined;
  };

  const seenDrIds = new Set<string>();
  let drAutoSeq = 1;
  const nextUniqueDrId = (preferred?: string): string => {
    if (preferred) {
      const cleaned = toValidDocId(preferred, "");
      if (cleaned && !seenDrIds.has(cleaned)) {
        seenDrIds.add(cleaned);
        return cleaned;
      }
    }
    while (true) {
      const candidate = padFsId("DR", drAutoSeq++, 4);
      if (!seenDrIds.has(candidate)) {
        seenDrIds.add(candidate);
        return candidate;
      }
    }
  };

  drSalesRows.forEach((d) => {
    const rawLot = String(d.lot || "").trim().toUpperCase();
    const rawLotId = toValidDocId(rawLot, "");
    if (!rawLotId) return;
    const cl = cleanForMatch(rawLotId);
    if (!cl) return;

    const shipping_date = toIsoDateStr(d.drDate || d.date) || "2026-01-01";
    const custClean = cleanForMatch(d.channel || "");
    const partner = findPartnerByName(d.channel || "");
    const rawQty = Number(d.qty);
    const shipped_qty_kg = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 0;

    const dedupKey = `${cl}|${shipping_date}|${custClean}|${shipped_qty_kg}`;
    if (seenDr.has(dedupKey)) return;
    seenDr.add(dedupKey);

    const hyb = hybridByClean.get(cleanForMatch(d.hybrid || ""));
    const expRaw =
      !d.expired || d.expired === "N/A" || d.expired === "-"
        ? extractExpFromLot(rawLot)
        : d.expired;
    const exp_date = toIsoDateStr(expRaw);

    let existingLot = lotMap.get(cl);
    if (!existingLot) {
      existingLot = {
        doc_id: rawLotId,
        hybrid_id: hyb ? hyb.doc_id : null,
        shipping_date: clampStr(shipping_date, 20),
        exp_date: clampStr(exp_date, 20),
        initial_dr_kg: shipped_qty_kg,
      };
      lotMap.set(cl, existingLot);
    } else {
      existingLot.initial_dr_kg += shipped_qty_kg;
      if (!existingLot.hybrid_id && hyb) existingLot.hybrid_id = hyb.doc_id;
      if (!existingLot.shipping_date && shipping_date) existingLot.shipping_date = clampStr(shipping_date, 20);
      if (!existingLot.exp_date && exp_date) existingLot.exp_date = clampStr(exp_date, 20);
    }

    drDocs.push({
      doc_id: nextUniqueDrId(d.doc_id),
      shipping_date: clampStr(shipping_date, 20, "2026-01-01"),
      partner_id: partner ? partner.doc_id : null,
      lot_no: existingLot.doc_id,
      exp_date: clampStr(exp_date, 20),
      shipped_qty_kg,
    });
  });

  workingRows.forEach((w) => {
    const rawLot = String(w.lot || "").trim().toUpperCase();
    const lot_no = toValidDocId(rawLot, "");
    const cl = cleanForMatch(lot_no);
    if (!lot_no || !cl) return;
    const hyb = hybridByClean.get(cleanForMatch(w.hybrid || ""));
    const shipping_date = toIsoDateStr(w.drDate || w.shippingDate);
    const exp_date = toIsoDateStr(w.expired || w.exp || extractExpFromLot(rawLot));

    const existing = lotMap.get(cl);
    if (!existing) {
      lotMap.set(cl, {
        doc_id: lot_no,
        hybrid_id: hyb ? hyb.doc_id : null,
        shipping_date: clampStr(shipping_date, 20),
        exp_date: clampStr(exp_date, 20),
        initial_dr_kg: 0,
      });
    } else {
      if (!existing.hybrid_id && hyb) existing.hybrid_id = hyb.doc_id;
      if (!existing.shipping_date && shipping_date) existing.shipping_date = clampStr(shipping_date, 20);
      if (!existing.exp_date && exp_date) existing.exp_date = clampStr(exp_date, 20);
    }
  });

  // 6. OPNAME_LOGS
  const invMap = new Map<
    string,
    {
      partner_id: string | null;
      lot_no: string;
      last_checker_id: string | null;
      stock_qty_kg: number;
      _mVals: number[];
      _mHas: boolean[];
      _mUpd: string[];
      _mCheckerId: Array<string | null>;
    }
  >();

  workingRows.forEach((item) => {
    const partnerName = String(item.kiosk || item.channel || item.toko || "").trim();
    const partner = partnerByClean.get(cleanForMatch(partnerName));
    const rawLotId = toValidDocId(String(item.lot || "").trim().toUpperCase(), "");
    if (!rawLotId) return;
    const canonicalLot = lotMap.get(cleanForMatch(rawLotId))?.doc_id || rawLotId;
    const checkerName = String(item.user || item.pic || item.checker || "").trim();
    const checker = empByClean.get(cleanForMatch(checkerName));

    const mVals = Array(12).fill(0);
    const mHas = Array(12).fill(false);
    const mUpd = Array(12).fill("");
    const mChk = Array<string | null>(12).fill(checker ? checker.doc_id : null);

    CROP_YEAR_ORDER.forEach((mIdx) => {
      const mKey = MONTH_KEYS[mIdx];
      const v = item[mKey];
      const u = item[`upd_${mKey}`];
      const numV = Number(v);
      const active =
        (v !== undefined && v !== null && String(v).trim() !== "" && Number.isFinite(numV) && numV !== 0) ||
        (u !== undefined && u !== null && String(u).trim() !== "");
      if (active) {
        mVals[mIdx] = Number.isFinite(numV) && numV > 0 ? numV : 0;
        mHas[mIdx] = true;
        mUpd[mIdx] = String(u || "sales").trim().toLowerCase();
      }
    });

    const uqKey = toValidDocId(
      `${partner ? partner.doc_id : toValidDocId(partnerName, "NO_PRT")}_${canonicalLot}_FY2026`,
      padFsId("LOG", invMap.size + 1, 4),
    );
    const existing = invMap.get(uqKey);
    const rawStock = Number(item.stock) || Number(item.qty) || 0;
    if (!existing) {
      invMap.set(uqKey, {
        partner_id: partner ? partner.doc_id : null,
        lot_no: canonicalLot,
        last_checker_id: checker ? checker.doc_id : null,
        stock_qty_kg: Number.isFinite(rawStock) && rawStock > 0 ? rawStock : 0,
        _mVals: mVals,
        _mHas: mHas,
        _mUpd: mUpd,
        _mCheckerId: mChk,
      });
    } else {
      for (let m = 0; m < 12; m++) {
        if (mHas[m]) {
          if (
            !existing._mHas[m] ||
            (mUpd[m] !== "admin" && existing._mUpd[m] === "admin") ||
            (mVals[m] > 0 && existing._mVals[m] === 0)
          ) {
            existing._mVals[m] = mVals[m];
            existing._mHas[m] = true;
            existing._mUpd[m] = mUpd[m];
            existing._mCheckerId[m] = mChk[m];
          }
        }
      }
    }
  });

  const opnameDocs: OpnameLogFsDoc[] = [];
  invMap.forEach((inv, uqKey) => {
    let prev: number | null = null;
    let firstIdx = -1;
    let lastIdx = -1;

    const monthCells: Record<string, MonthlyOpnameCell | null> = {
      apr: null, mei: null, jun: null, jul: null, ags: null, sep: null,
      okt: null, nov: null, des: null, jan: null, feb: null, mar: null,
    };

    FISCAL_MONTH_COLS.forEach(({ key, mIdx }) => {
      if (!inv._mHas[mIdx]) return;
      const qty = Math.max(0, inv._mVals[mIdx] || 0);
      if (firstIdx === -1) firstIdx = mIdx;
      lastIdx = mIdx;

      const inKg = prev === null ? qty : qty > prev ? qty - prev : 0;
      const pogKg = prev !== null && qty < prev ? prev - qty : 0;
      const idleKg = qty;

      monthCells[key] = { in: inKg, idle: idleKg, pog: pogKg };
      prev = qty;
    });

    if (firstIdx !== -1 && lastIdx !== -1) {
      inv.last_checker_id = inv._mCheckerId[lastIdx] || inv.last_checker_id;
    } else {
      monthCells.apr = {
        in: inv.stock_qty_kg,
        idle: inv.stock_qty_kg,
        pog: 0,
      };
    }

    const docId = toValidDocId(uqKey, padFsId("LOG", opnameDocs.length + 1, 4));
    opnameDocs.push({
      doc_id: docId,
      _key: docId,
      partner_id: inv.partner_id,
      lot_no: inv.lot_no,
      checker_id: inv.last_checker_id,
      crop_year: "FY2026",
      apr: monthCells.apr,
      mei: monthCells.mei,
      jun: monthCells.jun,
      jul: monthCells.jul,
      ags: monthCells.ags,
      sep: monthCells.sep,
      okt: monthCells.okt,
      nov: monthCells.nov,
      des: monthCells.des,
      jan: monthCells.jan,
      feb: monthCells.feb,
      mar: monthCells.mar,
    });
  });

  return {
    employees: empDocs,
    partners: partnerDocs,
    hybrids: hybridDocs,
    lots: Array.from(lotMap.values()),
    dr_shipments: drDocs,
    opname_logs: opnameDocs,
  };
}

/**
 * Hydrate legacy Dashboard flat structures (employees, kiosks, workingData, drSalesData)
 * directly from the 6 normalized Firestore collections.
 */
export function hydrateDashboardFromNormalized(data: NormalizedDataset): {
  employees: any[];
  kiosks: any[];
  workingData: any[];
  drSalesData: any[];
} {
  const empById = new Map<string, EmployeeFsDoc>();
  data.employees.forEach((e) => empById.set(e.doc_id, e));

  const partnerById = new Map<string, PartnerFsDoc>();
  data.partners.forEach((p) => partnerById.set(p.doc_id, p));

  const hybridById = new Map<string, HybridFsDoc>();
  data.hybrids.forEach((h) => hybridById.set(h.doc_id, h));

  const lotById = new Map<string, LotFsDoc>();
  data.lots.forEach((l) => lotById.set(l.doc_id, l));

  const employees = data.employees.map((e) => {
    const upline = e.upline_id ? empById.get(e.upline_id) : undefined;
    return {
      doc_id: e.doc_id,
      name: e.full_name,
      email: e.picEmail || e.username.toUpperCase(),
      user: e.username,
      position: e.position,
      province: e.province,
      area: e.area,
      upline: upline ? upline.full_name : "-",
      upline_id: e.upline_id,
      password: e._password || "123",
      level: String(e.role_level),
      group: e.division_group,
      status: e.status,
    };
  });

  const kiosks = data.partners.map((p) => {
    const picEmp = p.pic_employee_id ? empById.get(p.pic_employee_id) : undefined;
    const uplineEmp = picEmp?.upline_id ? empById.get(picEmp.upline_id) : undefined;
    return {
      id: p.doc_id,
      doc_id: p.doc_id,
      name: p.partner_name,
      category: p.category,
      pic: picEmp ? picEmp.full_name : p.pic_name || "",
      pic_employee_id: p.pic_employee_id,
      upline: uplineEmp ? uplineEmp.full_name : "",
      province: p.province,
      area: p.area,
      group: p.division_group,
    };
  });

  const drSalesData = data.dr_shipments.map((dr) => {
    const partner = dr.partner_id ? partnerById.get(dr.partner_id) : undefined;
    const lot = lotById.get(dr.lot_no);
    const hybrid = lot?.hybrid_id ? hybridById.get(lot.hybrid_id) : undefined;
    const picEmp = partner?.pic_employee_id ? empById.get(partner.pic_employee_id) : undefined;
    return {
      doc_id: dr.doc_id,
      lot: dr.lot_no,
      sku: dr.sku || lot?.sku || hybrid?.sku || "",
      hybrid: hybrid?.hybrid_name || "Unknown",
      crops: hybrid?.crop_type || partner?.division_group || "Field Corn",
      channel: partner?.partner_name || "",
      partner_id: dr.partner_id,
      qty: dr.shipped_qty_kg,
      drDate: dr.shipping_date,
      expired: dr.exp_date || lot?.exp_date || extractExpFromLot(dr.lot_no) || "N/A",
      pic: picEmp?.full_name || partner?.pic_name || "",
      province: partner?.province || "",
      area: partner?.area || "",
    };
  });

  const currentMonthIdx = new Date().getMonth();
  const workingData = data.opname_logs.map((log, index) => {
    const partner = log.partner_id ? partnerById.get(log.partner_id) : undefined;
    const lot = lotById.get(log.lot_no);
    const hybrid = lot?.hybrid_id ? hybridById.get(lot.hybrid_id) : undefined;
    const checker = log.checker_id ? empById.get(log.checker_id) : undefined;

    const row: Record<string, any> = {
      id: log.doc_id,
      doc_id: log.doc_id,
      rowNumber: index + 1,
      lot: log.lot_no,
      sku: log.sku || lot?.sku || hybrid?.sku || "",
      hybrid: hybrid?.hybrid_name || "Unknown",
      crops: hybrid?.crop_type || partner?.division_group || "Field Corn",
      drDate: lot?.shipping_date || "N/A",
      shippingDate: lot?.shipping_date || "N/A",
      expired: lot?.exp_date || extractExpFromLot(log.lot_no) || "N/A",
      aging: "-",
      kiosk: partner?.partner_name || "",
      channel: partner?.partner_name || "",
      category: partner?.category || "",
      province: partner?.province || checker?.province || "",
      area: partner?.area || checker?.area || "",
      user: checker?.full_name || partner?.pic_name || "",
      pic: checker?.full_name || partner?.pic_name || "",
      originalUser: checker?.full_name || partner?.pic_name || "",
      timestamp: new Date().toLocaleDateString("en-GB"),
      pog: 0,
      condition: "tetap",
    };

    let latestIdle = 0;
    let totalPog = 0;
    FISCAL_MONTH_COLS.forEach(({ key, mIdx }) => {
      const cell = log[key];
      const val = cell ? safeParseFloat(cell.idle) : 0;
      row[key] = val;
      row[`upd_${key}`] = cell ? (checker?.full_name || "sales") : "";
      if (cell) {
        latestIdle = val;
        totalPog += safeParseFloat(cell.pog);
      }
      if (mIdx === currentMonthIdx) {
        row.stock = val;
      }
    });
    if (row.stock === undefined) row.stock = latestIdle;
    row.pog = totalPog;
    return row;
  });

  return { employees, kiosks, workingData, drSalesData };
}

export const formatToDDMMYYYY = (raw: any): string => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{8}$/.test(s)) return s;
  const iso = toIsoDateStr(s);
  if (iso) {
    const [y, m, d] = iso.split("-");
    return `${d}${m}${y}`;
  }
  return s;
};

export const parseDDMMYYYYToIso = (raw: any): string => {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) {
    const d = s.slice(0, 2);
    const m = s.slice(2, 4);
    const y = s.slice(4, 8);
    return `${y}-${m}-${d}`;
  }
  const iso = toIsoDateStr(s);
  return iso || new Date().toISOString().slice(0, 10);
};

