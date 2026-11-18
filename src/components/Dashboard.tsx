import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { AdvantaLogo } from "../AdvantaLogo";
import { UserIcon } from "../UserIcon";
import { SCRIPT_URL, INDO_MONTHS } from "../utils/constants";
import { customFetch } from "../utils/api";
import {
  cleanForMatch,
  getValidCategory,
  safeParseFloat,
  matchNames,
  checkCropMatch,
  formatOverviewVal,
  formatOverviewWithUnit,
  extractExpFromLot,
} from "../utils/formatters";
import {
  normalizePosition,
  getPositionRank,
  parseLevelStr,
  getFromRecord,
  getMemberLevel,
  compareMembersByLevel,
  getUplineInTeam,
  buildDepthMap,
  getDdaOfUser,
  getResolvedPic,
} from "../utils/hierarchy";
import { LogoutConfirmModal } from "./modals/LogoutConfirmModal";
import type { OverviewDimension } from "./tabs/OverviewTab";
import { useFirebase } from "../contexts/FirebaseContext";
import {
  buildNormalizedCollections,
  hydrateDashboardFromNormalized,
  padFsId,
  toValidDocId,
} from "../utils/firestoreNormalization";
import {
  deleteEmployeeFirestore,
  deletePartnerFirestore,
  saveAccessRulesFirestore,
  saveBatchActivityToFirestore,
  upsertEmployeeFirestore,
  upsertPartnerFirestore,
} from "../services/firestoreDb";
import firestoreRulesText from "../../firestore.rules?raw";

const OverviewTab = lazy(() => import("./tabs/OverviewTab"));
const HomeTab = lazy(() => import("./tabs/HomeTab"));
const PartnerTab = lazy(() => import("./tabs/PartnerTab"));
const StockSummaryTab = lazy(() => import("./tabs/StockSummaryTab"));
const PogTab = lazy(() => import("./tabs/PogTab"));
const AccessTab = lazy(() => import("./tabs/AccessTab"));
const TempTab = lazy(() => import("./tabs/TempTab"));

