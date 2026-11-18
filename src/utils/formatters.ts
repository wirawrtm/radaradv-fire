const cleanForMatchCache = new Map<string, string>();

export const cleanForMatch = (s: any): string => {
  if (s === undefined || s === null) return "";
  const raw = String(s);
  const cached = cleanForMatchCache.get(raw);
  if (cached !== undefined) return cached;
  let str = raw.toLowerCase().trim();
  str = str.replace(/^(ud\s+|ud\.|cv\s+|cv\.|pt\s+|pt\.|toko\s+|kiosk\s+)/gi, "");
  const res = str.replace(/[^a-z0-9]/g, "");
  if (cleanForMatchCache.size < 10000) {
    cleanForMatchCache.set(raw, res);
  }
  return res;
};

export const formatNum = (num: any): string => {
  if (!num) return "0";
  const absNum = Math.abs(num);
  let minFrac = 0;
  let maxFrac = 0;

  if (absNum >= 100) {
    minFrac = 0;
    maxFrac = 0;
  } else if (absNum >= 10) {
    minFrac = 1;
    maxFrac = 1;
  } else if (absNum > 0) {
    minFrac = 2;
    maxFrac = 2;
  }

  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  });
};

export const parseTaskDate = (timestamp: any): Date | null => {
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

export const safeParseFloat = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

export const matchNames = (name1: any, name2: any): boolean => {
  const c1 = cleanForMatch(name1);
  const c2 = cleanForMatch(name2);
  if (!c1 || !c2) return false;
  return c1 === c2;
};

export const checkCropMatch = (itemCrop: string, filterCrop: string): boolean => {
  if (!filterCrop || filterCrop === "All") return true;
  const ic = String(itemCrop || "")
    .toLowerCase()
    .trim();
  const fc = String(filterCrop || "")
    .toLowerCase()
    .trim();
  return ic === fc;
};

export const normalizeWorkingItem = (item: any) => {
  const cropVal =
    item.crops ||
    item.Crops ||
    item.crop ||
    item.Crop ||
    item.CROP ||
    item.CROPS ||
    "Uncategorized Crops";
  const areaVal = item.area || item.Area || item.AREA;
  const catVal =
    item.category ||
    item.Category ||
    item.CATEGORY ||
    item.kategori ||
    item.Kategori ||
    item.klasifikasi ||
    item.cat ||
    item.Cat ||
    "";
  return { ...item, crops: cropVal, area: areaVal, category: catVal };
};

export const getValidCategory = (
  itemCat?: any,
  kioskCat?: any,
  kioskName?: string,
  fallbackMap?: Record<string, string>,
): string => {
  const cleanItem = String(itemCat || "").trim();
  const cleanKiosk = String(kioskCat || "").trim();

  const isInvalid = (val: string) =>
    !val ||
    val === "-" ||
    val.toLowerCase() === "uncategorized" ||
    val.toLowerCase() === "n/a" ||
    val.toLowerCase() === "unknown";

  let selected = "";
  if (!isInvalid(cleanItem)) {
    selected = cleanItem;
  } else if (!isInvalid(cleanKiosk)) {
    selected = cleanKiosk;
  } else if (fallbackMap && kioskName) {
    const cleanK = cleanForMatch(kioskName);
    const mapped = fallbackMap[cleanK];
    if (mapped && !isInvalid(mapped)) {
      selected = mapped;
    } else {
      for (const [mk, mv] of Object.entries(fallbackMap)) {
        if ((mk.includes(cleanK) || cleanK.includes(mk)) && !isInvalid(mv)) {
          selected = mv;
          break;
        }
      }
    }
  }

  if (!selected && kioskName) {
    const kLower = kioskName.toLowerCase();
    if (
      kLower.includes("distributor") ||
      kLower.includes("distr") ||
      kLower.includes("gudang") ||
      kLower.includes("warehouse") ||
      kLower.includes("subd")
    ) {
      selected = "Distributor";
    } else if (/\br1\b|toko r1|mitra r1|kiosk r1/i.test(kioskName)) {
      selected = "R1";
    } else if (/\br2\b|toko r2|mitra r2|kiosk r2/i.test(kioskName)) {
      selected = "R2";
    }
  }

  if (!selected) {
    selected = "R1";
  }

  const lower = selected.toLowerCase();
  if (lower === "distributor") return "Distributor";
  if (lower === "r1") return "R1";
  if (lower === "r2") return "R2";
  return selected.charAt(0).toUpperCase() + selected.slice(1);
};

export const formatOverviewVal = (
  num: number | undefined | null,
  forceMt?: boolean,
): { valueStr: string; unit: string } => {
  const n = num || 0;
  if (n === 0) {
    return { valueStr: "0", unit: forceMt ? "MT" : "Kg" };
  }
  const absVal = Math.abs(n);
  const isMt = forceMt !== undefined ? forceMt : absVal >= 1000;

  if (isMt) {
    const mtVal = n / 1000;
    const absMtVal = Math.abs(mtVal);
    let dec = 0;
    if (absMtVal < 10) {
      dec = 2;
    } else if (absMtVal < 100) {
      dec = 1;
    } else {
      dec = 0;
    }
    return {
      valueStr: mtVal.toLocaleString("id-ID", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      }),
      unit: "MT",
    };
  } else {
    const dec = absVal < 10 ? 2 : 1;
    return {
      valueStr: n.toLocaleString("id-ID", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      }),
      unit: "Kg",
    };
  }
};

