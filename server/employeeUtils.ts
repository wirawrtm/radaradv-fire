import { cleanForMatch, normalizePosition } from "./utils";
import { getSheetValues } from "./sheetsDb";

export function findEmployeeRow(user: string, empData: any[][]): any | null {
  if (!user || !empData || empData.length <= 1) return null;
  const headers = empData[0];
  const emailIdx = headers.findIndex((h: any) => /email/i.test(String(h).trim()));
  const userIdx = headers.findIndex((h: any) => /^user$|^username$|^user\s*name$/i.test(String(h).trim().toLowerCase()));
  const nameIdx = headers.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim()));

  const targetClean = cleanForMatch(user);

  for (let i = 1; i < empData.length; i++) {
    const row = empData[i];
    const rowName = nameIdx !== -1 ? cleanForMatch(row[nameIdx]) : "";
    const rowEmail = emailIdx !== -1 ? cleanForMatch(row[emailIdx]) : "";
    const rowUser = userIdx !== -1 ? cleanForMatch(row[userIdx]) : "";

    if (rowUser === targetClean || rowName === targetClean || rowEmail === targetClean) {
      return row;
    }
  }
  return null;
}

export function getUserProvince(userName: string, empData: any[][]): string {
  if (!userName || !empData || empData.length <= 1) return "";
  const headers = empData[0];
  const provIdx = headers.findIndex((h: any) => /province|provinsi/i.test(String(h).trim()));
  const areaIdx = headers.findIndex((h: any) => /area/i.test(String(h).trim()));
  const row = findEmployeeRow(userName, empData);
  if (row) {
    if (provIdx !== -1 && row[provIdx] !== "" && row[provIdx] !== undefined) {
      return String(row[provIdx]).trim();
    }
    if (areaIdx !== -1 && row[areaIdx] !== "" && row[areaIdx] !== undefined) {
      return String(row[areaIdx]).trim();
    }
  }
  return "";
}

let cachedEmployeeList: any[] | null = null;
let lastEmployeeListFetch = 0;
const EMPLOYEE_LIST_CACHE_MS = 120 * 1000;

export function clearEmployeeCache(): void {
  cachedEmployeeList = null;
}

export async function getEmployeeList(): Promise<any[]> {
  const now = Date.now();
  if (cachedEmployeeList && now - lastEmployeeListFetch < EMPLOYEE_LIST_CACHE_MS) {
    return cachedEmployeeList;
  }

  const data = await getSheetValues("employee");
  if (!data || data.length <= 1) return [];
  const headers = data[0];
  const emailIdx = headers.findIndex((h: any) => /email/i.test(String(h).trim()));
  const userIdx = headers.findIndex((h: any) => /^user$|^username$|^user\s*name$/i.test(String(h).trim().toLowerCase()));
  const idx = {
    name: headers.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim())),
    email: emailIdx !== -1 ? emailIdx : headers.findIndex((h: any) => /email|user/i.test(String(h).trim())),
    username: userIdx !== -1 ? userIdx : -1,
    pos: headers.findIndex((h: any) => /position|jabatan/i.test(String(h).trim())),
    prov: headers.findIndex((h: any) => /province|provinsi/i.test(String(h).trim())),
    area: headers.findIndex((h: any) => /area/i.test(String(h).trim())),
    upline: headers.findIndex((h: any) => /upline|spv|supervisor|atasan|manager/i.test(String(h).trim())),
    password: headers.findIndex((h: any) => /password|pass/i.test(String(h).trim())),
    level: headers.findIndex((h: any) => /level|grade/i.test(String(h).trim())),
    group: headers.findIndex((h: any) => /group|tim|divisi|division/i.test(String(h).trim())),
  };

  const list = data.slice(1).map((row) => {
    const p = idx.pos !== -1 ? row[idx.pos] : "Business Solution";
    return {
      name: idx.name !== -1 ? String(row[idx.name] || "").trim() : "",
      email: idx.email !== -1 ? String(row[idx.email] || "").trim() : "",
      user: idx.username !== -1 ? String(row[idx.username] || "").trim() : "",
      position: normalizePosition(p),
      province: idx.prov !== -1 ? String(row[idx.prov] || "").trim() : "-",
      area: idx.area !== -1 ? String(row[idx.area] || "").trim() : "-",
      upline: idx.upline !== -1 ? String(row[idx.upline] || "").trim() : "",
      password: idx.password !== -1 ? String(row[idx.password] || "").trim() : "",
      level: idx.level !== -1 && row[idx.level] !== "" && row[idx.level] !== undefined ? row[idx.level] : null,
      group: idx.group !== -1 ? String(row[idx.group] || "").trim() : "",
    };
  });

  const seenEmployees = new Set<string>();
  const dedupedList: any[] = [];
  for (const emp of list) {
    const cleanName = String(emp.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seenEmployees.has(cleanName) && cleanName !== "") {
      seenEmployees.add(cleanName);
      dedupedList.push(emp);
    }
  }

  cachedEmployeeList = dedupedList;
  lastEmployeeListFetch = now;
  return dedupedList;
}

