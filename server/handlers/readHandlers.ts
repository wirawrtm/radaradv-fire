import {
  MONTH_SHORT_NAMES,
  extractExpFromLot,
  formatMyDate,
  getJakartaDate,
  getMonthIndices,
  getUpdMonthIndices,
  normalizePosition,
  safeParseFloat,
  cleanForMatch,
} from "../utils";
import { appendSheetRow, getSheetValues } from "../sheetsDb";
import { findEmployeeRow, handleGetEmployees, handleGetUserProfile } from "../employeeUtils";

export async function handleGetWorkingData(_user: string) {
  const data = await getSheetValues("working");
  if (!data || data.length <= 1) return { status: "success", data: [] };
  const headers = data[0];
  const getIdx = (patterns: RegExp) => headers.findIndex((h) => patterns.test(String(h).trim()));
  const idx = {
    lot: getIdx(/^lot package$|^lot$/i),
    hybrid: getIdx(/^hybrid$|^material$/i),
    stock: getIdx(/^quantity \(kg\)|^qty$|^stock$|^kg$/i),
    aging: getIdx(/aging/i),
    exp: getIdx(/exp|expired|ed/i),
    kiosk: getIdx(/^channel$|^kiosk$/i),
    cat: getIdx(/category|kategori|klasifikasi|^cat/i),
    crops: getIdx(/^crops$/i),
    time: getIdx(/^tgl$|^tanggal$|^waktu$|^date$|^timestamp$/i),
    cond: getIdx(/^condition$|^kondisi$/i),
    dr: getIdx(/shipping|dr.*date|dr_date|^dr$/i),
    user: getIdx(/^name checker$|^nama checker$|^user$|^pic$|^checker$/i),
    pog: getIdx(/^pog$|^selisih$/i),
    area: getIdx(/^area$|^region$/i),
  };
  const monthIndices = getMonthIndices(headers);
  const updMonthIndices = getUpdMonthIndices(headers);

  const result = data
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .filter(({ row }) => {
      const kioskVal = idx.kiosk !== -1 ? row[idx.kiosk] : undefined;
      const userVal = idx.user !== -1 ? row[idx.user] : undefined;
      const lotVal = idx.lot !== -1 ? row[idx.lot] : undefined;
      return (
        row.length > 0 &&
        ((kioskVal !== undefined && kioskVal !== "") ||
          (userVal !== undefined && userVal !== "") ||
          (lotVal !== undefined && lotVal !== ""))
      );
    })
    .map(({ row, rowNumber }) => {
      const rowItem: any = {
        rowNumber,
        lot: idx.lot !== -1 ? row[idx.lot] : "",
        hybrid: idx.hybrid !== -1 ? row[idx.hybrid] : "",
        crops:
          idx.crops !== -1 && row[idx.crops] !== "" && row[idx.crops] !== undefined
            ? row[idx.crops]
            : "Uncategorized Crops",
        stock:
          idx.stock !== -1 && row[idx.stock] !== "" && row[idx.stock] !== undefined
            ? safeParseFloat(row[idx.stock])
            : 0,
        aging:
          idx.aging !== -1 && row[idx.aging] !== "" && row[idx.aging] !== undefined
            ? row[idx.aging]
            : "-",
        expired: (() => {
          const rawExp = idx.exp !== -1 && row[idx.exp] ? formatMyDate(row[idx.exp]) : "N/A";
          if (rawExp !== "N/A" && rawExp !== "-") return rawExp;
          const lotStr = idx.lot !== -1 ? String(row[idx.lot] || "").trim() : "";
          return lotStr ? extractExpFromLot(lotStr) : "N/A";
        })(),
        drDate: idx.dr !== -1 && row[idx.dr] ? formatMyDate(row[idx.dr]) : "N/A",
        kiosk: idx.kiosk !== -1 ? row[idx.kiosk] : "",
        category:
          idx.cat !== -1 && row[idx.cat] !== "" && row[idx.cat] !== undefined
            ? String(row[idx.cat]).trim()
            : "",
        timestamp: idx.time !== -1 && row[idx.time] ? row[idx.time] : "",
        condition: idx.cond !== -1 && row[idx.cond] ? row[idx.cond] : "tetap",
        user: idx.user !== -1 && row[idx.user] ? String(row[idx.user]).trim() : "",
        pog:
          idx.pog !== -1 && row[idx.pog] !== "" && row[idx.pog] !== undefined
            ? safeParseFloat(row[idx.pog])
            : 0,
        area:
          idx.area !== -1 && row[idx.area] !== "" && row[idx.area] !== undefined
            ? String(row[idx.area]).trim()
            : "",
      };

      MONTH_SHORT_NAMES.forEach((m, mIdx) => {
        const key = m.toLowerCase();
        const colIdx = monthIndices[mIdx];
        rowItem[key] =
          colIdx !== -1 && colIdx < row.length && row[colIdx] !== "" && row[colIdx] !== undefined
            ? safeParseFloat(row[colIdx])
            : 0;

        const updColIdx = updMonthIndices[mIdx];
        rowItem["upd_" + key] =
          updColIdx !== -1 && updColIdx < row.length && row[updColIdx] !== "" && row[updColIdx] !== undefined
            ? String(row[updColIdx]).trim()
            : "";
      });
      return rowItem;
    });

  return { status: "success", data: result };
}

