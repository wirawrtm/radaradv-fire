import React, { useState, useMemo, useCallback } from "react";
import { cleanForMatch, extractExpFromLot, getValidCategory } from "../../utils/formatters";
import { MONTH_KEYS } from "../../utils/constants";
import { PartnerEditModal } from "../modals/PartnerEditModal";
import { PartnerDeleteModal } from "../modals/PartnerDeleteModal";
import { EmployeeEditModal } from "../modals/EmployeeEditModal";
import { EmployeeDeleteModal } from "../modals/EmployeeDeleteModal";
import { useFirebase } from "../../contexts/FirebaseContext";
import { buildNormalizedCollections } from "../../utils/firestoreNormalization";
import { saveUploadedDrToFirestore } from "../../services/firestoreDb";
import firestoreRulesText from "../../../firestore.rules?raw";

export interface TempTabProps {
  consolidationSuccessMsg: string | null;
  isTempProceeded: boolean;
  setIsTempProceeded: React.Dispatch<React.SetStateAction<boolean>>;
  expandedTempRowId: string | null;
  setExpandedTempRowId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedConsolidateMonth: number;
  setSelectedConsolidateMonth: React.Dispatch<React.SetStateAction<number>>;
  isConsolidatingDb: boolean;
  handleConsolidateDatabase: () => void;
  tempSearchQuery: string;
  setTempSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  rawWorkingData: any[];
  workingData: any[];
  drSalesData: any[];
  tempSortBy: string;
  setTempSortBy: React.Dispatch<React.SetStateAction<string>>;
  tempSortOrder: "asc" | "desc";
  setTempSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  updatingRowMonthId: number | null;
  handleUpdateInputMonth: (rowNumber: number, newMonthIdx: number) => void;
  kiosks?: any[];
  employees?: any[];
  userData?: any;
  accessRules?: Record<string, any>;
  availableProvinces?: string[];
  allCategories?: string[];
  availableGroups?: string[];
  myActiveSubordinates?: any[];
  partnerEditModal?: { isOpen: boolean; item: any };
  setPartnerEditModal?: React.Dispatch<React.SetStateAction<{ isOpen: boolean; item: any }>>;
  partnerDeleteModal?: { isOpen: boolean; item: any };
  setPartnerDeleteModal?: React.Dispatch<React.SetStateAction<{ isOpen: boolean; item: any }>>;
  employeeEditModal?: { isOpen: boolean; item: any };
  setEmployeeEditModal?: React.Dispatch<React.SetStateAction<{ isOpen: boolean; item: any }>>;
  employeeDeleteModal?: { isOpen: boolean; item: any };
  setEmployeeDeleteModal?: React.Dispatch<React.SetStateAction<{ isOpen: boolean; item: any }>>;
  handleEditPartnerSave?: (id: any, newPic: any, additionalData?: any) => Promise<void>;
  handleDeletePartnerConfirm?: () => Promise<void>;
  handleEditEmployeeSave?: (empData: any) => Promise<void>;
  handleDeleteEmployeeConfirm?: () => Promise<void>;
  isActionLoading?: boolean;
  onRefreshDatabase?: () => Promise<void>;
}

type CollectionKey =
  | "opname_logs"
  | "dr_shipments"
  | "lots"
  | "hybrids"
  | "partners"
  | "employees";

const padId = (prefix: string, num: number, len = 3) =>
  `${prefix}-${String(num).padStart(len, "0")}`;

const toIsoDateStr = (raw: any): string => {
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
  return str;
};

const CROP_YEAR_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
const PERIOD_ISO = [
  "2027-01", "2027-02", "2027-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
];

type MonthlyOpnameCell = {
  in: number;
  idle: number;
  pog: number;
};