export async function handleGetUserProfile(user: string) {
  const employees = await getEmployeeList();
  if (employees.length === 0) {
    return { status: "error", message: "Data employee kosong atau tidak ditemukan" };
  }

  const lowerUser = String(user).trim().toLowerCase();
  const cleanQ = lowerUser.replace(/[^a-z0-9]/g, "");

  const foundEmployee = employees.find((emp) => {
    const rowUser = String(emp.user || "").trim().toLowerCase();
    const rowEmail = String(emp.email || "").trim().toLowerCase();
    const rowName = String(emp.name || "").trim().toLowerCase();
    const rowUserLocal = rowEmail.includes("@") ? rowEmail.split("@")[0] : rowEmail;
    const cleanUser = rowUser.replace(/[^a-z0-9]/g, "");
    const cleanName = rowName.replace(/[^a-z0-9]/g, "");
    const cleanEmail = rowEmail.replace(/[^a-z0-9]/g, "");
    const cleanUserLocal = rowUserLocal.replace(/[^a-z0-9]/g, "");

    if (rowUser === lowerUser || rowEmail === lowerUser || rowUserLocal === lowerUser) return true;
    if (cleanUser === cleanQ || cleanEmail === cleanQ || cleanUserLocal === cleanQ) return true;
    if (rowName === lowerUser || cleanName === cleanQ) return true;
    if (cleanUser.replace(/^l/, "i") === cleanQ.replace(/^l/, "i")) return true;
    if (cleanName.replace(/^l/, "i") === cleanQ.replace(/^l/, "i")) return true;

    return false;
  });

  if (!foundEmployee) {
    return { status: "error", message: "Username tidak ditemukan" };
  }

  const resolvedUser =
    foundEmployee.user ||
    (foundEmployee.email
      ? foundEmployee.email.includes("@")
        ? foundEmployee.email.split("@")[0]
        : foundEmployee.email
      : "");

  const profile: any = {
    name: foundEmployee.name,
    email: foundEmployee.email,
    user: resolvedUser,
    position: foundEmployee.position,
    province: foundEmployee.province,
    area: foundEmployee.area,
    password: foundEmployee.password,
    upline: foundEmployee.upline,
    level: foundEmployee.level,
    group: foundEmployee.group,
    subordinates: [],
  };

  const userAliases = new Set([lowerUser]);
  if (profile.name !== "") userAliases.add(profile.name.toLowerCase());
  if (profile.email !== "") userAliases.add(profile.email.toLowerCase());
  if (profile.user !== "") userAliases.add(profile.user.toLowerCase());

  const cleanProfilePos = profile.position ? profile.position.toLowerCase().replace(/\s+/g, "") : "";
  const profileLevelClean = profile.level ? String(profile.level).toLowerCase().trim() : "";
  const isBusinessAnalyst =
    lowerUser === "adityawiratama" ||
    lowerUser.includes("adityawiratama") ||
    cleanProfilePos === "businessanalyst" ||
    cleanProfilePos === "analyst" ||
    profileLevelClean === "admin";

  if (isBusinessAnalyst) {
    if (profileLevelClean !== "admin") {
      profile.position = "Business Analyst";
    }
    const asmSubordinates: string[] = [];
    if (profileLevelClean !== "admin") {
      employees.forEach((emp) => {
        if (emp.name !== "" && emp.position === "Area Sales Manager" && !asmSubordinates.includes(emp.name)) {
          asmSubordinates.push(emp.name);
        }
      });
    }
    profile.subordinates = asmSubordinates;
    return { status: "success", data: profile };
  }

  const subs: string[] = [];
  const queue = Array.from(userAliases);
  const visited = new Set(queue);

  while (queue.length > 0) {
    const currentUpline = queue.shift();
    employees.forEach((emp) => {
      const empNameRaw = String(emp.name || "").trim();
      const empNameLower = empNameRaw.toLowerCase();
      const empEmailRaw = String(emp.email || "").trim();
      const empEmailLower = empEmailRaw.toLowerCase();
      const empUplineRaw = String(emp.upline || "").trim();
      const empUplineLower = empUplineRaw.toLowerCase();

      if (empUplineLower !== "") {
        const isMatch =
          empUplineLower === currentUpline ||
          empUplineLower.includes(currentUpline!) ||
          currentUpline!.includes(empUplineLower);
        if (isMatch) {
          let addedAny = false;
          if (empNameLower !== "" && !visited.has(empNameLower)) {
            visited.add(empNameLower);
            queue.push(empNameLower);
            addedAny = true;
          }
          if (empEmailLower !== "" && !visited.has(empEmailLower)) {
            visited.add(empEmailLower);
            queue.push(empEmailLower);
            addedAny = true;
          }
          if (addedAny) {
            const displayName = empNameRaw !== "" ? empNameRaw : empEmailRaw;
            if (displayName !== "" && !subs.includes(displayName)) {
              subs.push(displayName);
            }
          }
        }
      }
    });
  }

  profile.subordinates = subs;
  return { status: "success", data: profile };
}