export async function handleGetChannels(user: string) {
  const data = await getSheetValues("channel");
  if (!data || data.length <= 1) return { status: "success", data: [] };
  const lowerUser = String(user).trim().toLowerCase();

  const empData = await getSheetValues("employee");
  const authorizedPICs = [lowerUser];
  let isBusinessAnalyst =
    lowerUser === "adityawiratama" ||
    lowerUser.includes("adityawiratama") ||
    lowerUser === "analyst" ||
    lowerUser === "businessanalyst";

  if (empData && empData.length > 0) {
    const empHeaders = empData[0];
    const idxE = {
      name: empHeaders.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim())),
      email: empHeaders.findIndex((h: any) => /email|user/i.test(String(h).trim())),
      upline: empHeaders.findIndex((h: any) => /upline|spv|supervisor|atasan|manager/i.test(String(h).trim())),
      pos: empHeaders.findIndex((h: any) => /position|jabatan/i.test(String(h).trim())),
    };

    const matchedRow = findEmployeeRow(user, empData);
    const userAliases = new Set([lowerUser]);

    if (matchedRow) {
      const emailIdx = empHeaders.findIndex((h: any) => /email/i.test(String(h).trim()));
      const userIdx = empHeaders.findIndex((h: any) => /^user$|^username$|^user\s*name$/i.test(String(h).trim().toLowerCase()));
      const rowName = idxE.name !== -1 ? String(matchedRow[idxE.name] || "").trim().toLowerCase() : "";
      const rowEmail = emailIdx !== -1 ? String(matchedRow[emailIdx] || "").trim().toLowerCase() : "";
      const rowUser = userIdx !== -1 ? String(matchedRow[userIdx] || "").trim().toLowerCase() : "";
      const rowPos = idxE.pos !== -1 ? String(matchedRow[idxE.pos] || "").trim().toLowerCase() : "";

      if (rowName !== "") userAliases.add(rowName);
      if (rowEmail !== "") userAliases.add(rowEmail);
      if (rowUser !== "") userAliases.add(rowUser);

      const cleanRowPos = rowPos.replace(/\s+/g, "");
      const levelIdx = empHeaders.findIndex((h: any) => /level|grade/i.test(String(h).trim()));
      const rowLevel = levelIdx !== -1 ? String(matchedRow[levelIdx] || "").trim().toLowerCase() : "";
      const numLevel = parseInt(rowLevel, 10);
      if (
        cleanRowPos === "businessanalyst" ||
        cleanRowPos === "analyst" ||
        cleanRowPos === "vegetablessalesmanager" ||
        cleanRowPos === "commerciallead" ||
        cleanRowPos === "countryhead" ||
        lowerUser === "suryantohead" ||
        lowerUser === "daniheadoffice" ||
        lowerUser === "yashheadoffice" ||
        (!isNaN(numLevel) && numLevel >= 4) ||
        rowLevel === "admin"
      ) {
        isBusinessAnalyst = true;
      }
    }

    if (isBusinessAnalyst) {
      const emailIdx = empHeaders.findIndex((h: any) => /email/i.test(String(h).trim()));
      const userIdx = empHeaders.findIndex((h: any) => /^user$|^username$|^user\s*name$/i.test(String(h).trim().toLowerCase()));
      const groupIdx = empHeaders.findIndex((h: any) => /group|tim|divisi|division/i.test(String(h).trim()));
      const levelIdx = empHeaders.findIndex((h: any) => /level|grade/i.test(String(h).trim()));

      let adminGroup = "";
      if (matchedRow && levelIdx !== -1 && groupIdx !== -1) {
        const rowLevel = String(matchedRow[levelIdx] || "").trim().toLowerCase();
        if (rowLevel === "admin") {
          adminGroup = String(matchedRow[groupIdx] || "").trim().toLowerCase();
        }
      }

      empData.slice(1).forEach((row) => {
        const rowGroup = groupIdx !== -1 ? String(row[groupIdx] || "").trim().toLowerCase() : "";
        const rowName = idxE.name !== -1 ? String(row[idxE.name] || "").trim().toLowerCase() : "";
        const rowEmail = emailIdx !== -1 ? String(row[emailIdx] || "").trim().toLowerCase() : "";
        const rowUser = userIdx !== -1 ? String(row[userIdx] || "").trim().toLowerCase() : "";

        if (adminGroup && adminGroup !== "all" && adminGroup !== "") {
          if (rowGroup !== adminGroup && rowName !== lowerUser && rowEmail !== lowerUser && rowUser !== lowerUser) {
            return;
          }
        }

        if (rowName !== "") userAliases.add(rowName);
        if (rowEmail !== "") userAliases.add(rowEmail);
        if (rowUser !== "") userAliases.add(rowUser);
      });
    }

    const queue = Array.from(userAliases);
    const visited = new Set(queue);
    userAliases.forEach((alias) => {
      if (!authorizedPICs.includes(alias)) authorizedPICs.push(alias);
    });

    while (queue.length > 0) {
      const currentUpline = queue.shift();
      empData.slice(1).forEach((row) => {
        const empNameLower = idxE.name !== -1 ? String(row[idxE.name] || "").trim().toLowerCase() : "";
        const empEmailLower = idxE.email !== -1 ? String(row[idxE.email] || "").trim().toLowerCase() : "";
        const empUplineLower = idxE.upline !== -1 ? String(row[idxE.upline] || "").trim().toLowerCase() : "";

        if (empUplineLower !== "") {
          const isMatch =
            empUplineLower === currentUpline ||
            empUplineLower.includes(currentUpline!) ||
            currentUpline!.includes(empUplineLower);
          if (isMatch) {
            if (empNameLower !== "" && !visited.has(empNameLower)) {
              visited.add(empNameLower);
              queue.push(empNameLower);
              if (!authorizedPICs.includes(empNameLower)) authorizedPICs.push(empNameLower);
            }
            if (empEmailLower !== "" && !visited.has(empEmailLower)) {
              visited.add(empEmailLower);
              queue.push(empEmailLower);
              if (!authorizedPICs.includes(empEmailLower)) authorizedPICs.push(empEmailLower);
            }
          }
        }
      });
    }
  }

  const headers = data[0];
  const idx = {
    pic: headers.findIndex((h: any) => /pic|user|nama|analyst|solution/i.test(String(h).trim())),
    channel: headers.findIndex((h: any) => /channel|kiosk|nama toko|toko|name|distributor|partner|mitra|customer|customers/i.test(String(h).trim())),
    cat: headers.findIndex((h: any) => /kategori|category|klasifikasi|^cat$/i.test(String(h).trim())),
    upline: headers.findIndex((h: any) => /upline|spv|supervisor/i.test(String(h).trim())),
    area: headers.findIndex((h: any) => /area|provinsi|province|wilayah/i.test(String(h).trim())),
    group: headers.findIndex((h: any) => /group|tim|divisi|division/i.test(String(h).trim())),
  };

  const picToAreaMap: Record<string, string> = {};
  if (empData && empData.length > 1) {
    const empHeadersVal = empData[0];
    const nameCol = empHeadersVal.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim()));
    const emailCol = empHeadersVal.findIndex((h: any) => /email|user/i.test(String(h).trim()));
    const areaCol = empHeadersVal.findIndex((h: any) => /area/i.test(String(h).trim()));
    const provCol = empHeadersVal.findIndex((h: any) => /province|provinsi/i.test(String(h).trim()));

    empData.slice(1).forEach((empRow) => {
      const empName = nameCol !== -1 ? String(empRow[nameCol] || "").trim().toLowerCase() : "";
      const empEmail = emailCol !== -1 ? String(empRow[emailCol] || "").trim().toLowerCase() : "";
      const empArea =
        areaCol !== -1 && empRow[areaCol] !== "" && empRow[areaCol] !== undefined
          ? String(empRow[areaCol]).trim()
          : provCol !== -1 && empRow[provCol] !== "" && empRow[provCol] !== undefined
            ? String(empRow[provCol]).trim()
            : "";
      if (empArea) {
        if (empName) picToAreaMap[empName] = empArea;
        if (empEmail) picToAreaMap[empEmail] = empArea;
      }
    });
  }

  const channels = data
    .slice(1)
    .map((row, i) => {
      if (row[0] === "" || row[0] === undefined) return null;
      const catValue = idx.cat !== -1 && row[idx.cat] !== "" && row[idx.cat] !== undefined ? String(row[idx.cat]).trim() : "";
      const rowGroup = idx.group !== -1 && row[idx.group] !== "" && row[idx.group] !== undefined ? String(row[idx.group]).trim() : "";
      if (idx.pic !== -1 && idx.channel !== -1) {
        const picLower = String(row[idx.pic] || "").trim().toLowerCase();
        const uplineLower = idx.upline !== -1 ? String(row[idx.upline] || "").trim().toLowerCase() : "";

        const isAuth =
          isBusinessAnalyst ||
          picLower === "" ||
          picLower === "tanpa pic" ||
          picLower === "tidak ada" ||
          picLower === lowerUser ||
          (lowerUser !== "" && picLower.includes(lowerUser)) ||
          uplineLower === lowerUser ||
          (lowerUser !== "" && uplineLower.includes(lowerUser)) ||
          authorizedPICs.some((auth) => picLower === auth || (auth !== "" && picLower.includes(auth)));

        if (isAuth) {
          const sheetArea = idx.area !== -1 && row[idx.area] !== "" && row[idx.area] !== undefined ? String(row[idx.area]).trim() : "";
          return {
            id: i + 2,
            name: row[idx.channel],
            category: catValue,
            pic: String(row[idx.pic] || "").trim(),
            upline: idx.upline !== -1 ? String(row[idx.upline] || "").trim() : "",
            area: sheetArea || picToAreaMap[picLower] || "-",
            group: rowGroup,
          };
        }
      } else if (idx.channel !== -1) {
        const sheetArea = idx.area !== -1 && row[idx.area] !== "" && row[idx.area] !== undefined ? String(row[idx.area]).trim() : "";
        return {
          id: i + 2,
          name: row[idx.channel],
          category: catValue,
          pic: "",
          upline: "",
          area: sheetArea || "-",
          group: rowGroup,
        };
      }
      return null;
    })
    .filter(Boolean);

  return { status: "success", data: channels };
}