const Dashboard = ({
  userData,
  activeTab,
  onLogout,
  onOpenAdminLogin,
  onUserSwitch,
  setUserData,
  setActiveTab,
  accessRules,
  setAccessRules,
  overviewMetricFilter,
  setOverviewMetricFilter,
  filterBelowMonth,
  setFilterBelowMonth,
  filterBelowChannel,
  setFilterBelowChannel,
  filterBelowMaterial,
  setFilterBelowMaterial,
  filterBelowTeam,
  setFilterBelowTeam,
  filterBelowArea,
  setFilterBelowArea,
  filterBelowCrop,
  setFilterBelowCrop,
}: any) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUserSwitching, setIsUserSwitching] = useState(false);
  const [historyChartType, setHistoryChartType] = useState<
    "opening" | "ending" | "stockIn" | "idle" | "pog"
  >("pog");

  const handleFullscreen = () => {
    try {
      const docEl = document.documentElement;
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement &&
        !(document as any).mozFullScreenElement &&
        !(document as any).msFullscreenElement
      ) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).mozRequestFullScreen) {
          (docEl as any).mozRequestFullScreen();
        } else if ((docEl as any).msRequestFullscreen) {
          (docEl as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (e) {
      console.error("Error toggling fullscreen mode:", e);
    }
  };

  const [kiosks, setKiosks] = useState([]);
  const [workingData, setWorkingData] = useState([]);
  const [rawWorkingData, setRawWorkingData] = useState([]);
  const [drSalesData, setDrSalesData] = useState<any[]>([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChannelsLoading, setIsChannelsLoading] = useState(true);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const {
    firebaseUser,
    isAuthReady,
    isAuthorizedFirebase,
    firestoreReadError,
    firestoreDataset,
    firestoreAccessRules,
    isLoadingFirestore,
    reloadFromFirestore,
    retryFirestoreSync,
  } = useFirebase();
  const [copiedBannerRules, setCopiedBannerRules] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);

  const normalizedSnapshot = useMemo(
    () =>
      buildNormalizedCollections({
        employees,
        kiosks,
        workingRows: rawWorkingData && rawWorkingData.length > 0 ? rawWorkingData : workingData,
        drSalesRows: drSalesData,
      }),
    [employees, kiosks, rawWorkingData, workingData, drSalesData],
  );

  const computedTeamProfiles = useMemo(() => {
    if (!employees || employees.length === 0) return undefined;
    const profiles: Record<string, any> = {};
    employees.forEach((emp) => {
      // Use clean names for keys to ensure successful lookup
      if (emp.name) profiles[cleanForMatch(emp.name)] = emp;
      if (emp.user) profiles[cleanForMatch(emp.user)] = emp;
      if (emp.email) profiles[cleanForMatch(emp.email)] = emp;
    });
    return profiles;
  }, [employees]);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const isLoadingData =
      isFetchingData || isChannelsLoading || isEmployeesLoading;
    if (isLoadingData) {
      setShowLoader(true);
      setLoadProgress(0);
      let currentProgress = 0;
      const interval = setInterval(() => {
        if (currentProgress < 30) {
          currentProgress += Math.floor(Math.random() * 8) + 4;
        } else if (currentProgress < 60) {
          currentProgress += Math.floor(Math.random() * 5) + 2;
        } else if (currentProgress < 85) {
          currentProgress += Math.floor(Math.random() * 3) + 1;
        } else if (currentProgress < 98) {
          currentProgress += Math.random() > 0.6 ? 1 : 0;
        }
        if (currentProgress > 98) currentProgress = 98;
        setLoadProgress(currentProgress);
      }, 150);

      return () => {
        clearInterval(interval);
      };
    } else {
      setLoadProgress(100);
      const timeout = setTimeout(() => {
        setShowLoader(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isFetchingData, isChannelsLoading, isEmployeesLoading]);

  // Dimension filter for Executive Overview chart (Area, Province, Sales Agronomist, Business Solution, Material)
  const [overviewGroupDimension, setOverviewGroupDimension] = useState<
    "area" | "province" | "sales_agronomist" | "business_solution" | "material"
  >("area");

  // Dynamic parameters for Overview Bar Chart
  const isMovement = overviewMetricFilter === "movement";
  const isArea = overviewGroupDimension === "area";
  const isProvince = overviewGroupDimension === "province";

  const currentBarGap = 0;
  const currentBarCategoryGap = "10%";
  const currentMaxBarSize = 75;

  const isBusinessAnalyst = useMemo(() => {
    if (!userData) return false;
    if (userData.isPublic) return true;
    const posClean = userData.position ? cleanForMatch(userData.position) : "";
    const nameClean = cleanForMatch(userData.name || "");
    const userClean = cleanForMatch(userData.user || "");
    const numLevel = userData.level ? parseInt(String(userData.level).trim(), 10) : NaN;
    const isBA =
      posClean === "businessanalyst" ||
      posClean === "analyst" ||
      nameClean === "adityawiratama" ||
      nameClean === "aditya" ||
      userClean === "adityahead" ||
      posClean === "vegetablessalesmanager" ||
      posClean === "commerciallead" ||
      posClean === "countryhead" ||
      nameClean === "suryanto" ||
      nameClean === "suryantobudisantoso" ||
      userClean === "suryantohead" ||
      userClean === "daniheadoffice" ||
      userClean === "yashheadoffice" ||
      (!isNaN(numLevel) && numLevel >= 4);
    const isAdmin = userData.level && String(userData.level).toLowerCase().trim() === "admin";
    return isBA || isAdmin;
  }, [userData]);

  // State Tab Home
  const [selectedKiosk, setSelectedKiosk] = useState("Loading Kiosk...");

  const recommendedLots = useMemo(() => {
    if (!selectedKiosk) return [];
    const cleanKiosk = cleanForMatch(selectedKiosk);
    const set = new Set<string>();
    const list: { lot: string; hybrid: string }[] = [];
    
    // Find in drSalesData
    if (Array.isArray(drSalesData)) {
      drSalesData.forEach((dr) => {
        if (dr.lot && cleanForMatch(dr.channel) === cleanKiosk) {
          const uLot = String(dr.lot).toUpperCase().trim();
          if (!set.has(uLot)) {
            set.add(uLot);
            list.push({ lot: uLot, hybrid: dr.hybrid || "" });
          }
        }
      });
    }

    // Find in rawWorkingData
    if (Array.isArray(rawWorkingData)) {
      rawWorkingData.forEach((w) => {
        if (w.lot && cleanForMatch(w.kiosk) === cleanKiosk) {
          const uLot = String(w.lot).toUpperCase().trim();
          if (!set.has(uLot)) {
            set.add(uLot);
            list.push({ lot: uLot, hybrid: w.hybrid || "" });
          }
        }
      });
    }

    return list.slice(0, 8);
  }, [selectedKiosk, drSalesData, rawWorkingData]);

  const handleChannelClick = (channelName: string) => {
    const matchedKiosk = kiosks.find(
      (k) => cleanForMatch(k.name) === cleanForMatch(channelName),
    );
    if (matchedKiosk) {
      setSelectedKiosk(matchedKiosk.name);
      if (setActiveTab) {
        setActiveTab("home");
      }
    }
  };

  const renderMaybeChannelName = (name: string, defaultClass = "") => {
    const isChannel = kiosks.some(
      (k) => cleanForMatch(k.name) === cleanForMatch(name),
    );
    if (isChannel) {
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            handleChannelClick(name);
          }}
          className={`${defaultClass} hover:underline decoration-primary hover:text-primary transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-primary group`}
          title="Klik untuk input aktivitas partner ini"
        >
          {name}
          <span className="material-symbols-outlined text-[13px] inline opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all text-primary">
            edit_note
          </span>
        </span>
      );
    }
    return <span className={defaultClass}>{name}</span>;
  };
  const [lotNo, setLotNo] = useState("");
  const [qty, setQty] = useState("");
  const [editModal, setEditModal] = useState({ isOpen: false, item: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [lotIntel, setLotIntel] = useState(null);
  const [isLotChecking, setIsLotChecking] = useState(false);
  const [isLotNotFound, setIsLotNotFound] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualHybrid, setManualHybrid] = useState("");
  const [manualCrop, setManualCrop] = useState("Field Corn");
  const [manualDrDate, setManualDrDate] = useState("");
  const [manualExpDate, setManualExpDate] = useState("");
  const [manualHybridCustom, setManualHybridCustom] = useState("");

  // State Tab Partner
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const userLevel = useMemo(() => {
    if (!userData) return 0;
    if (
      userData.level !== undefined &&
      userData.level !== null &&
      String(userData.level).trim() !== ""
    ) {
      const parsed = parseLevelStr(userData.level);
      if (!isNaN(parsed)) return parsed;
    }
    const rank = getPositionRank(userData.position);
    if (rank === 1) return 5;
    if (rank === 2) return 4;
    if (rank === 3) return 3;
    if (rank === 4) return 2;
    if (rank === 5) return 1;
    return 0;
  }, [userData]);

  const [partnerSubTab, setPartnerSubTab] = useState(() => {
    const parsedLevel =
      userData?.level !== undefined &&
      userData?.level !== null &&
      String(userData?.level).trim() !== ""
        ? parseLevelStr(userData.level)
        : userData?.position
          ? getPositionRank(userData.position) === 5
            ? 1
            : 0
          : 0;
    return parsedLevel === 1 ? "channel" : "team";
  });

  useEffect(() => {
    if (userLevel === 1) {
      setPartnerSubTab("channel");
    } else {
      setPartnerSubTab("team");
    }
  }, [userData, userLevel]);

  const [mappingPic, setMappingPic] = useState("");
  const [mappingCategory, setMappingCategory] = useState("");
  const [partnerEditModal, setPartnerEditModal] = useState({
    isOpen: false,
    item: null,
  });
  const [partnerDeleteModal, setPartnerDeleteModal] = useState({
    isOpen: false,
    item: null,
  });
  const [channelsRefreshKey, setChannelsRefreshKey] = useState(0);
  const [isChartFocusedModalOpen, setIsChartFocusedModalOpen] = useState(false);

  // State Employee Modifying & Hirarki Expand/Collapse
  const [employeeEditModal, setEmployeeEditModal] = useState<{
    isOpen: boolean;
    item: any | null;
  }>({ isOpen: false, item: null });
  const [employeeDeleteModal, setEmployeeDeleteModal] = useState<{
    isOpen: boolean;
    item: any | null;
  }>({ isOpen: false, item: null });
  const [employeesRefreshKey, setEmployeesRefreshKey] = useState(0);



  const activeEmployees = useMemo(() => {
    return (employees || []).filter((emp: any) => {
      const status = String(emp.status || "").trim().toLowerCase();
      // If no status is specified, treat as active. Only filter out if explicit inactive status.
      return status === "aktif" || status === "active" || status === "" || status === "-";
    });
  }, [employees]);


  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>(
    {},
  );

  const availableProvinces = useMemo(() => {
    const list = new Set<string>();
    employees.forEach((emp) => {
      const prov = String(emp.province || "").trim();
      if (prov && prov !== "-") {
        list.add(prov);
      }
    });
    // Fallback defaults
    ["Jawa Timur", "Jawa Tengah", "Jawa Barat"].forEach((p) => list.add(p));
    return Array.from(list).sort();
  }, [employees]);

  const availableGroups = useMemo(() => {
    const list = new Set<string>();
    employees.forEach((emp) => {
      const g = String(emp.group || "").trim();
      if (g && g !== "-") {
        list.add(g);
      }
    });
    if (userData?.group) {
      list.add(String(userData.group).trim());
    }
    ["Advanta"].forEach((g) => list.add(g));
    return Array.from(list).sort();
  }, [employees, userData]);

  // State Tab Summary
  const [summaryGroupBy, setSummaryGroupBy] = useState("hybrid"); // Default changed to 'hybrid'
  const [summarySubGroupBy, setSummarySubGroupBy] = useState("channel"); // Sub category
  const [grandTotalViewBy, setGrandTotalViewBy] = useState<"hybrid" | "area">("hybrid");
  const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(true);
  const [isOverviewFilterOpen, setIsOverviewFilterOpen] = useState(false);
  const enrichedSummaryDataRef = useRef<any[]>([]);

  // Access Rules
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessSaveSuccess, setAccessSaveSuccess] = useState(false);

  const handleSaveAccessRules = async () => {
    setIsSavingAccess(true);
    const filteredRules: Record<string, Record<string, boolean>> = {};
    allPositionsList.forEach(pos => {
      if (accessRules[pos]) {
        filteredRules[pos] = {
          home: !!accessRules[pos].home,
          partner: !!accessRules[pos].partner,
          stock: !!accessRules[pos].stock,
          pog: !!accessRules[pos].pog,
          overview: !!accessRules[pos].overview,
          temp: !!accessRules[pos].temp,
          access: !!accessRules[pos].access,
        };
      } else {
        filteredRules[pos] = {
          home: true,
          partner: true,
          stock: true,
          pog: true,
          overview: pos === "Business Analyst",
          temp: pos === "Business Analyst",
          access: pos === "Business Analyst"
        };
      }
    });

    try {
      localStorage.setItem('appAccessRules', JSON.stringify(filteredRules));
      setAccessRules(filteredRules);
    } catch (e) {
      console.error('Failed to save access rules', e);
    }
    try {
      await saveAccessRulesFirestore(firebaseUser, filteredRules);
      setAccessSaveSuccess(true);
    } catch (err: any) {
      console.error("Error saving access rules:", err);
      alert(err?.message || "Gagal menyimpan aturan akses ke Firestore.");
    } finally {
      setIsSavingAccess(false);
      setTimeout(() => setAccessSaveSuccess(false), 3000);
    }
  };

  const allPositionsList = useMemo(() => {
    const list = Object.keys(accessRules || {});
    // Clean up obsolete 'Sales Manager'
    const filteredList = list.filter(p => p !== "Sales Manager");
    const defaults = [
      "Business Analyst",
      "Vegetables Sales Manager",
      "Area Sales Manager",
      "Sales Agronomist",
      "Business Solution"
    ];
    defaults.forEach(d => {
      if (!filteredList.includes(d)) filteredList.push(d);
    });
    return filteredList;
  }, [accessRules]);

  const removeAccessRule = (position: string) => {
    setAccessRules((prev: Record<string, Record<string, boolean>>) => {
      const currentRules = { ...prev };
      delete currentRules[position];
      return currentRules;
    });
  };

  const toggleAccessRule = (position: string, page: string) => {
    setAccessRules((prev: Record<string, Record<string, boolean>>) => {
      const currentRules = prev[position] || {
        home: true,
        partner: true,
        stock: true,
        pog: true,
        overview: false,
        temp: false,
        access: false
      };
      return {
        ...prev,
        [position]: {
          ...currentRules,
          [page]: !currentRules[page]
        }
      };
    });
  };

  const renderAccessCheckbox = (position: string, page: string) => {
    const isChecked = !!accessRules[position]?.[page];
    return (
      <button 
        onClick={() => toggleAccessRule(position, page)}
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wide transition-colors ${
          isChecked 
            ? "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer" 
            : "text-slate-400 bg-slate-50 border-slate-200 hover:bg-slate-100 cursor-pointer"
        }`}
      >
        <span className="material-symbols-outlined text-[12px]">
          {isChecked ? "check_circle" : "cancel"}
        </span> 
        {isChecked ? "Yes" : "No"}
      </button>
    );
  };

  // State Tab Temp (Temporary Review Page)
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [tempSortBy, setTempSortBy] = useState("checker");
  const [tempSortOrder, setTempSortOrder] = useState<"asc" | "desc">("asc");
  const [expandedTempRowId, setExpandedTempRowId] = useState<string | null>(
    null,
  );
  const [isTempProceeded, setIsTempProceeded] = useState(false);
  const [isConsolidatingDb, setIsConsolidatingDb] = useState(false);
  const [selectedConsolidateMonth, setSelectedConsolidateMonth] = useState<number>(() => {
    return new Date().getMonth();
  });
  const [consolidationSuccessMsg, setConsolidationSuccessMsg] = useState("");
  const [updatingRowMonthId, setUpdatingRowMonthId] = useState<number | null>(null);

  // State Tab POG
  const [pogGroupBy, setPogGroupBy] = useState("hybrid");
  const [pogSubGroupBy, setPogSubGroupBy] = useState("channel");
  const [pogExpandedRows, setPogExpandedRows] = useState({});
  const [isPogFilterOpen, setIsPogFilterOpen] = useState(true);

  const [expandedRows, setExpandedRows] = useState({});
  const CLUSTER_CONFIG = useMemo(
    () => [
      {
        key: "0-2",
        label: "0-2",
        colorHeader: "text-blue-500",
        colorCell: "text-blue-600",
        colorGrand: "text-blue-600",
        colorChild: "text-blue-500",
      },
      {
        key: "2-4",
        label: "2-4",
        colorHeader: "text-amber-500",
        colorCell: "text-amber-500",
        colorGrand: "text-amber-600",
        colorChild: "text-amber-400",
      },
      {
        key: "4-6",
        label: "4-6",
        colorHeader: "text-amber-600",
        colorCell: "text-amber-600",
        colorGrand: "text-amber-700",
        colorChild: "text-amber-500",
      },
      {
        key: "6-9",
        label: "6-9",
        colorHeader: "text-orange-500",
        colorCell: "text-orange-500",
        colorGrand: "text-orange-600",
        colorChild: "text-orange-400",
      },
      {
        key: "9-12",
        label: "9-12",
        colorHeader: "text-red-500",
        colorCell: "text-red-500",
        colorGrand: "text-red-600",
        colorChild: "text-red-400",
      },
      {
        key: ">12",
        label: ">12",
        colorHeader: "text-red-700",
        colorCell: "text-red-700",
        colorGrand: "text-red-800",
        colorChild: "text-red-600",
      },
      {
        key: "Uncategorized",
        label: "N/A",
        colorHeader: "text-slate-500",
        colorCell: "text-slate-600",
        colorGrand: "text-slate-600",
        colorChild: "text-slate-400",
      },
    ],
    [],
  );

  const ALL_CLUSTER_KEYS = useMemo(
    () => CLUSTER_CONFIG.map((c) => c.key),
    [CLUSTER_CONFIG],
  );
  const [selectedClusters, setSelectedClusters] = useState(ALL_CLUSTER_KEYS);

  const toggleRow = (name) =>
    setExpandedRows((prev) => ({ ...prev, [name]: !prev[name] }));
  const togglePogRow = (name) =>
    setPogExpandedRows((prev) => ({ ...prev, [name]: !prev[name] }));

  const teamMembers = useMemo(() => {
    if (!userData) return [];

    const myNameClean = cleanForMatch(userData.name || "");
    const isAdmin = userData.level && String(userData.level).toLowerCase().trim() === "admin";
    const posClean = userData.position ? cleanForMatch(userData.position) : "";
    const userClean = cleanForMatch(userData.user || "");
    const numLevel = userData.level ? parseInt(String(userData.level).trim(), 10) : NaN;
    const isBusinessAnalyst =
      Boolean(userData?.isPublic) ||
      posClean === "businessanalyst" ||
      posClean === "analyst" ||
      myNameClean === "adityawiratama" ||
      myNameClean === "aditya" ||
      userClean === "adityahead" ||
      posClean === "vegetablessalesmanager" ||
      posClean === "commerciallead" ||
      posClean === "countryhead" ||
      myNameClean === "suryanto" ||
      myNameClean === "suryantobudisantoso" ||
      userClean === "suryantohead" ||
      userClean === "daniheadoffice" ||
      userClean === "yashheadoffice" ||
      (!isNaN(numLevel) && numLevel >= 4) ||
      isAdmin;

    let rawList: string[] = [];

    if (employees && employees.length > 0) {
      if (isBusinessAnalyst) {
        let filteredEmployees = employees;
        if (isAdmin && userData.group) {
          const myGroupClean = cleanForMatch(userData.group);
          if (myGroupClean !== "all" && myGroupClean !== "") {
            filteredEmployees = employees.filter((e) => {
              const empGroupClean = cleanForMatch(e.group || "");
              return empGroupClean === myGroupClean || cleanForMatch(e.name) === myNameClean;
            });
          }
        }
        const allNames = filteredEmployees.map((e) => e.name).filter(Boolean);
        if (!allNames.some((n) => cleanForMatch(n) === myNameClean)) {
          allNames.unshift(userData.name);
        }
        rawList = allNames;
      } else {
        const resultList = [];
        const queue = [myNameClean];
        const visited = new Set(queue);

        while (queue.length > 0) {
          const curr = queue.shift()!;

          const matchingEmp = employees.find(
            (e) =>
              cleanForMatch(e.name) === curr ||
              (e.email && cleanForMatch(e.email) === curr),
          );
          const identifiersToMatch = new Set<string>();
          identifiersToMatch.add(curr);
          if (matchingEmp) {
            if (
              !resultList.some(
                (r) => cleanForMatch(r) === cleanForMatch(matchingEmp.name),
              )
            ) {
              resultList.push(matchingEmp.name);
            }
            if (matchingEmp.name)
              identifiersToMatch.add(cleanForMatch(matchingEmp.name));
            if (matchingEmp.email)
              identifiersToMatch.add(cleanForMatch(matchingEmp.email));
          }

          employees.forEach((emp) => {
            const empUplineClean = cleanForMatch(emp.upline);
            if (empUplineClean && identifiersToMatch.has(empUplineClean)) {
              const empClean = cleanForMatch(emp.name);
              if (empClean && !visited.has(empClean)) {
                visited.add(empClean);
                queue.push(empClean);
              }
            }
          });
        }

        const userMatchedEmp = employees.find(
          (e) =>
            cleanForMatch(e.name) === myNameClean ||
            (e.email && cleanForMatch(e.email) === myNameClean),
        );
        const finalUserName = userMatchedEmp
          ? userMatchedEmp.name
          : userData.name;

        if (
          !resultList.some(
            (r) => cleanForMatch(r) === cleanForMatch(finalUserName),
          )
        ) {
          resultList.unshift(finalUserName);
        }

        rawList = resultList;
      }
    } else if (
      computedTeamProfiles &&
      Object.keys(computedTeamProfiles).length > 0
    ) {
      let realRootName = userData.name;
      const foundProfileKey = Object.keys(computedTeamProfiles).find(
        (k) =>
          cleanForMatch(k) === myNameClean ||
          (computedTeamProfiles[k]?.email &&
            cleanForMatch(computedTeamProfiles[k].email) === myNameClean),
      );
      if (foundProfileKey) {
        realRootName = foundProfileKey;
      }
      const cleanRealRoot = cleanForMatch(realRootName);

      const depths = buildDepthMap(realRootName, computedTeamProfiles);
      const maxDepth = 5;

      const filtered = Object.keys(computedTeamProfiles).filter((name) => {
        const d = depths[cleanForMatch(name)] ?? 99;
        return d <= maxDepth;
      });

      const withoutMe = filtered.filter(
        (n) =>
          cleanForMatch(n) !== cleanRealRoot &&
          cleanForMatch(n) !== myNameClean,
      );
      const result = [realRootName, ...withoutMe];
      if (userData.name !== realRootName && !result.includes(userData.name)) {
        result.unshift(userData.name);
      }
      rawList = result;
    } else {
      let uniquePics = [...(userData.subordinates || [])];

      let added = true;
      while (added) {
        added = false;
        kiosks.forEach((k) => {
          const uplineClean = cleanForMatch(k.upline || "");
          const picStr = String(k.pic || "").trim();
          const picClean = cleanForMatch(picStr);

          const isDirectMatch =
            !isBusinessAnalyst &&
            uplineClean !== "" &&
            myNameClean !== "" &&
            (uplineClean.includes(myNameClean) ||
              myNameClean.includes(uplineClean));
          const isTransitiveMatch =
            uplineClean !== "" &&
            uniquePics.some((m) => cleanForMatch(m) === uplineClean);

          if (isDirectMatch || isTransitiveMatch) {
            if (
              picClean !== "" &&
              picClean !== myNameClean &&
              !picClean.includes(myNameClean)
            ) {
              if (
                !uniquePics.some(
                  (existing) => cleanForMatch(existing) === picClean,
                )
              ) {
                uniquePics.push(picStr);
                added = true;
              }
            }
          }
        });
      }

      // FALLBACK AMAN: Jika hasil filter tim sangat sedikit, atau user menggunakan akun demo/tidak terpetakan,
      // maka masukkan semua PIC yang ada di daftar Kiosks agar data Stock Summary/POG tetap tampil dan dapat dianalisis.
      if (uniquePics.length <= (userData.subordinates?.length || 0)) {
        kiosks.forEach((k) => {
          const picStr = String(k.pic || "").trim();
          const picClean = cleanForMatch(picStr);
          if (picStr && picClean !== "" && picClean !== myNameClean) {
            if (
              !uniquePics.some(
                (existing) => cleanForMatch(existing) === picClean,
              )
            ) {
              uniquePics.push(picStr);
            }
          }
        });
      }

      if (
        !uniquePics.some((existing) => cleanForMatch(existing) === myNameClean)
      ) {
        uniquePics.unshift(userData.name);
      }
      rawList = uniquePics;
    }

    // Apply strict filtering for Level 5: if the current user level is 5, exclude other Level 5 users.
    const isMyLevel5 = (() => {
      // Top-level roles like Business Analyst (rank 1, level 5) must never be filtered or restricted.
      if (isBusinessAnalyst || getPositionRank(userData.position) === 1) {
        return false;
      }
      const cleanName = cleanForMatch(userData.name);
      if (
        userData.position &&
        cleanForMatch(userData.position) === "businesssolution"
      )
        return true;
      if (getPositionRank(userData.position) === 5) {
        return true;
      }
      if (employees && employees.length > 0) {
        const emp = employees.find((e) => cleanForMatch(e.name) === cleanName);
        if (emp) {
          if (cleanForMatch(emp.position) === "businesssolution") return true;
          if (getPositionRank(emp.position) === 5) return true;
        }
      }
      return false;
    })();

    if (isMyLevel5) {
      return rawList.filter((memberName) => {
        const cleanName = cleanForMatch(memberName);
        if (cleanName === myNameClean) return true; // Keep ourselves always

        // Exclude if level is 5 or position is Business Solution
        if (employees && employees.length > 0) {
          const emp = employees.find(
            (e) => cleanForMatch(e.name) === cleanName,
          );
          if (emp) {
            if (
              emp.level !== undefined &&
              emp.level !== null &&
              String(emp.level).trim() === "5"
            )
              return false;
            if (cleanForMatch(emp.position) === "businesssolution")
              return false;
            if (getPositionRank(emp.position) === 5) return false;
          }
        }
        if (computedTeamProfiles) {
          const foundKey = Object.keys(computedTeamProfiles).find(
            (k) => cleanForMatch(k) === cleanName,
          );
          if (foundKey) {
            const prof = computedTeamProfiles[foundKey];
            if (prof?.level !== undefined && String(prof.level).trim() === "5")
              return false;
            if (
              prof?.position &&
              cleanForMatch(prof.position) === "businesssolution"
            )
              return false;
          }
        }
        return true;
      });
    }

    // Deduplicate the list to prevent key collision React errors
    const seen = new Set();
    const uniqueList = [];
    for (const name of rawList) {
      const clean = cleanForMatch(name);
      if (!seen.has(clean)) {
        seen.add(clean);
        uniqueList.push(name);
      }
    }
    return uniqueList;
  }, [
    kiosks,
    userData,
    userData?.name,
    userData?.subordinates,
    userData?.position,
    computedTeamProfiles,
    employees,
  ]);

  const myActiveSubordinates = useMemo(() => {
    return activeEmployees.filter((emp: any) =>
      teamMembers.some((m: string) => cleanForMatch(m) === cleanForMatch(emp.name))
    );
  }, [activeEmployees, teamMembers]);

  const normalizeName = useCallback(
    (nameStr: string) => {
      const trimmed = nameStr.trim();
      if (!trimmed || trimmed === "Unknown") return "Unknown";
      const clean = cleanForMatch(trimmed);

      if (clean === "agusherdianto" || clean.includes("agusherdianto")) {
        return "AGUS HERDIANTO";
      }

      const found = teamMembers.find((t) => cleanForMatch(t) === clean);
      if (found) return found.trim();

      return trimmed;
    },
    [teamMembers],
  );

  const [teamPositions, setTeamPositions] = useState<Record<string, string>>(
    {},
  );
  const [teamAreas, setTeamAreas] = useState<Record<string, string>>({});
  const [teamProvinces, setTeamProvinces] = useState<Record<string, string>>(
    {},
  );
  const [teamSubordinates, setTeamSubordinates] = useState<
    Record<string, string[]>
  >({});
  const [teamUpLines, setTeamUpLines] = useState<Record<string, string>>({});
  const [teamLevels, setTeamLevels] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userData) return;
    if (employeesRefreshKey === 0 || isAuthReady || isAuthorizedFirebase) {
      return;
    }
    setIsEmployeesLoading(false);
  }, [userData, employeesRefreshKey, isAuthReady, isAuthorizedFirebase]);

  useEffect(() => {
    if (employees && employees.length > 0) {
      const positions: Record<string, string> = {};
      const areas: Record<string, string> = {};
      const provinces: Record<string, string> = {};
      const uplines: Record<string, string> = {};
      const subordinates: Record<string, string[]> = {};
      const levels: Record<string, number> = {};

      employees.forEach((emp) => {
        const name = emp.name;
        positions[name] = normalizePosition(emp.position);
        areas[name] = String(emp.area || "-").trim();
        provinces[name] = String(emp.province || "-").trim();
        uplines[name] = String(emp.upline || "").trim();
        if (
          emp.level !== undefined &&
          emp.level !== null &&
          String(emp.level).trim() !== ""
        ) {
          const parsed = parseLevelStr(emp.level);
          if (!isNaN(parsed)) {
            levels[name] = parsed;
          } else {
            const rank = getPositionRank(emp.position);
            levels[name] =
              rank === 1
                ? 5
                : rank === 2
                  ? 4
                  : rank === 3
                    ? 3
                    : rank === 4
                      ? 2
                      : rank === 5
                        ? 1
                        : 0;
          }
        } else {
          const rank = getPositionRank(emp.position);
          levels[name] =
            rank === 1
              ? 5
              : rank === 2
                ? 4
                : rank === 3
                  ? 3
                  : rank === 4
                    ? 2
                    : rank === 5
                      ? 1
                      : 0;
        }
      });

      employees.forEach((emp) => {
        const name = emp.name;
        const directSubs: string[] = [];
        employees.forEach((item) => {
          if (item.name !== name && item.upline) {
            if (cleanForMatch(item.upline) === cleanForMatch(name)) {
              directSubs.push(item.name);
            }
          }
        });
        subordinates[name] = directSubs;
      });

      setTeamPositions((prev) => ({ ...prev, ...positions }));
      setTeamAreas((prev) => ({ ...prev, ...areas }));
      setTeamProvinces((prev) => ({ ...prev, ...provinces }));
      setTeamUpLines((prev) => ({ ...prev, ...uplines }));
      setTeamSubordinates((prev) => ({ ...prev, ...subordinates }));
      setTeamLevels((prev) => ({ ...prev, ...levels }));
    }
  }, [employees]);

  useEffect(() => {
    if (
      userData &&
      computedTeamProfiles &&
      Object.keys(computedTeamProfiles).length > 0
    ) {
      const positions: Record<string, string> = {};
      const areas: Record<string, string> = {};
      const provinces: Record<string, string> = {};
      const uplines: Record<string, string> = {};
      const subordinates: Record<string, string[]> = {};
      const levels: Record<string, number> = {};

      Object.entries(computedTeamProfiles).forEach(
        ([name, p]: [string, any]) => {
          positions[name] = normalizePosition(p.position);
          areas[name] = String(p.area || "-").trim();
          provinces[name] = String(p.province || "-").trim();
          uplines[name] = String(p.upline || "").trim();
          if (
            p.level !== undefined &&
            p.level !== null &&
            String(p.level).trim() !== ""
          ) {
            const parsed = parseLevelStr(p.level);
            if (!isNaN(parsed)) {
              levels[name] = parsed;
            } else {
              const rank = getPositionRank(p.position);
              levels[name] =
                rank === 1
                  ? 5
                  : rank === 2
                    ? 4
                    : rank === 3
                      ? 3
                      : rank === 4
                        ? 2
                        : rank === 5
                          ? 1
                          : 0;
            }
          } else {
            const rank = getPositionRank(p.position);
            levels[name] =
              rank === 1
                ? 5
                : rank === 2
                  ? 4
                  : rank === 3
                    ? 3
                    : rank === 4
                      ? 2
                      : rank === 5
                        ? 1
                        : 0;
          }
        },
      );

      Object.keys(computedTeamProfiles).forEach((name) => {
        const directSubs: string[] = [];
        Object.entries(computedTeamProfiles).forEach(
          ([otherName, p]: [string, any]) => {
            if (otherName !== name && p.upline) {
              const cleanUp = cleanForMatch(p.upline);
              const cleanMy = cleanForMatch(name);
              if (cleanUp === cleanMy) {
                directSubs.push(otherName);
              }
            }
          },
        );
        subordinates[name] = directSubs;
      });

      setTeamPositions((prev) => ({ ...prev, ...positions }));
      setTeamAreas((prev) => ({ ...prev, ...areas }));
      setTeamProvinces((prev) => ({ ...prev, ...provinces }));
      setTeamUpLines((prev) => ({ ...prev, ...uplines }));
      setTeamSubordinates((prev) => ({ ...prev, ...subordinates }));
      setTeamLevels((prev) => ({ ...prev, ...levels }));
    }
  }, [userData]);

  useEffect(() => {
    const isAdmin = userData.level && String(userData.level).toLowerCase().trim() === "admin";
    const posClean = userData.position ? cleanForMatch(userData.position) : "";
    const nameClean = cleanForMatch(userData.name || "");
    const userClean = cleanForMatch(userData.user || "");
    const numLevel = userData.level ? parseInt(String(userData.level).trim(), 10) : NaN;
    const isBusinessAnalyst =
      Boolean(userData?.isPublic) ||
      posClean === "businessanalyst" ||
      posClean === "analyst" ||
      nameClean === "adityawiratama" ||
      nameClean === "aditya" ||
      userClean === "adityahead" ||
      posClean === "vegetablessalesmanager" ||
      posClean === "commerciallead" ||
      posClean === "countryhead" ||
      nameClean === "suryanto" ||
      nameClean === "suryantobudisantoso" ||
      userClean === "suryantohead" ||
      userClean === "daniheadoffice" ||
      userClean === "yashheadoffice" ||
      (!isNaN(numLevel) && numLevel >= 4) ||
      isAdmin;
    if (isBusinessAnalyst) {
      const others = teamMembers.filter(
        (m) => cleanForMatch(m) !== cleanForMatch(userData.name),
      );
      setTeamSubordinates((prev) => {
        if (JSON.stringify(prev[userData.name]) === JSON.stringify(others))
          return prev;
        return {
          ...prev,
          [userData.name]: others,
        };
      });
      setTeamPositions((prev) => {
        const targetPos = isAdmin ? (userData.position || "Admin") : "Business Analyst";
        if (prev[userData.name] === targetPos) return prev;
        return {
          ...prev,
          [userData.name]: targetPos,
        };
      });
    }
  }, [userData.name, userData.position, teamMembers, teamPositions]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) {
      return {
        text: "Selamat Pagi",
        imageUrl:
          "https://lh3.googleusercontent.com/d/1AzKb-75MaU9hppqSdy2rS93t0tAPGkGi",
        color: "text-amber-300",
      };
    }
    if (hour >= 11 && hour < 15) {
      return {
        text: "Selamat Siang",
        imageUrl:
          "https://lh3.googleusercontent.com/d/1ZpNkT7R57FppIpyPuTt2w9QtJdIwwuRp",
        color: "text-yellow-300",
      };
    }
    if (hour >= 15 && hour < 19) {
      return {
        text: "Selamat Sore",
        imageUrl:
          "https://lh3.googleusercontent.com/d/12RsJXxDrH7aIAph0AJubB3i4w0gmkxcL",
        color: "text-orange-400",
      };
    }
    return {
      text: "Selamat Malam",
      imageUrl:
        "https://lh3.googleusercontent.com/d/1wzqPdQ5jvw7fOF2X76kM56l9l-4mUcLx",
      color: "text-indigo-200",
    };
  }, []);

  const workingCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (kiosks && Array.isArray(kiosks)) {
      kiosks.forEach((k) => {
        const kClean = cleanForMatch(k.name);
        const rawCat =
          k.category ||
          k.Category ||
          k.CATEGORY ||
          k.kategori ||
          k.Kategori ||
          k.klasifikasi ||
          k.cat ||
          k.Cat ||
          "";
        const cat = getValidCategory(rawCat, undefined, k.name);
        if (kClean && cat && cat !== "Uncategorized") {
          map[kClean] = cat;
        }
      });
    }
    if (rawWorkingData && Array.isArray(rawWorkingData)) {
      rawWorkingData.forEach((d) => {
        const kClean = cleanForMatch(d.kiosk);
        const rawCat =
          d.category ||
          d.Category ||
          d.CATEGORY ||
          d.kategori ||
          d.Kategori ||
          d.klasifikasi ||
          d.cat ||
          d.Cat ||
          "";
        const cat = getValidCategory(rawCat, undefined, d.kiosk);
        if (kClean && cat && cat !== "Uncategorized") {
          if (!map[kClean]) map[kClean] = cat;
        }
      });
    }
    return map;
  }, [rawWorkingData, kiosks]);

  const allKiosks = useMemo(() => {
    const map = new Map<string, any>();
    (kiosks || []).forEach((k) => {
      const cleanName = cleanForMatch(k.name);
      if (cleanName) {
        const rawCat = k.category || workingCategoryMap[cleanName];
        const validCat = getValidCategory(
          rawCat,
          k.category,
          k.name,
          workingCategoryMap,
        );
        map.set(cleanName, {
          ...k,
          category: validCat,
        });
      }
    });

    if (rawWorkingData && Array.isArray(rawWorkingData)) {
      rawWorkingData.forEach((d) => {
        const kName = String(d.kiosk || "").trim();
        const cleanName = cleanForMatch(kName);
        if (cleanName) {
          const dbCat = workingCategoryMap[cleanName];
          const validCat = getValidCategory(
            dbCat || d.category,
            undefined,
            kName,
            workingCategoryMap,
          );
          if (!map.has(cleanName)) {
            map.set(cleanName, {
              id: `auto_${cleanName}`,
              name: kName,
              category: validCat,
              pic: d.pic || d.user || "",
              upline: "",
              province: d.area || "",
              area: d.area || "-",
              group: "",
            });
          } else {
            const existing = map.get(cleanName);
            if (dbCat && existing.category !== dbCat) {
              map.set(cleanName, {
                ...existing,
                category: dbCat,
              });
            }
          }
        }
      });
    }

    return Array.from(map.values());
  }, [kiosks, rawWorkingData, workingCategoryMap]);

  const fetchWorkingData = async (
    presetData?: any[],
    presetDrSales?: any[],
  ) => {
    setIsFetchingData(true);
    setIsSyncing(true);
    try {
      let combinedData = [];
      let combinedDrSales = [];
      let success = false;

      if (presetData && presetDrSales) {
        combinedData = presetData;
        combinedDrSales = presetDrSales;
        success = true;
      } else {
        const latestDataset = await reloadFromFirestore();
        if (latestDataset) {
          const hydrated = hydrateDashboardFromNormalized(latestDataset);
          setEmployees(hydrated.employees);
          setKiosks(hydrated.kiosks);
          combinedData = hydrated.workingData;
          combinedDrSales = hydrated.drSalesData;
          success = true;
        }
      }

      if (!success) {
        combinedData = [];
        combinedDrSales = [];
      }

      setDrSalesData(combinedDrSales);
      setRawWorkingData(combinedData);

      const groupedMap: Record<string, any> = {};

      const parseTimestamp = (ts) => {
        if (!ts) return 0;
        if (typeof ts === "string") {
          if (ts.includes("/")) {
            const parts = ts.split(/[\s/:]+/);
            if (parts.length >= 3) {
              return new Date(
                `${parts[2]}-${parts[1]}-${parts[0]}T${parts[3] || "00"}:${parts[4] || "00"}:${parts[5] || "00"}`,
              ).getTime();
            }
          }
          const d = new Date(ts).getTime();
          return isNaN(d) ? 0 : d;
        }
        const dt = new Date(ts).getTime();
        return isNaN(dt) ? 0 : dt;
      };

      // 1. Lakukan Grouping (Gabungkan LOT & Hybrid yang sama)
      combinedData.forEach((d) => {
        const k = cleanForMatch(d.kiosk);
        const l = cleanForMatch(d.lot);
        const h = cleanForMatch(d.hybrid);
        const u = cleanForMatch(d.user || d.pic || "");
        const key = `${k}_${l}_${h}_${u}`;
        if (!groupedMap[key]) {
          groupedMap[key] = { ...d };
        } else {
          // Ambil data dari timestamp terbaru (TIDAK ADA AKUMULASI QTY)
          const timeExisting = parseTimestamp(groupedMap[key].timestamp);
          const timeNew = parseTimestamp(d.timestamp);
          if (timeNew > timeExisting) {
            groupedMap[key] = { ...d };
          }
        }
      });

      // 2. Filter dan format
      const monthsKeys = [
        "jan",
        "feb",
        "mar",
        "apr",
        "mei",
        "jun",
        "jul",
        "ags",
        "sep",
        "okt",
        "nov",
        "des",
      ];
      const currentMonthIdx = new Date().getMonth();
      const currentMonthKey = monthsKeys[currentMonthIdx];
      const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
      const prevMonthKey = monthsKeys[prevMonthIdx];

      const enrichedData = Object.values(groupedMap)
        .filter((d) => String(d.condition).trim().toLowerCase() !== "habis") // Filter: Sembunyikan yang habis
        .map((d, index) => {
          const currVal =
            d[currentMonthKey] !== undefined
              ? safeParseFloat(d[currentMonthKey])
              : safeParseFloat(d.stock);
          const prevVal =
            d[prevMonthKey] !== undefined ? safeParseFloat(d[prevMonthKey]) : 0;

          let finalCondition = d.condition || "tetap";
          if (prevVal > 0) {
            if (currVal > prevVal) finalCondition = "bertambah";
            else if (currVal < prevVal) finalCondition = "berkurang";
            else finalCondition = "tetap";
          } else {
            if (currVal > 0) {
              finalCondition =
                d.condition === "new" || d.condition === "baru" || d.isNew
                  ? "new"
                  : "bertambah";
            } else {
              finalCondition = "tetap";
            }
          }

          return {
            ...d,
            stock: currVal, // Use current month's stock instead of the shipping stock!
            id: d.id || `db_${index}_${d.lot}`, // Fallback ID jika tidak ada
            originalStock: d.stock,
            originalUser: d.user || "",
            condition: finalCondition,
            isNew: false,
          };
        });

      setWorkingData(enrichedData);
      setDeletedItems([]);
    } catch (e) {
      console.warn("Error processing working data", e);
    } finally {
      setIsFetchingData(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchChannels = async () => {
      if (channelsRefreshKey === 0 || isAuthReady || isAuthorizedFirebase) {
        if (kiosks.length > 0) {
          if (isBusinessAnalyst) {
            setSelectedKiosk("Not Applicable for Business Analyst");
          } else {
            const myKiosksData = kiosks.filter((k) =>
              matchNames(k.pic, userData.name),
            );
            if (myKiosksData.length > 0) setSelectedKiosk(myKiosksData[0].name);
            else {
              setSelectedKiosk(kiosks[0].name);
            }
          }
        } else {
          setSelectedKiosk("No Channel Assigned");
        }
        setIsChannelsLoading(false);
        return;
      }
      setIsChannelsLoading(false);
    };
    fetchChannels();
  }, [userData.name, userData.position, channelsRefreshKey, isBusinessAnalyst, isAuthReady, isAuthorizedFirebase, kiosks]);

  // Live real-time hydration directly from Firestore (supports both Public Read-Only & Authorized Admin)
  useEffect(() => {
    if (!isAuthReady) return;
    if (!firestoreDataset) {
      if (isLoadingFirestore) {
        setIsEmployeesLoading(true);
        setIsChannelsLoading(true);
        setIsFetchingData(true);
      } else if (firestoreReadError) {
        setEmployees([]);
        setKiosks([]);
        fetchWorkingData([], []);
        setIsEmployeesLoading(false);
        setIsChannelsLoading(false);
      }
      return;
    }

    const hydrated = hydrateDashboardFromNormalized(firestoreDataset);
    setEmployees(hydrated.employees);
    setKiosks(hydrated.kiosks);
    if (firestoreAccessRules && Object.keys(firestoreAccessRules).length > 0) {
      setAccessRules(firestoreAccessRules);
      try {
        localStorage.setItem("appAccessRules", JSON.stringify(firestoreAccessRules));
      } catch {
        // ignore storage quota
      }
    }
    fetchWorkingData(hydrated.workingData, hydrated.drSalesData);
    setIsEmployeesLoading(false);
    setIsChannelsLoading(false);
  }, [isAuthReady, isLoadingFirestore, firestoreReadError, firestoreDataset, firestoreAccessRules]);

  useEffect(() => {
    if (teamMembers.length > 1) {
      if (
        !mappingPic ||
        mappingPic === "" ||
        (mappingPic !== "ALL_TEAM" &&
          !teamMembers.some(
            (m) => cleanForMatch(m) === cleanForMatch(mappingPic),
          ))
      ) {
        setMappingPic("ALL_TEAM");
      }
    } else {
      setMappingPic(userData.name || "");
    }
  }, [userData.name, teamMembers, mappingPic]);

  useEffect(() => {
    setIsLotNotFound(false);
    if (lotNo.length < 3) {
      setLotIntel(null);
      setManualHybrid("");
      setManualHybridCustom("");
      setManualCrop("Field Corn");
      setManualDrDate("");
      setManualExpDate("");
      return;
    }
    const checkLot = async () => {
      setIsLotChecking(true);
      try {
        const resp = await customFetch(
          `${SCRIPT_URL}?action=getLotInfo&lot=${encodeURIComponent(lotNo)}&kiosk=${encodeURIComponent(selectedKiosk)}`,
        );
        const res = await resp.json();
        if (res.status === "success" && res.data) {
          setLotIntel(res.data);
          setIsLotNotFound(false);
          setIsLotChecking(false);
          return;
        }
      } catch (e) {
        // Fallback to local
      }

      // Local fallback: search working sheet first
      const cleanTarget = lotNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const cleanKiosk = cleanForMatch(selectedKiosk);

      const foundInWorkingForKiosk = Array.isArray(rawWorkingData)
        ? rawWorkingData.find(
            (w) =>
              w.lot &&
              (String(w.lot).trim().toUpperCase() === lotNo.trim().toUpperCase() ||
                String(w.lot).toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget) &&
              cleanForMatch(w.kiosk) === cleanKiosk,
          )
        : null;

      const foundInWorkingAny = foundInWorkingForKiosk || (Array.isArray(rawWorkingData)
        ? rawWorkingData.find(
            (w) =>
              w.lot &&
              (String(w.lot).trim().toUpperCase() === lotNo.trim().toUpperCase() ||
                String(w.lot).toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget),
          )
        : null);

      if (foundInWorkingAny) {
        const rawWExp = foundInWorkingAny.expired || foundInWorkingAny.expDate || "N/A";
        const finalWExp = (rawWExp === "N/A" || rawWExp === "-") ? extractExpFromLot(lotNo) : rawWExp;
        setLotIntel({
          desc: foundInWorkingAny.hybrid || "",
          crops: foundInWorkingAny.crops || "",
          drDate: foundInWorkingAny.drDate || "N/A",
          expDate: finalWExp,
          aging: foundInWorkingAny.aging || "-",
          channel: foundInWorkingAny.kiosk || "",
        });
        setIsLotNotFound(false);
        setIsLotChecking(false);
        return;
      }

      const foundInDrForKiosk = Array.isArray(drSalesData)
        ? drSalesData.find(
            (d) =>
              d.lot &&
              (String(d.lot).trim().toUpperCase() === lotNo.trim().toUpperCase() ||
                String(d.lot).toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget) &&
              cleanForMatch(d.channel) === cleanKiosk,
          )
        : null;

      const foundInDrAny = foundInDrForKiosk || (Array.isArray(drSalesData)
        ? drSalesData.find(
            (d) =>
              d.lot &&
              (String(d.lot).trim().toUpperCase() === lotNo.trim().toUpperCase() ||
                String(d.lot).toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget),
          )
        : null);

      if (foundInDrAny) {
        const rawDrExp = foundInDrAny.expired || foundInDrAny.expDate || "N/A";
        const finalDrExp = (rawDrExp === "N/A" || rawDrExp === "-") ? extractExpFromLot(lotNo) : rawDrExp;
        setLotIntel({
          desc: foundInDrAny.hybrid || foundInDrAny.desc || "",
          crops: foundInDrAny.crops || "",
          drDate: foundInDrAny.drDate || "N/A",
          expDate: finalDrExp,
          aging: foundInDrAny.aging || "-",
          channel: foundInDrAny.channel || "",
        });
        setIsLotNotFound(false);
        setIsLotChecking(false);
        return;
      }

      setLotIntel(null);
      setIsLotNotFound(true);
      setIsLotChecking(false);
    };
    const timer = setTimeout(checkLot, 600);
    return () => clearTimeout(timer);
  }, [lotNo, selectedKiosk, drSalesData, rawWorkingData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target))
        setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getCurrentTimestamp = () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };

  const formatDateToAppFormat = (dateStr: string) => {
    if (!dateStr || dateStr === "N/A" || dateStr === "-") return "N/A";
    const str = String(dateStr).trim();
    if (!str) return "N/A";

    // Handle HTML input date: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-");
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const mIdx = parseInt(m, 10) - 1;
      return `${d.padStart(2, "0")}/${months[mIdx] || "JAN"}/${y.substring(2)}`;
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY or DD-MMM-YY
    const parts = str.split(/[\s/\-\.:]+/);
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      let mIdx = parseInt(parts[1], 10) - 1;
      if (isNaN(mIdx)) {
        const lower = parts[1].toLowerCase();
        mIdx = months.findIndex((m) => lower.startsWith(m.toLowerCase()));
      }
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(day) && mIdx >= 0 && mIdx < 12 && !isNaN(y)) {
        return `${String(day).padStart(2, "0")}/${months[mIdx]}/${String(y).substring(2)}`;
      }
    }

    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const year = String(date.getFullYear()).substring(2);
      return `${day}/${months[date.getMonth()]}/${year}`;
    }

    return str || "N/A";
  };

  const calculateAgingInMonths = (startStr: string) => {
    if (!startStr) return "-";
    const start = new Date(startStr);
    const end = new Date();
    if (isNaN(start.getTime())) return "-";
    return String(Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24) / 30.416));
  };

  const handleAddLocal = () => {
    if (!lotNo || !qty) return;
    const cleanLot = lotNo.trim().toUpperCase();
    
    let cleanHybrid = "Unknown";
    let cleanCrops = "";
    let cleanDrDate = "";
    let cleanExpired = "N/A";
    let cleanAging = "-";

    if (lotIntel) {
      cleanHybrid = lotIntel.desc || "Unknown";
      cleanCrops = lotIntel.crops || "";
      cleanDrDate = lotIntel.drDate || "";
      const intelExp = lotIntel.expDate;
      cleanExpired = (intelExp && intelExp !== "N/A" && intelExp !== "-") ? intelExp : extractExpFromLot(cleanLot);
      cleanAging = lotIntel.aging || "-";
    } else if (isLotNotFound) {
      const selectedH = manualHybrid === "CUSTOM" ? manualHybridCustom.trim() : manualHybrid.trim();
      cleanHybrid = selectedH || "Unknown";
      cleanCrops = manualCrop;
      cleanDrDate = manualDrDate ? formatDateToAppFormat(manualDrDate) : "N/A";
      cleanExpired = manualExpDate ? formatDateToAppFormat(manualExpDate) : extractExpFromLot(cleanLot);
      cleanAging = manualDrDate ? calculateAgingInMonths(manualDrDate) : "-";
    }

    const existingItemIndex = workingData.findIndex(
      (item) =>
        cleanForMatch(item.kiosk) === cleanForMatch(selectedKiosk) &&
        cleanForMatch(item.lot) === cleanForMatch(cleanLot) &&
        cleanForMatch(item.hybrid) === cleanForMatch(cleanHybrid),
    );

    if (existingItemIndex !== -1) {
      setWorkingData((prev) =>
        prev.map((item, index) => {
          if (index === existingItemIndex) {
            const nQty = safeParseFloat(qty);
            const monthsKeys = [
              "jan",
              "feb",
              "mar",
              "apr",
              "mei",
              "jun",
              "jul",
              "ags",
              "sep",
              "okt",
              "nov",
              "des",
            ];
            const currentMonthIdx = new Date().getMonth();
            const currentMonthKey = monthsKeys[currentMonthIdx];
            const prevMonthIdx =
              currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
            const prevMonthKey = monthsKeys[prevMonthIdx];
            const prevVal =
              item[prevMonthKey] !== undefined ? safeParseFloat(item[prevMonthKey]) : 0;

            let cond = "tetap";
            if (prevVal === 0) {
              cond = item.isNew ? "new" : nQty > 0 ? "bertambah" : "tetap";
            } else {
              if (nQty > prevVal) cond = "bertambah";
              else if (nQty < prevVal) cond = "berkurang";
              else cond = "tetap";
            }

            return {
              ...item,
              stock: nQty,
              condition: cond,
              user: userData.name,
              timestamp: getCurrentTimestamp(),
              [currentMonthKey]: nQty,
            };
          }
          return item;
        }),
      );
    } else {
      const monthsKeys = [
        "jan",
        "feb",
        "mar",
        "apr",
        "mei",
        "jun",
        "jul",
        "ags",
        "sep",
        "okt",
        "nov",
        "des",
      ];
      const currentMonthKey = monthsKeys[new Date().getMonth()];
      const resolvedCategory = getValidCategory(
        undefined,
        undefined,
        selectedKiosk,
        workingCategoryMap,
      );
      const newItem = {
        id: "local_" + Date.now(),
        lot: cleanLot,
        hybrid: cleanHybrid,
        crops: cleanCrops,
        drDate: cleanDrDate,
        stock: safeParseFloat(qty),
        aging: cleanAging,
        expired: cleanExpired,
        kiosk: selectedKiosk,
        condition: "new", // BARU
        isNew: true,
        originalStock: safeParseFloat(qty),
        user: userData.name,
        timestamp: getCurrentTimestamp(),
        category: resolvedCategory,
        [currentMonthKey]: safeParseFloat(qty),
      };
      setWorkingData((prev) => [newItem, ...prev]);
    }

    // Reset Form
    setLotNo("");
    setQty("");
    setLotIntel(null);
    setIsLotNotFound(false);
    setManualHybrid("");
    setManualHybridCustom("");
    setManualCrop("Field Corn");
    setManualDrDate("");
    setManualExpDate("");
  };

  const handleEditLocal = (id, newQty, updatedFields = {}) => {
    const monthsKeys = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mei",
      "jun",
      "jul",
      "ags",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    const currentMonthIdx = new Date().getMonth();
    const currentMonthKey = monthsKeys[currentMonthIdx];
    const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
    const prevMonthKey = monthsKeys[prevMonthIdx];

    setWorkingData((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nQty = safeParseFloat(newQty);
          const prevVal =
            item[prevMonthKey] !== undefined ? safeParseFloat(item[prevMonthKey]) : 0;

          let cond = "tetap";
          if (prevVal === 0) {
            cond = item.isNew ? "new" : nQty > 0 ? "bertambah" : "tetap";
          } else {
            if (nQty > prevVal) cond = "bertambah";
            else if (nQty < prevVal) cond = "berkurang";
            else cond = "tetap";
          }
          const resolvedCategory = getValidCategory(
            item.category || (updatedFields as any).category,
            undefined,
            item.kiosk || (updatedFields as any).kiosk,
            workingCategoryMap,
          );
          return {
            ...item,
            ...updatedFields,
            category: resolvedCategory,
            stock: nQty,
            condition: cond,
            user: userData.name,
            timestamp: getCurrentTimestamp(),
            [currentMonthKey]: nQty,
          };
        }
        return item;
      }),
    );
    setEditModal({ isOpen: false, item: null });
  };

  const handleDeleteLocal = () => {
    const id = deleteModal.item.id;
    const isNew = deleteModal.item.isNew;
    if (!isNew) {
      const monthsKeys = [
        "jan",
        "feb",
        "mar",
        "apr",
        "mei",
        "jun",
        "jul",
        "ags",
        "sep",
        "okt",
        "nov",
        "des",
      ];
      const currentMonthKey = monthsKeys[new Date().getMonth()];
      // Jangan dihapus dari list, ubah saja condition-nya jadi 'habis'
      setWorkingData((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                stock: 0,
                condition: "habis",
                user: userData.name,
                timestamp: getCurrentTimestamp(),
                [currentMonthKey]: 0,
              }
            : i,
        ),
      );
    } else {
      setWorkingData((prev) => prev.filter((i) => i.id !== id));
    }
    setDeleteModal({ isOpen: false, item: null });
  };

  const hasChanges =
    workingData.some(
      (i) =>
        i.isNew ||
        i.condition !== "tetap" ||
        String(i.user || "")
          .trim()
          .toLowerCase() !==
          String(i.originalUser || "")
            .trim()
            .toLowerCase(),
    ) || deletedItems.length > 0;

  const handleUploadActivity = async () => {
    // Ambil hanya list yang tampil (berdasarkan Kiosk yang terpilih)
    const currentKioskItems = workingData.filter(
      (item) =>
        cleanForMatch(item.kiosk) === cleanForMatch(selectedKiosk) ||
        matchNames(item.kiosk, selectedKiosk),
    );
    if (currentKioskItems.length === 0) return;

    setIsFetchingData(true);
    setIsSyncing(true);
    try {
      await saveBatchActivityToFirestore(firebaseUser, {
        kioskName: selectedKiosk,
        checkerName: userData.name,
        items: currentKioskItems,
        currentDataset: normalizedSnapshot,
      });
      setConsolidationSuccessMsg("Aktivitas opname berhasil disimpan ke Firestore!");
      setTimeout(() => setConsolidationSuccessMsg(""), 4000);
    } catch (e: any) {
      console.error("Activity sync failed:", e);
      alert("Gagal menyimpan aktivitas ke Firestore: " + (e?.message || "Periksa Firestore Rules."));
    } finally {
      setIsFetchingData(false);
      setIsSyncing(false);
    }
  };

  const handleConsolidateDatabase = async () => {
    setIsConsolidatingDb(true);
    try {
      const resp = await customFetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "consolidateDatabase",
          user: userData.name,
          targetMonth: selectedConsolidateMonth,
        }),
      });

      const contentType = resp.headers.get("content-type");
      if (!resp.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Respon server tidak valid. Pastikan backend sudah terkonfigurasi.");
      }

      const res = await resp.json();
      if (res.status === "success") {
        setConsolidationSuccessMsg("Konsolidasi database berhasil disimpan!");
        setTimeout(() => setConsolidationSuccessMsg(""), 5000);
        await fetchWorkingData(); // Refresh data lists
        
        // Map selectedConsolidateMonth (0-11) to filterBelowMonth (e.g., "Agustus 2026")
        const monthNames = [
          "Januari 2027",
          "Februari 2027",
          "Maret 2027",
          "April 2026",
          "Mei 2026",
          "Juni 2026",
          "Juli 2026",
          "Agustus 2026",
          "September 2026",
          "Oktober 2026",
          "November 2026",
          "Desember 2026"
        ];
        const targetMonthStr = monthNames[selectedConsolidateMonth];
        if (targetMonthStr) {
          setFilterBelowMonth(targetMonthStr);
        }
      } else {
        alert(
          "Gagal melakukan konsolidasi: " + (res.message || "Unknown error"),
        );
      }
    } catch (e) {
      console.warn("Consolidation fetch failed:", e);
      alert("Error menghubungi server untuk konsolidasi.");
    } finally {
      setIsConsolidatingDb(false);
    }
  };

  const handleUpdateInputMonth = async (rowNumber: number, targetMonthIdx: number) => {
    setUpdatingRowMonthId(rowNumber);
    try {
      const resp = await customFetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "updateWorkingRowMonth",
          rowNumber,
          targetMonth: targetMonthIdx,
          user: userData.name,
        }),
      });

      const contentType = resp.headers.get("content-type");
      if (!resp.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Respon server tidak valid.");
      }

      const res = await resp.json();
      if (res.status === "success") {
        setConsolidationSuccessMsg("Bulan berhasil dipindahkan!");
        setTimeout(() => setConsolidationSuccessMsg(""), 5000);
        await fetchWorkingData(); // Refresh data from sheet
      } else {
        alert("Gagal memindahkan bulan: " + (res.message || "Unknown error"));
      }
    } catch (e) {
      console.warn("Update month failed:", e);
      alert("Error memindahkan bulan pada server.");
    } finally {
      setUpdatingRowMonthId(null);
    }
  };

  const handleEditPartnerSave = async (
    id: any,
    newPic: any,
    additionalData: any = {},
  ) => {
    setIsActionLoading(true);
    try {
      const isAdd = !id || additionalData.isAdd;

      const matchedPartner = !isAdd
        ? normalizedSnapshot.partners.find(
            (p) =>
              p.doc_id === String(id) ||
              cleanForMatch(p.partner_name) ===
                cleanForMatch(additionalData.originalName || additionalData.name || ""),
          )
        : undefined;
      const picEmp = normalizedSnapshot.employees.find(
        (e) =>
          cleanForMatch(e.full_name) === cleanForMatch(newPic || "") ||
          cleanForMatch(e.username) === cleanForMatch(newPic || ""),
      );
      const docId =
        matchedPartner?.doc_id ||
        (isAdd
          ? padFsId("PRT", normalizedSnapshot.partners.length + 1, 3)
          : toValidDocId(String(id)));
      const divGroup = String(additionalData.group || userData?.group || "")
        .toLowerCase()
        .includes("veg")
        ? ("Vegetables" as const)
        : ("Field Corn" as const);

      await upsertPartnerFirestore(
        firebaseUser,
        {
          doc_id: docId,
          partner_name: additionalData.name || matchedPartner?.partner_name || docId,
          category: additionalData.category || matchedPartner?.category || "R1",
          pic_employee_id: picEmp ? picEmp.doc_id : null,
          pic_name: picEmp?.full_name || String(newPic || ""),
          division_group: divGroup,
          province: additionalData.province || userData?.province || "-",
          area: additionalData.province || userData?.area || "-",
        },
        isAdd || !matchedPartner,
      );
      setPartnerEditModal({ isOpen: false, item: null });
      setConsolidationSuccessMsg("Data partner berhasil disimpan ke Firestore.");
      setTimeout(() => setConsolidationSuccessMsg(""), 4000);
    } catch (e: any) {
      console.warn("Gagal update data partner", e);
      alert("Terjadi kesalahan saat menyimpan data partner: " + e.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeletePartnerConfirm = async () => {
    if (!partnerDeleteModal.item?.name) {
      alert("Data partner tidak valid untuk dihapus (Nama kosong)");
      return;
    }
    const targetName = partnerDeleteModal.item.name;
    const targetId = partnerDeleteModal.item.id || partnerDeleteModal.item.doc_id;

    setIsActionLoading(true);
    try {
      const matched = normalizedSnapshot.partners.find(
        (p) =>
          p.doc_id === String(targetId) ||
          cleanForMatch(p.partner_name) === cleanForMatch(targetName),
      );
      if (matched) {
        await deletePartnerFirestore(matched.doc_id);
      }
      setPartnerDeleteModal({ isOpen: false, item: null });
      setConsolidationSuccessMsg("Partner berhasil dihapus dari Firestore.");
      setTimeout(() => setConsolidationSuccessMsg(""), 4000);
    } catch (e) {
      console.warn("Gagal hapus data partner", e);
      alert("Terjadi kesalahan saat menghapus partner. Silakan coba lagi.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEditEmployeeSave = async (
    originalName: string,
    updatedFields: any,
    isAdd = false,
  ) => {
    if (!isAdd && !originalName) return;
    setIsActionLoading(true);
    try {
      const existingEmp = !isAdd
        ? normalizedSnapshot.employees.find(
            (e) => cleanForMatch(e.full_name) === cleanForMatch(originalName),
          )
        : undefined;
      const uplineEmp = normalizedSnapshot.employees.find(
        (e) => cleanForMatch(e.full_name) === cleanForMatch(updatedFields.upline || ""),
      );
      const docId =
        existingEmp?.doc_id ||
        padFsId("EMP", normalizedSnapshot.employees.length + 1, 3);
      const divGroup = String(updatedFields.group || existingEmp?.division_group || "")
        .toLowerCase()
        .includes("veg")
        ? ("Vegetables" as const)
        : ("Field Corn" as const);
      const pos = String(updatedFields.position || existingEmp?.position || "Business Solution");
      const roleLevel = Number(updatedFields.level) || existingEmp?.role_level || 1;

      await upsertEmployeeFirestore(
        firebaseUser,
        {
          doc_id: docId,
          username: String(updatedFields.user || existingEmp?.username || "").toLowerCase(),
          full_name: updatedFields.name || existingEmp?.full_name || docId,
          position: pos,
          role_level: Math.min(5, Math.max(1, roleLevel)),
          upline_id: uplineEmp ? uplineEmp.doc_id : null,
          subordinate_ids: existingEmp?.subordinate_ids || [],
          access_scope_ids: existingEmp?.access_scope_ids || [docId],
          division_group: divGroup,
          province: updatedFields.province || existingEmp?.province || "-",
          area: updatedFields.area || updatedFields.province || existingEmp?.area || "-",
          status: String(updatedFields.status || "").toLowerCase().includes("non")
            ? "Nonaktif"
            : "Aktif",
        },
        isAdd || !existingEmp,
      );
      setEmployeeEditModal({ isOpen: false, item: null });
      setConsolidationSuccessMsg("Data karyawan berhasil disimpan ke Firestore.");
      setTimeout(() => setConsolidationSuccessMsg(""), 4000);
    } catch (e: any) {
      console.warn("Gagal update data karyawan", e);
      alert("Gagal menyimpan data karyawan ke Firestore: " + (e?.message || "Periksa Firestore Rules."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteEmployeeConfirm = async () => {
    if (!employeeDeleteModal.item?.name) return;
    setIsActionLoading(true);
    try {
      const existingEmp = normalizedSnapshot.employees.find(
        (e) =>
          cleanForMatch(e.full_name) === cleanForMatch(employeeDeleteModal.item?.name) ||
          e.doc_id === String(employeeDeleteModal.item?.doc_id || ""),
      );
      if (existingEmp) {
        await deleteEmployeeFirestore(existingEmp.doc_id);
      }
      setEmployeeDeleteModal({ isOpen: false, item: null });
      setConsolidationSuccessMsg("Karyawan berhasil dihapus dari Firestore.");
      setTimeout(() => setConsolidationSuccessMsg(""), 4000);
    } catch (e: any) {
      console.warn("Gagal hapus data karyawan", e);
      alert("Gagal menghapus data karyawan dari Firestore: " + (e?.message || "Periksa Firestore Rules."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const teamStats = useMemo(() => {
    const memberChannelsMap: Record<string, typeof kiosks> = {};
    const kioskCategoryMap: Record<string, string> = {};

    teamMembers.forEach((memberName) => {
      memberChannelsMap[cleanForMatch(memberName)] = [];
    });

    kiosks.forEach((k) => {
      const resolvedPic = getDdaOfUser(
        k.pic || "",
        userData?.name,
        computedTeamProfiles,
      );
      const cleanPic = cleanForMatch(resolvedPic);
      const cleanKiosk = cleanForMatch(k.name);

      kioskCategoryMap[cleanKiosk] = String(
        k.category || "Uncategorized",
      ).trim();

      if (memberChannelsMap[cleanPic]) {
        memberChannelsMap[cleanPic].push(k);
      } else {
        const match = teamMembers.find((m) => cleanForMatch(m) === cleanPic);
        if (match) {
          const mClean = cleanForMatch(match);
          if (!memberChannelsMap[mClean]) memberChannelsMap[mClean] = [];
          memberChannelsMap[mClean].push(k);
        }
      }
    });

    rawWorkingData.forEach((d) => {
      if (d.kiosk && d.category) {
        const cleanK = cleanForMatch(d.kiosk);
        if (cleanK) {
          kioskCategoryMap[cleanK] = String(d.category).trim();
        }
      }
    });

    const monthKeys = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mei",
      "jun",
      "jul",
      "ags",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    let currentMonthIdx = new Date().getMonth();
    if (filterBelowMonth && filterBelowMonth !== "All") {
      const parts = filterBelowMonth.split(" ");
      const mIdx = INDO_MONTHS.indexOf(parts[0]);
      if (mIdx !== -1) {
        currentMonthIdx = mIdx;
      }
    }
    const currentMonthKey = monthKeys[currentMonthIdx];
    const updColName = `upd_${currentMonthKey}`;
    const visitedKiosksByUser: Record<string, Set<string>> = {};

    rawWorkingData.forEach((item) => {
      if (!item.kiosk) return;
      const updVal = String(item[updColName] || "")
        .trim()
        .toLowerCase();
      if (updVal === "sales") {
        const cleanKiosk = cleanForMatch(item.kiosk);
        const resolvedUser = getDdaOfUser(
          String(item.user || ""),
          userData?.name,
          computedTeamProfiles,
        );
        const cleanUser = cleanForMatch(resolvedUser);

        let finalUser = cleanUser;
        if (!teamMembers.some((m) => cleanForMatch(m) === cleanUser)) {
          const match = teamMembers.find((m) => cleanForMatch(m) === cleanUser);
          if (match) finalUser = cleanForMatch(match);
        }

        if (!visitedKiosksByUser[finalUser]) {
          visitedKiosksByUser[finalUser] = new Set();
        }
        visitedKiosksByUser[finalUser].add(cleanKiosk);
      }
    });

    return teamMembers
      .filter((memberName) => {
        const p = teamPositions[memberName];
        const pos = normalizePosition(p);
        return pos !== "Unknown";
      })
      .map((memberName) => {
        const cleanMember = cleanForMatch(memberName);
        const memberChannels = memberChannelsMap[cleanMember] || [];
        const visitedKiosks = visitedKiosksByUser[cleanMember] || new Set();

        const counts: Record<string, any> = {};

        memberChannels.forEach((c) => {
          const cat = String(c.category || "Uncategorized").trim();
          if (!counts[cat]) counts[cat] = { total: 0, visited: 0 };
          counts[cat].total += 1;
        });

        let totalVisited = 0;
        visitedKiosks.forEach((kClean) => {
          const cat = kioskCategoryMap[kClean] || "Uncategorized";
          if (!counts[cat]) counts[cat] = { total: 0, visited: 0 };
          counts[cat].visited += 1;
          totalVisited += 1;
        });

        return {
          name: memberName,
          total: memberChannels.length,
          totalVisited: totalVisited,
          counts: counts,
        };
      })
      .sort((a, b) =>
        compareMembersByLevel(
          a.name,
          b.name,
          teamLevels,
          teamPositions,
          userData,
        ),
      );
  }, [
    kiosks,
    teamMembers,
    rawWorkingData,
    teamPositions,
    userData,
    filterBelowMonth,
  ]);

  const getStatsForPic = (name: string) => {
    const cleanName = cleanForMatch(name);
    const stat = teamStats.find((s) => cleanForMatch(s.name) === cleanName);

    if (!stat) {
      return { visited: 0, total: 0, percentage: 0 };
    }
    const percentage =
      stat.total > 0 ? Math.round((stat.totalVisited / stat.total) * 100) : 0;
    return { visited: stat.totalVisited, total: stat.total, percentage };
  };

  const isKioskVisited = (kioskName: string) => {
    const cleanK = cleanForMatch(kioskName);
    const monthKeys = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mei",
      "jun",
      "jul",
      "ags",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    let currentMonthIdx = new Date().getMonth();
    if (filterBelowMonth && filterBelowMonth !== "All") {
      const parts = filterBelowMonth.split(" ");
      const mIdx = INDO_MONTHS.indexOf(parts[0]);
      if (mIdx !== -1) {
        currentMonthIdx = mIdx;
      }
    }
    const currentMonthKey = monthKeys[currentMonthIdx];
    const updColName = `upd_${currentMonthKey}`;
    return rawWorkingData.some((item) => {
      if (!item.kiosk) return false;
      if (cleanForMatch(item.kiosk) !== cleanK) return false;
      const updVal = String(item[updColName] || "")
        .trim()
        .toLowerCase();
      return updVal === "sales";
    });
  };

  const isRowVisitZero = (rowName: string) => {
    const cleanName = cleanForMatch(rowName);
    const stat = teamStats.find((s) => cleanForMatch(s.name) === cleanName);
    if (stat) {
      return stat.totalVisited === 0;
    }
    // Check if it matches a kiosk name
    const isKiosk = kiosks.some((k) => cleanForMatch(k.name) === cleanName);
    if (isKiosk) {
      return !isKioskVisited(rowName);
    }
    return false;
  };

  const mappedChannelsByPic = useMemo(() => {
    const enrichedKiosks = allKiosks.map((k) => {
      const resolvedPic = getDdaOfUser(
        k.pic || "",
        userData?.name,
        computedTeamProfiles,
      );
      const cat = getValidCategory(
        k.category,
        undefined,
        k.name,
        workingCategoryMap,
      );
      return { ...k, pic: resolvedPic, category: cat };
    });

    const isAll =
      !mappingPic ||
      cleanForMatch(mappingPic) === "allteam" ||
      cleanForMatch(mappingPic) === "all_team";
    if (isAll) {
      return enrichedKiosks.filter((k) => {
        return teamMembers.some((m) => matchNames(k.pic, m));
      });
    }
    return enrichedKiosks.filter((k) => matchNames(k.pic, mappingPic));
  }, [allKiosks, mappingPic, teamMembers, userData, workingCategoryMap]);

  const mappingCategories = useMemo(() => {
    const rawCats = [
      ...new Set<string>(
        mappedChannelsByPic.map((k) =>
          String(k.category || "Uncategorized").trim(),
        ),
      ),
    ];
    const order = ["Distributor", "R1", "R2"];
    return rawCats.sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [mappedChannelsByPic]);

  const allCategories = useMemo(() => {
    const rawCats = [
      ...new Set<string>(
        allKiosks.map((k) => String(k.category || "Uncategorized").trim()),
      ),
    ];
    const order = ["Distributor", "R1", "R2"];
    return rawCats.sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [allKiosks]);

  useEffect(() => {
    if (
      mappingCategories.length > 0 &&
      !mappingCategories.includes(mappingCategory)
    ) {
      setMappingCategory(mappingCategories[0]);
    } else if (mappingCategories.length === 0) {
      setMappingCategory("");
    }
  }, [mappingCategories, mappingCategory]);

  const displayedPartnerChannels = useMemo(() => {
    return mappedChannelsByPic.filter(
      (k) => String(k.category || "Uncategorized").trim() === mappingCategory,
    );
  }, [mappedChannelsByPic, mappingCategory]);

  const myKiosks = useMemo(() => {
    if (isBusinessAnalyst) {
      return allKiosks;
    }
    const userPicName = userData?.name || "";
    const direct = allKiosks.filter(
      (k) =>
        matchNames(k.pic, userPicName) ||
        (computedTeamProfiles &&
          getDdaOfUser(k.pic, userPicName, computedTeamProfiles).toLowerCase() ===
            userPicName.toLowerCase()),
    );
    if (direct.length > 0) return direct;
    return allKiosks;
  }, [allKiosks, userData, isBusinessAnalyst, computedTeamProfiles]);

  const filteredKiosks = useMemo(
    () =>
      myKiosks.filter((k) =>
        String(k.name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [myKiosks, searchTerm],
  );

  useEffect(() => {
    if (myKiosks.length > 0) {
      if (
        selectedKiosk === "Loading Kiosk..." ||
        selectedKiosk === "No Channel Assigned" ||
        !myKiosks.some(
          (k) => cleanForMatch(k.name) === cleanForMatch(selectedKiosk),
        )
      ) {
        setSelectedKiosk(myKiosks[0].name);
      }
    } else if (kiosks.length > 0) {
      setSelectedKiosk(kiosks[0].name);
    } else {
      setSelectedKiosk("No Channel Assigned");
    }
  }, [myKiosks, kiosks, selectedKiosk]);

  // Fungsi Parser Tanggal POG
  const parseDateForPog = (timestamp) => {
    if (!timestamp) return new Date(0);
    if (timestamp instanceof Date) return timestamp;
    let d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;

    if (typeof timestamp === "string" && timestamp.includes("/")) {
      const parts = timestamp.split(/[\s/:]+/);
      if (parts.length >= 3) {
        let year = parts[2];
        if (year.length === 2 && !isNaN(Number(year))) {
          year = "20" + year;
        }
        const dStr = `${year}-${parts[1]}-${parts[0]}T${parts[3] || "00"}:${parts[4] || "00"}:${parts[5] || "00"}`;
        d = new Date(dStr);
      }
    }
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  // Kalkulasi & Filter Data POG
  const pogDataProcessed = useMemo(() => {
    const now = new Date();
    let currentMonth = now.getMonth();
    let currentYear = now.getFullYear();

    if (filterBelowMonth && filterBelowMonth !== "All") {
      const parts = filterBelowMonth.split(" ");
      const mIdx = INDO_MONTHS.indexOf(parts[0]);
      if (mIdx !== -1) {
        currentMonth = mIdx;
        currentYear = parseInt(parts[1], 10);
      }
    }

    const startOfCurrentMonthTime = new Date(
      currentYear,
      currentMonth,
      1,
    ).getTime();

    const picToUplineMap: Record<string, string> = {};
    allKiosks.forEach((k) => {
      const p = String(k.pic || "").trim();
      const u = String(k.upline || "").trim();
      if (p && u) {
        picToUplineMap[p.toLowerCase()] = normalizeName(u);
      }
    });
    picToUplineMap["listianto"] = "AGUS HERDIANTO";

    // Pre-compute maps to avoid nested array scans (O(N*M) -> O(N+M))
    const kiosksMapByCleanName: Record<string, any> = {};
    allKiosks.forEach((k) => {
      kiosksMapByCleanName[cleanForMatch(k.name)] = k;
    });

    const teamMembersMapByCleanName: Record<string, string> = {};
    teamMembers.forEach((m) => {
      teamMembersMapByCleanName[cleanForMatch(m)] = m;
    });
    const getTeamMemberMatch = (name: string): string | undefined => {
      const clean = cleanForMatch(name);
      if (teamMembersMapByCleanName[clean])
        return teamMembersMapByCleanName[clean];
      return teamMembers.find((m) => matchNames(m, name));
    };

    const lotMap: Record<string, any> = {};

    const resolveHierarchy = (
      kioskName: string,
      itemUser?: string,
      itemArea?: string,
      itemCategory?: string,
      itemLot?: string,
      itemPic?: string,
    ) => {
      const cleanKName = cleanForMatch(kioskName);
      const kInfo =
        kiosksMapByCleanName[cleanKName] ||
        kiosks.find((k) => matchNames(k.name, kioskName)) ||
        {};
      const rawPic = normalizeName(getResolvedPic(kioskName, kInfo.pic, itemUser, itemLot, itemPic));
      const pic = getDdaOfUser(rawPic, userData?.name, computedTeamProfiles);
      let upline = normalizeName(String(kInfo.upline || ""));
      if (pic.toLowerCase() === "listianto") {
        upline = "AGUS HERDIANTO";
      } else {
        const matchedMember = getTeamMemberMatch(pic);
        const foundUp = getFromRecord<string>(
          teamUpLines,
          matchedMember || pic,
        );
        if (foundUp) {
          upline = normalizeName(foundUp);
        } else if (!upline && pic !== "Unknown") {
          const foundUpline = picToUplineMap[pic.toLowerCase()];
          if (foundUpline) upline = normalizeName(foundUpline);
        }
      }

      let area = "-";
      const cleanPic = cleanForMatch(pic);
      const matchedMember = getTeamMemberMatch(pic);
      const foundArea = getFromRecord<string>(teamAreas, matchedMember || pic);
      if (foundArea && foundArea !== "-") {
        area = foundArea;
      } else if (itemArea && String(itemArea).trim() !== "") {
        area = String(itemArea).trim();
      } else if (cleanPic === cleanForMatch(userData?.name)) {
        area = userData?.area || "-";
      }

      const category = getValidCategory(
        itemCategory,
        kInfo.category,
        kioskName,
        workingCategoryMap,
      );
      return { pic, upline, area, category, kInfo };
    };

    const monthCols = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mei",
      "jun",
      "jul",
      "ags",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    const prevMonthCol =
      currentMonth === 3 // April
        ? null
        : currentMonth === 0 // January
        ? "des"
        : monthCols[currentMonth - 1];
    const targetMonthCol = monthCols[currentMonth];

    rawWorkingData.forEach((d) => {
      const h = resolveHierarchy(d.kiosk, d.user, d.area, d.category, d.lot, d.pic);
      const crops =
        d.crops && String(d.crops).trim() !== ""
          ? d.crops
          : "Uncategorized Crops";

      const dateObj = parseDateForPog(d.timestamp);
      const t = dateObj.getTime();
      const key = `${d.kiosk}_${String(d.lot).trim().toUpperCase()}_${d.hybrid}_${cleanForMatch(h.pic || "")}`;
      if (!lotMap[key]) {
        lotMap[key] = {
          kiosk: d.kiosk,
          lot: String(d.lot).toUpperCase(),
          hybrid: d.hybrid,
          pic: h.pic,
          upline: h.upline,
          area: h.area,
          category: h.category,
          crops,
          lastQty: 0,
          currentQty: 0,
          latestTime: 0,
          latestRow: null,
          sellIn: 0, // representing Stock in
          sellOut: 0, // representing Stock out
          idleStock: 0, // representing idle stock
          pogAccumulated: 0,
        };
      }

      if (t > lotMap[key].latestTime || lotMap[key].latestRow === null) {
        lotMap[key].latestTime = t;
        lotMap[key].latestRow = d;
      }

      const pogVal = safeParseFloat(d.pog);
      if (pogVal < 0) {
        lotMap[key].sellIn += Math.abs(pogVal);
      } else if (pogVal > 0) {
        lotMap[key].sellOut += pogVal;
      }

      const condClean = String(d.condition || "").trim().toLowerCase();
      if (condClean === "berkurang" && pogVal > 0) {
        lotMap[key].pogAccumulated += pogVal;
      }
      if (condClean === "tetap") {
        lotMap[key].idleStock += safeParseFloat(d.stock);
      }
    });

    // Extract opening (lastQty) and ending (currentQty) directly from monthly columns of the latest row
    Object.values(lotMap).forEach((item: any) => {
      if (item.latestRow) {
        const row = item.latestRow;
        item.lastQty =
          prevMonthCol &&
          row[prevMonthCol] !== undefined &&
          safeParseFloat(row[prevMonthCol]) > 0
            ? safeParseFloat(row[prevMonthCol])
            : 0;

        const isUpdated = row["upd_" + targetMonthCol] && row["upd_" + targetMonthCol] !== "";
        item.currentQty = isUpdated
          ? safeParseFloat(row[targetMonthCol])
          : safeParseFloat(row.stock);
      }
    });

    return Object.values(lotMap)
      .map((item: any) => {
        return {
          ...item,
          pog: (item.lastQty || 0) + (item.sellIn || 0) - (item.currentQty || 0),
        };
      })
      .filter(
        (item) =>
          item.lastQty > 0 ||
          item.currentQty > 0 ||
          item.sellIn > 0 ||
          item.sellOut > 0 ||
          item.idleStock > 0,
      );
  }, [
    rawWorkingData,
    drSalesData,
    kiosks,
    userData,
    teamAreas,
    teamMembers,
    teamUpLines,
    filterBelowMonth,
  ]);

  // Dynamic filter options based on raw data
  const filterOptions = useMemo(() => {
    const rawData =
      rawWorkingData && rawWorkingData.length > 0 ? rawWorkingData : [];

    // 1. Months (April - Maret, matching the database columns / crop year)
    const months = [
      "April 2026",
      "Mei 2026",
      "Juni 2026",
      "Juli 2026",
      "Agustus 2026",
      "September 2026",
      "Oktober 2026",
      "November 2026",
      "Desember 2026",
      "Januari 2027",
      "Februari 2027",
      "Maret 2027",
    ];

    // 2. Channel (Category)
    const channelsSet = new Set<string>();
    kiosks.forEach((k) => {
      const cat = getValidCategory(k.category, undefined, k.name, workingCategoryMap);
      if (cat && cat !== "Uncategorized") channelsSet.add(cat);
    });
    rawData.forEach((d) => {
      const cat = getValidCategory(d.category, undefined, d.kiosk, workingCategoryMap);
      if (cat && cat !== "Uncategorized") channelsSet.add(cat);
    });
    const channels = Array.from(channelsSet).filter(Boolean).sort();

    // 3. Material (Hybrid)
    const materialsSet = new Set<string>();
    rawData.forEach((d) => {
      if (d.hybrid) materialsSet.add(String(d.hybrid).trim());
    });
    const materials = Array.from(materialsSet).filter(Boolean).sort();

    // 4. Team (PIC)
    const teamsSet = new Set<string>();
    rawData.forEach((d) => {
      const cleanKName = cleanForMatch(d.kiosk);
      const kInfo =
        kiosks.find((k) => cleanForMatch(k.name) === cleanKName) || {};
      const rawPic = normalizeName(getResolvedPic(d.kiosk, kInfo.pic, d.user, d.lot, d.pic));
      const pic = getDdaOfUser(rawPic, userData?.name, computedTeamProfiles);
      if (pic && pic !== "Unknown") teamsSet.add(String(pic).trim());
    });
    const teams = Array.from(teamsSet).filter(Boolean).sort();

    // 5. Area
    const areasSet = new Set<string>();
    if (employees && employees.length > 0) {
      employees.forEach((emp) => {
        const area = String(emp.area || "").trim();
        if (area && area !== "-") {
          areasSet.add(area);
        }
      });
    } else {
      rawData.forEach((d) => {
        const cleanKName = cleanForMatch(d.kiosk);
        const kInfo =
          kiosks.find((k) => cleanForMatch(k.name) === cleanKName) || {};
        const rawPic = normalizeName(getResolvedPic(d.kiosk, kInfo.pic, d.user, d.lot, d.pic));
        const pic = getDdaOfUser(rawPic, userData?.name, computedTeamProfiles);
        const matchedMember = teamMembers.find((m) => matchNames(m, pic));
        const area =
          getFromRecord<string>(teamAreas, matchedMember || pic) ||
          kInfo.area ||
          d.area;
        if (area && area !== "-") areasSet.add(String(area).trim());
      });
    }
    const areas = Array.from(areasSet).filter(Boolean).sort();

    return {
      months,
      channels,
      materials,
      teams,
      areas,
    };
  }, [
    rawWorkingData,
    kiosks,
    userData,
    teamMembers,
    teamAreas,
    employees,
    workingCategoryMap,
  ]);

  // Recalculate processed POG data base on selected month filter
  const pogDataProcessedForOverview = useMemo(() => {
    const now = new Date();
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();
    const isFilteredMonth = filterBelowMonth && filterBelowMonth !== "All";

    if (isFilteredMonth) {
      const parts = filterBelowMonth.split(" ");
      const mIdx = INDO_MONTHS.indexOf(parts[0]);
      if (mIdx !== -1) {
        targetMonth = mIdx;
        targetYear = parseInt(parts[1], 10);
      }
    }

    const startOfTargetMonthTime = new Date(
      targetYear,
      targetMonth,
      1,
    ).getTime();
    const endOfTargetMonthTime = new Date(
      targetYear,
      targetMonth + 1,
      1,
    ).getTime();

    const monthCols = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mei",
      "jun",
      "jul",
      "ags",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    const prevMonthCol =
      targetMonth === 3 // April
        ? null
        : targetMonth === 0 // January
        ? "des"
        : monthCols[targetMonth - 1];
    const targetMonthCol = monthCols[targetMonth];

    const picToUplineMap: Record<string, string> = {};
    allKiosks.forEach((k) => {
      const p = String(k.pic || "").trim();
      const u = String(k.upline || "").trim();
      if (p && u) {
        picToUplineMap[p.toLowerCase()] = normalizeName(u);
      }
    });
    picToUplineMap["listianto"] = "AGUS HERDIANTO";

    const kiosksMapByCleanName: Record<string, any> = {};
    allKiosks.forEach((k) => {
      kiosksMapByCleanName[cleanForMatch(k.name)] = k;
    });

    const teamMembersMapByCleanName: Record<string, string> = {};
    teamMembers.forEach((m) => {
      teamMembersMapByCleanName[cleanForMatch(m)] = m;
    });
    const getTeamMemberMatch = (name: string): string | undefined => {
      const clean = cleanForMatch(name);
      if (teamMembersMapByCleanName[clean])
        return teamMembersMapByCleanName[clean];
      return teamMembers.find((m) => matchNames(m, name));
    };

    const lotMap: Record<string, any> = {};

    const resolveHierarchy = (
      kioskName: string,
      itemUser?: string,
      itemArea?: string,
      itemCategory?: string,
      itemLot?: string,
      itemPic?: string,
    ) => {
      const cleanKName = cleanForMatch(kioskName);
      const kInfo =
        kiosksMapByCleanName[cleanKName] ||
        kiosks.find((k) => matchNames(k.name, kioskName)) ||
        {};
      const rawPic = normalizeName(getResolvedPic(kioskName, kInfo.pic, itemUser, itemLot, itemPic));
      const pic = getDdaOfUser(rawPic, userData?.name, computedTeamProfiles);
      let upline = normalizeName(String(kInfo.upline || ""));
      if (pic.toLowerCase() === "listianto") {
        upline = "AGUS HERDIANTO";
      }

      let area = "-";
      const cleanPic = cleanForMatch(pic);
      const matchedMember = getTeamMemberMatch(pic);
      const foundArea = getFromRecord<string>(teamAreas, matchedMember || pic);
      if (foundArea && foundArea !== "-") {
        area = foundArea;
      } else if (itemArea && String(itemArea).trim() !== "") {
        area = String(itemArea).trim();
      } else if (cleanPic === cleanForMatch(userData?.name)) {
        area = userData?.area || "-";
      }

      const category = getValidCategory(
        itemCategory,
        kInfo.category,
        kioskName,
        workingCategoryMap,
      );
      return { pic, upline, area, category, kInfo };
    };

    const rawData =
      rawWorkingData && rawWorkingData.length > 0 ? rawWorkingData : [];

    rawData.forEach((d) => {
      const dateObj = parseDateForPog(d.timestamp);
      const t = dateObj.getTime();

      // If filtering by specific month, skip transactions that happened after the end of this target month
      if (isFilteredMonth && t >= endOfTargetMonthTime) {
        return;
      }

      const h = resolveHierarchy(d.kiosk, d.user, d.area, d.category, d.lot, d.pic);
      const crops =
        d.crops && String(d.crops).trim() !== ""
          ? d.crops
          : "Uncategorized Crops";

      const key = `${d.kiosk}_${String(d.lot).trim().toUpperCase()}_${d.hybrid}_${cleanForMatch(h.pic || "")}`;
      if (!lotMap[key]) {
        lotMap[key] = {
          kiosk: d.kiosk,
          lot: String(d.lot).toUpperCase(),
          hybrid: d.hybrid,
          pic: h.pic,
          upline: h.upline,
          area: h.area,
          category: h.category,
          crops,
          lastQty: 0,
          currentQty: 0,
          latestTime: 0,
          latestRow: null,
          sellIn: 0,
          sellOut: 0,
          idleStock: 0,
          pogAccumulated: 0,
        };
      }

      if (t > lotMap[key].latestTime || lotMap[key].latestRow === null) {
        lotMap[key].latestTime = t;
        lotMap[key].latestRow = d;
      }

      const pogVal = safeParseFloat(d.pog);
      if (pogVal < 0) {
        lotMap[key].sellIn += Math.abs(pogVal);
      } else if (pogVal > 0) {
        lotMap[key].sellOut += pogVal;
      }

      const condClean = String(d.condition || "").trim().toLowerCase();
      if (condClean === "berkurang" && pogVal > 0) {
        lotMap[key].pogAccumulated += pogVal;
      }
      if (condClean === "tetap") {
        lotMap[key].idleStock += safeParseFloat(d.stock);
      }
    });

    // Extract opening (lastQty) and ending (currentQty) directly from monthly columns of the latest row
    Object.values(lotMap).forEach((item: any) => {
      if (item.latestRow) {
        const row = item.latestRow;
        item.lastQty =
          prevMonthCol &&
          row[prevMonthCol] !== undefined &&
          safeParseFloat(row[prevMonthCol]) > 0
            ? safeParseFloat(row[prevMonthCol])
            : 0;

        const isUpdated = row["upd_" + targetMonthCol] && row["upd_" + targetMonthCol] !== "";
        item.currentQty = isUpdated
          ? safeParseFloat(row[targetMonthCol])
          : safeParseFloat(row.stock);
      }
    });

    const teamMembersCleanSet = new Set(
      teamMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );

    let result = Object.values(lotMap)
      .map((item: any) => {
        return {
          ...item,
          pog: (item.lastQty || 0) + (item.sellIn || 0) - (item.currentQty || 0),
        };
      })
      .filter(
        (item) =>
          item.lastQty > 0 ||
          item.currentQty > 0 ||
          item.sellIn > 0 ||
          item.sellOut > 0 ||
          item.idleStock > 0,
      )
      .filter((item) => {
        if (isBusinessAnalyst) return true;
        const picClean = cleanForMatch(item.pic);
        let isTeamMember = teamMembersCleanSet.has(picClean);
        if (!isTeamMember && computedTeamProfiles) {
          const emp = computedTeamProfiles[picClean];
          if (emp && emp.name) {
            const empNameClean = cleanForMatch(emp.name);
            if (teamMembersCleanSet.has(empNameClean)) {
              isTeamMember = true;
            }
          }
        }
        return isTeamMember;
      });

    return result;
  }, [
    rawWorkingData,
    kiosks,
    userData,
    teamAreas,
    teamMembers,
    teamUpLines,
    filterBelowMonth,
    isBusinessAnalyst,
  ]);

  // Apply other category filters (channel, material, team, area) to computed list
  const pogDataOverviewFiltered = useMemo(() => {
    let result = pogDataProcessedForOverview;

    // Filter 2: channel (Category)
    if (filterBelowChannel && filterBelowChannel !== "All") {
      result = result.filter(
        (item) =>
          cleanForMatch(item.category) === cleanForMatch(filterBelowChannel),
      );
    }

    // Filter 2: material (Hybrid)
    if (filterBelowMaterial && filterBelowMaterial !== "All") {
      result = result.filter(
        (item) =>
          cleanForMatch(item.hybrid) === cleanForMatch(filterBelowMaterial),
      );
    }

    // Filter 2: team (PIC)
    if (filterBelowTeam && filterBelowTeam !== "All") {
      result = result.filter(
        (item) => cleanForMatch(item.pic) === cleanForMatch(filterBelowTeam),
      );
    }

    // Filter 2: area
    if (filterBelowArea && filterBelowArea !== "All") {
      result = result.filter(
        (item) => cleanForMatch(item.area) === cleanForMatch(filterBelowArea),
      );
    }

    // Filter 2: crop (Crops)
    if (filterBelowCrop && filterBelowCrop !== "All") {
      result = result.filter((item) =>
        checkCropMatch(item.crops, filterBelowCrop),
      );
    }

    return result;
  }, [
    pogDataProcessedForOverview,
    filterBelowChannel,
    filterBelowMaterial,
    filterBelowTeam,
    filterBelowArea,
    filterBelowCrop,
  ]);

  const overviewHistoryData = useMemo(() => {
    // Generate historical trends grouped by Month from April 2026 to March 2027
    const monthsSequence = [
      { key: "2026-04", label: "Apr 26", prop: "apr", monthIdx: 3, year: 2026 },
      { key: "2026-05", label: "Mei 26", prop: "mei", monthIdx: 4, year: 2026 },
      { key: "2026-06", label: "Jun 26", prop: "jun", monthIdx: 5, year: 2026 },
      { key: "2026-07", label: "Jul 26", prop: "jul", monthIdx: 6, year: 2026 },
      { key: "2026-08", label: "Ags 26", prop: "ags", monthIdx: 7, year: 2026 },
      { key: "2026-09", label: "Sep 26", prop: "sep", monthIdx: 8, year: 2026 },
      { key: "2026-10", label: "Okt 26", prop: "okt", monthIdx: 9, year: 2026 },
      {
        key: "2026-11",
        label: "Nov 26",
        prop: "nov",
        monthIdx: 10,
        year: 2026,
      },
      {
        key: "2026-12",
        label: "Des 26",
        prop: "des",
        monthIdx: 11,
        year: 2026,
      },
      { key: "2027-01", label: "Jan 27", prop: "jan", monthIdx: 0, year: 2027 },
      { key: "2027-02", label: "Feb 27", prop: "feb", monthIdx: 1, year: 2027 },
      { key: "2027-03", label: "Mar 27", prop: "mar", monthIdx: 2, year: 2027 },
    ];

    const monthlyMap: Record<
      string,
      {
        monthKey: string;
        monthLabel: string;
        opening: number;
        ending: number;
        stockIn: number;
        idle: number;
        pog: number;
      }
    > = {};
    monthsSequence.forEach((item) => {
      monthlyMap[item.key] = {
        monthKey: item.key,
        monthLabel: item.label,
        opening: 0,
        ending: 0,
        stockIn: 0,
        idle: 0,
        pog: 0,
      };
    });

    rawWorkingData.forEach((d) => {
      // Dynamic filters matching Category, Material, Team, Area
      if (filterBelowChannel && filterBelowChannel !== "All") {
        const kName = cleanForMatch(d.kiosk);
        const kInfo = allKiosks.find((k) => cleanForMatch(k.name) === kName);
        const effectiveCat = kInfo?.category || d.category;
        if (
          cleanForMatch(effectiveCat) !== cleanForMatch(filterBelowChannel)
        ) {
          return;
        }
      }
      if (filterBelowMaterial && filterBelowMaterial !== "All") {
        if (cleanForMatch(d.hybrid) !== cleanForMatch(filterBelowMaterial)) {
          return;
        }
      }
      if (filterBelowTeam && filterBelowTeam !== "All") {
        const kName = cleanForMatch(d.kiosk);
        const kInfo = kiosks.find((k) => cleanForMatch(k.name) === kName) || {};
        const rawPic = normalizeName(getResolvedPic(d.kiosk, kInfo.pic, d.user, d.lot, d.pic));
        const pic = getDdaOfUser(
          rawPic,
          userData?.name,
          computedTeamProfiles,
        );
        if (cleanForMatch(pic) !== cleanForMatch(filterBelowTeam)) {
          return;
        }
      }
      if (filterBelowArea && filterBelowArea !== "All") {
        const kName = cleanForMatch(d.kiosk);
        const kInfo = kiosks.find((k) => cleanForMatch(k.name) === kName) || {};
        const rawPic = normalizeName(getResolvedPic(d.kiosk, kInfo.pic, d.user, d.lot, d.pic));
        const pic = getDdaOfUser(
          rawPic,
          userData?.name,
          computedTeamProfiles,
        );
        const matchedMember = teamMembers.find((m) => matchNames(m, pic));
        const area =
          getFromRecord<string>(teamAreas, matchedMember || pic) ||
          kInfo.area ||
          d.area ||
          "-";
        if (cleanForMatch(area) !== cleanForMatch(filterBelowArea)) {
          return;
        }
      }
      if (filterBelowCrop && filterBelowCrop !== "All") {
        const itemCrop =
          d.crops || d.Crops || d.crop || d.Crop || d.CROP || d.CROPS || "";
        if (!checkCropMatch(itemCrop, filterBelowCrop)) {
          return;
        }
      }

      // Find max POG across months to estimate capacity
      let maxPogForKiosk = 0;
      monthsSequence.forEach((cfg) => {
        const val = safeParseFloat((d as any)[cfg.prop]);
        if (val > maxPogForKiosk) maxPogForKiosk = val;
      });
      if (maxPogForKiosk === 0) maxPogForKiosk = 100; // default baseline

      // Initialize sequential inventory simulation for this specific channel partner
      let currentOpening = Math.round(maxPogForKiosk * 1.5 + 40);

      monthsSequence.forEach((cfg) => {
        const pogVal = safeParseFloat((d as any)[cfg.prop]);
        const stockInVal = Math.round(pogVal * 1.08 + (pogVal > 0 ? 12 : 3));
        const endingVal = Math.max(0, currentOpening + stockInVal - pogVal);
        const idleVal = Math.min(
          endingVal,
          Math.round(currentOpening * 0.15 + 8),
        );

        monthlyMap[cfg.key].opening += currentOpening;
        monthlyMap[cfg.key].ending += endingVal;
        monthlyMap[cfg.key].stockIn += stockInVal;
        monthlyMap[cfg.key].idle += idleVal;
        monthlyMap[cfg.key].pog += pogVal;

        currentOpening = endingVal;
      });
    });

    return monthsSequence.map((cfg) => monthlyMap[cfg.key]);
  }, [
    rawWorkingData,
    kiosks,
    filterBelowChannel,
    filterBelowMaterial,
    filterBelowTeam,
    filterBelowArea,
    filterBelowCrop,
    userData,
    teamMembers,
    teamAreas,
  ]);

  const overviewStats = useMemo(() => {
    let activeKiosks = (allKiosks || []).filter((k) => {
      if (isBusinessAnalyst) return true;
      const resolvedPic = getDdaOfUser(
        k.pic || "",
        userData?.name,
        computedTeamProfiles,
      );
      return teamMembers.some((m) => matchNames(m, resolvedPic));
    });

    if (filterBelowChannel && filterBelowChannel !== "All") {
      activeKiosks = activeKiosks.filter(
        (k) => cleanForMatch(k.category) === cleanForMatch(filterBelowChannel),
      );
    }
    if (filterBelowTeam && filterBelowTeam !== "All") {
      activeKiosks = activeKiosks.filter((k) => {
        const resolvedPic = getDdaOfUser(
          k.pic || "",
          userData?.name,
          computedTeamProfiles,
        );
        return cleanForMatch(resolvedPic) === cleanForMatch(filterBelowTeam);
      });
    }
    if (filterBelowArea && filterBelowArea !== "All") {
      activeKiosks = activeKiosks.filter((k) => {
        const resolvedPic = getDdaOfUser(
          k.pic || "",
          userData?.name,
          computedTeamProfiles,
        );
        const matchedMember = teamMembers.find((m) =>
          matchNames(m, resolvedPic),
        );
        const area =
          getFromRecord<string>(teamAreas, matchedMember || resolvedPic) ||
          k.area ||
          "-";
        return cleanForMatch(area) === cleanForMatch(filterBelowArea);
      });
    }
    if (filterBelowCrop && filterBelowCrop !== "All") {
      const activeKioskNames = new Set(
        pogDataOverviewFiltered.map((item) => cleanForMatch(item.kiosk)),
      );
      activeKiosks = activeKiosks.filter((k) =>
        activeKioskNames.has(cleanForMatch(k.name)),
      );
    }

    let totalKiosks = activeKiosks.length;
    let totalOpeningStock = 0;
    let totalSellIn = 0;
    let totalSellOut = 0;
    let totalCurrentStock = 0;
    let totalIdleStock = 0;

    pogDataOverviewFiltered.forEach((item) => {
      const isDistributor = cleanForMatch(item.category) === "distributor";
      totalOpeningStock += safeParseFloat(item.lastQty);
      if (isDistributor) totalSellIn += safeParseFloat(item.sellIn);
      totalSellOut += safeParseFloat(item.sellOut);
      totalCurrentStock += safeParseFloat(item.currentQty);
      totalIdleStock += safeParseFloat(item.idleStock);
    });

    let totalPog = totalOpeningStock + totalSellIn - totalCurrentStock;

    // Grouping dimension: group by area, province, sales_agronomist, business_solution, material, or distributor
    const groupMap: Record<
      string,
      {
        name: string;
        pog: number;
        stock: number;
        sellIn: number;
        sellOut: number;
        opening: number;
        idle: number;
      }
    > = {};

    pogDataOverviewFiltered.forEach((item) => {
      let gVal = "";
      const itemPic = item.pic;
      const rawPos = getFromRecord<string>(teamPositions, itemPic) || "";
      const pos = normalizePosition(rawPos);

      if (overviewGroupDimension === "area") {
        gVal = item.area || "Tanpa Area";
      } else if (overviewGroupDimension === "province") {
        gVal =
          getFromRecord<string>(teamProvinces, itemPic) ||
          item.province ||
          "Tanpa Provinsi";
      } else if (overviewGroupDimension === "sales_agronomist") {
        if (pos === "Sales Agronomist") {
          gVal = itemPic || "Unknown";
        } else {
          return;
        }
      } else if (overviewGroupDimension === "business_solution") {
        if (pos === "Business Solution") {
          gVal = itemPic || "Unknown";
        } else {
          return;
        }
      } else if (overviewGroupDimension === "material") {
        gVal = item.hybrid || "Lainnya";
      } else if ((overviewGroupDimension as string) === "distributor") {
        if (cleanForMatch(item.category) === "distributor") {
          gVal = item.kiosk || "Tanpa Distributor";
        } else {
          return;
        }
      } else {
        gVal = item.area || "Tanpa Area";
      }

      if (!groupMap[gVal]) {
        groupMap[gVal] = {
          name: gVal,
          pog: 0,
          stock: 0,
          sellIn: 0,
          sellOut: 0,
          opening: 0,
          idle: 0,
        };
      }
      groupMap[gVal].pog += safeParseFloat(item.pog);
      groupMap[gVal].stock += safeParseFloat(item.currentQty);
      groupMap[gVal].sellIn += safeParseFloat(item.sellIn);
      groupMap[gVal].sellOut += safeParseFloat(item.sellOut);
      groupMap[gVal].opening += safeParseFloat(item.lastQty);
      groupMap[gVal].idle += safeParseFloat(item.idleStock);
    });

    const areaChartData = Object.values(groupMap).sort((a, b) => {
      if (overviewMetricFilter === "movement") {
        return b.sellIn + b.pog - (a.sellIn + a.pog);
      } else if (overviewMetricFilter === "idle") {
        return b.idle - a.idle;
      } else if (overviewMetricFilter === "total_stock") {
        return b.stock - a.stock;
      } else if (overviewMetricFilter === "Opening") {
        return b.opening - a.opening;
      } else {
        return b.pog - a.pog;
      }
    });

    // Group by Category of Kiosk (Channel)
    const catMap: Record<string, { name: string; value: number }> = {};
    activeKiosks.forEach((k) => {
      const cat = getValidCategory(
        k.category,
        undefined,
        k.name,
        workingCategoryMap,
      );
      if (!catMap[cat]) {
        catMap[cat] = { name: cat, value: 0 };
      }
      catMap[cat].value += 1;
    });
    const categoryChartData = Object.values(catMap);

    // Group by Crops
    const cropMap: Record<
      string,
      { name: string; stock: number; pog: number }
    > = {};
    pogDataOverviewFiltered.forEach((item) => {
      const crop = item.crops || "Lainnya";
      if (!cropMap[crop]) {
        cropMap[crop] = { name: crop, stock: 0, pog: 0 };
      }
      cropMap[crop].stock += safeParseFloat(item.currentQty);
      cropMap[crop].pog += safeParseFloat(item.pog);
    });
    const cropsChartData = Object.values(cropMap).sort(
      (a, b) => b.stock - a.stock,
    );

    return {
      totalKiosks,
      totalOpeningStock,
      totalSellIn,
      totalSellOut,
      totalCurrentStock,
      totalIdleStock,
      totalPog,
      areaChartData,
      categoryChartData,
      cropsChartData,
    };
  }, [
    allKiosks,
    pogDataOverviewFiltered,
    overviewMetricFilter,
    overviewGroupDimension,
    teamPositions,
    teamProvinces,
    filterBelowChannel,
    filterBelowTeam,
    filterBelowArea,
    filterBelowCrop,
    userData,
    teamMembers,
    teamAreas,
  ]);

  const topKiosksData = useMemo(() => {
    const kioskSales: Record<
      string,
      {
        kiosk: string;
        category: string;
        pic: string;
        area: string;
        pog: number;
        currentStock: number;
      }
    > = {};

    pogDataOverviewFiltered.forEach((item) => {
      const kName = item.kiosk;
      if (!kioskSales[kName]) {
        kioskSales[kName] = {
          kiosk: kName,
          category: getValidCategory(
            item.category,
            undefined,
            item.kiosk,
            workingCategoryMap,
          ),
          pic: item.pic || "Unknown",
          area: item.area || "-",
          pog: 0,
          currentStock: 0,
        };
      }
      kioskSales[kName].pog += Number(item.pog || 0);
      kioskSales[kName].currentStock += Number(item.currentQty || 0);
    });

    return Object.values(kioskSales)
      .sort((a, b) => b.pog - a.pog)
      .slice(0, 5);
  }, [pogDataOverviewFiltered]);

  const employeePerformanceData = useMemo(() => {
    const empSales: Record<
      string,
      { employee: string; area: string; pog: number; currentStock: number }
    > = {};

    teamMembers.forEach((member) => {
      const mClean = cleanForMatch(member);

      // Get area for this member
      let area = "-";
      const foundArea = getFromRecord<string>(teamAreas, member);
      if (foundArea) {
        area = foundArea;
      } else if (mClean === cleanForMatch(userData?.name)) {
        area = userData?.area || "-";
      }

      // Filter by Area if chosen
      if (
        filterBelowArea &&
        filterBelowArea !== "All" &&
        cleanForMatch(area) !== cleanForMatch(filterBelowArea)
      ) {
        return;
      }

      // Filter by PIC if chosen
      if (
        filterBelowTeam &&
        filterBelowTeam !== "All" &&
        mClean !== cleanForMatch(filterBelowTeam)
      ) {
        return;
      }

      empSales[mClean] = {
        employee: member,
        area: area,
        pog: 0,
        currentStock: 0,
      };
    });

    // Accumulate sales and stock from pogDataOverviewFiltered
    pogDataOverviewFiltered.forEach((item) => {
      const picClean = cleanForMatch(item.pic);
      // Try to find matching employee
      let matchedEmpClean = picClean;
      if (!empSales[picClean]) {
        const found = teamMembers.find(
          (m) => cleanForMatch(m) === picClean || matchNames(m, item.pic),
        );
        if (found) {
          matchedEmpClean = cleanForMatch(found);
        }
      }

      if (empSales[matchedEmpClean]) {
        empSales[matchedEmpClean].pog += Number(item.pog || 0);
        empSales[matchedEmpClean].currentStock += Number(item.currentQty || 0);
      }
    });

    const empSalesList = Object.values(empSales);

    // Sort for Highest (Top 5)
    const highest = [...empSalesList].sort((a, b) => b.pog - a.pog).slice(0, 5);

    // Sort for Lowest (Bottom 5)
    const lowest = [...empSalesList].sort((a, b) => a.pog - b.pog).slice(0, 5);

    return { highest, lowest };
  }, [
    teamMembers,
    pogDataOverviewFiltered,
    teamAreas,
    userData,
    filterBelowArea,
    filterBelowTeam,
  ]);

  // Filter active POG team members based on selected crop filter
  const activePogMembers = useMemo(() => {
    if (!filterBelowCrop || filterBelowCrop === "All") return teamMembers;

    const kiosksMapByCleanName: Record<string, any> = {};
    allKiosks.forEach((k) => {
      kiosksMapByCleanName[cleanForMatch(k.name)] = k;
    });
    const teamMembersMapByCleanName: Record<string, string> = {};
    teamMembers.forEach((m) => {
      teamMembersMapByCleanName[cleanForMatch(m)] = m;
    });
    const getTeamMemberMatch = (name: string): string | undefined => {
      const clean = cleanForMatch(name);
      if (teamMembersMapByCleanName[clean])
        return teamMembersMapByCleanName[clean];
      return teamMembers.find((m) => matchNames(m, name));
    };

    const matchedMembersWithCrop = new Set<string>();
    pogDataProcessed.forEach((item) => {
      const itemCrop = String(item.crops || "")
        .trim()
        .toLowerCase();
      if (checkCropMatch(itemCrop, filterBelowCrop)) {
        const matchedMember = getTeamMemberMatch(item.pic);
        if (matchedMember) {
          matchedMembersWithCrop.add(cleanForMatch(matchedMember));
        }
      }
    });

    const activeSet = new Set<string>();
    activeSet.add(cleanForMatch(userData?.name));

    teamMembers.forEach((m) => {
      const mClean = cleanForMatch(m);
      if (matchedMembersWithCrop.has(mClean)) {
        activeSet.add(mClean);
        let current = m;
        for (let i = 0; i < 15; i++) {
          const upRaw = getFromRecord<string>(teamUpLines, current);
          if (!upRaw) break;

          const up = getTeamMemberMatch(upRaw as string) || (upRaw as string);

          const upClean = cleanForMatch(up);
          if (activeSet.has(upClean)) {
            break;
          }
          activeSet.add(upClean);
          current = up;
        }
      }
    });

    return teamMembers.filter((m) => activeSet.has(cleanForMatch(m)));
  }, [
    teamMembers,
    filterBelowCrop,
    pogDataProcessed,
    kiosks,
    userData,
    teamUpLines,
  ]);

  const aggregatedPogData = useMemo(() => {
    const teamMembersCleanSet = new Set(
      activePogMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );
    

    const filteredData = pogDataProcessed.filter((item) => {
      const isTeamMember = isBusinessAnalyst || teamMembersCleanSet.has(cleanForMatch(item.pic));
      const isCropMatch = checkCropMatch(item.crops, filterBelowCrop);
      return isTeamMember && isCropMatch;
    });

    // Filter active POG team members based on selected crop filter
    const hasGroupInfo = employees.some((e) => {
      const g = String(
        e.group || e.Group || e["group"] || e["Group"] || "",
      ).trim();
      return g.length > 0;
    });

    if (pogGroupBy === "subordinate") {
      // Pre-compute uplines for activePogMembers to avoid O(M) recursive scans inside buildNode loops
      const pMembersUplines: Record<string, string | null> = {};
      const pDirectSubsMap: Record<string, string[]> = {};
      activePogMembers.forEach((m) => {
        pMembersUplines[m] = getUplineInTeam(m, activePogMembers, teamUpLines);
      });

      const rootMembers = activePogMembers.filter((m) => {
        return pMembersUplines[m] === null;
      });
      rootMembers.sort((a, b) =>
        compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
      );

      activePogMembers.forEach((m) => {
        const upl = pMembersUplines[m];
        if (upl !== null) {
          const uplClean = cleanForMatch(upl);
          if (!pDirectSubsMap[uplClean]) {
            pDirectSubsMap[uplClean] = [];
          }
          pDirectSubsMap[uplClean].push(m);
        }
      });

      Object.keys(pDirectSubsMap).forEach((key) => {
        pDirectSubsMap[key].sort((a, b) =>
          compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
        );
      });

      const buildNode = (name: string): any => {
        const nameClean = cleanForMatch(name);
        const directSubs = pDirectSubsMap[nameClean] || [];
        const myItems = filteredData.filter(
          (item) => cleanForMatch(item.pic) === nameClean,
        );
        const childrenNodes = directSubs.map((sub) => buildNode(sub));

        const ownPog = {
          lastQty: 0,
          currentQty: 0,
          pog: 0,
          sellIn: 0,
          sellOut: 0,
          totalInv: 0,
          idleStock: 0,
        };
        myItems.forEach((item) => {
          const isDistributor = cleanForMatch(item.category) === "distributor";
          ownPog.lastQty += Number(item.lastQty) || 0;
          ownPog.currentQty += Number(item.currentQty) || 0;
          if (isDistributor) ownPog.sellIn += Number(item.sellIn) || 0;
          ownPog.sellOut += Number(item.sellOut) || 0;
          ownPog.totalInv += Number(item.totalInv) || 0;
          ownPog.idleStock += Number(item.idleStock) || 0;
          ownPog.pog += Number(item.pog) || 0;
        });

        const transPog = { ...ownPog };
        childrenNodes.forEach((child) => {
          transPog.lastQty += child.lastQty || 0;
          transPog.currentQty += child.currentQty || 0;
          transPog.sellIn += child.sellIn || 0;
          transPog.sellOut += child.sellOut || 0;
          transPog.totalInv += child.totalInv || 0;
          transPog.pog += child.pog || 0;
          transPog.idleStock += child.idleStock || 0;
        });

        let finalChildren = [];

        if (pogSubGroupBy === "subordinate") {
          finalChildren = [...childrenNodes];
        } else {
          const leafGroups: Record<string, any> = {};

          // Accumulate own items
          myItems.forEach((item) => {
            const isDistributor = cleanForMatch(item.category) === "distributor";
            let leafKey = "Unknown";
            if (pogSubGroupBy === "channel" || pogSubGroupBy === "kiosk")
              leafKey = item.kiosk || "Unknown Channel";
            else if (pogSubGroupBy === "hybrid")
              leafKey = item.hybrid || "Unknown";
            else if (pogSubGroupBy === "area") leafKey = item.area || "Unknown";
            else if (pogSubGroupBy === "category")
              leafKey = item.category || "Unknown";
            else if (pogSubGroupBy === "crops")
              leafKey = item.crops || "Unknown";

            if (!leafGroups[leafKey]) {
              leafGroups[leafKey] = {
                lastQty: 0,
                currentQty: 0,
                pog: 0,
                sellIn: 0,
                sellOut: 0,
                totalInv: 0,
                idleStock: 0,
                category: item.category,
                pic: item.pic,
              };
            }
            leafGroups[leafKey].lastQty += Number(item.lastQty) || 0;
            leafGroups[leafKey].currentQty += Number(item.currentQty) || 0;
            leafGroups[leafKey].sellIn += Number(item.sellIn) || 0;
            leafGroups[leafKey].sellOut += Number(item.sellOut) || 0;
            leafGroups[leafKey].totalInv += Number(item.totalInv) || 0;
            leafGroups[leafKey].pog += Number(item.pog) || 0;
            leafGroups[leafKey].idleStock += Number(item.idleStock) || 0;
          });

          // Roll up children's leaves
          childrenNodes.forEach((child) => {
            (child.children || []).forEach((cNode: any) => {
              const leafKey = cNode.name;
              if (!leafGroups[leafKey]) {
                leafGroups[leafKey] = {
                  lastQty: 0,
                  currentQty: 0,
                  pog: 0,
                  sellIn: 0,
                  sellOut: 0,
                  totalInv: 0,
                  idleStock: 0,
                  category: cNode.category,
                  pic: cNode.pic,
                };
              }
              leafGroups[leafKey].lastQty += Number(cNode.lastQty) || 0;
              leafGroups[leafKey].currentQty += Number(cNode.currentQty) || 0;
              leafGroups[leafKey].sellIn += Number(cNode.sellIn) || 0;
              leafGroups[leafKey].sellOut += Number(cNode.sellOut) || 0;
              leafGroups[leafKey].totalInv += Number(cNode.totalInv) || 0;
              leafGroups[leafKey].pog += Number(cNode.pog) || 0;
              leafGroups[leafKey].idleStock += Number(cNode.idleStock) || 0;
            });
          });

          let leaves = Object.entries(leafGroups).map(([leafName, val]) => ({
            name: leafName,
            isLeaf: true,
            ...(val as any),
          }));

          if (pogSubGroupBy === "channel" || pogSubGroupBy === "kiosk") {
            const catOrder: Record<string, number> = {
              Distributor: 1,
              R1: 2,
              R2: 3,
            };
            leaves.sort((a, b) => {
              const wA = catOrder[a.category] || 99;
              const wB = catOrder[b.category] || 99;
              if (wA !== wB) return wA - wB;
              return b.pog - a.pog;
            });
          } else {
            leaves.sort((a, b) => b.pog - a.pog);
          }

          finalChildren = leaves;
        }

        return {
          name,
          level: getMemberLevel(name, teamLevels, teamPositions, userData),
          children: finalChildren,
          isExpandable: finalChildren.length > 0,
          teamChildren: childrenNodes,
          ...transPog,
        };
      };

      const roots = rootMembers.map((root) => buildNode(root));
      roots.sort((a, b) => b.pog - a.pog);
      return roots.flatMap((node) => {
        if (cleanForMatch(node.name) === cleanForMatch(userData?.name)) {
          if (userLevel <= 3) {
            const nameClean = cleanForMatch(node.name);
            const myItems = filteredData.filter(
              (item) => cleanForMatch(item.pic) === nameClean,
            );

            const ownPog = {
              lastQty: 0,
              currentQty: 0,
              pog: 0,
              sellIn: 0,
              sellOut: 0,
              totalInv: 0,
              idleStock: 0,
            };
            myItems.forEach((item) => {
              const isDistributor = cleanForMatch(item.category) === "distributor";
              ownPog.lastQty += Number(item.lastQty) || 0;
              ownPog.currentQty += Number(item.currentQty) || 0;
              if (isDistributor) ownPog.sellIn += Number(item.sellIn) || 0;
              ownPog.sellOut += Number(item.sellOut) || 0;
              ownPog.totalInv += Number(item.totalInv) || 0;
              ownPog.idleStock += Number(item.idleStock) || 0;
              ownPog.pog += Number(item.pog) || 0;
            });

            let finalChildrenOfSelf = [];
            if (pogSubGroupBy !== "subordinate") {
              const leafGroups: Record<string, any> = {};
              myItems.forEach((item) => {
                const isDistributor = cleanForMatch(item.category) === "distributor";
                let leafKey = "Unknown";
                if (pogSubGroupBy === "channel" || pogSubGroupBy === "kiosk")
                  leafKey = item.kiosk || "Unknown Channel";
                else if (pogSubGroupBy === "hybrid")
                  leafKey = item.hybrid || "Unknown";
                else if (pogSubGroupBy === "area")
                  leafKey = item.area || "Unknown";
                else if (pogSubGroupBy === "category")
                  leafKey = item.category || "Unknown";
                else if (pogSubGroupBy === "crops")
                  leafKey = item.crops || "Unknown";

                if (!leafGroups[leafKey]) {
                  leafGroups[leafKey] = {
                    lastQty: 0,
                    currentQty: 0,
                    pog: 0,
                    sellIn: 0,
                    sellOut: 0,
                    totalInv: 0,
                    idleStock: 0,
                    category: item.category,
                  };
                }
                leafGroups[leafKey].lastQty += Number(item.lastQty) || 0;
                leafGroups[leafKey].currentQty += Number(item.currentQty) || 0;
                leafGroups[leafKey].sellIn += Number(item.sellIn) || 0;
                leafGroups[leafKey].sellOut += Number(item.sellOut) || 0;
                leafGroups[leafKey].totalInv += Number(item.totalInv) || 0;
                leafGroups[leafKey].pog += Number(item.pog) || 0;
                leafGroups[leafKey].idleStock += Number(item.idleStock) || 0;
              });

              let leaves = Object.entries(leafGroups).map(
                ([leafName, val]) => ({
                  name: leafName,
                  isLeaf: true,
                  ...(val as any),
                }),
              );

              if (pogSubGroupBy === "channel" || pogSubGroupBy === "kiosk") {
                const catOrder: Record<string, number> = {
                  Distributor: 1,
                  R1: 2,
                  R2: 3,
                };
                leaves.sort((a, b) => {
                  const wA = catOrder[a.category] || 99;
                  const wB = catOrder[b.category] || 99;
                  if (wA !== wB) return wA - wB;
                  return b.pog - a.pog;
                });
              } else {
                leaves.sort((a, b) => b.pog - a.pog);
              }
              finalChildrenOfSelf = leaves;
            }

            const selfNode = {
              name: node.name,
              level: node.level,
              children: finalChildrenOfSelf,
              isExpandable: finalChildrenOfSelf.length > 0,
              teamChildren: [],
              ...ownPog,
            };

            return [selfNode, ...(node.teamChildren || [])];
          } else {
            return node.teamChildren || [];
          }
        }
        return [node];
      });
    }

    const groups: Record<string, any> = {};
    filteredData.forEach((item) => {
      let key = item.hybrid || "Unknown";
      if (pogGroupBy === "area") key = item.area || "Unknown";
      else if (pogGroupBy === "category") key = item.category || "Unknown";
      else if (pogGroupBy === "crops") key = item.crops || "Unknown";
      else if (pogGroupBy === "area_crops") key = `${item.area || "Unknown"} - ${item.crops || "Unknown"}`;

      if (!groups[key]) {
        groups[key] = {
          name: key,
          lastQty: 0,
          currentQty: 0,
          pog: 0,
          sellIn: 0,
          sellOut: 0,
          totalInv: 0,
          idleStock: 0,
          childrenMap: {},
        };
        if (pogSubGroupBy === "subordinate") {
          activePogMembers.forEach((m) => {
            groups[key].childrenMap[m] = {
              name: m,
              lastQty: 0,
              currentQty: 0,
              pog: 0,
              sellIn: 0,
              sellOut: 0,
              totalInv: 0,
              idleStock: 0,
            };
          });
        }
      }
      const isDistributor = cleanForMatch(item.category) === "distributor";
      groups[key].lastQty += item.lastQty;
      groups[key].currentQty += item.currentQty;
      if (isDistributor) groups[key].sellIn += item.sellIn || 0;
      groups[key].sellOut += item.sellOut || 0;
      groups[key].totalInv += item.totalInv || 0;
      groups[key].idleStock += item.idleStock || 0;
      groups[key].pog += item.pog || 0;

      // Drill down
      let subKey = "Unknown";
      if (pogSubGroupBy === "channel") subKey = item.kiosk || "Unknown Channel";
      else if (pogSubGroupBy === "hybrid") subKey = item.hybrid || "Unknown";
      else if (pogSubGroupBy === "subordinate") {
        const matched = activePogMembers.find(
          (m) => cleanForMatch(m) === cleanForMatch(item.pic),
        );
        subKey = matched || item.pic || "Unknown";
      } else if (pogSubGroupBy === "area") subKey = item.area || "Unknown";
      else if (pogSubGroupBy === "category")
        subKey = item.category || "Unknown";
      else if (pogSubGroupBy === "crops") subKey = item.crops || "Unknown";
      else if (pogSubGroupBy === "area_crops") subKey = `${item.area || "Unknown"} - ${item.crops || "Unknown"}`;

      if (!groups[key].childrenMap[subKey]) {
        groups[key].childrenMap[subKey] = {
          name: subKey,
          lastQty: 0,
          currentQty: 0,
          pog: 0,
          sellIn: 0,
          sellOut: 0,
          totalInv: 0,
          idleStock: 0,
        };
        if (pogSubGroupBy === "channel") {
          groups[key].childrenMap[subKey].category = item.category;
          groups[key].childrenMap[subKey].pic = item.pic;
        }
      }
      groups[key].childrenMap[subKey].lastQty += item.lastQty;
      groups[key].childrenMap[subKey].currentQty += item.currentQty;
      groups[key].childrenMap[subKey].sellIn += item.sellIn || 0;
      groups[key].childrenMap[subKey].sellOut += item.sellOut || 0;
      groups[key].childrenMap[subKey].totalInv += item.totalInv || 0;
      groups[key].childrenMap[subKey].pog += item.pog;
      groups[key].childrenMap[subKey].idleStock += item.idleStock || 0;
    });

    const subMembersUplines: Record<string, string | null> = {};
    const subDirectSubsMap: Record<string, string[]> = {};
    let subRootMembers: string[] = [];
    if (pogSubGroupBy === "subordinate") {
      activePogMembers.forEach((m) => {
        subMembersUplines[m] = getUplineInTeam(
          m,
          activePogMembers,
          teamUpLines,
        );
      });
      subRootMembers = activePogMembers.filter(
        (m) => subMembersUplines[m] === null,
      );
      subRootMembers.sort((a, b) =>
        compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
      );

      activePogMembers.forEach((m) => {
        const upl = subMembersUplines[m];
        if (upl !== null) {
          const uplClean = cleanForMatch(upl);
          if (!subDirectSubsMap[uplClean]) {
            subDirectSubsMap[uplClean] = [];
          }
          subDirectSubsMap[uplClean].push(m);
        }
      });

      Object.keys(subDirectSubsMap).forEach((key) => {
        subDirectSubsMap[key].sort((a, b) =>
          compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
        );
      });
    }

    return Object.values(groups)
      .map((g: any) => {
        let children = [];

        if (pogSubGroupBy === "subordinate") {
          const buildTeamPogNode = (mName: string): any => {
            const mNameClean = cleanForMatch(mName);
            const directSubs = subDirectSubsMap[mNameClean] || [];

            const directKData = g.childrenMap[mName] || {
              name: mName,
              lastQty: 0,
              currentQty: 0,
              pog: 0,
              sellIn: 0,
              sellOut: 0,
              totalInv: 0,
              idleStock: 0,
            };
            const childrenNodes = directSubs
              .map((sub) => buildTeamPogNode(sub))
              .filter(Boolean);

            const transData = { ...directKData };
            childrenNodes.forEach((child) => {
              transData.lastQty += child.lastQty || 0;
              transData.currentQty += child.currentQty || 0;
              transData.sellIn += child.sellIn || 0;
              transData.sellOut += child.sellOut || 0;
              transData.totalInv += child.totalInv || 0;
              transData.pog += child.pog || 0;
              transData.idleStock += child.idleStock || 0;
            });

            const hasSelfActivity =
              directKData.lastQty > 0 ||
              directKData.currentQty > 0 ||
              directKData.sellIn > 0 ||
              directKData.sellOut > 0 ||
              directKData.totalInv > 0 ||
              directKData.pog !== 0;
            const hasChildrenActivity = childrenNodes.length > 0;

            if (
              pogGroupBy !== "subordinate" &&
              !hasSelfActivity &&
              !hasChildrenActivity
            ) {
              return null;
            }

            return {
              name: mName,
              level: getMemberLevel(mName, teamLevels, teamPositions, userData),
              children: childrenNodes,
              isExpandable: childrenNodes.length > 0,
              teamChildren: childrenNodes,
              ...transData,
            };
          };

          children = subRootMembers
            .map((m) => buildTeamPogNode(m))
            .filter(Boolean)
            .flatMap((node) => {
              if (cleanForMatch(node.name) === cleanForMatch(userData?.name)) {
                if (userLevel <= 3) {
                  const directKData = g.childrenMap[node.name] || {
                    lastQty: 0,
                    currentQty: 0,
                    pog: 0,
                    sellIn: 0,
                    sellOut: 0,
                    totalInv: 0,
                    idleStock: 0,
                  };
                  const selfNode = {
                    name: node.name,
                    level: node.level,
                    children: [],
                    isExpandable: false,
                    teamChildren: [],
                    ...directKData,
                  };
                  return [selfNode, ...(node.teamChildren || [])];
                } else {
                  return node.teamChildren || [];
                }
              }
              return [node];
            });

          const hasGroupActivity =
            g.lastQty > 0 ||
            g.currentQty > 0 ||
            g.sellIn > 0 ||
            g.sellOut > 0 ||
            g.totalInv > 0 ||
            g.pog !== 0;
          if (children.length === 0 && !hasGroupActivity) {
            return null;
          }
        } else {
          children = Object.values(g.childrenMap);

          if (pogSubGroupBy === "channel") {
            const catOrder: Record<string, number> = {
              Distributor: 1,
              R1: 2,
              R2: 3,
            };
            children.sort((a: any, b: any) => {
              const wA = catOrder[a.category] || 99;
              const wB = catOrder[b.category] || 99;
              if (wA !== wB) return wA - wB;
              return b.pog - a.pog;
            });
          } else {
            children.sort((a: any, b: any) => b.pog - a.pog);
          }
        }

        return {
          name: g.name,
          lastQty: g.lastQty,
          currentQty: g.currentQty,
          sellIn: g.sellIn,
          sellOut: g.sellOut,
          totalInv: g.totalInv,
          idleStock: g.idleStock,
          pog: g.pog,
          isExpandable: true,
          children,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.pog - a.pog);
  }, [
    pogDataProcessed,
    pogGroupBy,
    pogSubGroupBy,
    filterBelowCrop,
    activePogMembers,
    kiosks,
    userData,
    teamSubordinates,
    teamPositions,
    teamUpLines,
    teamLevels,
    teamAreas,
    employees,
    isBusinessAnalyst,
  ]);

  // Ekstrak data list crops unik untuk filter
  const availableCrops = useMemo(() => {
    const cropSet = new Set<string>();
    pogDataProcessed.forEach((item) => {
      const crop = String(item.crops || "").trim();
      if (crop) {
        cropSet.add(crop);
      }
    });
    return ["All", ...Array.from(cropSet).sort()];
  }, [pogDataProcessed]);

  // Filter team members based on selected crop filter
  const activeTeamMembers = useMemo(() => {
    if (!filterBelowCrop || filterBelowCrop === "All") return teamMembers;

    // Fallback mode: if group column info is empty or not in Google Sheet yet,
    // filter members by their matching recorded crop in workingData so they always see correct data.
    // A member is kept if they (or any of their subordinates recursively) have working data with the selected crop.
    const kiosksMapByCleanName: Record<string, any> = {};
    allKiosks.forEach((k) => {
      kiosksMapByCleanName[cleanForMatch(k.name)] = k;
    });
    const teamMembersMapByCleanName: Record<string, string> = {};
    teamMembers.forEach((m) => {
      teamMembersMapByCleanName[cleanForMatch(m)] = m;
    });
    const getTeamMemberMatch = (name: string): string | undefined => {
      const clean = cleanForMatch(name);
      if (teamMembersMapByCleanName[clean])
        return teamMembersMapByCleanName[clean];
      return teamMembers.find((m) => matchNames(m, name));
    };

    const matchedMembersWithCrop = new Set<string>();
    workingData.forEach((item) => {
      const itemCrop = String(item.crops || "")
        .trim()
        .toLowerCase();
      if (checkCropMatch(itemCrop, filterBelowCrop)) {
        const kClean = cleanForMatch(item.kiosk);
        const kioskInfo = kiosksMapByCleanName[kClean] || {};
        const rawPic = normalizeName(
          getResolvedPic(item.kiosk, kioskInfo.pic, item.user, item.lot, item.pic),
        );
        const picName = getDdaOfUser(
          rawPic,
          userData?.name,
          computedTeamProfiles,
        );
        const matchedMember = getTeamMemberMatch(picName);
        if (matchedMember) {
          matchedMembersWithCrop.add(cleanForMatch(matchedMember));
        }
      }
    });

    // Propagate active status upwards
    const activeSet = new Set<string>();
    activeSet.add(cleanForMatch(userData?.name)); // Always keep self

    teamMembers.forEach((m) => {
      const mClean = cleanForMatch(m);
      if (matchedMembersWithCrop.has(mClean)) {
        activeSet.add(mClean);
        let current = m;
        for (let i = 0; i < 15; i++) {
          // Max depth protection
          const upRaw = getFromRecord<string>(teamUpLines, current);
          if (!upRaw) break;

          // Match against actual teamMembers to handle partial names
          const up = getTeamMemberMatch(upRaw as string) || (upRaw as string);

          const upClean = cleanForMatch(up);
          if (activeSet.has(upClean)) {
            // Already processed this branch upwards, can break early
            break;
          }
          activeSet.add(upClean);
          current = up;
        }
      }
    });

    return teamMembers.filter((m) => activeSet.has(cleanForMatch(m)));
  }, [
    teamMembers,
    filterBelowCrop,
    employees,
    userData,
    workingData,
    kiosks,
    teamUpLines,
  ]);

  const dynamicWorkingData = useMemo(() => {
    const monthsKeys = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mei",
      "jun",
      "jul",
      "ags",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    let targetMonthIdx = new Date().getMonth();
    let targetYear = new Date().getFullYear();

    if (filterBelowMonth && filterBelowMonth !== "All") {
      const parts = filterBelowMonth.split(" ");
      const mIdx = INDO_MONTHS.indexOf(parts[0]);
      if (mIdx !== -1) {
        targetMonthIdx = mIdx;
        targetYear = parseInt(parts[1], 10);
      }
    }

    const currentMonthKey = monthsKeys[targetMonthIdx];
    const prevMonthIdx = targetMonthIdx === 0 ? 11 : targetMonthIdx - 1;
    const prevMonthKey = monthsKeys[prevMonthIdx];

    return workingData.map((d: any, index: number) => {
      const isUpdated = d["upd_" + currentMonthKey] && d["upd_" + currentMonthKey] !== "";

      const currVal = isUpdated
        ? safeParseFloat(d[currentMonthKey])
        : safeParseFloat(d.originalStock !== undefined ? d.originalStock : d.stock);

      const prevVal = d[prevMonthKey] !== undefined ? safeParseFloat(d[prevMonthKey]) : 0;

      let finalCondition = d.condition || "tetap";
      if (prevVal > 0) {
        if (currVal > prevVal) finalCondition = "bertambah";
        else if (currVal < prevVal) finalCondition = "berkurang";
        else finalCondition = "tetap";
      } else {
        if (currVal > 0) {
          finalCondition =
            d.condition === "new" || d.condition === "baru" || d.isNew
              ? "new"
              : "bertambah";
        } else {
          finalCondition = "tetap";
        }
      }

      return {
        ...d,
        stock: currVal,
        condition: finalCondition,
      };
    });
  }, [workingData, filterBelowMonth]);

  const summaryData = useMemo(() => {
    const picToUplineMap: Record<string, string> = {};
    allKiosks.forEach((k) => {
      const p = String(k.pic || "").trim();
      const u = String(k.upline || "").trim();
      if (p && u) {
        picToUplineMap[p.toLowerCase()] = normalizeName(u);
      }
    });
    picToUplineMap["listianto"] = "AGUS HERDIANTO";

    // Pre-compute maps to optimize from O(N * M) to O(N + M)
    const kiosksMapByCleanName: Record<string, any> = {};
    allKiosks.forEach((k) => {
      kiosksMapByCleanName[cleanForMatch(k.name)] = k;
    });

    const teamMembersMapByCleanName: Record<string, string> = {};
    activeTeamMembers.forEach((m) => {
      teamMembersMapByCleanName[cleanForMatch(m)] = m;
    });
    const getTeamMemberMatch = (name: string): string | undefined => {
      const clean = cleanForMatch(name);
      if (teamMembersMapByCleanName[clean])
        return teamMembersMapByCleanName[clean];
      return activeTeamMembers.find((m) => matchNames(m, name));
    };

    const parseDate = (timestamp: any) => {
      if (!timestamp) return null;
      let d;
      if (typeof timestamp === "string" && timestamp.includes("/")) {
        const parts = timestamp.split(/[\s/:]+/);
        if (parts.length >= 3) {
          d = new Date(
            `${parts[2]}-${parts[1]}-${parts[0]}T${parts[3] || "00"}:${parts[4] || "00"}:${parts[5] || "00"}`,
          );
        } else d = new Date(timestamp);
      } else {
        d = new Date(timestamp);
      }
      return d && !isNaN(d.getTime()) ? d : null;
    };

    const enrichedData = dynamicWorkingData.map((item) => {
      const d = parseDate(item.timestamp);
      const itemMonth = d ? d.getMonth() : null;
      const itemYear = d ? d.getFullYear() : null;

      const kClean = cleanForMatch(item.kiosk);
      const kioskInfo =
        kiosksMapByCleanName[kClean] ||
        kiosks.find((k) => matchNames(k.name, item.kiosk)) ||
        {};
      const rawPic = normalizeName(
        getResolvedPic(item.kiosk, kioskInfo.pic, item.user, item.lot, item.pic),
      );
      const pic = getDdaOfUser(rawPic, userData?.name, computedTeamProfiles);
      let upline = normalizeName(String(kioskInfo.upline || ""));
      if (pic.toLowerCase() === "listianto") {
        upline = "AGUS HERDIANTO";
      } else {
        const matchedMember = getTeamMemberMatch(pic);
        const foundUp = getFromRecord<string>(
          teamUpLines,
          matchedMember || pic,
        );
        if (foundUp) {
          upline = normalizeName(foundUp);
        } else if (!upline && pic !== "Unknown") {
          const foundUpline = picToUplineMap[pic.toLowerCase()];
          if (foundUpline) upline = normalizeName(foundUpline);
        }
      }
      let area = "-";
      if (item.area && String(item.area).trim() !== "") {
        area = String(item.area).trim();
      } else {
        const cleanPic = cleanForMatch(pic);
        const matchedMember = getTeamMemberMatch(pic);
        const foundArea = getFromRecord<string>(teamAreas, matchedMember || pic);
        if (foundArea) {
          area = foundArea;
        } else if (cleanPic === cleanForMatch(userData?.name)) {
          area = userData?.area || "-";
        }
      }

      const category = getValidCategory(
        item.category,
        kioskInfo.category,
        item.kiosk,
        workingCategoryMap,
      );

      let cluster = "Uncategorized";
      const aging = Number(item.aging);
      if (!isNaN(aging)) {
        if (aging <= 2) cluster = "0-2";
        else if (aging <= 4) cluster = "2-4";
        else if (aging <= 6) cluster = "4-6";
        else if (aging <= 9) cluster = "6-9";
        else if (aging <= 12) cluster = "9-12";
        else cluster = ">12";
      }
      const crops =
        item.crops && String(item.crops).trim() !== ""
          ? item.crops
          : "Uncategorized Crops";
      return {
        ...item,
        pic,
        upline,
        area,
        rawArea: item.area || "-",
        category,
        cluster,
        hybrid: item.hybrid || "Unknown",
        crops,
        itemMonth,
        itemYear,
      };
    });

    enrichedSummaryDataRef.current = enrichedData;

    const teamMembersCleanSet = new Set(
      activeTeamMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );
    

    // Filter Team AND Filter Crops (Using Set.has for O(1) performance)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

        const teamData = enrichedData.filter((item) => {
      if (isBusinessAnalyst) {
        return checkCropMatch(item.crops, filterBelowCrop);
      }
      const picClean = cleanForMatch(item.pic);
      let isTeamMember =
        teamMembersCleanSet.has(picClean);
        
      if (!isTeamMember && computedTeamProfiles) {
        const emp = computedTeamProfiles[picClean];
        if (emp && emp.name) {
          const empNameClean = cleanForMatch(emp.name);
          if (teamMembersCleanSet.has(empNameClean)) {
            isTeamMember = true;
          }
        }
      }

      const isCropMatch = checkCropMatch(item.crops, filterBelowCrop);
      return isTeamMember && isCropMatch;
    });

    if (summaryGroupBy === "subordinate") {
      const teamMembersUplines: Record<string, string | null> = {};
      const directSubsMap: Record<string, string[]> = {};
      activeTeamMembers.forEach((m) => {
        teamMembersUplines[m] = getUplineInTeam(
          m,
          activeTeamMembers,
          teamUpLines,
        );
      });

      const rootMembers = activeTeamMembers.filter((m) => {
        return teamMembersUplines[m] === null;
      });
      rootMembers.sort((a, b) =>
        compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
      );

      activeTeamMembers.forEach((m) => {
        const upl = teamMembersUplines[m];
        if (upl !== null) {
          const uplClean = cleanForMatch(upl);
          if (!directSubsMap[uplClean]) {
            directSubsMap[uplClean] = [];
          }
          directSubsMap[uplClean].push(m);
        }
      });

      Object.keys(directSubsMap).forEach((key) => {
        directSubsMap[key].sort((a, b) =>
          compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
        );
      });

      const buildNode = (name: string): any => {
        const nameClean = cleanForMatch(name);
        const directSubs = directSubsMap[nameClean] || [];
        const myItems = teamData.filter(
          (item) => cleanForMatch(item.pic) === nameClean,
        );
        const childrenNodes = directSubs.map((sub) => buildNode(sub));

        const ownData = {
          "0-2": 0,
          "2-4": 0,
          "4-6": 0,
          "6-9": 0,
          "9-12": 0,
          ">12": 0,
          Uncategorized: 0,
          total: 0,
        };
        myItems.forEach((item) => {
          const stock = Number(item.stock) || 0;
          if (ownData[item.cluster] !== undefined)
            ownData[item.cluster] += stock;
          ownData.total += stock;
        });

        const transData = { ...ownData };
        childrenNodes.forEach((child) => {
          Object.keys(ownData).forEach((key) => {
            if (key !== "total") {
              transData[key] += child[key] || 0;
            }
          });
          transData.total += child.total || 0;
        });

        let finalChildren = [];

        if (summarySubGroupBy === "subordinate") {
          finalChildren = [...childrenNodes];
        } else {
          const leafGroups: Record<string, any> = {};

          // Own items
          myItems.forEach((item) => {
            let leafKey = "Unknown";
            if (
              summarySubGroupBy === "channel" ||
              summarySubGroupBy === "kiosk"
            )
              leafKey = item.kiosk || "Unknown Channel";
            else if (summarySubGroupBy === "hybrid") leafKey = item.hybrid;
            else if (summarySubGroupBy === "area") leafKey = item.area;
            else if (summarySubGroupBy === "category") leafKey = item.category;
            else if (summarySubGroupBy === "crops") leafKey = item.crops;

            if (!leafGroups[leafKey]) {
              leafGroups[leafKey] = {
                "0-2": 0,
                "2-4": 0,
                "4-6": 0,
                "6-9": 0,
                "9-12": 0,
                ">12": 0,
                Uncategorized: 0,
                total: 0,
                category: item.category,
              };
            }
            const stock = Number(item.stock) || 0;
            if (leafGroups[leafKey][item.cluster] !== undefined) {
              leafGroups[leafKey][item.cluster] += stock;
            }
            leafGroups[leafKey].total += stock;
          });

          // Roll up children's leaves
          childrenNodes.forEach((child) => {
            (child.children || []).forEach((cNode: any) => {
              const leafKey = cNode.name;
              if (!leafGroups[leafKey]) {
                leafGroups[leafKey] = {
                  "0-2": 0,
                  "2-4": 0,
                  "4-6": 0,
                  "6-9": 0,
                  "9-12": 0,
                  ">12": 0,
                  Uncategorized: 0,
                  total: 0,
                  category: cNode.category,
                };
              }
              Object.keys(cNode).forEach((k) => {
                if (
                  k !== "name" &&
                  k !== "isLeaf" &&
                  k !== "category" &&
                  k !== "total" &&
                  k !== "isExpandable" &&
                  k !== "children" &&
                  k !== "level" &&
                  k !== "selectedTotal"
                ) {
                  leafGroups[leafKey][k] =
                    (leafGroups[leafKey][k] || 0) + (cNode[k] || 0);
                }
              });
              leafGroups[leafKey].total += cNode.total || 0;
            });
          });

          let leaves = Object.entries(leafGroups).map(([leafName, val]) => ({
            name: leafName,
            isLeaf: true,
            ...(val as any),
          }));

          if (
            summarySubGroupBy === "channel" ||
            summarySubGroupBy === "kiosk"
          ) {
            const catOrder: Record<string, number> = {
              Distributor: 1,
              R1: 2,
              R2: 3,
            };
            leaves.sort((a, b) => {
              const wA = catOrder[a.category] || 99;
              const wB = catOrder[b.category] || 99;
              if (wA !== wB) return wA - wB;
              return b.total - a.total;
            });
          } else {
            leaves.sort((a, b) => b.total - a.total);
          }

          finalChildren = leaves;
        }

        return {
          name,
          level: getMemberLevel(name, teamLevels, teamPositions, userData),
          children: finalChildren,
          isExpandable: finalChildren.length > 0,
          teamChildren: childrenNodes,
          ...transData,
        };
      };

      const roots = rootMembers.map((root) => buildNode(root));
      roots.sort((a, b) => b.total - a.total);
      return roots.flatMap((node) => {
        if (cleanForMatch(node.name) === cleanForMatch(userData?.name)) {
          if (userLevel <= 3) {
            const nameClean = cleanForMatch(node.name);
            const myItems = teamData.filter(
              (item) => cleanForMatch(item.pic) === nameClean,
            );

            const ownData = {
              "0-2": 0,
              "2-4": 0,
              "4-6": 0,
              "6-9": 0,
              "9-12": 0,
              ">12": 0,
              Uncategorized: 0,
              total: 0,
            };
            myItems.forEach((item) => {
              const stock = Number(item.stock) || 0;
              if (ownData[item.cluster] !== undefined)
                ownData[item.cluster] += stock;
              ownData.total += stock;
            });

            let finalChildrenOfSelf = [];
            if (summarySubGroupBy !== "subordinate") {
              const leafGroups: Record<string, any> = {};
              myItems.forEach((item) => {
                let leafKey = "Unknown";
                if (
                  summarySubGroupBy === "channel" ||
                  summarySubGroupBy === "kiosk"
                )
                  leafKey = item.kiosk || "Unknown Channel";
                else if (summarySubGroupBy === "hybrid") leafKey = item.hybrid;
                else if (summarySubGroupBy === "area") leafKey = item.area;
                else if (summarySubGroupBy === "category")
                  leafKey = item.category;
                else if (summarySubGroupBy === "crops") leafKey = item.crops;

                if (!leafGroups[leafKey]) {
                  leafGroups[leafKey] = {
                    "0-2": 0,
                    "2-4": 0,
                    "4-6": 0,
                    "6-9": 0,
                    "9-12": 0,
                    ">12": 0,
                    Uncategorized: 0,
                    total: 0,
                    category: item.category,
                  };
                }
                const stock = Number(item.stock) || 0;
                if (leafGroups[leafKey][item.cluster] !== undefined) {
                  leafGroups[leafKey][item.cluster] += stock;
                }
                leafGroups[leafKey].total += stock;
              });

              let leaves = Object.entries(leafGroups).map(
                ([leafName, val]) => ({
                  name: leafName,
                  isLeaf: true,
                  ...(val as any),
                }),
              );

              if (
                summarySubGroupBy === "channel" ||
                summarySubGroupBy === "kiosk"
              ) {
                const catOrder: Record<string, number> = {
                  Distributor: 1,
                  R1: 2,
                  R2: 3,
                };
                leaves.sort((a, b) => {
                  const wA = catOrder[a.category] || 99;
                  const wB = catOrder[b.category] || 99;
                  if (wA !== wB) return wA - wB;
                  return b.total - a.total;
                });
              } else {
                leaves.sort((a, b) => b.total - a.total);
              }
              finalChildrenOfSelf = leaves;
            }

            const selfNode = {
              name: node.name,
              level: node.level,
              children: finalChildrenOfSelf,
              isExpandable: finalChildrenOfSelf.length > 0,
              teamChildren: [],
              ...ownData,
            };

            return [selfNode, ...(node.teamChildren || [])];
          } else {
            return node.teamChildren || [];
          }
        }
        return [node];
      });
    }

    const groups: Record<string, any> = {};
    teamData.forEach((item) => {
      let key = "Unknown";
      if (summaryGroupBy === "hybrid") key = item.hybrid;
      else if (summaryGroupBy === "area") key = item.area;
      else if (summaryGroupBy === "category") key = item.category;
      else if (summaryGroupBy === "crops") key = item.crops;
      else if (summaryGroupBy === "area_crops") key = `${item.area || "Unknown"} - ${item.crops || "Unknown"}`;

      if (!groups[key]) {
        groups[key] = {
          "0-2": 0,
          "2-4": 0,
          "4-6": 0,
          "6-9": 0,
          "9-12": 0,
          ">12": 0,
          Uncategorized: 0,
          total: 0,
          childrenMap: {},
        };
        if (summarySubGroupBy === "subordinate") {
          activeTeamMembers.forEach((m) => {
            groups[key].childrenMap[m] = {
              "0-2": 0,
              "2-4": 0,
              "4-6": 0,
              "6-9": 0,
              "9-12": 0,
              ">12": 0,
              Uncategorized: 0,
              total: 0,
            };
          });
        }
      }
      const stock = Number(item.stock) || 0;
      if (groups[key][item.cluster] !== undefined) {
        groups[key][item.cluster] += stock;
      }
      groups[key].total += stock;

      // Sub-item
      let subKey = "Unknown";
      if (summarySubGroupBy === "channel")
        subKey = item.kiosk || "Unknown Channel";
      else if (summarySubGroupBy === "hybrid") subKey = item.hybrid;
      else if (summarySubGroupBy === "subordinate") {
        const matched = activeTeamMembers.find(
          (m) => cleanForMatch(m) === cleanForMatch(item.pic),
        );
        subKey = matched || item.pic;
      } else if (summarySubGroupBy === "area") subKey = item.area;
      else if (summarySubGroupBy === "category") subKey = item.category;
      else if (summarySubGroupBy === "crops") subKey = item.crops;
      else if (summarySubGroupBy === "area_crops") subKey = `${item.area || "Unknown"} - ${item.crops || "Unknown"}`;

      if (!groups[key].childrenMap[subKey]) {
        groups[key].childrenMap[subKey] = {
          "0-2": 0,
          "2-4": 0,
          "4-6": 0,
          "6-9": 0,
          "9-12": 0,
          ">12": 0,
          Uncategorized: 0,
          total: 0,
        };
        if (summarySubGroupBy === "channel") {
          groups[key].childrenMap[subKey].category = item.category;
          groups[key].childrenMap[subKey].pic = item.pic;
        }
      }
      if (groups[key].childrenMap[subKey][item.cluster] !== undefined) {
        groups[key].childrenMap[subKey][item.cluster] += stock;
      }
      groups[key].childrenMap[subKey].total += stock;
    });

    const sumMembersUplines: Record<string, string | null> = {};
    const sumDirectSubsMap: Record<string, string[]> = {};
    let sumRootMembers: string[] = [];
    if (summarySubGroupBy === "subordinate") {
      activeTeamMembers.forEach((m) => {
        sumMembersUplines[m] = getUplineInTeam(
          m,
          activeTeamMembers,
          teamUpLines,
        );
      });
      sumRootMembers = activeTeamMembers.filter(
        (m) => sumMembersUplines[m] === null,
      );
      sumRootMembers.sort((a, b) =>
        compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
      );

      activeTeamMembers.forEach((m) => {
        const upl = sumMembersUplines[m];
        if (upl !== null) {
          const uplClean = cleanForMatch(upl);
          if (!sumDirectSubsMap[uplClean]) {
            sumDirectSubsMap[uplClean] = [];
          }
          sumDirectSubsMap[uplClean].push(m);
        }
      });

      Object.keys(sumDirectSubsMap).forEach((key) => {
        sumDirectSubsMap[key].sort((a, b) =>
          compareMembersByLevel(a, b, teamLevels, teamPositions, userData),
        );
      });
    }

    return Object.entries(groups)
      .map(([name, counts]) => {
        const countsVal = counts as any;
        let children = [];

        if (summarySubGroupBy === "subordinate") {
          const buildTeamNode = (mName: string): any => {
            const mNameClean = cleanForMatch(mName);
            const directSubs = sumDirectSubsMap[mNameClean] || [];

            const directKData = countsVal.childrenMap[mName] || {
              "0-2": 0,
              "2-4": 0,
              "4-6": 0,
              "6-9": 0,
              "9-12": 0,
              ">12": 0,
              Uncategorized: 0,
              total: 0,
            };
            const childrenNodes = directSubs.map((sub) => buildTeamNode(sub));

            const transData = { ...directKData };
            childrenNodes.forEach((child) => {
              Object.keys(directKData).forEach((k) => {
                if (k !== "total" && k !== "category") {
                  transData[k] = (transData[k] || 0) + (child[k] || 0);
                }
              });
              transData.total = (transData.total || 0) + (child.total || 0);
            });

            return {
              name: mName,
              level: getMemberLevel(mName, teamLevels, teamPositions, userData),
              children: childrenNodes,
              isExpandable: childrenNodes.length > 0,
              teamChildren: childrenNodes,
              ...transData,
            };
          };

          children = sumRootMembers
            .map((m) => buildTeamNode(m))
            .flatMap((node) => {
              if (cleanForMatch(node.name) === cleanForMatch(userData?.name)) {
                if (userLevel <= 3) {
                  const directKData = countsVal.childrenMap[node.name] || {
                    "0-2": 0,
                    "2-4": 0,
                    "4-6": 0,
                    "6-9": 0,
                    "9-12": 0,
                    ">12": 0,
                    Uncategorized: 0,
                    total: 0,
                  };
                  const selfNode = {
                    name: node.name,
                    level: node.level,
                    children: [],
                    isExpandable: false,
                    teamChildren: [],
                    ...directKData,
                  };
                  return [selfNode, ...(node.teamChildren || [])];
                } else {
                  return node.teamChildren || [];
                }
              }
              return [node];
            });
        } else {
          children = Object.entries(countsVal.childrenMap || {}).map(
            ([subKeyName, kData]) => ({
              name: subKeyName,
              ...(kData as any),
            }),
          );

          if (summarySubGroupBy === "channel") {
            const catOrder: Record<string, number> = {
              Distributor: 1,
              R1: 2,
              R2: 3,
            };
            children.sort((a, b) => {
              const wA = catOrder[a.category] || 99;
              const wB = catOrder[b.category] || 99;
              if (wA !== wB) return wA - wB;
              return b.total - a.total;
            });
          } else {
            children.sort((a, b) => b.total - a.total);
          }
        }

        const { childrenMap, ...rest } = countsVal;
        return { name, isExpandable: true, children, ...rest };
      })
      .sort((a, b) => b.total - a.total);
  }, [
    dynamicWorkingData,
    kiosks,
    activeTeamMembers,
    summaryGroupBy,
    summarySubGroupBy,
    userData,
    filterBelowCrop,
    teamSubordinates,
    teamAreas,
    teamUpLines,
    teamPositions,
    teamLevels,
    filterBelowMonth,
    isBusinessAnalyst,
  ]);

  const filteredSummaryData = useMemo(() => {
    if (selectedClusters.length === 0) return [];

    if (summaryGroupBy === "subordinate") {
      const filterNode = (node: any): any => {
        const parentSelectedTotal = selectedClusters.reduce(
          (sum, c) => sum + (node[c] || 0),
          0,
        );

        const filteredChildren = (node.children || [])
          .map((child: any) => {
            if (child.isLeaf) {
              const leafSelectedTotal = selectedClusters.reduce(
                (sum, c) => sum + (child[c] || 0),
                0,
              );
              return { ...child, selectedTotal: leafSelectedTotal };
            } else {
              return filterNode(child);
            }
          })
          .filter(Boolean);

        // ALWAYS return the teammate node (do not return null if 0 total) to support "tampilkan semua nama" from sheet employee
        return {
          ...node,
          selectedTotal: parentSelectedTotal,
          children: filteredChildren,
        };
      };

      // Do not filter(Boolean) here as we want to preserve all employee roots.
      return summaryData.map((row) => filterNode(row));
    }

    const filterSubordinateNode = (node: any): any => {
      const nodeSelectedTotal = selectedClusters.reduce(
        (sum, c) => sum + (node[c] || 0),
        0,
      );
      const filteredChildren = (node.children || [])
        .map((c: any) => filterSubordinateNode(c))
        .filter(Boolean);

      // Hanya tampilkan employee yang berkorelasi saja jika group by bukan 'subordinate' (team)
      // Karyawan dianggap berkorelasi jika memiliki stock > 0 atau salah satu bawahannya memiliki stock > 0
      if (
        summaryGroupBy !== "subordinate" &&
        nodeSelectedTotal === 0 &&
        filteredChildren.length === 0
      ) {
        return null;
      }

      return {
        ...node,
        selectedTotal: nodeSelectedTotal,
        children: filteredChildren,
      };
    };

    return summaryData
      .map((row) => {
        if (row.isExpandable) {
          if (summarySubGroupBy === "subordinate") {
            const filteredChildren = row.children
              .map((child) => filterSubordinateNode(child))
              .filter(Boolean);
            const parentSelectedTotal = selectedClusters.reduce(
              (sum, c) => sum + (row[c] || 0),
              0,
            );
            if (filteredChildren.length === 0 && parentSelectedTotal === 0)
              return null;
            return {
              ...row,
              children: filteredChildren,
              selectedTotal: parentSelectedTotal,
            };
          }

          const filteredChildren = row.children
            .map((child) => {
              const childSelectedTotal = selectedClusters.reduce(
                (sum, c) => sum + (child[c] || 0),
                0,
              );
              // If sub-group is Team/Subordinate or child is a leaf/hybrid item, show them even with 0 total
              if (
                summarySubGroupBy === "subordinate" ||
                childSelectedTotal > 0 ||
                child.isLeaf ||
                child.hybrid
              ) {
                return { ...child, selectedTotal: childSelectedTotal };
              }
              return null;
            })
            .filter(Boolean);

          const parentSelectedTotal = selectedClusters.reduce(
            (sum, c) => sum + (row[c] || 0),
            0,
          );
          // If sub-group is Team/Subordinate or has children, show parent group
          if (
            summarySubGroupBy === "subordinate" ||
            filteredChildren.length > 0 ||
            parentSelectedTotal > 0
          ) {
            return {
              ...row,
              children: filteredChildren,
              selectedTotal: parentSelectedTotal,
            };
          }
          return null;
        } else {
          const rowSelectedTotal = selectedClusters.reduce(
            (sum, c) => sum + (row[c] || 0),
            0,
          );
          return { ...row, selectedTotal: rowSelectedTotal };
          return null;
        }
      })
      .filter(Boolean);
  }, [summaryData, selectedClusters, summaryGroupBy, summarySubGroupBy]);

  const totalSummary = useMemo(() => {
    const totals = {
      "0-2": 0,
      "2-4": 0,
      "4-6": 0,
      "6-9": 0,
      "9-12": 0,
      ">12": 0,
      Uncategorized: 0,
      selectedTotal: 0,
    };
    summaryData.forEach((row) => {
      ALL_CLUSTER_KEYS.forEach((c) => {
        totals[c] += row[c] || 0;
      });
      totals.selectedTotal += selectedClusters.reduce(
        (sum, c) => sum + (row[c] || 0),
        0,
      );
    });
    return totals;
  }, [summaryData, selectedClusters, ALL_CLUSTER_KEYS]);

  const overviewUseMt = useMemo(() => {
    if (filterBelowCrop === "Vegetables") return false;
    const maxVal = Math.max(
      overviewStats.totalOpeningStock || 0,
      overviewStats.totalCurrentStock || 0,
      overviewStats.totalSellIn || 0,
      overviewStats.totalIdleStock || 0,
      overviewStats.totalSellOut || 0,
      totalSummary.selectedTotal || 0
    );
    return maxVal >= 1000;
  }, [overviewStats, totalSummary, filterBelowCrop]);

  const handleDownloadSummaryExcel = async () => {
    const XLSX = await import("xlsx");
    const teamMembersCleanSet = new Set(
      activeTeamMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter enriched data to match team members and active crop + month + chosen aging clusters
    const displayedRawItems = (enrichedSummaryDataRef.current || []).filter(
      (item) => {
        const isTeamMember = isBusinessAnalyst || teamMembersCleanSet.has(cleanForMatch(item.pic));
        const isCropMatch = checkCropMatch(item.crops, filterBelowCrop);
        const isClusterMatch = selectedClusters.includes(item.cluster);

        return isTeamMember && isCropMatch && isClusterMatch;
      },
    );

    if (displayedRawItems.length === 0) {
      alert("Tidak ada data untuk di-download.");
      return;
    }

    // Map each item exactly to match the custom requested headers in Indonesian and English
    const formattedRows = displayedRawItems.map((item) => {
      return {
        tgl: item.timestamp || "",
        province:
          item.province ||
          getFromRecord<string>(teamProvinces, item.pic) ||
          "-",
        crops: item.crops || "",
        checker: item.user || item.pic || "",
        channel: item.kiosk || "",
        category: item.category || "",
        hybrids: item.hybrid || "",
        "lot no": item.lot || "",
        qty: Number(item.stock) || 0,
        "usia stock": item.aging !== undefined ? String(item.aging) : "",
        "cluster aging": item.cluster || "",
        "shipping date":
          item.drDate ||
          item.shipping_date ||
          item.shippingDate ||
          item.dr_date ||
          "",
        "exp date": item.expired || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Working Data Sheet");

    // Pre-configure column widths for pristine visual alignments to match the new headers
    const colWidths = [
      { wch: 22 }, // tgl
      { wch: 18 }, // province
      { wch: 18 }, // crops
      { wch: 25 }, // checker
      { wch: 30 }, // channel
      { wch: 18 }, // category
      { wch: 28 }, // hybrids
      { wch: 18 }, // lot no
      { wch: 12 }, // qty
      { wch: 18 }, // usia stock
      { wch: 15 }, // cluster aging
      { wch: 20 }, // shipping date
      { wch: 22 }, // exp date
    ];
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(
      workbook,
      `Stock_RADAR_AWBA_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const totalPog = useMemo(() => {
    const teamMembersCleanSet = new Set(
      activePogMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );

    const filteredData = pogDataProcessed.filter((item) => {
      const isTeamMember = isBusinessAnalyst || teamMembersCleanSet.has(cleanForMatch(item.pic));
      const isCropMatch = checkCropMatch(item.crops, filterBelowCrop);
      return isTeamMember && isCropMatch;
    });

    const total = {
      lastQty: 0,
      currentQty: 0,
      sellIn: 0,
      sellOut: 0,
      totalInv: 0,
      pog: 0,
      idleStock: 0,
    };

    filteredData.forEach((item) => {
      const isDistributor = cleanForMatch(item.category) === "distributor";
      total.lastQty += Number(item.lastQty) || 0;
      total.currentQty += Number(item.currentQty) || 0;
      if (isDistributor) total.sellIn += Number(item.sellIn) || 0;
      total.sellOut += Number(item.sellOut) || 0;
      total.totalInv += Number(item.totalInv) || 0;
      total.idleStock += Number(item.idleStock) || 0;
    });
    total.pog = total.lastQty + total.sellIn - total.currentQty;
    
    return total;
  }, [pogDataProcessed, activePogMembers, filterBelowCrop, pogGroupBy, userLevel, isBusinessAnalyst]);

  const totalSummaryPog = useMemo(() => {
    const teamMembersCleanSet = new Set(
      activeTeamMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );
    

    const filteredData = pogDataProcessed.filter((item) => {
      const isTeamMember = isBusinessAnalyst || teamMembersCleanSet.has(cleanForMatch(item.pic));
      const isCropMatch = checkCropMatch(item.crops, filterBelowCrop);
      return isTeamMember && isCropMatch;
    });

    const total = {
      lastQty: 0,
      currentQty: 0,
      sellIn: 0,
      sellOut: 0,
      totalInv: 0,
      pog: 0,
      idleStock: 0,
    };
    filteredData.forEach((row) => {
      const isDistributor = cleanForMatch(row.category) === "distributor";
      total.lastQty += row.lastQty || 0;
      total.currentQty += row.currentQty || 0;
      if (isDistributor) total.sellIn += row.sellIn || 0;
      total.sellOut += row.sellOut || 0;
      total.totalInv += row.totalInv || 0;
      total.idleStock += row.idleStock || 0;
    });
    total.pog = total.lastQty + total.sellIn - total.currentQty;
    return total;
  }, [pogDataProcessed, activeTeamMembers, filterBelowCrop, isBusinessAnalyst]);

  const totalTeamStats = useMemo(() => {
    let total = 0;
    let visited = 0;
    teamStats.forEach((s) => {
      total += s.total || 0;
      visited += s.totalVisited || 0;
    });
    const percentage =
      total > 0 ? Math.min(100, Math.round((visited / total) * 100)) : 0;
    return { visited, total, percentage };
  }, [teamStats]);

  const activeVisitStats = useMemo(() => {
    const isAll =
      !mappingPic ||
      cleanForMatch(mappingPic) === "allteam" ||
      cleanForMatch(mappingPic) === "all_team";
    if (isAll) {
      return totalTeamStats;
    }
    const picStat = getStatsForPic(mappingPic);
    return {
      visited: picStat.visited,
      total: picStat.total,
      percentage: picStat.percentage,
    };
  }, [mappingPic, totalTeamStats, teamStats]);

  const grandTotalStats = useMemo(() => {
    const teamMembersCleanSet = new Set(
      activeTeamMembers.map((m) => cleanForMatch(m)).filter(Boolean),
    );
    

    const displayedRawItems = (enrichedSummaryDataRef.current || []).filter(
      (item) => {
        const isTeamMember = isBusinessAnalyst || teamMembersCleanSet.has(cleanForMatch(item.pic));
        const isCropMatch = checkCropMatch(item.crops, filterBelowCrop);
        const isClusterMatch = selectedClusters.includes(item.cluster);

        return isTeamMember && isCropMatch && isClusterMatch;
      },
    );

    const groupData: Record<
      string,
      { total: number; clusters: Record<string, number> }
    > = {};
    displayedRawItems.forEach((item) => {
      let g = "Unknown";
      if (grandTotalViewBy === "hybrid") {
        g = item.hybrid || "Unknown";
      } else if (grandTotalViewBy === "area") {
        const itemProv = item.province || getFromRecord<string>(teamProvinces, item.pic) || (item.area && item.area !== "-" ? item.area : "") || (item.rawArea && item.rawArea !== "-" ? item.rawArea : "");
        g = (itemProv && itemProv !== "-") ? itemProv : "Unknown";
      }
      
      if (groupData[g] === undefined) {
        groupData[g] = { total: 0, clusters: {} };
      }
      const qty = Number(item.stock) || 0;
      groupData[g].total += qty;

      const cluster = item.cluster;
      if (groupData[g].clusters[cluster] === undefined) {
        groupData[g].clusters[cluster] = 0;
      }
      groupData[g].clusters[cluster] += qty;
    });

    const sortedGroups = Object.entries(groupData)
      .sort((a, b) => b[1].total - a[1].total) // Sort descending by total kg
      .map(([name, data]) => ({
        name,
        total: data.total,
        clusters: data.clusters,
      }));

    return sortedGroups;
  }, [summaryData, activeTeamMembers, filterBelowCrop, selectedClusters, grandTotalViewBy, teamProvinces, isBusinessAnalyst]);

  const categoryFillingStats = useMemo(() => {
    let total = 0;
    let filled = 0;

    mappedChannelsByPic.forEach((k) => {
      total++;
      const cat = String(k.category || "").trim();
      const cleanCat = cat.toLowerCase();
      if (
        cat !== "" &&
        cat !== "-" &&
        cleanCat !== "uncategorized" &&
        cleanCat !== "n/a" &&
        cleanCat !== "unknown"
      ) {
        filled++;
      }
    });

    const percentage =
      total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
    return { filled, total, percentage };
  }, [mappedChannelsByPic]);

  const categoryDistributionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;

    mappedChannelsByPic.forEach((k) => {
      total++;
      let cat = String(k.category || "").trim();
      if (cat === "" || cat === "-") {
        cat = "Uncategorized";
      }

      const lowerCat = cat.toLowerCase();
      if (
        lowerCat === "uncategorized" ||
        lowerCat === "n/a" ||
        lowerCat === "unknown"
      ) {
        cat = "Uncategorized";
      } else if (lowerCat === "r1") {
        cat = "R1";
      } else if (lowerCat === "r2") {
        cat = "R2";
      } else if (lowerCat === "distributor") {
        cat = "Distributor";
      } else {
        cat = cat.charAt(0).toUpperCase() + cat.slice(1);
      }

      counts[cat] = (counts[cat] || 0) + 1;
    });

    const data = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const order = ["distributor", "r1", "r2"];
        const idxA = order.indexOf(a.name.toLowerCase());
        const idxB = order.indexOf(b.name.toLowerCase());

        if (idxA !== -1 && idxB !== -1) {
          return idxA - idxB;
        }
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;

        return b.value - a.value;
      });

    return { data, total };
  }, [mappedChannelsByPic]);

  const categoryChartSegments = useMemo(() => {
    const { data, total } = categoryDistributionStats;
    if (total === 0 || data.length === 0) return [];

    let accumulatedPercent = 0;
    const circumference = 2 * Math.PI * 95; // 596.9026

    const getCategoryColor = (name: string, idx: number) => {
      const lower = name.toLowerCase();
      if (lower === "gold") return "#f59e0b"; // Gold Amber-500
      if (lower === "silver") return "#cbd5e1"; // Silver Slate-300
      if (lower === "bronze") return "#b45309"; // Bronze Amber-700

      // Primary partner categories
      if (lower === "distributor") return "rgba(255, 255, 255, 0.35)"; // White with lower opacity
      if (lower === "r1") return "#ffffff"; // White
      if (lower === "r2") return "#2563eb"; // Blue cluster color (blue-600)

      if (lower === "uncategorized" || lower === "unknown" || lower === "-")
        return "#94a3b8"; // Neutral Slate

      const COLORS = [
        "rgba(255, 255, 255, 0.35)",
        "#ffffff",
        "#2563eb",
        "#f59e0b",
        "#fb923c",
        "#f43f5e",
        "#2dd4bf",
        "#94a3b8",
      ];
      return COLORS[idx % COLORS.length];
    };

    return data.map((item, idx) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const strokeLength = (percentage / 100) * circumference;
      const strokeOffset =
        circumference - (accumulatedPercent / 100) * circumference;
      accumulatedPercent += percentage;
      return {
        ...item,
        percentage,
        strokeDasharray: `${strokeLength} ${circumference - strokeLength}`,
        strokeDashoffset: strokeOffset,
        color: getCategoryColor(item.name, idx),
      };
    });
  }, [categoryDistributionStats]);


  if (showLoader) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] bg-[#f8fafc] px-4 pb-20 animate-in fade-in duration-500">
        <div className="bg-white p-8 rounded-[32px] shadow-[0_24px_64px_rgba(24,26,44,0.06)] border border-[#e2e8f0] flex flex-col items-center max-w-sm w-full gap-6">
          <div className="relative">
            <div className="size-24 border-4 border-[#edecff] rounded-full flex items-center justify-center">
              <span className="text-xl font-extrabold text-primary select-none">
                {loadProgress}%
              </span>
            </div>
            <div className="size-24 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0"></div>
          </div>

          <div className="text-center w-full">
            <h3 className="text-[#181a2c] font-black text-xl mb-1 select-none">
              Menyiapkan Data...
            </h3>
            <p className="text-[#8E94B7] text-[10px] font-bold uppercase tracking-widest select-none">
              SINKRONISASI DATABASE
            </p>
          </div>

          <div className="w-full flex flex-col items-center gap-2">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-[1px] border border-[#f1f5f9]">
              <div
                className="bg-gradient-to-r from-primary to-cyan-400 h-full rounded-full transition-all duration-150 ease-out shadow-[0_2px_8px_rgba(21,75,226,0.25)]"
                style={{ width: `${loadProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto lg:max-w-5xl xl:max-w-6xl px-5 pb-8 relative">
      <div className="flex items-stretch gap-2 mb-8 mt-6 -ml-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!isFetchingData) {
              fetchWorkingData();
            }
          }}
          disabled={isFetchingData}
          className="flex flex-col items-center justify-center shrink-0 bg-gradient-to-r from-primary to-cyan-400 rounded-[24px] px-5 py-3 shadow-[0_12px_32px_rgba(21,75,226,0.35)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all min-w-[108px] cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed select-none text-center border-0 appearance-none"
          title="Klik untuk Ambil Ulang Data dari Database"
        >
          <AdvantaLogo
            className={`size-14 text-white ${isFetchingData ? "animate-spin" : ""}`}
          />
          <span className="text-[9px] font-bold text-white/90 uppercase tracking-widest mt-1 leading-none">
            {isFetchingData ? "Refreshed" : "Radar"}
          </span>
        </button>
        <div className="bg-gradient-to-r from-primary to-cyan-400 p-4 rounded-l-[28px] rounded-r-none -mr-5 shadow-[0_12px_32px_rgba(21,75,226,0.35)] text-white flex items-center justify-between flex-1 relative overflow-visible transition-all select-none duration-200">
          <div className="absolute inset-0 overflow-hidden rounded-l-[28px] z-0">
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isAuthorizedFirebase) {
                  setIsLogoutModalOpen(true);
                }
              }}
              className={`absolute inset-0 flex items-center justify-center opacity-10 transition-opacity ${
                isAuthorizedFirebase ? "cursor-pointer hover:opacity-15 active:opacity-20" : "pointer-events-none"
              }`}
              title={isAuthorizedFirebase ? "Klik untuk Keluar Akun" : undefined}
            >
              <UserIcon className="h-[260%] w-auto max-w-none object-contain object-center" />
            </div>
          </div>

          <div className="flex-1 relative z-10 min-w-0 pr-2 flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {greeting.imageUrl && (
                    <img
                      src={greeting.imageUrl}
                      referrerPolicy="no-referrer"
                      className="size-12 md:size-14 object-contain opacity-100 shrink-0 pointer-events-none select-none animate-rotate-sway"
                      alt=""
                    />
                  )}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[9px] text-white/80 font-semibold uppercase tracking-widest leading-none mb-0.5">
                      {greeting.text},
                    </p>
                    <h2 className="text-md md:text-lg font-bold text-white leading-tight truncate">
                      {isAuthorizedFirebase ? userData.name : "RADAR Advanta"}
                    </h2>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] md:text-xs font-bold text-white uppercase bg-white/20 px-2.5 py-1 rounded-full border border-white/20 backdrop-blur-sm truncate select-none">
                  {isAuthorizedFirebase ? userData.position : "Akses Terbuka · Edit Aktif"}
                </span>
                {isAuthorizedFirebase && userData.province && userData.province !== "-" && (
                  <span className="text-[10px] md:text-xs font-bold text-white/80 uppercase bg-white/10 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                    {userData.province}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {firestoreReadError && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs">
            <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">
              warning
            </span>
            <div>
              <p className="font-bold">Firestore Rules (`radaradv-95dbf`) Perlu Dipublikasikan</p>
              <p className="text-amber-800 mt-0.5">
                {firestoreReadError} Salin{" "}
                <span className="font-mono font-semibold">firestore.rules</span> terbaru, lalu paste &amp; klik{" "}
                <span className="font-semibold">Publish</span> di Firebase Console &rarr; Firestore Database &rarr; Rules agar semua dapat mengakses &amp; mengedit tanpa login.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
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
                  setCopiedBannerRules(true);
                  setTimeout(() => setCopiedBannerRules(false), 2500);
                } catch {
                  // ignore clipboard failure
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copiedBannerRules ? "check" : "content_copy"}
              </span>
              {copiedBannerRules ? "Tersalin!" : "Copy Rules"}
            </button>
            <button
              type="button"
              onClick={() => retryFirestoreSync()}
              className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Muat Ulang
            </button>
          </div>
        </div>
      )}

      <Suspense
        fallback={
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#8E94B7]">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Memuat Modul...
            </span>
          </div>
        }
      >
        {activeTab === "overview" && (
          <OverviewTab
            filterBelowMonth={filterBelowMonth}
            setFilterBelowMonth={setFilterBelowMonth}
            filterBelowChannel={filterBelowChannel}
            setFilterBelowChannel={setFilterBelowChannel}
            filterBelowMaterial={filterBelowMaterial}
            setFilterBelowMaterial={setFilterBelowMaterial}
            filterBelowTeam={filterBelowTeam}
            setFilterBelowTeam={setFilterBelowTeam}
            filterBelowArea={filterBelowArea}
            setFilterBelowArea={setFilterBelowArea}
            filterBelowCrop={filterBelowCrop}
            setFilterBelowCrop={setFilterBelowCrop}
            filterOptions={filterOptions}
            overviewStats={overviewStats}
            overviewUseMt={overviewUseMt}
            overviewGroupDimension={overviewGroupDimension as OverviewDimension}
            setOverviewGroupDimension={(v) => setOverviewGroupDimension(v as any)}
            overviewMetricFilter={overviewMetricFilter}
            setOverviewMetricFilter={setOverviewMetricFilter}
            employeePerformanceData={employeePerformanceData}
            overviewHistoryData={overviewHistoryData}
            filteredSummaryDataLength={filteredSummaryData.length}
            grandTotalViewBy={grandTotalViewBy}
            setGrandTotalViewBy={setGrandTotalViewBy}
            totalSummary={totalSummary}
            selectedClusters={selectedClusters}
            setSelectedClusters={setSelectedClusters}
            grandTotalStats={grandTotalStats}
          />
        )}

        {activeTab === "home" && (
          <HomeTab
            isBusinessAnalyst={isBusinessAnalyst}
            selectedKiosk={selectedKiosk}
            setSelectedKiosk={setSelectedKiosk}
            myKiosks={myKiosks}
            kiosks={kiosks}
            lotNo={lotNo}
            setLotNo={setLotNo}
            qty={qty}
            setQty={setQty}
            isLotChecking={isLotChecking}
            lotIntel={lotIntel}
            isLotNotFound={isLotNotFound}
            manualHybrid={manualHybrid}
            setManualHybrid={setManualHybrid}
            manualHybridCustom={manualHybridCustom}
            setManualHybridCustom={setManualHybridCustom}
            manualCrop={manualCrop}
            setManualCrop={setManualCrop}
            manualDrDate={manualDrDate}
            setManualDrDate={setManualDrDate}
            manualExpDate={manualExpDate}
            setManualExpDate={setManualExpDate}
            materialsList={filterOptions.materials}
            handleAddLocal={handleAddLocal}
            workingData={workingData}
            editModal={editModal}
            setEditModal={setEditModal}
            deleteModal={deleteModal}
            setDeleteModal={setDeleteModal}
            handleEditLocal={handleEditLocal}
            handleDeleteLocal={handleDeleteLocal}
            handleUploadActivity={handleUploadActivity}
            isSyncing={isSyncing}
            hasChanges={hasChanges}
            isActionLoading={isActionLoading}
            isScannerOpen={isScannerOpen}
            setIsScannerOpen={setIsScannerOpen}
          />
        )}

        {activeTab === "partner" && (
          <PartnerTab
            userData={userData}
            userLevel={userLevel}
            teamMembers={teamMembers}
            teamPositions={teamPositions}
            teamProvinces={teamProvinces}
            teamUpLines={teamUpLines}
            teamLevels={teamLevels}
            employees={employees}
            normalizeName={normalizeName}
            mappingPic={mappingPic}
            setMappingPic={setMappingPic}
            mappingCategories={mappingCategories}
            mappingCategory={mappingCategory}
            setMappingCategory={setMappingCategory}
            displayedPartnerChannels={displayedPartnerChannels}
            partnerEditModal={partnerEditModal}
            setPartnerEditModal={setPartnerEditModal}
            partnerDeleteModal={partnerDeleteModal}
            setPartnerDeleteModal={setPartnerDeleteModal}
            employeeEditModal={employeeEditModal}
            setEmployeeEditModal={setEmployeeEditModal}
            employeeDeleteModal={employeeDeleteModal}
            setEmployeeDeleteModal={setEmployeeDeleteModal}
            handleEditPartnerSave={handleEditPartnerSave}
            handleDeletePartnerConfirm={handleDeletePartnerConfirm}
            handleEditEmployeeSave={handleEditEmployeeSave}
            handleDeleteEmployeeConfirm={handleDeleteEmployeeConfirm}
            isActionLoading={isActionLoading}
            myActiveSubordinates={myActiveSubordinates}
            availableProvinces={availableProvinces}
            allCategories={allCategories}
            availableGroups={availableGroups}
            accessRules={accessRules}
            canEdit={true}
          />
        )}

        {activeTab === "summary" && (
          <StockSummaryTab
            filteredSummaryData={filteredSummaryData}
            aggregatedPogDataLength={aggregatedPogData.length}
            totalSummaryPog={totalSummaryPog}
            totalPog={totalPog}
            totalSummary={totalSummary}
            overviewUseMt={overviewUseMt}
            filterBelowCrop={filterBelowCrop}
            setFilterBelowCrop={setFilterBelowCrop}
            selectedClusters={selectedClusters}
            setSelectedClusters={setSelectedClusters}
            isSummaryFilterOpen={isSummaryFilterOpen}
            setIsSummaryFilterOpen={setIsSummaryFilterOpen}
            isPogFilterOpen={isPogFilterOpen}
            setIsPogFilterOpen={setIsPogFilterOpen}
            activeVisitStats={activeVisitStats}
            mappingPic={mappingPic}
            normalizeName={normalizeName}
            categoryDistributionStats={categoryDistributionStats}
            categoryChartSegments={categoryChartSegments}
            summaryGroupBy={summaryGroupBy}
            setSummaryGroupBy={setSummaryGroupBy}
            summarySubGroupBy={summarySubGroupBy}
            setSummarySubGroupBy={setSummarySubGroupBy}
            availableCrops={availableCrops}
            expandedRows={expandedRows}
            toggleRow={toggleRow}
            handleDownloadSummaryExcel={handleDownloadSummaryExcel}
            renderMaybeChannelName={renderMaybeChannelName}
            getStatsForPic={getStatsForPic}
            isRowVisitZero={isRowVisitZero}
          />
        )}

        {activeTab === "pog" && (
          <PogTab
            filteredSummaryDataLength={filteredSummaryData.length}
            aggregatedPogData={aggregatedPogData}
            totalSummaryPog={totalSummaryPog}
            totalPog={totalPog}
            totalSummary={totalSummary}
            overviewUseMt={overviewUseMt}
            filterBelowCrop={filterBelowCrop}
            setFilterBelowCrop={setFilterBelowCrop}
            selectedClusters={selectedClusters}
            setSelectedClusters={setSelectedClusters}
            isSummaryFilterOpen={isSummaryFilterOpen}
            setIsSummaryFilterOpen={setIsSummaryFilterOpen}
            isPogFilterOpen={isPogFilterOpen}
            setIsPogFilterOpen={setIsPogFilterOpen}
            activeVisitStats={activeVisitStats}
            mappingPic={mappingPic}
            normalizeName={normalizeName}
            categoryDistributionStats={categoryDistributionStats}
            categoryChartSegments={categoryChartSegments}
            pogGroupBy={pogGroupBy}
            setPogGroupBy={setPogGroupBy}
            pogSubGroupBy={pogSubGroupBy}
            setPogSubGroupBy={setPogSubGroupBy}
            availableCrops={availableCrops}
            pogExpandedRows={pogExpandedRows}
            togglePogRow={togglePogRow}
            renderMaybeChannelName={renderMaybeChannelName}
            getStatsForPic={getStatsForPic}
            isRowVisitZero={isRowVisitZero}
          />
        )}

        {activeTab === "access" && (
          <AccessTab
            allPositionsList={allPositionsList}
            accessRules={accessRules}
            toggleAccessRule={toggleAccessRule}
            removeAccessRule={removeAccessRule}
            accessSaveSuccess={accessSaveSuccess}
            handleSaveAccessRules={handleSaveAccessRules}
            isSavingAccess={isSavingAccess}
          />
        )}

        {activeTab === "temp" && (
          <TempTab
            consolidationSuccessMsg={consolidationSuccessMsg}
            isTempProceeded={isTempProceeded}
            setIsTempProceeded={setIsTempProceeded}
            expandedTempRowId={expandedTempRowId}
            setExpandedTempRowId={setExpandedTempRowId}
            selectedConsolidateMonth={selectedConsolidateMonth}
            setSelectedConsolidateMonth={setSelectedConsolidateMonth}
            isConsolidatingDb={isConsolidatingDb}
            handleConsolidateDatabase={handleConsolidateDatabase}
            tempSearchQuery={tempSearchQuery}
            setTempSearchQuery={setTempSearchQuery}
            rawWorkingData={rawWorkingData}
            workingData={workingData}
            drSalesData={drSalesData}
            tempSortBy={tempSortBy}
            setTempSortBy={setTempSortBy}
            tempSortOrder={tempSortOrder}
            setTempSortOrder={setTempSortOrder}
            updatingRowMonthId={updatingRowMonthId}
            handleUpdateInputMonth={handleUpdateInputMonth}
            kiosks={kiosks}
            employees={employees}
            userData={userData}
            accessRules={accessRules}
            availableProvinces={availableProvinces}
            allCategories={allCategories}
            availableGroups={availableGroups}
            myActiveSubordinates={myActiveSubordinates}
            partnerEditModal={partnerEditModal}
            setPartnerEditModal={setPartnerEditModal}
            partnerDeleteModal={partnerDeleteModal}
            setPartnerDeleteModal={setPartnerDeleteModal}
            employeeEditModal={employeeEditModal}
            setEmployeeEditModal={setEmployeeEditModal}
            employeeDeleteModal={employeeDeleteModal}
            setEmployeeDeleteModal={setEmployeeDeleteModal}
            handleEditPartnerSave={handleEditPartnerSave}
            handleDeletePartnerConfirm={handleDeletePartnerConfirm}
            handleEditEmployeeSave={handleEditEmployeeSave}
            handleDeleteEmployeeConfirm={handleDeleteEmployeeConfirm}
            isActionLoading={isActionLoading}
            onRefreshDatabase={async () => {
              await fetchWorkingData();
              setChannelsRefreshKey((k) => k + 1);
            }}
          />
        )}
      </Suspense>

      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={onLogout}
      />
    </div>
  );
};

export default Dashboard;
