export const MONTH_SHORT_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
] as const;

const MONTH_SYNONYMS: string[][] = [
  ["jan", "januari", "january"],
  ["feb", "februari", "february"],
  ["mar", "maret", "march"],
  ["apr", "april"],
  ["mei", "may"],
  ["jun", "juni", "june"],
  ["jul", "juli", "july"],
  ["ags", "agu", "agst", "agustus", "aug", "august"],
  ["sep", "sept", "september"],
  ["okt", "oct", "oktober", "october"],
  ["nov", "november"],
  ["des", "dec", "desember", "december"],
];

const EN_MONTH_UPPER = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const EN_MONTH_LOWER = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const ID_MONTH_LOWER = [
  "jan", "feb", "mar", "apr", "mei", "jun",
  "jul", "agu", "sep", "okt", "nov", "des",
];

export function getJakartaParts(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const partMap = formatter.formatToParts(now).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
  };
}

export function getJakartaDate(): Date {
  const parts = getJakartaParts();
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function getJakartaTimestamp(): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = getJakartaDate();
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function cleanForMatch(val: any): string {
  return String(val || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizePosition(pos: string | undefined): string {
  if (!pos) return "Business Solution";
  const clean = String(pos).toLowerCase().replace(/\s+/g, "");
  if (clean === "businessanalyst" || clean === "analyst") return "Business Analyst";
  if (clean === "salesmanager" || clean === "sm") return "Vegetables Sales Manager";
  if (clean === "areasalesmanager" || clean === "asm") return "Area Sales Manager";
  if (clean === "salesagronomist" || clean === "sa") return "Sales Agronomist";
  if (clean === "businesssolution" || clean === "bs") return "Business Solution";
  return String(pos).trim();
}

export function safeParseFloat(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseGasDate(val: any): Date {
  if (!val || val === "N/A" || val === "-" || val === "null" || val === "undefined") {
    return new Date(0);
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date(0) : val;

  const str = String(val).trim();
  if (!str) return new Date(0);

  if (typeof val === "number" || (!isNaN(Number(str)) && !str.includes("/") && !str.includes("-") && !str.includes("."))) {
    const num = Number(str);
    if (num > 10000 && num < 100000) {
      const jsDate = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(jsDate.getTime())) return jsDate;
    }
  }

  const parts = str.split(/[\s/\-.:]+/);
  if (parts.length >= 3) {
    const [p0, p1, p2] = parts;

    const getMonthNum = (mStr: string): number => {
      const m = parseInt(mStr, 10) - 1;
      if (!isNaN(m) && m >= 0 && m <= 11) return m;
      const lower = mStr.toLowerCase();
      let idx = EN_MONTH_LOWER.findIndex((name) => lower.startsWith(name));
      if (idx !== -1) return idx;
      idx = ID_MONTH_LOWER.findIndex((name) => lower.startsWith(name));
      return idx;
    };

    if (p0.length === 4) {
      const y = parseInt(p0, 10);
      const m = getMonthNum(p1);
      const day = parseInt(p2, 10);
      if (y > 1900 && m !== -1 && !isNaN(day)) return new Date(y, m, day);
    } else {
      const day = parseInt(p0, 10);
      const m = getMonthNum(p1);
      let y = parseInt(p2, 10);
      if (y < 100) y += 2000;
      if (!isNaN(day) && m !== -1 && !isNaN(y) && y > 1900) {
        return new Date(y, m, day);
      }
    }
  }

  const d = new Date(str);
  return !isNaN(d.getTime()) ? d : new Date(0);
}

export function extractExpFromLot(lotNo: any): string {
  if (!lotNo) return "N/A";
  const raw = String(lotNo).trim().toUpperCase();
  if (!raw || raw === "N/A" || raw === "-") return "N/A";

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
        return `${String(d).padStart(2, "0")}/${EN_MONTH_UPPER[m - 1]}/${String(y).slice(-2)}`;
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
          return `${String(d).padStart(2, "0")}/${EN_MONTH_UPPER[m - 1]}/${String(y).padStart(2, "0")}`;
        }
      }

      const yy = parseInt(mStr.slice(0, 2), 10);
      const mm = parseInt(mStr.slice(2, 4), 10);
      const dd = parseInt(mStr.slice(4, 6), 10);
      if (yy >= 20 && yy <= 50 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${String(dd).padStart(2, "0")}/${EN_MONTH_UPPER[mm - 1]}/${String(yy).padStart(2, "0")}`;
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
      return `${String(d).padStart(2, "0")}/${EN_MONTH_UPPER[m - 1]}/${String(y).padStart(2, "0")}`;
    }
  }

  return "N/A";
}

export function formatMyDate(dateObj: any): string {
  if (!dateObj || dateObj === "" || dateObj === "N/A" || dateObj === "-" || dateObj === "null" || dateObj === "undefined") {
    return "N/A";
  }
  const date = parseGasDate(dateObj);
  if (date && !isNaN(date.getTime()) && date.getTime() !== 0) {
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).substring(2);
    return `${day}/${EN_MONTH_UPPER[date.getMonth()]}/${year}`;
  }
  return String(dateObj).trim() || "N/A";
}

export function getMonthIndices(headers: string[]): number[] {
  return MONTH_SYNONYMS.map((list) =>
    headers.findIndex((h) => {
      const hStr = String(h || "").trim().toLowerCase();
      return list.some((syn) => hStr === syn);
    })
  );
}

export function getUpdMonthIndices(headers: string[]): number[] {
  return MONTH_SYNONYMS.map((list) =>
    headers.findIndex((h) => {
      if (h === undefined || h === null) return false;
      const hStr = String(h).trim().toLowerCase().replace(/[\s_\-/]/g, "");
      if (!hStr.startsWith("upd")) return false;
      const remains = hStr.substring(3);
      return list.some((syn) => remains === syn);
    })
  );
}

export function getMonthIndexFromDateString(dateStr: any): number {
  if (!dateStr) return new Date().getMonth();
  if (dateStr instanceof Date) return dateStr.getMonth();
  const str = String(dateStr).trim();

  const parseMonthPart = (mPart: string): number => {
    const mVal = parseInt(mPart, 10);
    if (!isNaN(mVal) && mVal >= 1 && mVal <= 12) return mVal - 1;
    const lowerM = mPart.toLowerCase();
    let m = EN_MONTH_LOWER.findIndex((name) => lowerM.startsWith(name));
    if (m === -1) m = ID_MONTH_LOWER.findIndex((name) => lowerM.startsWith(name));
    if (m === -1 && (lowerM.startsWith("ags") || lowerM.startsWith("agu"))) return 7;
    return m;
  };

  if (str.includes("/")) {
    const parts = str.split(/[\s/:]+/);
    if (parts.length >= 2) {
      const mIdx = parseMonthPart(parts[1]);
      if (mIdx !== -1) return mIdx;
    }
  }
  if (str.includes("-")) {
    const parts = str.split(/[\s\-:]+/);
    if (parts.length >= 2) {
      const mIdx = parseMonthPart(parts[1]);
      if (mIdx !== -1) return mIdx;
    }
  }
  const d = new Date(str);
  return !isNaN(d.getTime()) ? d.getMonth() : new Date().getMonth();
}

export function colIndexInBounds(idx: number, row: any[]): boolean {
  return idx !== -1 && idx < row.length;
}

export function buildChannelCategoryMap(channelData: any[][]): Record<string, string> {
  const map: Record<string, string> = {};
  if (channelData && channelData.length > 1) {
    const headers = channelData[0];
    const nameIdx = headers.findIndex((h: any) => /name|nama|channel|kiosk/i.test(String(h).trim()));
    const catIdx = headers.findIndex((h: any) => /kategori|category|klasifikasi/i.test(String(h).trim()));
    if (nameIdx !== -1 && catIdx !== -1) {
      for (let c = 1; c < channelData.length; c++) {
        const cRow = channelData[c];
        const cName = String(cRow[nameIdx] || "").trim().toLowerCase();
        const cCat = String(cRow[catIdx] || "").trim();
        if (cName) map[cName] = cCat;
      }
    }
  }
  return map;
}

export function getGasCategory(
  kioskName: string,
  channelCategoryMap: Record<string, string>,
  itemCat?: string,
): string {
  if (itemCat && itemCat !== "-" && itemCat.toLowerCase() !== "uncategorized" && itemCat.toLowerCase() !== "n/a") {
    return itemCat;
  }
  const cleanKName = String(kioskName || "").trim().toLowerCase();
  if (channelCategoryMap[cleanKName]) {
    return channelCategoryMap[cleanKName];
  }
  if (
    cleanKName.includes("distributor") ||
    cleanKName.includes("distr") ||
    cleanKName.includes("gudang") ||
    cleanKName.includes("warehouse") ||
    cleanKName.includes("subd")
  ) {
    return "Distributor";
  }
  if (/\br1\b|toko r1|mitra r1|kiosk r1/i.test(cleanKName)) return "R1";
  if (/\br2\b|toko r2|mitra r2|kiosk r2/i.test(cleanKName)) return "R2";
  return "R1";
}
