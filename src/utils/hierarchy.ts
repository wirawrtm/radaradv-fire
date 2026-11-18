import { cleanForMatch, matchNames } from "./formatters";

export const getResolvedRole = (pos: any): string => {
  if (!pos) return "";
  const cleaned = cleanForMatch(pos);
  if (cleaned.includes("businessanalyst") || cleaned.includes("ba")) {
    return "Business Analyst";
  }
  if (cleaned.includes("vegetablessalesmanager") || cleaned.includes("vsm")) {
    return "Vegetables Sales Manager";
  }
  if (cleaned.includes("commerciallead") || cleaned.includes("cl")) {
    return "Commercial Lead";
  }
  if (cleaned.includes("countryhead") || cleaned.includes("ch")) {
    return "Country Head";
  }
  if (cleaned.includes("areasalesmanager") || cleaned.includes("asm")) {
    return "Area Sales Manager";
  }
  if (cleaned.includes("salesagronomist") || cleaned.includes("sa")) {
    return "Sales Agronomist";
  }
  if (cleaned.includes("businesssolution") || cleaned.includes("bs")) {
    return "Business Solution";
  }
  return pos;
};

export const normalizePosition = (pos: string | undefined): string => {
  if (!pos) return "Unknown";
  const clean = cleanForMatch(pos);
  if (clean === "businessanalyst" || clean === "analyst")
    return "Business Analyst";
  if (clean === "areasalesmanager" || clean === "asm")
    return "Area Sales Manager";
  if (clean === "vegetablessalesmanager" || clean === "vsm")
    return "Vegetables Sales Manager";
  if (clean === "salesmanager" || clean === "sm") return "Sales Manager";
  if (clean === "salesagronomist" || clean === "sa") return "Sales Agronomist";
  if (clean === "businesssolution" || clean === "bs")
    return "Business Solution";
  if (clean === "countryhead") return "Country Head";
  if (clean === "commerciallead") return "Commercial Lead";

  if (clean.includes("businessanalyst")) return "Business Analyst";
  if (clean.includes("areasalesmanager") || clean.includes("asm"))
    return "Area Sales Manager";
  if (clean.includes("vegetablessalesmanager"))
    return "Vegetables Sales Manager";
  if (clean.includes("salesmanager") || clean.includes("sm"))
    return "Sales Manager";
  if (
    clean.includes("salesagronomist") ||
    clean.includes("sa") ||
    clean.includes("agronomist")
  )
    return "Sales Agronomist";
  if (clean.includes("businesssolution") || clean.includes("bs"))
    return "Business Solution";
  return pos;
};

export const getPositionRank = (pos: string | undefined): number => {
  const norm = normalizePosition(pos);
  if (norm === "Country Head") return 1;
  if (norm === "Commercial Lead") return 1;
  if (norm === "Business Analyst") return 1;
  if (norm === "Vegetables Sales Manager") return 2;
  if (norm === "Sales Manager") return 2;
  if (norm === "Area Sales Manager") return 3;
  if (norm === "Sales Agronomist") return 4;
  if (norm === "Business Solution") return 5;

  const normLower = norm.toLowerCase();
  if (
    normLower.includes("head") ||
    normLower.includes("director") ||
    normLower.includes("vp") ||
    normLower.includes("lead") ||
    normLower.includes("business analyst")
  ) {
    return 1;
  }
  if (normLower.includes("manager")) return 2;
  return 5;
};

export const parseLevelStr = (
  val: string | number | undefined | null,
): number => {
  if (val === undefined || val === null || val === "") return NaN;
  if (typeof val === "number") return val;
  const str = String(val).toUpperCase().trim();
  if (str === "ADMIN") return 4;
  const match = str.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  if (str.includes("IV")) return 4;
  if (str.includes("III")) return 3;
  if (str.includes("II")) return 2;
  if (str.includes("V")) return 5;
  if (str.includes("I")) return 1;
  return NaN;
};

export const checkIsBusinessAnalyst = (userData: any): boolean => {
  if (!userData) return false;
  const posClean = userData.position ? cleanForMatch(userData.position) : "";
  const nameClean = cleanForMatch(userData.name || "");
  const userClean = cleanForMatch(userData.user || "");
  const numLevel = userData.level
    ? parseInt(String(userData.level).trim(), 10)
    : NaN;
  const isAdmin =
    Boolean(userData.level) &&
    String(userData.level).toLowerCase().trim() === "admin";

  return (
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
    isAdmin
  );
};

export const isAdityaUser = (userObj: any): boolean => {
  if (!userObj) return false;
  const nameClean = cleanForMatch(userObj.name || "");
  const userClean = cleanForMatch(userObj.user || "");
  return (
    nameClean === "adityawiratama" ||
    nameClean === "aditya" ||
    userClean === "aditya" ||
    userClean === "adityawiratama"
  );
};

