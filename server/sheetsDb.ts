import path from "path";
import fs from "fs";

export const LOCAL_DB_PATH = path.join(process.cwd(), "local_sheets_db.json");

let memoryDb: Record<string, any[][]> | null = null;

export function initLocalDb(): void {
  if (memoryDb) {
    return;
  }
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      memoryDb = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
      return;
    } catch (e) {
      console.error("Failed to parse local_sheets_db.json, initializing empty schema:", e);
    }
  }
  // Empty header-only tables (no dummy rows; live data lives in Firebase Firestore)
  memoryDb = {
    employee: [
      ["Nama", "Email", "User", "Position", "Province", "Area", "Upline", "Password", "Level", "Group"],
    ],
    channel: [
      ["Name", "PIC", "Category", "Province", "Area"],
    ],
    working: [
      ["Timestamp", "Channel", "Name Checker", "Lot", "Quantity (kg)", "Aging (month)", "Exp Date", "Crops", "Condition", "Shipping Date", "POG", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des", "upd_jan", "upd_feb", "upd_mar", "upd_apr", "upd_mei", "upd_jun", "upd_jul", "upd_ags", "upd_sep", "upd_okt", "upd_nov", "upd_des"],
    ],
    dr: [
      ["Lot No", "Date", "Qty", "Hybrid", "Crops"],
    ],
    hybrid: [
      ["Material", "Hybrid", "Crops"],
    ],
    access: [
      ["position", "home", "partner", "stock", "pog", "overview", "temp", "access"],
    ],
  };
}

export const isDummyConfig = false;
export const isDirectConfigured = false;
let useLocalDbOnly = true;

export function getUseLocalDbOnly(): boolean {
  return useLocalDbOnly;
}

export function setUseLocalDbOnly(val: boolean): void {
  useLocalDbOnly = val;
}

export function invalidateCache(_sheetName: string): void {
  // No-op
}

export function clearAllCaches(): void {
  // No-op
}

export async function getSheetValues(sheetName: string): Promise<any[][] | null> {
  initLocalDb();
  if (!memoryDb) return [];
  const rows = memoryDb[sheetName];
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map((row) => (Array.isArray(row) ? [...row] : []));
}

export async function updateSheetValues(sheetName: string, values: any[][]): Promise<boolean> {
  initLocalDb();
  if (!memoryDb) memoryDb = {};
  const sanitizedValues = (values || []).map((row) => {
    if (!Array.isArray(row)) return [];
    return row.map((val) => (val === undefined || val === null ? "" : val));
  });
  memoryDb[sheetName] = sanitizedValues;
  return true;
}

export async function appendSheetRow(sheetName: string, rowValues: any[]): Promise<boolean> {
  initLocalDb();
  if (!memoryDb) memoryDb = {};
  const sanitizedRow = (rowValues || []).map((cell) => (cell === undefined || cell === null ? "" : cell));
  if (!memoryDb[sheetName]) memoryDb[sheetName] = [];
  memoryDb[sheetName].push(sanitizedRow);
  return true;
}
