export const ORIGINAL_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxUUPKhsEo-LencnYjex3gOhVl7w2tS154VCICVbqGfFSBLAwzv0P7XOu9oMTE1jTUg1g/exec";
export const SCRIPT_URL = "/api";

export const INDO_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ags",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const MONTH_KEYS = [
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
] as const;

export const CROP_YEAR_MONTH_LABELS = [
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
  "Desember 2026",
];

export const CROP_OPTIONS = ["Field Corn", "Fresh Corn", "Vegetables"];

export interface ClusterConfigItem {
  key: string;
  label: string;
  colorHeader: string;
  colorCell: string;
  colorGrand: string;
  colorChild: string;
}

export const CLUSTER_CONFIG: ClusterConfigItem[] = [
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
];

export const ALL_CLUSTER_KEYS = CLUSTER_CONFIG.map((c) => c.key);

export const DEFAULT_POSITIONS = [
  "Business Analyst",
  "Vegetables Sales Manager",
  "Area Sales Manager",
  "Sales Agronomist",
  "Business Solution",
];

export const DEFAULT_ACCESS_RULES: Record<string, Record<string, boolean>> = {
  "Business Analyst": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
  "Vegetables Sales Manager": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
  "Commercial Lead": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
  "Country Head": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
  "Area Sales Manager": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
  "Sales Agronomist": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
  "Business Solution": {
    home: true,
    partner: true,
    stock: true,
    pog: true,
    overview: true,
    temp: true,
    access: true,
  },
};