const FISCAL_MONTH_COLS: Array<{
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

export const TempTab: React.FC<TempTabProps> = ({
  consolidationSuccessMsg,
  tempSearchQuery,
  setTempSearchQuery,
  rawWorkingData,
  workingData,
  drSalesData,
  kiosks = [],
  employees = [],
  userData,
  accessRules = {},
  availableProvinces = [],
  allCategories = ["Distributor", "R1", "R2"],
  availableGroups = ["Field Corn", "Fresh Corn", "Vegetables", "All"],
  myActiveSubordinates = [],
  partnerEditModal,
  setPartnerEditModal,
  partnerDeleteModal,
  setPartnerDeleteModal,
  employeeEditModal,
  setEmployeeEditModal,
  employeeDeleteModal,
  setEmployeeDeleteModal,
  handleEditPartnerSave,
  handleDeletePartnerConfirm,
  handleEditEmployeeSave,
  handleDeleteEmployeeConfirm,
  isActionLoading = false,
}) => {
  const [activeCollection, setActiveCollection] = useState<CollectionKey>("opname_logs");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [activeDivision, setActiveDivision] = useState<"Field Corn" | "Vegetables">(() =>
    String(userData?.group || "").toLowerCase().includes("veg") ? "Vegetables" : "Field Corn",
  );
  const [simulatedLoginEmpId, setSimulatedLoginEmpId] = useState<string>("ADMIN_DIV");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ field: string; dir: "asc" | "desc" }>({
    field: "partner_id",
    dir: "asc",
  });
  const [opnameMetricView, setOpnameMetricView] = useState<"combined" | "in" | "idle" | "pog">(
    "combined",
  );
  const {
    firebaseUser,
    isAuthorizedFirebase,
    hasFirestoreData,
    isLoadingFirestore,
    isMigrating,
    migrationStage,
    connectGoogle,
    disconnectGoogle,
    migrateDatasetToFirestore,
    reloadFromFirestore,
  } = useFirebase();

  const [uploadedDrRows, setUploadedDrRows] = useState<any[]>([]);
  const [drUploadStats, setDrUploadStats] = useState<{
    total: number;
    matchedExisting: number;
    autoCreatedPartner: number;
  } | null>(null);
  const [isUploadingDr, setIsUploadingDr] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const mergedDrSales = useMemo(
    () => [...(drSalesData || []), ...uploadedDrRows],
    [drSalesData, uploadedDrRows],
  );

  const showToast = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((prev) => (prev === msg ? null : prev)), 4000);
  }, []);

  const handleCopyFirestoreRules = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(firestoreRulesText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = firestoreRulesText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedRules(true);
      showToast("Isi firestore.rules berhasil disalin ke clipboard.");
      setTimeout(() => setCopiedRules(false), 2500);
    } catch {
      setShowRulesPanel(true);
      showToast("Silakan pilih & salin teks firestore.rules dari panel di bawah.");
    }
  }, [showToast]);

  const handleDownloadFirestoreRules = useCallback(() => {
    const blob = new Blob([firestoreRulesText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "firestore.rules";
    a.click();
    URL.revokeObjectURL(url);
    showToast("File firestore.rules berhasil diunduh.");
  }, [showToast]);

  const handleSelectCollection = (col: CollectionKey) => {
    setActiveCollection(col);
    setSortConfig({ field: col === "opname_logs" ? "partner_id" : "doc_id", dir: "asc" });
  };

  const handleToggleSort = (field: string) => {
    setSortConfig((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const setColumnSearch = (colKey: CollectionKey, field: string, val: string) => {
    const key = `${colKey}.${field}`;
    setColFilters((prev) => ({ ...prev, [key]: val }));
  };

  const getColumnSearch = (colKey: CollectionKey, field: string): string =>
    colFilters[`${colKey}.${field}`] || "";

  const hasActiveColFilters = useMemo(
    () =>
      Object.entries(colFilters).some(
        ([k, v]) => k.startsWith(`${activeCollection}.`) && String(v || "").trim() !== "",
      ),
    [colFilters, activeCollection],
  );

  const clearActiveCollectionFilters = () => {
    setColFilters((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${activeCollection}.`)) delete next[k];
      });
      return next;
    });
  };

  const toStrictDivision = (raw: any): "Field Corn" | "Vegetables" =>
    String(raw || "").toLowerCase().includes("veg") ? "Vegetables" : "Field Corn";

  const sourceWorking = useMemo(
    () => (rawWorkingData && rawWorkingData.length > 0 ? rawWorkingData : workingData || []),
    [rawWorkingData, workingData],
  );

  // ============================================================================
  // REAL NORMALIZED COLLECTIONS (READY FOR FIREBASE FIRESTORE / RELATIONAL DB)
  // ============================================================================

  // 1. COLLECTION: employees (doc_id: EMP-xxx — Login Auth, 2 Divisi Sales, & Downline Hierarchy)
  const { employeesCol, empByClean, empById } = useMemo(() => {
    const tempIdByClean = new Map<string, string>();
    (employees || []).forEach((e, idx) => {
      const docId = padId("EMP", idx + 1, 3);
      const cn = cleanForMatch(e.name || "");
      const cu = cleanForMatch(e.user || "");
      if (cn) tempIdByClean.set(cn, docId);
      if (cu) tempIdByClean.set(cu, docId);
    });

    const getRoleLevel = (posRaw: string, rawLvl: any): number => {
      const p = String(posRaw || "").toLowerCase();
      if (p.includes("admin") || p.includes("country head") || p.includes("business analyst"))
        return 5;
      if (p.includes("commercial lead") || (p.includes("sales manager") && !p.includes("area")))
        return 4;
      if (p.includes("area sales manager")) return 3;
      if (p.includes("sales agronomist")) return 2;
      if (p.includes("business solution")) return 1;
      return Number(rawLvl) || 1;
    };

    const baseDocs = (employees || []).map((e, idx) => {
      const doc_id = padId("EMP", idx + 1, 3);
      const uplineClean = cleanForMatch(e.upline || "");
      const upline_id =
        uplineClean && tempIdByClean.has(uplineClean) ? tempIdByClean.get(uplineClean)! : null;
      const position = String(e.position || "Business Solution").trim();
      const role_level = getRoleLevel(position, e.level);
      const division_group = toStrictDivision(e.group || position);

      return {
        doc_id,
        username: String(e.user || e.email || "").trim().toLowerCase(),
        password: String(e.password || "123").trim(),
        full_name: String(e.name || "").trim(),
        position,
        role_level,
        upline_id,
        subordinate_ids: [] as string[],
        access_scope_ids: [] as string[],
        division_group,
        province: String(e.province || "-").trim(),
        area: String(e.area || e.province || "-").trim(),
        _raw: e,
      };
    });

    // Build Downline Tree (BFS) per Divisi (Field Corn / Vegetables)
    const childrenByUpline = new Map<string, string[]>();
    baseDocs.forEach((d) => {
      if (d.upline_id) {
        const list = childrenByUpline.get(d.upline_id) || [];
        list.push(d.doc_id);
        childrenByUpline.set(d.upline_id, list);
      }
    });

    const docs = baseDocs.map((d) => {
      // Admin (Lv.5): bisa melihat SEMUA data, namun HANYA pada divisinya saja (Field Corn saja ATAU Vegetables saja)
      if (d.role_level >= 5) {
        const divSubs = baseDocs
          .filter((other) => other.doc_id !== d.doc_id && other.division_group === d.division_group)
          .map((other) => other.doc_id);
        return {
          ...d,
          subordinate_ids: divSubs,
          access_scope_ids: [d.doc_id, ...divSubs],
        };
      }

      // Sales (Lv.1 Business Solution s/d Lv.4 Sales Manager): melihat seluruh bawahan (under) di divisinya
      const subs: string[] = [];
      const visited = new Set<string>([d.doc_id]);
      const queue = [...(childrenByUpline.get(d.doc_id) || [])];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (!visited.has(curr)) {
          visited.add(curr);
          const childDoc = baseDocs.find((x) => x.doc_id === curr);
          if (!childDoc || childDoc.division_group === d.division_group) {
            subs.push(curr);
          }
          const grandChildren = childrenByUpline.get(curr) || [];
          queue.push(...grandChildren);
        }
      }
      return {
        ...d,
        subordinate_ids: subs,
        access_scope_ids: [d.doc_id, ...subs],
      };
    });

    const lookup = new Map<string, (typeof docs)[0]>();
    const byId = new Map<string, (typeof docs)[0]>();
    docs.forEach((d) => {
      byId.set(d.doc_id, d);
      if (d.full_name) lookup.set(cleanForMatch(d.full_name), d);
      if (d.username) lookup.set(cleanForMatch(d.username), d);
    });
    return { employeesCol: docs, empByClean: lookup, empById: byId };
  }, [employees]);

  // 2. COLLECTION: partners (doc_id: PRT-xxx)
  const { partnersCol, partnerByClean } = useMemo(() => {
    const seen = new Set<string>();
    const docs: Array<{
      doc_id: string;
      partner_name: string;
      category: string;
      pic_employee_id: string | null;
      division_group: string;
      province: string;
      area: string;
      _raw: any;
    }> = [];

    const registerPartner = (nameRaw: string, catRaw: any, picRaw: string, provRaw: string, areaRaw: string, groupRaw: string, rawObj: any) => {
      const name = String(nameRaw || "").trim();
      const ck = cleanForMatch(name);
      if (!ck || seen.has(ck)) return;
      seen.add(ck);

      const category = getValidCategory(catRaw, undefined, name);
      const emp = empByClean.get(cleanForMatch(picRaw));

      docs.push({
        doc_id: padId("PRT", docs.length + 1, 3),
        partner_name: name,
        category,
        pic_employee_id: emp ? emp.doc_id : null,
        division_group: emp ? emp.division_group : toStrictDivision(groupRaw),
        province: String(provRaw || emp?.province || "-").trim(),
        area: String(areaRaw || provRaw || emp?.area || "-").trim(),
        _raw: rawObj,
      });
    };

    (kiosks || []).forEach((k) => {
      registerPartner(k.name, k.category, k.pic, k.province, k.area, k.group, k);
    });

    // Auto-register any partner referenced in working or DR so foreign keys are 100% referentially intact
    sourceWorking.forEach((w) => {
      registerPartner(w.kiosk || w.channel || w.toko, w.category, w.user || w.pic, w.province, w.area, w.crops, w);
    });
    mergedDrSales.forEach((d) => {
      registerPartner(d.channel, "Distributor", d.pic || "", d.province || "", d.area || "", d.crops, d);
    });

    const lookup = new Map<string, (typeof docs)[0]>();
    docs.forEach((d) => lookup.set(cleanForMatch(d.partner_name), d));
    return { partnersCol: docs, partnerByClean: lookup };
  }, [kiosks, sourceWorking, mergedDrSales, empByClean]);

  // 3. COLLECTION: hybrids (doc_id: HYB-xxx — Hanya Field Corn atau Vegetables)
  const { hybridsCol, hybridByClean } = useMemo(() => {
    const map = new Map<string, { hybrid_name: string; crop_type: "Field Corn" | "Vegetables" }>();

    mergedDrSales.forEach((d) => {
      const hName = String(d.hybrid || "").trim().toUpperCase();
      if (!hName) return;
      const ck = cleanForMatch(hName);
      if (!map.has(ck)) {
        map.set(ck, {
          hybrid_name: hName,
          crop_type: toStrictDivision(d.crops),
        });
      }
    });

    sourceWorking.forEach((w) => {
      const hName = String(w.hybrid || "").trim().toUpperCase();
      if (!hName) return;
      const ck = cleanForMatch(hName);
      if (!map.has(ck)) {
        map.set(ck, {
          hybrid_name: hName,
          crop_type: toStrictDivision(w.crops),
        });
      }
    });

    const sorted = Array.from(map.values()).sort((a, b) =>
      a.hybrid_name.localeCompare(b.hybrid_name),
    );

    const docs = sorted.map((h, i) => ({
      doc_id: padId("HYB", i + 1, 3),
      hybrid_name: h.hybrid_name,
      crop_type: h.crop_type,
    }));

    const lookup = new Map<string, (typeof docs)[0]>();
    docs.forEach((d) => lookup.set(cleanForMatch(d.hybrid_name), d));
    return { hybridsCol: docs, hybridByClean: lookup };
  }, [mergedDrSales, sourceWorking]);

  // 4. COLLECTION: lots (doc_id: lot_no) & 5. COLLECTION: dr_shipments (doc_id: DR-xxx)
  const { lotsCol, drShipmentsCol } = useMemo(() => {
    const lotMap = new Map<
      string,
      {
        doc_id: string;
        hybrid_id: string | null;
        shipping_date: string;
        exp_date: string;
        initial_dr_kg: number;
      }
    >();

    const seenDr = new Set<string>();
    const drDocs: Array<{
      doc_id: string;
      shipping_date: string;
      partner_id: string | null;
      lot_no: string;
      exp_date: string;
      shipped_qty_kg: number;
    }> = [];

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

    mergedDrSales.forEach((d) => {
      const lot_no = String(d.lot || "").trim().toUpperCase();
      const cl = cleanForMatch(lot_no);
      const shipping_date = toIsoDateStr(d.drDate);
      const custClean = cleanForMatch(d.channel || "");
      const partner = findPartnerByName(d.channel || "");
      const shipped_qty_kg = Number(d.qty) || 0;

      const dedupKey = `${cl}|${shipping_date}|${custClean}|${shipped_qty_kg}`;
      if (seenDr.has(dedupKey)) return;
      seenDr.add(dedupKey);

      const hyb = hybridByClean.get(cleanForMatch(d.hybrid || ""));
      const expRaw =
        !d.expired || d.expired === "N/A" || d.expired === "-"
          ? extractExpFromLot(lot_no)
          : d.expired;
      const exp_date = toIsoDateStr(expRaw);

      drDocs.push({
        doc_id: padId("DR", drDocs.length + 1, 4),
        shipping_date: shipping_date || "2026-01-01",
        partner_id: partner ? partner.doc_id : null,
        lot_no,
        exp_date: exp_date || "",
        shipped_qty_kg,
      });

      if (cl) {
        const existing = lotMap.get(cl);
        if (!existing) {
          lotMap.set(cl, {
            doc_id: lot_no,
            hybrid_id: hyb ? hyb.doc_id : null,
            shipping_date: shipping_date || "",
            exp_date: exp_date || "",
            initial_dr_kg: shipped_qty_kg,
          });
        } else {
          existing.initial_dr_kg += shipped_qty_kg;
          if (!existing.shipping_date && shipping_date) existing.shipping_date = shipping_date;
          if (!existing.exp_date && exp_date) existing.exp_date = exp_date;
        }
      }
    });

    sourceWorking.forEach((w) => {
      const lot_no = String(w.lot || "").trim().toUpperCase();
      const cl = cleanForMatch(lot_no);
      if (!cl) return;
      const hyb = hybridByClean.get(cleanForMatch(w.hybrid || ""));
      const shipping_date = toIsoDateStr(w.drDate);
      const exp_date = toIsoDateStr(w.expired || extractExpFromLot(lot_no));

      const existing = lotMap.get(cl);
      if (!existing) {
        lotMap.set(cl, {
          doc_id: lot_no,
          hybrid_id: hyb ? hyb.doc_id : null,
          shipping_date: shipping_date || "",
          exp_date: exp_date || "",
          initial_dr_kg: 0,
        });
      } else {
        if (!existing.hybrid_id && hyb) existing.hybrid_id = hyb.doc_id;
        if (!existing.shipping_date && shipping_date) existing.shipping_date = shipping_date;
        if (!existing.exp_date && exp_date) existing.exp_date = exp_date;
      }
    });

    return {
      lotsCol: Array.from(lotMap.values()),
      drShipmentsCol: drDocs,
    };
  }, [mergedDrSales, sourceWorking, partnerByClean, hybridByClean]);

  // 6. COLLECTION: opname_logs (Riwayat & Saldo Opname Bulanan April -> Maret)
  const opnameLogsCol = useMemo(() => {
    const invMap = new Map<
      string,
      {
        doc_id: string;
        partner_id: string | null;
        lot_no: string;
        last_checker_id: string | null;
        first_period: string;
        initial_qty_kg: number;
        latest_period: string;
        stock_qty_kg: number;
        depleted_qty_kg: number;
        status: "ACTIVE" | "CARRY_OVER" | "DEPLETED";
        updated_at: string;
        _mVals: number[];
        _mHas: boolean[];
        _mUpd: string[];
        _mCheckerId: Array<string | null>;
      }
    >();

    sourceWorking.forEach((item) => {
      const partnerName = String(item.kiosk || item.channel || item.toko || "").trim();
      const partner = partnerByClean.get(cleanForMatch(partnerName));
      const lot_no = String(item.lot || "").trim().toUpperCase();
      const checkerName = String(item.user || item.pic || "").trim();
      const checker = empByClean.get(cleanForMatch(checkerName));
      const updated_at = toIsoDateStr(item.timestamp) || "2026-04-01";

      const mVals = Array(12).fill(0);
      const mHas = Array(12).fill(false);
      const mUpd = Array(12).fill("");
      const mChk = Array<string | null>(12).fill(checker ? checker.doc_id : null);

      CROP_YEAR_ORDER.forEach((mIdx) => {
        const mKey = MONTH_KEYS[mIdx];
        const v = item[mKey];
        const u = item[`upd_${mKey}`];
        const active =
          (v !== undefined && v !== null && String(v).trim() !== "" && Number(v) !== 0) ||
          (u !== undefined && u !== null && String(u).trim() !== "");
        if (active) {
          mVals[mIdx] = Number(v) || 0;
          mHas[mIdx] = true;
          mUpd[mIdx] = String(u || "sales").trim().toLowerCase();
        }
      });

      const uqKey = `${partner ? partner.doc_id : cleanForMatch(partnerName)}_${cleanForMatch(lot_no)}`;
      const existing = invMap.get(uqKey);

      if (!existing) {
        invMap.set(uqKey, {
          doc_id: padId("INV", invMap.size + 1, 3),
          partner_id: partner ? partner.doc_id : null,
          lot_no,
          last_checker_id: checker ? checker.doc_id : null,
          first_period: "2026-04",
          initial_qty_kg: 0,
          latest_period: "2026-04",
          stock_qty_kg: Number(item.stock) || Number(item.qty) || 0,
          depleted_qty_kg: 0,
          status: "ACTIVE",
          updated_at,
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

    const logs: Array<{
      _key: string;
      partner_id: string | null;
      lot_no: string;
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
    }> = [];

    Array.from(invMap.values()).forEach((inv) => {
      let prev: number | null = null;
      let firstIdx = -1;
      let lastIdx = -1;

      const monthCells: Record<string, MonthlyOpnameCell | null> = {
        apr: null,
        mei: null,
        jun: null,
        jul: null,
        ags: null,
        sep: null,
        okt: null,
        nov: null,
        des: null,
        jan: null,
        feb: null,
        mar: null,
      };

      FISCAL_MONTH_COLS.forEach(({ key, mIdx }) => {
        if (!inv._mHas[mIdx]) return;
        const qty = inv._mVals[mIdx] || 0;
        if (firstIdx === -1) firstIdx = mIdx;
        lastIdx = mIdx;

        const inKg = prev === null ? qty : qty > prev ? qty - prev : 0;
        const pogKg = prev !== null && qty < prev ? prev - qty : 0;
        const idleKg = qty;

        monthCells[key] = {
          in: inKg,
          idle: idleKg,
          pog: pogKg,
        };

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

      logs.push({
        _key: `${inv.doc_id}_${inv.partner_id || "NO-PRT"}_${inv.lot_no}`,
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

    return logs;
  }, [sourceWorking, partnerByClean, empByClean]);

  // Fast ID Lookup Maps for Hover Tooltips (so table stays 100% pure DB structure)
  const idTooltipMap = useMemo(() => {
    const map: Record<string, string> = {};
    partnersCol.forEach((p) => {
      map[p.doc_id] = `${p.partner_name} (${p.category} · ${p.province} · ${p.area})`;
    });
    employeesCol.forEach((e) => {
      map[e.doc_id] = `${e.full_name} (${e.position} · ${e.province})`;
    });
    hybridsCol.forEach((h) => {
      map[h.doc_id] = `${h.hybrid_name} (${h.crop_type})`;
    });
    lotsCol.forEach((l) => {
      map[l.doc_id] = `Lot ${l.doc_id} · Hybrid: ${l.hybrid_id} · Exp: ${l.exp_date}`;
    });
    return map;
  }, [partnersCol, employeesCol, hybridsCol, lotsCol]);

  // Active simulated login employee scope:
  // - Admin: melihat SEMUA data, namun HANYA Field Corn saja ATAU Vegetables saja (sesuai activeDivision)
  // - Sales (Lv.1 - Lv.4): melihat datanya sendiri + seluruh bawahannya (under) di divisinya
  const activeLoginEmp = useMemo(
    () => (simulatedLoginEmpId !== "ADMIN_DIV" ? empById.get(simulatedLoginEmpId) || null : null),
    [simulatedLoginEmpId, empById],
  );

  const effectiveDivision: "Field Corn" | "Vegetables" = activeLoginEmp
    ? activeLoginEmp.division_group
    : activeDivision;

  const allowedEmpSet = useMemo(() => {
    if (activeLoginEmp) {
      return new Set(activeLoginEmp.access_scope_ids);
    }
    // Admin Divisi: semua karyawan di divisi efektif (Field Corn saja atau Vegetables saja)
    return new Set(
      employeesCol.filter((e) => e.division_group === effectiveDivision).map((e) => e.doc_id),
    );
  }, [activeLoginEmp, employeesCol, effectiveDivision]);

  // Search filter across raw DB fields + Per-Header Column Search + Sorting
  const q = tempSearchQuery.trim().toLowerCase();
  const filterAndSortDocs = useCallback(
    <T extends Record<string, any>>(docs: T[], colKey: CollectionKey): T[] => {
      const filtered = docs.filter((doc) => {
        // 1. Global search
        if (q) {
          const matchesGlobal = Object.entries(doc).some(([k, v]) => {
            if (k === "_raw" || k === "_key") return false;
            if (v && typeof v === "object" && "idle" in v) {
              const c = v as MonthlyOpnameCell;
              return `${c.in} ${c.idle} ${c.pog}`.toLowerCase().includes(q);
            }
            const strVal = String(v ?? "").toLowerCase();
            const tooltipVal = (idTooltipMap[String(v)] || "").toLowerCase();
            return strVal.includes(q) || tooltipVal.includes(q);
          });
          if (!matchesGlobal) return false;
        }

        // 2. Per-column header search
        for (const [k, rawQuery] of Object.entries(colFilters)) {
          if (!k.startsWith(`${colKey}.`)) continue;
          const query = String(rawQuery || "").trim().toLowerCase();
          if (!query) continue;
          const field = k.slice(colKey.length + 1);
          const val = doc[field];
          if (Array.isArray(val)) {
            const countStr = `${val.length} under`;
            const arrMatch =
              countStr.includes(query) ||
              val.some(
                (id) =>
                  String(id).toLowerCase().includes(query) ||
                  (idTooltipMap[String(id)] || "").toLowerCase().includes(query),
              );
            if (!arrMatch) return false;
          } else if (val && typeof val === "object" && "idle" in val) {
            const cell = val as MonthlyOpnameCell;
            const cellStr =
              opnameMetricView === "in"
                ? `${cell.in}`
                : opnameMetricView === "idle"
                  ? `${cell.idle}`
                  : opnameMetricView === "pog"
                    ? `${cell.pog}`
                    : `in:${cell.in} idle:${cell.idle} pog:${cell.pog} ${cell.in}/${cell.idle}/${cell.pog}`;
            if (!cellStr.toLowerCase().includes(query)) return false;
          } else {
            const strVal = String(val ?? "-").toLowerCase();
            const tipVal = (idTooltipMap[String(val)] || "").toLowerCase();
            if (!strVal.includes(query) && !tipVal.includes(query)) return false;
          }
        }
        return true;
      });

      if (colKey !== activeCollection) return filtered;

      // 3. Active column sorting
      const { field, dir } = sortConfig;
      const mult = dir === "asc" ? 1 : -1;
      const getCellSortNum = (v: any): number | null => {
        if (v === null || v === undefined) return -1;
        if (typeof v === "object" && "idle" in v) {
          const c = v as MonthlyOpnameCell;
          if (opnameMetricView === "in") return c.in;
          if (opnameMetricView === "idle") return c.idle;
          if (opnameMetricView === "pog") return c.pog;
          return c.idle * 10000 + c.pog * 100 + c.in;
        }
        return null;
      };

      return [...filtered].sort((a, b) => {
        const va = a[field];
        const vb = b[field];
        if (Array.isArray(va) && Array.isArray(vb)) {
          return (va.length - vb.length) * mult;
        }
        const na = getCellSortNum(va);
        const nb = getCellSortNum(vb);
        if (na !== null || nb !== null) {
          return ((na ?? -1) - (nb ?? -1)) * mult;
        }
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * mult;
        }
        const sa = String(va ?? "");
        const sb = String(vb ?? "");
        return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" }) * mult;
      });
    },
    [q, colFilters, activeCollection, sortConfig, idTooltipMap, opnameMetricView],
  );

  const filteredHybrids = useMemo(() => {
    const scoped = hybridsCol.filter((h) => h.crop_type === effectiveDivision);
    return filterAndSortDocs(scoped, "hybrids");
  }, [hybridsCol, effectiveDivision, filterAndSortDocs]);

  const allowedHybridSet = useMemo(
    () => new Set(hybridsCol.filter((h) => h.crop_type === effectiveDivision).map((h) => h.doc_id)),
    [hybridsCol, effectiveDivision],
  );

  const filteredLots = useMemo(() => {
    const scoped = lotsCol.filter((l) => l.hybrid_id && allowedHybridSet.has(l.hybrid_id));
    return filterAndSortDocs(scoped, "lots");
  }, [lotsCol, allowedHybridSet, filterAndSortDocs]);

  const allowedLotSet = useMemo(
    () => new Set(lotsCol.filter((l) => l.hybrid_id && allowedHybridSet.has(l.hybrid_id)).map((l) => l.doc_id)),
    [lotsCol, allowedHybridSet],
  );

  const scopedPartnersBase = useMemo(() => {
    return activeLoginEmp
      ? partnersCol.filter(
          (p) =>
            p.division_group === effectiveDivision &&
            p.pic_employee_id &&
            allowedEmpSet.has(p.pic_employee_id),
        )
      : partnersCol.filter((p) => p.division_group === effectiveDivision);
  }, [partnersCol, activeLoginEmp, effectiveDivision, allowedEmpSet]);

  const filteredPartners = useMemo(
    () => filterAndSortDocs(scopedPartnersBase, "partners"),
    [scopedPartnersBase, filterAndSortDocs],
  );

  const allowedPartnerSet = useMemo(
    () => new Set(scopedPartnersBase.map((p) => p.doc_id)),
    [scopedPartnersBase],
  );

  const filteredLogs = useMemo(() => {
    const scoped = opnameLogsCol.filter((l) => {
      const inDivision = allowedLotSet.has(l.lot_no);
      if (!inDivision) return false;
      if (!activeLoginEmp) return true;
      return (
        (l.checker_id && allowedEmpSet.has(l.checker_id)) ||
        (l.partner_id && allowedPartnerSet.has(l.partner_id))
      );
    });
    return filterAndSortDocs(scoped, "opname_logs");
  }, [opnameLogsCol, allowedLotSet, activeLoginEmp, allowedEmpSet, allowedPartnerSet, filterAndSortDocs]);

  const filteredDr = useMemo(() => {
    const scoped = drShipmentsCol.filter((d) => {
      const inDivision = allowedLotSet.has(d.lot_no);
      if (!inDivision) return false;
      if (!activeLoginEmp) return true;
      return d.partner_id && allowedPartnerSet.has(d.partner_id);
    });
    return filterAndSortDocs(scoped, "dr_shipments");
  }, [drShipmentsCol, allowedLotSet, activeLoginEmp, allowedPartnerSet, filterAndSortDocs]);

  const filteredEmployees = useMemo(() => {
    const scoped = employeesCol.filter(
      (e) => e.division_group === effectiveDivision && allowedEmpSet.has(e.doc_id),
    );
    return filterAndSortDocs(scoped, "employees");
  }, [employeesCol, effectiveDivision, allowedEmpSet, filterAndSortDocs]);

  // Active collection JSON representation for Firebase export / preview
  const firebaseCollectionsPayload = useMemo(() => {
    const toDocMap = <T extends Record<string, any>>(arr: T[], idKey = "doc_id") => {
      const out: Record<string, any> = {};
      arr.forEach((item, idx) => {
        const clone = { ...item };
        delete (clone as any)._raw;
        delete (clone as any)._key;
        const key = String(item[idKey] || `DOC-${idx + 1}`);
        out[key] = clone;
      });
      return out;
    };
    return {
      opname_logs: toDocMap(opnameLogsCol, "_key"),
      dr_shipments: toDocMap(drShipmentsCol),
      lots: toDocMap(lotsCol),
      hybrids: toDocMap(hybridsCol),
      partners: toDocMap(partnersCol),
      employees: toDocMap(employeesCol),
    };
  }, [
    opnameLogsCol,
    drShipmentsCol,
    lotsCol,
    hybridsCol,
    partnersCol,
    employeesCol,
  ]);

  const handleExportFirebaseJson = () => {
    const jsonStr = JSON.stringify(firebaseCollectionsPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firebase_firestore_seed_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("File JSON koleksi Firebase berhasil diunduh.");
  };

  const handleUploadDrSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploadingDr(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const stripPrefix = (s: string) =>
        cleanForMatch(s).replace(/^(pt|cv|ud|toko|kios|udt|pd)+/, "");

      const getVal = (row: Record<string, any>, keys: string[]) => {
        const entry = Object.entries(row).find(([k]) =>
          keys.some((target) => cleanForMatch(k).includes(cleanForMatch(target))),
        );
        return entry ? entry[1] : "";
      };

      const formatCellDate = (raw: any): string => {
        if (!raw) return "";
        if (raw instanceof Date && !isNaN(raw.getTime())) {
          return raw.toISOString().slice(0, 10);
        }
        return toIsoDateStr(raw);
      };

      let matchedExisting = 0;
      let autoCreatedPartner = 0;
      const parsed: any[] = [];

      rows.forEach((row) => {
        const partnerName = String(
          getVal(row, ["nama_partner", "partner_name", "partner", "channel", "kiosk", "toko", "customer"]),
        ).trim();
        const lotNo = String(getVal(row, ["lot_no", "lot", "batch"])).trim().toUpperCase();
        if (!partnerName && !lotNo) return;

        const qty = Number(getVal(row, ["shipped_qty_kg", "qty", "quantity", "kg", "volume"])) || 0;
        const drDate = formatCellDate(getVal(row, ["shipping_date", "dr_date", "drdate", "tanggal_kirim", "date"]));
        const expDate = formatCellDate(getVal(row, ["exp_date", "expired", "exp", "kadaluarsa"]));
        const hybrid = String(getVal(row, ["hybrid", "varietas", "material", "produk"]) || "ADV808").trim().toUpperCase();
        const cropsRaw = String(getVal(row, ["crops", "crop", "division", "divisi"]) || effectiveDivision);

        const ck = cleanForMatch(partnerName);
        const stripped = stripPrefix(partnerName);
        let found = partnerByClean.get(ck);
        if (!found && stripped) {
          for (const [, pDoc] of partnerByClean.entries()) {
            if (stripPrefix(pDoc.partner_name) === stripped) {
              found = pDoc;
              break;
            }
          }
        }
        if (found) matchedExisting++;
        else autoCreatedPartner++;

        parsed.push({
          channel: found ? found.partner_name : partnerName,
          lot: lotNo,
          qty,
          drDate: drDate || new Date().toISOString().slice(0, 10),
          expired: expDate || extractExpFromLot(lotNo) || "",
          hybrid,
          crops: toStrictDivision(cropsRaw),
        });
      });

      if (parsed.length === 0) {
        showToast("Tidak ada baris valid ditemukan di file. Pastikan ada kolom nama_partner & lot_no.");
        return;
      }

      const snapshot = buildNormalizedCollections({
        employees,
        kiosks,
        workingRows: sourceWorking,
        drSalesRows: drSalesData || [],
      });
      const res = await saveUploadedDrToFirestore(firebaseUser, parsed, snapshot);
      setDrUploadStats({
        total: parsed.length,
        matchedExisting: matchedExisting,
        autoCreatedPartner: res.createdPartners,
      });
      showToast(
        `Berhasil upload ${res.uploadedCount} DR langsung ke Firestore (${matchedExisting} partner existing · ${res.createdPartners} partner baru).`,
      );
    } catch (err: any) {
      console.error("Failed to upload DR spreadsheet:", err);
      showToast(err?.message || "Gagal membaca/menyimpan file Excel/CSV DR.");
    } finally {
      setIsUploadingDr(false);
    }
  };

  const handleDownloadDrTemplate = async () => {
    const XLSX = await import("xlsx");
    const samplePartner = partnersCol.find((p) => p.division_group === effectiveDivision)?.partner_name || "PT KHARISMA EKA PUTRA";
    const sample = [
      {
        shipping_date: "2026-05-12",
        nama_partner: samplePartner,
        lot_no: "NLE1B1099",
        exp_date: "2027-05-12",
        shipped_qty_kg: 500,
        hybrid: effectiveDivision === "Vegetables" ? "LAVANTA" : "ADV808",
        crops: effectiveDivision,
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), "upload_dr");
    XLSX.writeFile(wb, "template_upload_dr_shipments.xlsx");
    showToast("Template upload DR (.xlsx) berhasil diunduh.");
  };

  const handleExportRelationalExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const stripRaw = (arr: any[]) =>
        arr.map((item) => {
          const copy = { ...item };
          delete copy._raw;
          delete copy._key;
          return copy;
        });

      const flattenLogsForExcel = (arr: typeof opnameLogsCol) =>
        arr.map((l) => {
          const row: Record<string, any> = {
            partner_id: l.partner_id,
            lot_no: l.lot_no,
            checker_id: l.checker_id,
            crop_year: l.crop_year,
          };
          FISCAL_MONTH_COLS.forEach(({ key }) => {
            const cell = l[key];
            row[`${key}_in_kg`] = cell ? cell.in : null;
            row[`${key}_idle_kg`] = cell ? cell.idle : null;
            row[`${key}_pog_kg`] = cell ? cell.pog : null;
          });
          return row;
        });

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flattenLogsForExcel(opnameLogsCol)), "opname_logs");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stripRaw(drShipmentsCol)), "dr_shipments");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stripRaw(lotsCol)), "lots");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stripRaw(hybridsCol)), "hybrids");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stripRaw(partnersCol)), "partners");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stripRaw(employeesCol)), "employees");

      XLSX.writeFile(wb, `firebase_db_collections_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast("6 Koleksi Database berhasil diunduh (.xlsx).");
    } catch {
      showToast("Gagal mengekspor Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const collectionsMeta: Array<{ key: CollectionKey; count: number; pk: string; fks: string }> = [
    {
      key: "opname_logs",
      count: filteredLogs.length,
      pk: "partner_id + lot_no",
      fks: "partner_id → partners, lot_no → lots, checker_id → employees · Bulan: apr → mar {in, idle, pog}",
    },
    {
      key: "dr_shipments",
      count: filteredDr.length,
      pk: "doc_id (DR-xxxx)",
      fks: "partner_id → partners, lot_no → lots",
    },
    {
      key: "lots",
      count: filteredLots.length,
      pk: "doc_id (lot_no)",
      fks: "hybrid_id → hybrids",
    },
    {
      key: "hybrids",
      count: filteredHybrids.length,
      pk: "doc_id (HYB-xxx)",
      fks: "-",
    },
    {
      key: "partners",
      count: filteredPartners.length,
      pk: "doc_id (PRT-xxx)",
      fks: "pic_employee_id → employees",
    },
    {
      key: "employees",
      count: filteredEmployees.length,
      pk: "doc_id (EMP-xxx)",
      fks: "upline_id → employees",
    },
  ];

  const currentMeta = collectionsMeta.find((c) => c.key === activeCollection)!;

  const renderFkBadge = (fkId: string | null, targetCol: CollectionKey) => {
    if (!fkId) return <span className="font-mono text-[11px] text-amber-600">null</span>;
    const tip = idTooltipMap[fkId] || fkId;
    return (
      <button
        type="button"
        onClick={() => {
          handleSelectCollection(targetCol);
          setTempSearchQuery(fkId);
        }}
        title={`${tip} (Klik untuk buka dokumen di koleksi ${targetCol})`}
        className="font-mono text-[11px] font-semibold text-primary bg-[#f4f2ff] hover:bg-[#e6e6ff] px-2 py-0.5 rounded border border-[#e0e0fa] cursor-pointer transition-colors"
      >
        {fkId}
      </button>
    );
  };

  // Reusable Sortable + Searchable Column Header Cell
  const renderHeaderCell = (
    colKey: CollectionKey,
    field: string,
    label: string,
    align: "left" | "right" | "center" = "left",
  ) => {
    const isSorted = sortConfig.field === field;
    const val = getColumnSearch(colKey, field);
    const alignClass =
      align === "right"
        ? "justify-end text-right"
        : align === "center"
          ? "justify-center text-center"
          : "justify-start text-left";

    return (
      <th key={`${colKey}.${field}`} className="py-2 px-3 align-top min-w-[115px]">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => handleToggleSort(field)}
            className={`w-full flex items-center gap-1 font-mono text-[11px] font-bold cursor-pointer select-none transition-colors ${alignClass} ${
              isSorted ? "text-primary" : "text-[#434655] hover:text-[#181a2c]"
            }`}
            title={`Klik untuk urutkan kolom ${label}`}
          >
            <span className="truncate">{label}</span>
            <span className="material-symbols-outlined text-[14px] shrink-0">
              {isSorted
                ? sortConfig.dir === "asc"
                  ? "arrow_upward"
                  : "arrow_downward"
                : "unfold_more"}
            </span>
          </button>
          <div className="relative">
            <input
              type="text"
              value={val}
              onChange={(e) => setColumnSearch(colKey, field, e.target.value)}
              placeholder="Cari..."
              className="w-full h-6 px-2 pr-5 rounded-md bg-white border border-[#e0e0fa] focus:border-primary text-[10px] font-mono font-normal text-[#181a2c] outline-none"
            />
            {val && (
              <button
                type="button"
                onClick={() => setColumnSearch(colKey, field, "")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8E94B7] hover:text-[#181a2c] text-[10px] cursor-pointer"
                title="Hapus filter kolom"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      {(consolidationSuccessMsg || feedback) && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{consolidationSuccessMsg || feedback}</span>
          {feedback && (
            <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Firebase Firestore Live Connection & Rules Bar */}
      <div className="bg-gradient-to-r from-[#154be2]/[0.06] via-white to-emerald-50/70 p-4 rounded-2xl border border-[#154be2]/15 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">
              cloud_done
            </span>
            <h2 className="text-xs font-bold text-[#181a2c] uppercase tracking-wider">
              Firestore Live Sync Aktif (Akses Terbuka Tanpa Login)
            </h2>
          </div>
          <p className="text-[11px] text-[#434655]">
            {isMigrating && migrationStage
              ? migrationStage
              : isLoadingFirestore
                ? "Menarik data real-time dari Firestore..."
                : hasFirestoreData
                  ? "Terhubung ke Firebase Firestore (radaradv-95dbf) · Semua pengunjung dapat membaca & mengedit tanpa login."
                  : "Terhubung ke Firebase Firestore (radaradv-95dbf) · Database kosong (0 dokumen). Siap menerima input atau upload Excel DR tanpa login."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isLoadingFirestore || isMigrating}
            onClick={async () => {
              try {
                await reloadFromFirestore();
                showToast("Data terbaru berhasil ditarik dari Firebase Firestore.");
              } catch (err: any) {
                showToast(err?.message || "Gagal memuat ulang data dari Firestore.");
              }
            }}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            {isLoadingFirestore ? "Memuat..." : "Muat Ulang dari Firestore"}
          </button>
          {isAuthorizedFirebase && (
            <button
              type="button"
              disabled={isMigrating}
              onClick={() => disconnectGoogle()}
              className="h-9 px-3 rounded-xl bg-white border border-[#e0e0fa] hover:bg-red-50 hover:text-red-600 text-[#434655] text-xs font-semibold cursor-pointer"
            >
              Putuskan
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyFirestoreRules}
            className="h-9 px-3 rounded-xl bg-white border border-[#e0e0fa] hover:bg-[#f4f2ff] text-[#181a2c] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Salin seluruh isi firestore.rules ke clipboard"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">
              {copiedRules ? "check" : "content_copy"}
            </span>
            {copiedRules ? "Tersalin!" : "Copy firestore.rules"}
          </button>
          <button
            type="button"
            onClick={() => setShowRulesPanel((v) => !v)}
            className="h-9 px-3 rounded-xl bg-[#f4f2ff] border border-[#e0e0fa] hover:bg-[#e6e6ff] text-primary text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Tampilkan atau sembunyikan isi firestore.rules"
          >
            <span className="material-symbols-outlined text-[15px]">
              {showRulesPanel ? "expand_less" : "security"}
            </span>
            {showRulesPanel ? "Tutup Rules" : "Lihat Rules"}
          </button>
        </div>
      </div>

      {/* Expandable firestore.rules Panel for Easy Copy & Publish */}
      {showRulesPanel && (
        <div className="bg-white rounded-2xl border border-[#e0e0fa] overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-[#f4f2ff]/70 border-b border-[#e0e0fa] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#181a2c] font-mono flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">shield_lock</span>
                firestore.rules (Siap Paste ke Firebase Console → Firestore → Rules)
              </h3>
              <p className="text-[11px] text-[#434655] mt-0.5">
                Akses Terbuka (Baca, Input &amp; Edit Tanpa Login) &middot; Validasi Schema &amp; Integritas Relasi Aktif
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyFirestoreRules}
                className="h-8 px-3 rounded-xl bg-[#154be2] hover:bg-[#154be2]/90 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copiedRules ? "check" : "content_copy"}
                </span>
                {copiedRules ? "Tersalin!" : "Salin Semua Rules"}
              </button>
              <button
                type="button"
                onClick={handleDownloadFirestoreRules}
                className="h-8 px-3 rounded-xl bg-white border border-[#e0e0fa] hover:bg-[#f4f2ff] text-[#181a2c] text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                .rules
              </button>
            </div>
          </div>
          <pre className="p-4 text-[11px] font-mono text-[#181a2c] bg-[#fbf8ff] overflow-auto max-h-[340px] leading-relaxed select-all">
            {firestoreRulesText}
          </pre>
        </div>
      )}

      {/* Top Bar: Database Schema Info, Search & Export */}
      <div className="bg-white p-4 rounded-2xl border border-[#e0e0fa] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">database</span>
            <h1 className="text-base font-bold text-[#181a2c] font-mono">
              firestore_db / {activeCollection}
            </h1>
          </div>
          <p className="text-[11px] font-mono text-[#747687] mt-0.5">
            PK: <strong className="text-[#181a2c]">{currentMeta.pk}</strong> · FK:{" "}
            <span className="text-primary">{currentMeta.fks}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Strict 2-Division Switcher: Field Corn vs Vegetables */}
          <div className="flex items-center bg-[#f4f2ff] p-1 rounded-xl border border-[#e0e0fa]">
            <button
              type="button"
              onClick={() => {
                setActiveDivision("Field Corn");
                setSimulatedLoginEmpId("ADMIN_DIV");
              }}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                effectiveDivision === "Field Corn"
                  ? "bg-[#154be2] text-white shadow-sm"
                  : "text-[#434655] hover:text-[#181a2c]"
              }`}
            >
              Field Corn
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveDivision("Vegetables");
                setSimulatedLoginEmpId("ADMIN_DIV");
              }}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                effectiveDivision === "Vegetables"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-[#434655] hover:text-[#181a2c]"
              }`}
            >
              Vegetables
            </button>
          </div>

          {/* 2. Hierarchy Login Scope Simulator (Scoped strictly to active division) */}
          <select
            value={simulatedLoginEmpId}
            onChange={(e) => setSimulatedLoginEmpId(e.target.value)}
            className="h-9 px-3 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-xs font-semibold text-emerald-900 outline-none cursor-pointer max-w-[260px]"
            title="Admin hanya melihat semua data pada 1 divisi (Field Corn saja atau Vegetables saja); Sales melihat data miliknya + bawahannya (under)"
          >
            <option value="ADMIN_DIV">
              Admin: Semua Data {effectiveDivision} Saja
            </option>
            {employeesCol
              .filter((emp) => emp.division_group === effectiveDivision && emp.role_level < 5)
              .sort((a, b) => b.role_level - a.role_level || a.full_name.localeCompare(b.full_name))
              .map((emp) => (
                <option key={emp.doc_id} value={emp.doc_id}>
                  [Lv.{emp.role_level}] {emp.full_name} ({emp.position} · {emp.subordinate_ids.length} under)
                </option>
              ))}
          </select>

          {/* Search */}
          <div className="relative w-full sm:w-48">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E94B7] text-[15px]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter doc_id / FK / value..."
              value={tempSearchQuery}
              onChange={(e) => setTempSearchQuery(e.target.value)}
              className="w-full h-9 bg-[#f4f2ff]/60 border border-[#e0e0fa] rounded-xl pl-8 pr-7 font-mono text-xs text-[#181a2c] outline-none focus:bg-white focus:border-primary"
            />
            {tempSearchQuery && (
              <button
                type="button"
                onClick={() => setTempSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E94B7] hover:text-[#181a2c] cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Switcher: Table vs JSON */}
          <div className="flex items-center bg-[#f4f2ff] p-1 rounded-xl border border-[#e0e0fa]">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                viewMode === "table" ? "bg-white text-[#181a2c] shadow-sm" : "text-[#747687]"
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("json")}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                viewMode === "json" ? "bg-white text-[#181a2c] shadow-sm" : "text-[#747687]"
              }`}
            >
              JSON
            </button>
          </div>

          {activeCollection === "partners" && setPartnerEditModal && (
            <button
              type="button"
              onClick={() =>
                setPartnerEditModal({
                  isOpen: true,
                  item: {
                    id: null,
                    name: "",
                    pic: userData?.name || "",
                    category: "R1",
                    province: "",
                    group: "Field Corn",
                    isAdd: true,
                  },
                })
              }
              className="h-9 px-3 rounded-xl bg-[#181a2c] text-white text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
            >
              + doc
            </button>
          )}

          {activeCollection === "employees" && setEmployeeEditModal && (
            <button
              type="button"
              onClick={() => {
                const defaultAgro = employeesCol.find(
                  (e) => e.division_group === effectiveDivision && e.role_level === 2,
                );
                setEmployeeEditModal({
                  isOpen: true,
                  item: {
                    name: "",
                    user: "",
                    position: "Business Solution",
                    province: defaultAgro?.province || "",
                    area: defaultAgro?.area || "",
                    upline: activeLoginEmp?.full_name || defaultAgro?.full_name || "",
                    password: "123",
                    level: "1",
                    group: effectiveDivision,
                    isAdd: true,
                  },
                });
              }}
              className="h-9 px-3 rounded-xl bg-[#181a2c] text-white text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
            >
              + doc
            </button>
          )}

          <button
            type="button"
            onClick={handleExportFirebaseJson}
            className="h-9 px-3 rounded-xl bg-white border border-[#e0e0fa] hover:bg-[#f4f2ff] text-[#181a2c] text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-600">data_object</span>
            Export .json
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportRelationalExcel}
            className="h-9 px-3 rounded-xl bg-[#154be2] hover:bg-[#154be2]/90 text-white text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            Export .xlsx
          </button>
        </div>
      </div>

      {/* Collection Selector Tabs (7 Normalized Collections) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-1.5 rounded-2xl border border-[#e0e0fa]">
        <div className="flex flex-wrap items-center gap-1.5">
          {collectionsMeta.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => handleSelectCollection(c.key)}
              className={`h-8 px-3 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeCollection === c.key
                  ? "bg-[#181a2c] text-white shadow-sm"
                  : "text-[#434655] hover:bg-[#f4f2ff] hover:text-[#181a2c]"
              }`}
            >
              <span>{c.key}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded ${
                  activeCollection === c.key ? "bg-white/20 text-white" : "bg-[#f4f2ff] text-[#747687]"
                }`}
              >
                {c.count}
              </span>
            </button>
          ))}
        </div>

        {hasActiveColFilters && (
          <button
            type="button"
            onClick={clearActiveCollectionFilters}
            className="h-7 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-mono text-[11px] font-semibold cursor-pointer mr-1"
          >
            Reset Filter Kolom ✕
          </button>
        )}
      </div>

      {/* View Mode: Raw Firebase JSON Document Tree */}
      {viewMode === "json" ? (
        <div className="bg-[#181a2c] text-[#f1efff] rounded-2xl border border-[#e0e0fa] p-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs font-mono text-[#8E94B7]">
            <span>Collection Path: /{activeCollection}/&#123;doc_id&#125;</span>
            <span>Klik &quot;Export .json&quot; untuk mengunduh seluruh koleksi</span>
          </div>
          <pre className="font-mono text-[11px] leading-relaxed">
            {JSON.stringify(firebaseCollectionsPayload[activeCollection], null, 2)}
          </pre>
        </div>
      ) : (
        /* View Mode: Pure Database Table (Strict Document ID & Foreign Keys) */
        <div className="bg-white rounded-2xl border border-[#e0e0fa] overflow-hidden">
          <div className="overflow-x-auto">
            {/* 1. opname_logs (Header Per Bulan: April -> Maret dengan IN, IDLE, POG) */}
            {activeCollection === "opname_logs" && (
              <div>
                {/* Sub-bar Arsitektur: 1 Tabel Gabungan vs Filter Metrik (In / Idle / POG) */}
                <div className="px-4 py-3 bg-[#f4f2ff]/40 border-b border-[#e0e0fa] flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="text-xs text-[#434655]">
                    <span className="font-bold text-[#181a2c]">
                      Struktur 1 Tabel Gabungan (Per Tahun Fiskal `crop_year: FY2026`, Apr → Mar):
                    </span>{" "}
                    Setiap sel bulan menyimpan objek{" "}
                    <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#e0e0fa] text-primary">
                      &#123; in, idle, pog &#125;
                    </code>{" "}
                    lengkap dengan rekap saldo akhir dan status.
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#e0e0fa] shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpnameMetricView("combined")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                        opnameMetricView === "combined"
                          ? "bg-[#181a2c] text-white"
                          : "text-[#434655] hover:bg-[#f4f2ff]"
                      }`}
                    >
                      1 Tabel: IN · IDLE · POG
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameMetricView("in")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                        opnameMetricView === "in"
                          ? "bg-blue-600 text-white"
                          : "text-blue-700 hover:bg-blue-50"
                      }`}
                    >
                      Hanya IN
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameMetricView("idle")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                        opnameMetricView === "idle"
                          ? "bg-amber-600 text-white"
                          : "text-amber-700 hover:bg-amber-50"
                      }`}
                    >
                      Hanya IDLE
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameMetricView("pog")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                        opnameMetricView === "pog"
                          ? "bg-emerald-600 text-white"
                          : "text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      Hanya POG
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#e0e0fa] bg-[#f4f2ff]/60">
                      {renderHeaderCell("opname_logs", "partner_id", "partner_id (FK)")}
                      {renderHeaderCell("opname_logs", "lot_no", "lot_no (FK)")}
                      {renderHeaderCell("opname_logs", "checker_id", "checker_id (FK)")}
                      {renderHeaderCell("opname_logs", "crop_year", "crop_year")}
                      {FISCAL_MONTH_COLS.map((m) =>
                        renderHeaderCell("opname_logs", m.key, m.label, "center"),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f0fa] text-[#181a2c]">
                    {filteredLogs.map((l) => (
                      <tr key={l._key} className="hover:bg-[#f4f2ff]/30">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderFkBadge(l.partner_id, "partners")}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderFkBadge(l.lot_no, "lots")}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderFkBadge(l.checker_id, "employees")}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#434655] whitespace-nowrap">
                          {l.crop_year}
                        </td>
                        {FISCAL_MONTH_COLS.map(({ key }) => {
                          const cell = l[key];
                          if (!cell) {
                            return (
                              <td
                                key={key}
                                className="py-2.5 px-3 text-center text-[#c0c2d4] border-l border-[#f4f2ff]"
                              >
                                -
                              </td>
                            );
                          }
                          if (opnameMetricView === "in") {
                            return (
                              <td
                                key={key}
                                className="py-2.5 px-3 text-right tabular-nums font-bold text-blue-700 border-l border-[#f4f2ff]"
                              >
                                {cell.in}
                              </td>
                            );
                          }
                          if (opnameMetricView === "idle") {
                            return (
                              <td
                                key={key}
                                className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-700 border-l border-[#f4f2ff]"
                              >
                                {cell.idle}
                              </td>
                            );
                          }
                          if (opnameMetricView === "pog") {
                            return (
                              <td
                                key={key}
                                className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-700 border-l border-[#f4f2ff]"
                              >
                                {cell.pog}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={key}
                              className="py-2 px-2.5 border-l border-[#f4f2ff] whitespace-nowrap"
                            >
                              <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight bg-[#f9f8ff] px-2 py-1 rounded border border-[#e8e6fc]">
                                <span className="text-blue-700 font-semibold" title="Stock In (kg)">
                                  in:{cell.in}
                                </span>
                                <span className="text-[#c0c2d4]">|</span>
                                <span className="text-amber-700 font-bold" title="Idle / Sisa Stok (kg)">
                                  idle:{cell.idle}
                                </span>
                                <span className="text-[#c0c2d4]">|</span>
                                <span className="text-emerald-700 font-bold" title="POG / Terserap (kg)">
                                  pog:{cell.pog}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. dr_shipments */}
            {activeCollection === "dr_shipments" && (
              <div>
                {/* Solusi Upload DR dengan Nama Partner (Auto-Mapping ke partner_id FK) */}
                <div className="px-4 py-3 bg-[#f4f2ff]/40 border-b border-[#e0e0fa] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="text-xs text-[#434655] space-y-0.5">
                    <div className="font-bold text-[#181a2c]">
                      Upload DR Pakai <span className="text-primary">Nama Partner</span> → Otomatis Jadi{" "}
                      <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#e0e0fa] text-primary">
                        partner_id (FK)
                      </code>
                    </div>
                    <div className="text-[11px]">
                      Saat upload Excel/CSV dengan kolom <code className="font-mono">nama_partner</code>, sistem otomatis mencocokkan nama (abaikan huruf besar/titik/PT/CV) ke tabel <strong>partners</strong> untuk mengisi <code className="font-mono">partner_id</code>. Jika toko belum ada, otomatis dibuatkan <code className="font-mono">PRT-xxx</code> baru.
                    </div>
                    {drUploadStats && (
                      <div className="text-[11px] font-semibold text-emerald-700 pt-0.5">
                        Upload terakhir: {drUploadStats.total} baris ({drUploadStats.matchedExisting} cocok ke partner existing · {drUploadStats.autoCreatedPartner} partner baru dibuat otomatis).
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadDrTemplate}
                      className="h-8 px-3 rounded-xl bg-white border border-[#e0e0fa] hover:bg-[#f4f2ff] text-[#181a2c] text-[11px] font-mono font-semibold cursor-pointer"
                    >
                      Template .xlsx
                    </button>
                    <label className="h-8 px-3 rounded-xl bg-[#154be2] hover:bg-[#154be2]/90 text-white text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer">
                      <span className="material-symbols-outlined text-[15px]">upload_file</span>
                      {isUploadingDr ? "Memproses..." : "Upload DR (.xlsx / .csv)"}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleUploadDrSpreadsheet}
                        disabled={isUploadingDr}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#e0e0fa] bg-[#f4f2ff]/60">
                      {renderHeaderCell("dr_shipments", "doc_id", "doc_id (PK)")}
                      {renderHeaderCell("dr_shipments", "shipping_date", "shipping_date")}
                      {renderHeaderCell("dr_shipments", "partner_id", "partner_id (FK)")}
                      {renderHeaderCell("dr_shipments", "lot_no", "lot_no (FK)")}
                      {renderHeaderCell("dr_shipments", "exp_date", "exp_date")}
                      {renderHeaderCell("dr_shipments", "shipped_qty_kg", "shipped_qty_kg", "right")}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f0fa] text-[#181a2c]">
                    {filteredDr.map((d) => (
                      <tr key={d.doc_id} className="hover:bg-[#f4f2ff]/30">
                        <td className="py-2.5 px-4 font-bold">{d.doc_id}</td>
                        <td className="py-2.5 px-4 text-[#434655]">{d.shipping_date}</td>
                        <td className="py-2.5 px-4">{renderFkBadge(d.partner_id, "partners")}</td>
                        <td className="py-2.5 px-4">{renderFkBadge(d.lot_no, "lots")}</td>
                        <td className="py-2.5 px-4 text-[#434655]">{d.exp_date || "null"}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {d.shipped_qty_kg}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. lots */}
            {activeCollection === "lots" && (
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#e0e0fa] bg-[#f4f2ff]/60">
                    {renderHeaderCell("lots", "doc_id", "doc_id / lot_no (PK)")}
                    {renderHeaderCell("lots", "hybrid_id", "hybrid_id (FK)")}
                    {renderHeaderCell("lots", "shipping_date", "shipping_date")}
                    {renderHeaderCell("lots", "exp_date", "exp_date")}
                    {renderHeaderCell("lots", "initial_dr_kg", "initial_dr_kg", "right")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0fa] text-[#181a2c]">
                  {filteredLots.map((l) => (
                    <tr key={l.doc_id} className="hover:bg-[#f4f2ff]/30">
                      <td className="py-2.5 px-4 font-bold">{l.doc_id}</td>
                      <td className="py-2.5 px-4">{renderFkBadge(l.hybrid_id, "hybrids")}</td>
                      <td className="py-2.5 px-4 text-[#434655]">{l.shipping_date || "null"}</td>
                      <td className="py-2.5 px-4 text-[#434655]">{l.exp_date || "null"}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                        {l.initial_dr_kg}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 5. hybrids */}
            {activeCollection === "hybrids" && (
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#e0e0fa] bg-[#f4f2ff]/60">
                    {renderHeaderCell("hybrids", "doc_id", "doc_id (PK)")}
                    {renderHeaderCell("hybrids", "hybrid_name", "hybrid_name")}
                    {renderHeaderCell("hybrids", "crop_type", "crop_type")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0fa] text-[#181a2c]">
                  {filteredHybrids.map((h) => (
                    <tr key={h.doc_id} className="hover:bg-[#f4f2ff]/30">
                      <td className="py-2.5 px-4 font-bold">{h.doc_id}</td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-primary">
                        {h.hybrid_name}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{h.crop_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 6. partners */}
            {activeCollection === "partners" && (
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#e0e0fa] bg-[#f4f2ff]/60">
                    {renderHeaderCell("partners", "doc_id", "doc_id (PK)")}
                    {renderHeaderCell("partners", "partner_name", "partner_name")}
                    {renderHeaderCell("partners", "category", "category")}
                    {renderHeaderCell("partners", "pic_employee_id", "pic_employee_id (FK)")}
                    {renderHeaderCell("partners", "division_group", "division_group")}
                    {renderHeaderCell("partners", "province", "province")}
                    {renderHeaderCell("partners", "area", "area")}
                    <th className="py-2 px-4 text-right align-top font-bold text-[11px] text-[#434655]">
                      actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0fa] text-[#181a2c]">
                  {filteredPartners.map((p) => (
                    <tr key={p.doc_id} className="hover:bg-[#f4f2ff]/30">
                      <td className="py-2.5 px-4 font-bold">{p.doc_id}</td>
                      <td className="py-2.5 px-4 font-sans font-semibold">{p.partner_name}</td>
                      <td className="py-2.5 px-4 text-primary font-semibold">{p.category}</td>
                      <td className="py-2.5 px-4">
                        {renderFkBadge(p.pic_employee_id, "employees")}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{p.division_group}</td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{p.province}</td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{p.area}</td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <div className="inline-flex items-center gap-1.5">
                          {setPartnerEditModal && (
                            <button
                              type="button"
                              onClick={() => setPartnerEditModal({ isOpen: true, item: p._raw })}
                              className="px-2 py-0.5 rounded bg-[#f4f2ff] hover:bg-[#e6e6ff] text-primary text-[11px] font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {setPartnerDeleteModal && (
                            <button
                              type="button"
                              onClick={() => setPartnerDeleteModal({ isOpen: true, item: p._raw })}
                              className="px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold cursor-pointer"
                            >
                              Del
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 7. employees */}
            {activeCollection === "employees" && (
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#e0e0fa] bg-[#f4f2ff]/60">
                    {renderHeaderCell("employees", "doc_id", "doc_id (PK)")}
                    {renderHeaderCell("employees", "username", "username")}
                    {renderHeaderCell("employees", "password", "password")}
                    {renderHeaderCell("employees", "full_name", "full_name")}
                    {renderHeaderCell("employees", "position", "position")}
                    {renderHeaderCell("employees", "role_level", "role_level", "center")}
                    {renderHeaderCell("employees", "upline_id", "upline_id (FK)")}
                    {renderHeaderCell("employees", "subordinate_ids", "subordinate_ids (Under)")}
                    {renderHeaderCell("employees", "division_group", "division_group")}
                    {renderHeaderCell("employees", "province", "province")}
                    {renderHeaderCell("employees", "area", "area")}
                    <th className="py-2 px-4 text-right align-top font-bold text-[11px] text-[#434655]">
                      actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0fa] text-[#181a2c]">
                  {filteredEmployees.map((e) => (
                    <tr key={e.doc_id} className="hover:bg-[#f4f2ff]/30">
                      <td className="py-2.5 px-4 font-bold">{e.doc_id}</td>
                      <td className="py-2.5 px-4 text-[#434655]">{e.username}</td>
                      <td className="py-2.5 px-4 text-[#747687]">
                        {isAuthorizedFirebase || hasFirestoreData ? "••• (Secured)" : e.password}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-semibold">{e.full_name}</td>
                      <td className="py-2.5 px-4 font-sans text-primary font-medium">
                        {e.position}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold">Lv.{e.role_level}</td>
                      <td className="py-2.5 px-4">{renderFkBadge(e.upline_id, "employees")}</td>
                      <td className="py-2.5 px-4">
                        {e.subordinate_ids.length === 0 ? (
                          <span className="text-[#8E94B7] text-[11px]">[] (Terbawah)</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {e.subordinate_ids.length} under:
                            </span>
                            {e.subordinate_ids.slice(0, 4).map((subId) => (
                              <React.Fragment key={subId}>
                                {renderFkBadge(subId, "employees")}
                              </React.Fragment>
                            ))}
                            {e.subordinate_ids.length > 4 && (
                              <span
                                className="text-[10px] text-[#747687] font-semibold"
                                title={e.subordinate_ids
                                  .map((id) => `${id}: ${idTooltipMap[id] || ""}`)
                                  .join("\n")}
                              >
                                +{e.subordinate_ids.length - 4} lagi
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{e.division_group}</td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{e.province}</td>
                      <td className="py-2.5 px-4 font-sans text-[#434655]">{e.area}</td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <div className="inline-flex items-center gap-1.5">
                          {setEmployeeEditModal && (
                            <button
                              type="button"
                              onClick={() => setEmployeeEditModal({ isOpen: true, item: e._raw })}
                              className="px-2 py-0.5 rounded bg-[#f4f2ff] hover:bg-[#e6e6ff] text-primary text-[11px] font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {setEmployeeDeleteModal && (
                            <button
                              type="button"
                              onClick={() => setEmployeeDeleteModal({ isOpen: true, item: e._raw })}
                              className="px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold cursor-pointer"
                            >
                              Del
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modals for Add/Edit/Delete */}
      {partnerEditModal && setPartnerEditModal && handleEditPartnerSave && (
        <PartnerEditModal
          isOpen={partnerEditModal.isOpen}
          item={partnerEditModal.item}
          onClose={() => setPartnerEditModal({ isOpen: false, item: null })}
          onSave={handleEditPartnerSave}
          isSaving={isActionLoading}
          activeEmployees={myActiveSubordinates}
          allProvinces={availableProvinces}
          allCategories={allCategories}
          userData={userData}
          allGroups={availableGroups}
        />
      )}
      {partnerDeleteModal && setPartnerDeleteModal && handleDeletePartnerConfirm && (
        <PartnerDeleteModal
          isOpen={partnerDeleteModal.isOpen}
          onClose={() => setPartnerDeleteModal({ isOpen: false, item: null })}
          onConfirm={handleDeletePartnerConfirm}
          isProcessing={isActionLoading}
          itemName={partnerDeleteModal.item?.name}
        />
      )}
      {employeeEditModal && setEmployeeEditModal && handleEditEmployeeSave && (
        <EmployeeEditModal
          isOpen={employeeEditModal.isOpen}
          item={employeeEditModal.item}
          onClose={() => setEmployeeEditModal({ isOpen: false, item: null })}
          onSave={handleEditEmployeeSave}
          isSaving={isActionLoading}
          userData={userData}
          allProvinces={availableProvinces}
          accessRules={accessRules}
          allEmployees={employees}
        />
      )}
      {employeeDeleteModal && setEmployeeDeleteModal && handleDeleteEmployeeConfirm && (
        <EmployeeDeleteModal
          isOpen={employeeDeleteModal.isOpen}
          onClose={() => setEmployeeDeleteModal({ isOpen: false, item: null })}
          onConfirm={handleDeleteEmployeeConfirm}
          isProcessing={isActionLoading}
          itemName={employeeDeleteModal.item?.name}
        />
      )}
    </div>
  );
};

export default TempTab;