export async function handleGetEmployees() {
  const data = await getSheetValues("employee");
  if (!data || data.length <= 1) return { status: "success", data: [] };
  const headers = data[0];
  const emailIdx = headers.findIndex((h: any) => /email/i.test(String(h).trim()));
  const userIdx = headers.findIndex((h: any) => /^user$|^username$|^user\s*name$/i.test(String(h).trim().toLowerCase()));
  const idx = {
    name: headers.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim())),
    email: emailIdx !== -1 ? emailIdx : headers.findIndex((h: any) => /email|user/i.test(String(h).trim())),
    username: userIdx !== -1 ? userIdx : -1,
    pos: headers.findIndex((h: any) => /position|jabatan/i.test(String(h).trim())),
    prov: headers.findIndex((h: any) => /province|provinsi/i.test(String(h).trim())),
    area: headers.findIndex((h: any) => /area/i.test(String(h).trim())),
    upline: headers.findIndex((h: any) => /upline|spv|supervisor|atasan|manager/i.test(String(h).trim())),
    password: headers.findIndex((h: any) => /password|pass/i.test(String(h).trim())),
    level: headers.findIndex((h: any) => /level|grade/i.test(String(h).trim())),
    group: headers.findIndex((h: any) => /group|tim|divisi|division/i.test(String(h).trim())),
    status: headers.findIndex((h: any) => /status|aktif|active/i.test(String(h).trim())),
  };

  const result = data
    .slice(1)
    .filter((row) => row[idx.name] !== "" && row[idx.name] !== undefined)
    .map((row) => {
      const p = idx.pos !== -1 ? row[idx.pos] : "Business Solution";
      return {
        name: idx.name !== -1 ? String(row[idx.name] || "").trim() : "",
        email: idx.email !== -1 ? String(row[idx.email] || "").trim() : "",
        user: idx.username !== -1 ? String(row[idx.username] || "").trim() : "",
        position: normalizePosition(p),
        province: idx.prov !== -1 ? String(row[idx.prov] || "").trim() : "-",
        area: idx.area !== -1 ? String(row[idx.area] || "").trim() : "-",
        upline: idx.upline !== -1 ? String(row[idx.upline] || "").trim() : "",
        password: idx.password !== -1 ? String(row[idx.password] || "").trim() : "",
        level: idx.level !== -1 && row[idx.level] !== "" && row[idx.level] !== undefined ? row[idx.level] : null,
        group: idx.group !== -1 ? String(row[idx.group] || "").trim() : "",
        status: idx.status !== -1 ? String(row[idx.status] || "").trim() : "Aktif",
      };
    });

  const seenEmployees = new Set<string>();
  const dedupedResult: any[] = [];
  for (const emp of result) {
    const cleanName = String(emp.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seenEmployees.has(cleanName) && cleanName !== "") {
      seenEmployees.add(cleanName);
      dedupedResult.push(emp);
    }
  }

  return { status: "success", data: dedupedResult };
}