export const getFromRecord = <T,>(
  record: Record<string, T>,
  key: string | undefined,
): T | undefined => {
  if (!key) return undefined;
  const cleanKey = cleanForMatch(key);
  let foundKey = Object.keys(record).find((k) => cleanForMatch(k) === cleanKey);
  if (!foundKey) {
    foundKey = Object.keys(record).find((k) => matchNames(k, key));
  }
  return foundKey ? record[foundKey] : undefined;
};

export const getMemberLevel = (
  name: string,
  teamLevels: Record<string, number>,
  teamPositions: Record<string, string>,
  userData: any,
): number => {
  const cleanName = cleanForMatch(name);

  if (cleanName === cleanForMatch(userData?.name)) {
    if (
      userData?.level !== undefined &&
      userData.level !== null &&
      String(userData.level).trim() !== ""
    ) {
      const parsed = parseLevelStr(userData.level);
      if (!isNaN(parsed)) return parsed;
    }
  }

  const lvl = getFromRecord(teamLevels, name);
  if (lvl !== undefined && lvl !== null && !isNaN(lvl)) {
    return lvl;
  }

  const p =
    getFromRecord(teamPositions, name) ||
    (cleanName === cleanForMatch(userData?.name) ? userData?.position : "");
  const rank = getPositionRank(p);
  if (rank === 1) return 5;
  if (rank === 2) return 4;
  if (rank === 3) return 3;
  if (rank === 4) return 2;
  if (rank === 5) return 1;
  return 0;
};

export const compareMembersByLevel = (
  a: string,
  b: string,
  teamLevels: Record<string, number>,
  teamPositions: Record<string, string>,
  userData: any,
): number => {
  const lvlA = getMemberLevel(a, teamLevels, teamPositions, userData);
  const lvlB = getMemberLevel(b, teamLevels, teamPositions, userData);
  if (lvlA !== lvlB) {
    return lvlB - lvlA;
  }
  return a.localeCompare(b);
};

export const getUplineInTeam = (
  member: string,
  teamMembers: string[],
  teamUpLines: Record<string, string>,
): string | null => {
  const cleanMember = cleanForMatch(member);

  let currentUpline = getFromRecord(teamUpLines, member);
  const seen = new Set<string>([cleanMember]);
  while (currentUpline && currentUpline.trim() !== "") {
    const cleanUp = cleanForMatch(currentUpline);
    if (seen.has(cleanUp)) break;
    seen.add(cleanUp);

    let found = teamMembers.find((tm) => cleanForMatch(tm) === cleanUp);
    if (!found) {
      found = teamMembers.find((tm) => matchNames(tm, currentUpline));
    }
    if (found) {
      return found;
    }
    currentUpline = getFromRecord(teamUpLines, currentUpline);
  }

  return null;
};

const depthMapCache = new Map<string, Record<string, number>>();

export const buildDepthMap = (
  rootName: string,
  teamProfiles: Record<string, any>,
): Record<string, number> => {
  const cacheKey = `${rootName}_${Object.keys(teamProfiles || {}).length}`;
  if (depthMapCache.has(cacheKey)) {
    return depthMapCache.get(cacheKey)!;
  }
  const depths: Record<string, number> = {};
  const cleanRoot = cleanForMatch(rootName);

  let realRootName = rootName;
  const foundProfileKey = Object.keys(teamProfiles).find(
    (k) =>
      cleanForMatch(k) === cleanRoot ||
      (teamProfiles[k]?.email &&
        cleanForMatch(teamProfiles[k].email) === cleanRoot),
  );
  if (foundProfileKey) {
    realRootName = foundProfileKey;
  }
  const cleanRealRoot = cleanForMatch(realRootName);

  depths[cleanRealRoot] = 0;
  if (cleanRoot !== cleanRealRoot) {
    depths[cleanRoot] = 0;
  }

  const queue: string[] = [cleanRealRoot];
  const visited = new Set<string>([cleanRealRoot]);

  while (queue.length > 0) {
    const currentClean = queue.shift()!;
    const currentDepth = depths[currentClean];

    Object.entries(teamProfiles).forEach(([name, p]: [string, any]) => {
      const cleanName = cleanForMatch(name);
      if (cleanName === cleanRealRoot || cleanName === cleanRoot) return;
      const cleanUpline = cleanForMatch(p.upline || "");
      if (cleanUpline === currentClean && !visited.has(cleanName)) {
        visited.add(cleanName);
        depths[cleanName] = currentDepth + 1;
        queue.push(cleanName);
      }
    });
  }

  Object.entries(teamProfiles).forEach(([name]) => {
    const cleanName = cleanForMatch(name);
    if (depths[cleanName] === undefined) {
      let current = cleanName;
      const climbVisited = new Set<string>();
      const path: string[] = [];
      while (
        current &&
        current !== cleanRealRoot &&
        current !== cleanRoot &&
        !climbVisited.has(current)
      ) {
        climbVisited.add(current);
        path.push(current);
        const currentProfile = Object.values(teamProfiles).find(
          (prof: any) => cleanForMatch(prof.name) === current,
        ) as any;
        if (currentProfile && currentProfile.upline) {
          current = cleanForMatch(currentProfile.upline);
        } else {
          break;
        }
      }
      if (current === cleanRealRoot || current === cleanRoot) {
        for (let i = 0; i < path.length; i++) {
          const node = path[i];
          depths[node] = path.length - i;
        }
      } else {
        depths[cleanName] = 99;
      }
    }
  });

  depthMapCache.set(cacheKey, depths);
  return depths;
};