async function getHybridMap(): Promise<Record<string, { hybrid: string; crops: string }>> {
  const hybridMap: Record<string, { hybrid: string; crops: string }> = {};
  const hData = await getSheetValues("hybrid");
  if (hData && hData.length > 1) {
    const hHeaders = hData[0];
    const idxH = {
      desc: hHeaders.findIndex((h: any) => /material.*desc|description/i.test(String(h).trim())),
      hybrid: hHeaders.findIndex((h: any) => /^hybrid$/i.test(String(h).trim())),
      crops: hHeaders.findIndex((h: any) => /^crops$/i.test(String(h).trim())),
    };
    if (idxH.desc !== -1 && idxH.hybrid !== -1) {
      hData.slice(1).forEach((row) => {
        const mDesc = String(row[idxH.desc] || "").trim().toLowerCase();
        if (mDesc) {
          hybridMap[mDesc] = {
            hybrid: String(row[idxH.hybrid] || "").trim(),
            crops: idxH.crops !== -1 && row[idxH.crops] !== undefined ? String(row[idxH.crops]).trim() : "",
          };
        }
      });
    }
  }
  return hybridMap;
}

export async function handleGetDrSalesData(_user: string) {
  const [hybridMap, data] = await Promise.all([getHybridMap(), getSheetValues("dr")]);
  if (!data || data.length <= 1) return { status: "success", data: [] };
  const headers = data[0];

  const hIdx = {
    qty: headers.findIndex((h: any) => /qty|quantity/i.test(String(h).trim())),
    type: headers.findIndex((h: any) => /type|jenis/i.test(String(h).trim())),
    channel: headers.findIndex((h: any) => /channel|kiosk|nama toko|toko|name|distributor|partner|mitra|customer|customers/i.test(String(h).trim())),
    lot: headers.findIndex((h: any) => /lot/i.test(String(h).trim())),
    desc: headers.findIndex((h: any) => /material.*desc|description/i.test(String(h).trim())),
    dr: headers.findIndex((h: any) => /dr date|shipping date/i.test(String(h).trim())),
    exp: headers.findIndex((h: any) => /exp date|expired/i.test(String(h).trim())),
  };

  const result = data
    .slice(1)
    .filter((row) => {
      if (hIdx.type === -1) return true;
      const t = String(row[hIdx.type] || "").trim().toLowerCase();
      return !t || t.includes("sales") || t.includes("so") || t === "s";
    })
    .map((row) => {
      const rawDesc = hIdx.desc !== -1 ? String(row[hIdx.desc] || "").trim() : "";
      const mapInfo = hybridMap[rawDesc.toLowerCase()] || { hybrid: rawDesc, crops: "" };
      const lotValStr = hIdx.lot !== -1 ? String(row[hIdx.lot] || "").trim().toUpperCase() : "";
      const drValue = hIdx.dr !== -1 && row[hIdx.dr] ? formatMyDate(row[hIdx.dr]) : "N/A";
      let expValue = hIdx.exp !== -1 && row[hIdx.exp] ? formatMyDate(row[hIdx.exp]) : "N/A";
      if ((expValue === "N/A" || expValue === "-") && lotValStr) {
        expValue = extractExpFromLot(lotValStr);
      }
      return {
        lot: lotValStr,
        hybrid: mapInfo.hybrid,
        crops: mapInfo.crops,
        channel: hIdx.channel !== -1 ? String(row[hIdx.channel] || "").trim() : "",
        qty: hIdx.qty !== -1 ? safeParseFloat(row[hIdx.qty]) : 0,
        drDate: drValue,
        expired: expValue,
      };
    });

  return { status: "success", data: result };
}