export const formatOverviewWithUnit = (
  num: number | undefined | null,
  forceMt?: boolean,
): string => {
  const formatted = formatOverviewVal(num, forceMt);
  return `${formatted.valueStr} ${formatted.unit}`;
};

export const parseTimestampMs = (ts: any): number => {
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

export const parseDateForPog = (timestamp: any): Date => {
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

export const extractExpFromLot = (lotNo: string | undefined | null): string => {
  if (!lotNo) return "N/A";
  const raw = String(lotNo).trim().toUpperCase();
  if (!raw || raw === "N/A" || raw === "-") return "N/A";

  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  const clean = raw.replace(/[^A-Z0-9]/g, "");

  const digit8Matches = clean.match(/\d{8}/g);
  if (digit8Matches) {
    for (const mStr of digit8Matches) {
      let d = parseInt(mStr.slice(0, 2), 10);
      let m = parseInt(mStr.slice(2, 4), 10);
      const y = parseInt(mStr.slice(4, 8), 10);

      if (m > 12 && d >= 1 && d <= 12) {
        const temp = d;
        d = m;
        m = temp;
      }
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2050) {
        const dayStr = String(d).padStart(2, "0");
        const yearStr = String(y).slice(-2);
        return `${dayStr}/${months[m - 1]}/${yearStr}`;
      }
    }
  }

  const digit6Matches = clean.match(/\d{6}/g);
  if (digit6Matches) {
    for (const mStr of digit6Matches) {
      let d = parseInt(mStr.slice(0, 2), 10);
      let m = parseInt(mStr.slice(2, 4), 10);
      const y = parseInt(mStr.slice(4, 6), 10);

      if (y >= 20 && y <= 50) {
        if (m > 12 && d >= 1 && d <= 12) {
          const temp = d;
          d = m;
          m = temp;
        }
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
          const dayStr = String(d).padStart(2, "0");
          const yearStr = String(y).padStart(2, "0");
          return `${dayStr}/${months[m - 1]}/${yearStr}`;
        }
      }

      const yy = parseInt(mStr.slice(0, 2), 10);
      const mm = parseInt(mStr.slice(2, 4), 10);
      const dd = parseInt(mStr.slice(4, 6), 10);
      if (
        yy >= 20 &&
        yy <= 50 &&
        mm >= 1 &&
        mm <= 12 &&
        dd >= 1 &&
        dd <= 31
      ) {
        const dayStr = String(dd).padStart(2, "0");
        const yearStr = String(yy).padStart(2, "0");
        return `${dayStr}/${months[mm - 1]}/${yearStr}`;
      }
    }
  }

  const match = raw.match(/(\d{2})(\d{2})(\d{2})/);
  if (match) {
    let d = parseInt(match[1], 10);
    let m = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);

    if (m > 12 && d >= 1 && d <= 12) {
      const temp = d;
      d = m;
      m = temp;
    }

    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 20 && y <= 50) {
      const dayStr = String(d).padStart(2, "0");
      const yearStr = String(y).padStart(2, "0");
      return `${dayStr}/${months[m - 1]}/${yearStr}`;
    }
  }

  return "N/A";
};

export const getCurrentTimestamp = (): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

export const formatDateToAppFormat = (dateStr: string): string => {
  if (!dateStr || dateStr === "N/A" || dateStr === "-") return "N/A";
  const str = String(dateStr).trim();
  if (!str) return "N/A";

  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    const mIdx = parseInt(m, 10) - 1;
    return `${d.padStart(2, "0")}/${months[mIdx] || "JAN"}/${y.substring(2)}`;
  }

  const parts = str.split(/[\s/\-.:]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
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
    const year = String(date.getFullYear()).substring(2);
    return `${day}/${months[date.getMonth()]}/${year}`;
  }

  return str || "N/A";
};

export const calculateAgingInMonths = (startStr: string): string => {
  if (!startStr) return "-";
  const start = new Date(startStr);
  const end = new Date();
  if (isNaN(start.getTime())) return "-";
  return String(
    Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24) / 30.416),
  );
};

export const getMonthIndexFromTimestamp = (timestamp: any): number => {
  if (!timestamp) return new Date().getMonth();
  if (timestamp instanceof Date) return timestamp.getMonth();

  const str = String(timestamp).trim();
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const indMonths = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mei",
    "jun",
    "jul",
    "agu",
    "ags",
    "sep",
    "okt",
    "nov",
    "des",
  ];

  const matchDelimited = (delimiterRegex: RegExp) => {
    const parts = str.split(delimiterRegex);
    if (parts.length >= 2) {
      const mVal = parseInt(parts[1], 10);
      if (!isNaN(mVal) && mVal >= 1 && mVal <= 12) {
        return mVal - 1;
      }
      const lowerM = parts[1].toLowerCase();
      let m = months.findIndex((name) => lowerM.startsWith(name));
      if (m === -1) m = indMonths.findIndex((name) => lowerM.startsWith(name));
      if (m !== -1) return m;
    }
    return -1;
  };

  if (str.includes("/")) {
    const m = matchDelimited(/[\s/:]+/);
    if (m !== -1) return m;
  }

  if (str.includes("-")) {
    const m = matchDelimited(/[\s\-:]+/);
    if (m !== -1) return m;
  }

  const d = new Date(str);
  return !isNaN(d.getTime()) ? d.getMonth() : new Date().getMonth();
};