const getDdaOfUserCache = new Map<string, string>();

export const getDdaOfUser = (
  picName: string,
  rootName: string | undefined,
  teamProfiles: Record<string, any> | undefined,
): string => {
  if (!rootName || !teamProfiles) return picName;
  const cleanPic = cleanForMatch(picName);
  const cleanRoot = cleanForMatch(rootName);
  if (!cleanPic || cleanPic === "unknown") return picName;

  const cacheKey = `${cleanPic}_${cleanRoot}_${Object.keys(teamProfiles).length}`;
  if (getDdaOfUserCache.has(cacheKey)) {
    return getDdaOfUserCache.get(cacheKey)!;
  }

  const calculate = (): string => {
    let realRootName = rootName;
    const foundProfileKey = Object.keys(teamProfiles).find(
      (k) =>
        cleanForMatch(k) === cleanRoot ||
        (teamProfiles[k]?.email &&
          cleanForMatch(teamProfiles[k].email) === cleanRoot),
    );
    if (foundProfileKey) {
      realRootName = foundProfileKey;
    }
    const cleanRealRoot = cleanForMatch(realRootName);

    const rootProfile = Object.values(teamProfiles).find(
      (p: any) => cleanForMatch(p.name) === cleanRealRoot,
    ) as any;
    const rootPos = rootProfile?.position || "";
    const rootLevelClean = rootProfile?.level
      ? String(rootProfile.level).toLowerCase().trim()
      : "";
    const rootNumLevel = parseInt(rootLevelClean, 10);
    const isBusinessAnalyst =
      cleanForMatch(rootPos) === "businessanalyst" ||
      cleanForMatch(rootPos) === "analyst" ||
      cleanRealRoot === "adityawiratama" ||
      cleanRoot === "adityawiratama" ||
      cleanRealRoot === "aditya" ||
      cleanRoot === "aditya" ||
      cleanRealRoot === "suryanto" ||
      cleanRoot === "suryanto" ||
      cleanRealRoot === "suryantobudisantoso" ||
      cleanRoot === "suryantobudisantoso" ||
      cleanRealRoot === "suryantohead" ||
      cleanRoot === "suryantohead" ||
      cleanForMatch(rootPos) === "vegetablessalesmanager" ||
      cleanForMatch(rootPos) === "commerciallead" ||
      cleanForMatch(rootPos) === "countryhead" ||
      (!isNaN(rootNumLevel) && rootNumLevel >= 4) ||
      rootLevelClean === "admin";

    if (isBusinessAnalyst) {
      return picName;
    }

    const maxThreshold = 5;
    const depths = { ...buildDepthMap(realRootName, teamProfiles) };
    depths[cleanRoot] = 0;

    if ((depths[cleanPic] ?? 99) <= maxThreshold) {
      const matched = Object.keys(teamProfiles).find(
        (k) => cleanForMatch(k) === cleanPic,
      );
      return (matched && teamProfiles[matched]?.name) || picName;
    }

    let current = cleanPic;
    const visited = new Set<string>();

    while (current && current !== cleanRealRoot && current !== cleanRoot) {
      if (visited.has(current)) break;
      visited.add(current);

      const profile = Object.values(teamProfiles).find(
        (p: any) => cleanForMatch(p.name) === current,
      ) as any;
      if (!profile || !profile.upline) break;

      const parentClean = cleanForMatch(profile.upline);
      const parentDepth = depths[parentClean] ?? 99;

      if (parentDepth <= maxThreshold) {
        const matched = Object.keys(teamProfiles).find(
          (k) => cleanForMatch(k) === parentClean,
        );
        return (matched && teamProfiles[matched]?.name) || profile.upline;
      }

      current = parentClean;
    }

    return picName;
  };

  const result = calculate();
  getDdaOfUserCache.set(cacheKey, result);
  return result;
};

export const getResolvedPic = (
  _kiosk: any,
  pic: any,
  user: any,
  _lot: any,
  picFromItem: any,
): string => {
  if (
    user &&
    String(user).trim() !== "" &&
    String(user).trim().toLowerCase() !== "unknown"
  ) {
    return String(user);
  }
  if (
    picFromItem &&
    String(picFromItem).trim() !== "" &&
    String(picFromItem).trim().toLowerCase() !== "unknown"
  ) {
    return String(picFromItem);
  }
  return String(pic || "Unknown");
};