export async function handleGetLotInfo(lotNo: string, kioskName?: string) {
  if (!lotNo) return { status: "error", message: "Lot number is required" };
  const targetLot = String(lotNo).trim().toUpperCase();
  const cleanTarget = targetLot.replace(/[^A-Z0-9]/g, "");
  const cleanKiosk = kioskName ? cleanForMatch(kioskName) : "";

  const [hybridMap, wData] = await Promise.all([getHybridMap(), getSheetValues("working")]);

  const todayDate = getJakartaDate();
  todayDate.setHours(0, 0, 0, 0);

  if (wData && wData.length > 1) {
    const headers = wData[0];
    const getIdx = (patterns: RegExp) => headers.findIndex((h) => patterns.test(String(h).trim()));
    const idxW = {
      lot: getIdx(/^lot package$|^lot$/i),
      hybrid: getIdx(/^hybrid$|^material$/i),
      crops: getIdx(/^crops$/i),
      drDate: getIdx(/^shipping date$|^dr date$|^shipping$|^dr/i),
      expDate: getIdx(/^exp date$|^expired$|^exp/i),
      aging: getIdx(/^aging \(month\)|^aging/i),
      kiosk: getIdx(/^channel$|^kiosk$|^toko$|^nama toko$/i),
    };
    if (idxW.lot !== -1) {
      let foundRow = wData.slice(1).find((row) => {
        const val = String(row[idxW.lot] || "").trim().toUpperCase();
        const rowKiosk = idxW.kiosk !== -1 ? String(row[idxW.kiosk] || "") : "";
        const matchesLot = val === targetLot || (cleanTarget && val.replace(/[^A-Z0-9]/g, "") === cleanTarget);
        return matchesLot && (!cleanKiosk || cleanForMatch(rowKiosk) === cleanKiosk);
      });
      if (!foundRow) {
        foundRow = wData.slice(1).find((row) => {
          const val = String(row[idxW.lot] || "").trim().toUpperCase();
          return val === targetLot || (cleanTarget && val.replace(/[^A-Z0-9]/g, "") === cleanTarget);
        });
      }
      if (foundRow) {
        let wExp = idxW.expDate !== -1 && foundRow[idxW.expDate] ? formatMyDate(foundRow[idxW.expDate]) : "N/A";
        if (wExp === "N/A" || wExp === "-") {
          wExp = extractExpFromLot(targetLot);
        }
        const wDr = idxW.drDate !== -1 && foundRow[idxW.drDate] ? formatMyDate(foundRow[idxW.drDate]) : "N/A";
        const rowKioskVal = idxW.kiosk !== -1 ? String(foundRow[idxW.kiosk] || "").trim() : "";
        return {
          status: "success",
          data: {
            desc: idxW.hybrid !== -1 ? String(foundRow[idxW.hybrid] || "").trim() : "",
            crops: idxW.crops !== -1 ? String(foundRow[idxW.crops] || "").trim() : "",
            drDate: wDr,
            expDate: wExp,
            aging: idxW.aging !== -1 ? String(foundRow[idxW.aging] || "").trim() : "-",
            channel: rowKioskVal,
          },
        };
      }
    }
  }

  const drData = await getSheetValues("dr");
  if (drData && drData.length > 1) {
    const headers = drData[0];
    const idx = {
      lot: headers.findIndex((h: any) => /lot/i.test(String(h).trim())),
      desc: headers.findIndex((h: any) => /material.*desc|description/i.test(String(h).trim())),
      dr: headers.findIndex((h: any) => /dr date|shipping date/i.test(String(h).trim())),
      customer: headers.findIndex((h: any) => /customer|channel|kiosk|toko|nama toko/i.test(String(h).trim())),
    };

    if (idx.lot !== -1) {
      let foundRow = drData.slice(1).find((row) => {
        const val = String(row[idx.lot] || "").trim().toUpperCase();
        const rowCust = idx.customer !== -1 ? String(row[idx.customer] || "") : "";
        const matchesLot = val === targetLot || (cleanTarget && val.replace(/[^A-Z0-9]/g, "") === cleanTarget);
        return matchesLot && (!cleanKiosk || cleanForMatch(rowCust) === cleanKiosk);
      });
      if (!foundRow) {
        foundRow = drData.slice(1).find((row) => {
          const val = String(row[idx.lot] || "").trim().toUpperCase();
          return val === targetLot || (cleanTarget && val.replace(/[^A-Z0-9]/g, "") === cleanTarget);
        });
      }
      if (foundRow) {
        const rawDesc = idx.desc !== -1 ? String(foundRow[idx.desc] || "").trim() : "Unknown Material";
        const mapInfo = hybridMap[rawDesc.toLowerCase()] || { hybrid: rawDesc, crops: "" };
        const drDateVal = idx.dr !== -1 ? foundRow[idx.dr] : "";
        const drExp = extractExpFromLot(targetLot);
        const rowCustVal = idx.customer !== -1 ? String(foundRow[idx.customer] || "").trim() : "";

        let agingVal: any = "";
        try {
          if (drDateVal) {
            const d1 = new Date(drDateVal);
            if (!isNaN(d1.getTime())) {
              agingVal = Math.round((todayDate.getTime() - d1.getTime()) / (1000 * 3600 * 24) / 30.416);
            }
          }
        } catch {
          agingVal = "";
        }

        return {
          status: "success",
          data: {
            desc: mapInfo.hybrid,
            crops: mapInfo.crops,
            drDate: idx.dr !== -1 ? formatMyDate(drDateVal) : "N/A",
            expDate: drExp,
            aging: agingVal,
            channel: rowCustVal,
          },
        };
      }
    }
  }

  return { status: "error", message: "Lot not found" };
}

export async function handleGetAccessRules() {
  try {
    const empData = await getSheetValues("employee");
    const uniquePositions: string[] = [];
    if (empData && empData.length > 1) {
      const headers = empData[0];
      const posIdx = headers.findIndex((h: any) => /position|jabatan/i.test(String(h).trim()));
      const nameIdx = headers.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim()));
      for (let i = 1; i < empData.length; i++) {
        const row = empData[i];
        if (nameIdx !== -1 && !row[nameIdx]) continue;
        const rawPos = posIdx !== -1 ? row[posIdx] : "";
        const normalized = normalizePosition(rawPos);
        if (normalized && !uniquePositions.includes(normalized)) {
          uniquePositions.push(normalized);
        }
      }
    }

    const defaults = [
      "Business Analyst",
      "Vegetables Sales Manager",
      "Area Sales Manager",
      "Sales Agronomist",
      "Business Solution",
    ];
    defaults.forEach((d) => {
      if (!uniquePositions.includes(d)) uniquePositions.push(d);
    });

    const data = await getSheetValues("access");
    const rules: Record<string, any> = {};
    const existingPositions: string[] = [];

    if (data && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const position = String(row[0]).trim();
        if (!position) continue;
        existingPositions.push(position);
        rules[position] = {
          home: row[1] === true || String(row[1]).toUpperCase() === "TRUE",
          partner: row[2] === true || String(row[2]).toUpperCase() === "TRUE",
          stock: row[3] === true || String(row[3]).toUpperCase() === "TRUE",
          pog: row[4] === true || String(row[4]).toUpperCase() === "TRUE",
          overview: row[5] === true || String(row[5]).toUpperCase() === "TRUE",
          temp: row[6] === true || String(row[6]).toUpperCase() === "TRUE",
          access: row[7] === true || String(row[7]).toUpperCase() === "TRUE",
        };
      }
    }

    const missingPositions = uniquePositions.filter((p) => !existingPositions.includes(p));
    for (const p of missingPositions) {
      const overview = p === "Business Analyst" ? "TRUE" : "FALSE";
      const temp = p === "Business Analyst" ? "TRUE" : "FALSE";
      const access = p === "Business Analyst" ? "TRUE" : "FALSE";
      const newRow = [p, "TRUE", "TRUE", "TRUE", "TRUE", overview, temp, access];
      await appendSheetRow("access", newRow);

      rules[p] = {
        home: true,
        partner: true,
        stock: true,
        pog: true,
        overview: overview === "TRUE",
        temp: temp === "TRUE",
        access: access === "TRUE",
      };
    }

    return { status: "success", data: rules };
  } catch (error: any) {
    return { status: "error", message: error.toString() };
  }
}

export async function handleGetInitialData(user: string) {
  try {
    const [
      profileJson,
      employeesJson,
      channelsJson,
      workingDataJson,
      drSalesDataJson,
      accessRulesJson,
    ] = await Promise.all([
      handleGetUserProfile(user),
      handleGetEmployees(),
      handleGetChannels(user),
      handleGetWorkingData(user),
      handleGetDrSalesData(user),
      handleGetAccessRules(),
    ]);

    return {
      status: "success",
      data: {
        profile: profileJson.status === "success" ? profileJson.data : null,
        employees: employeesJson.status === "success" ? employeesJson.data : [],
        channels: channelsJson.status === "success" ? channelsJson.data : [],
        workingData: workingDataJson.status === "success" ? workingDataJson.data : [],
        drSalesData: drSalesDataJson.status === "success" ? drSalesDataJson.data : [],
        accessRules: accessRulesJson.status === "success" ? accessRulesJson.data : {},
      },
    };
  } catch (error: any) {
    return { status: "error", message: error.toString() };
  }
}
