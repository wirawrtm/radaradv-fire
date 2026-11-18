import {
  buildChannelCategoryMap,
  cleanForMatch,
  colIndexInBounds,
  extractExpFromLot,
  formatMyDate,
  getGasCategory,
  getJakartaDate,
  getJakartaTimestamp,
  getMonthIndexFromDateString,
  getMonthIndices,
  getUpdMonthIndices,
  parseGasDate,
  safeParseFloat,
} from "../utils";
import { appendSheetRow, getSheetValues, updateSheetValues } from "../sheetsDb";
import { clearEmployeeCache, getUserProvince } from "../employeeUtils";

function ensureWorkingColumns(data: any[][]) {
  const headers = data[0];
  let hasTgl = false;
  let hasCat = false;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).trim().toLowerCase();
    if (h === "tgl" || h === "tanggal") hasTgl = true;
    if (h === "category" || h === "kategori") hasCat = true;
  }
  if (!hasTgl) headers.push("Tgl");
  if (!hasCat) headers.push("Category");

  let idxPog = headers.findIndex((h) => /^pog$|^selisih$/i.test(String(h).trim()));
  if (idxPog === -1) {
    headers.push("POG");
    idxPog = headers.length - 1;
  }

  for (let i = 1; i < data.length; i++) {
    while (data[i].length < headers.length) {
      data[i].push("");
    }
  }
  return { headers, idxPog };
}

function getWorkingIndices(headers: string[], idxPog: number) {
  const getIdx = (patterns: RegExp) => headers.findIndex((h) => patterns.test(String(h).trim()));
  const getIdxList = (patterns: RegExp) => {
    const indices: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (patterns.test(String(headers[i]).trim())) indices.push(i);
    }
    return indices;
  };
  return {
    timeCols: getIdxList(/^tgl$|^tanggal$|^waktu$|^date$|^timestamp$/i),
    catCols: getIdxList(/^category$|^kategori$|^klasifikasi$|^cat$/i),
    idx: {
      time: getIdx(/^tgl$|^tanggal$|^waktu$|^date$|^timestamp$/i),
      kiosk: getIdx(/^channel$|^kiosk$/i),
      cat: getIdx(/^category$|^kategori$|^klasifikasi$|^cat$/i),
      user: getIdx(/^name checker$|^nama checker$|^user$|^pic$|^checker$/i),
      lot: getIdx(/^lot package$|^lot$/i),
      qty: getIdx(/^quantity \(kg\)|^qty$|^stock$|^kg$/i),
      area: getIdx(/^area$|^region$/i),
      desc: getIdx(/^hybrid$|^material$/i),
      exp: getIdx(/exp|expired|ed/i),
      agingMonth: getIdx(/aging/i),
      cond: getIdx(/^condition$|^kondisi$/i),
      crops: getIdx(/^crops$/i),
      dr: getIdx(/shipping|dr.*date|dr_date|^dr$/i),
      agingExp: getIdx(/^aging to exp$/i),
      cluster: getIdx(/^cluster$/i),
      pog: idxPog,
    },
  };
}

function backfillRowsTimeAndCategory(
  data: any[][],
  timeCols: number[],
  catCols: number[],
  idxKiosk: number,
  channelCategoryMap: Record<string, string>,
  timestamp: string,
  overwriteAllCat: boolean,
) {
  let tglFilled = 0;
  let catFilled = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    let hasValidTime = false;
    timeCols.forEach((colIdx) => {
      if (row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== "") {
        hasValidTime = true;
      }
    });

    if (!hasValidTime) {
      timeCols.forEach((colIdx) => {
        row[colIdx] = timestamp;
        tglFilled++;
      });
    } else {
      let existingTimeVal = "";
      timeCols.forEach((colIdx) => {
        if (row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== "") {
          existingTimeVal = String(row[colIdx]).trim();
        }
      });
      timeCols.forEach((colIdx) => {
        if (row[colIdx] === undefined || row[colIdx] === null || String(row[colIdx]).trim() === "") {
          row[colIdx] = existingTimeVal;
          tglFilled++;
        }
      });
    }

    const kioskNameVal = idxKiosk !== -1 ? String(row[idxKiosk] || "").trim() : "";
    let existingCatVal = "";
    catCols.forEach((colIdx) => {
      if (
        row[colIdx] !== undefined &&
        row[colIdx] !== null &&
        String(row[colIdx]).trim() !== "" &&
        String(row[colIdx]).trim().toLowerCase() !== "uncategorized"
      ) {
        existingCatVal = String(row[colIdx]).trim();
      }
    });

    if (!existingCatVal) {
      existingCatVal = getGasCategory(kioskNameVal, channelCategoryMap) || "R1";
      catCols.forEach((colIdx) => {
        row[colIdx] = existingCatVal;
        catFilled++;
      });
    } else if (overwriteAllCat) {
      catCols.forEach((colIdx) => {
        row[colIdx] = existingCatVal;
      });
    } else {
      catCols.forEach((colIdx) => {
        if (row[colIdx] === undefined || row[colIdx] === null || String(row[colIdx]).trim() === "") {
          row[colIdx] = existingCatVal;
          catFilled++;
        }
      });
    }
  }

  return { tglFilled, catFilled };
}

function buildLotLookup(drData: any[][] | null): Record<string, { drDate: string; expDate: string }> {
  const lotLookup: Record<string, { drDate: string; expDate: string }> = {};
  if (drData && drData.length > 1) {
    const drHeaders = drData[0];
    const drIdx = {
      lot: drHeaders.findIndex((h: any) => /lot/i.test(String(h).trim())),
      dr: drHeaders.findIndex((h: any) => /dr date|shipping date/i.test(String(h).trim())),
      exp: drHeaders.findIndex((h: any) => /exp date|expired/i.test(String(h).trim())),
    };
    if (drIdx.lot !== -1) {
      for (let j = 1; j < drData.length; j++) {
        const drRow = drData[j];
        const lNo = String(drRow[drIdx.lot] || "").trim().toUpperCase();
        if (lNo && !lotLookup[lNo]) {
          lotLookup[lNo] = {
            drDate: drIdx.dr !== -1 && drRow[drIdx.dr] ? formatMyDate(drRow[drIdx.dr]) : "",
            expDate: drIdx.exp !== -1 && drRow[drIdx.exp] ? formatMyDate(drRow[drIdx.exp]) : "",
          };
        }
      }
    }
  }
  return lotLookup;
}

export async function handleBatchActivity(body: any) {
  const [data, channelData, empDataRaw, drDataRaw] = await Promise.all([
    getSheetValues("working"),
    getSheetValues("channel"),
    getSheetValues("employee"),
    getSheetValues("dr"),
  ]);
  if (!data) throw new Error("Sheet 'working' tidak ditemukan");

  const { headers, idxPog } = ensureWorkingColumns(data);
  const { timeCols, catCols, idx } = getWorkingIndices(headers, idxPog);
  const timestamp = getJakartaTimestamp();
  const channelCategoryMap = buildChannelCategoryMap(channelData || []);

  backfillRowsTimeAndCategory(data, timeCols, catCols, idx.kiosk, channelCategoryMap, timestamp, true);

  const monthIndices = getMonthIndices(headers);
  const updMonthIndices = getUpdMonthIndices(headers);

  const currentMonthRowsMap: Record<string, { index: number; date: Date }> = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const k = idx.kiosk !== -1 ? cleanForMatch(row[idx.kiosk]) : "";
    const l = idx.lot !== -1 ? cleanForMatch(row[idx.lot]) : "";
    const h = idx.desc !== -1 ? cleanForMatch(row[idx.desc]) : "";
    const u = idx.user !== -1 ? cleanForMatch(row[idx.user]) : "";
    const key = `${k}_${l}_${h}_${u}`;
    if (k && l) {
      const rowDate = idx.time !== -1 && row[idx.time] ? parseGasDate(row[idx.time]) : new Date(0);
      if (!currentMonthRowsMap[key] || rowDate.getTime() > currentMonthRowsMap[key].date.getTime()) {
        currentMonthRowsMap[key] = { index: i + 1, date: rowDate };
      }
    }
  }

  const empData = empDataRaw || [];
  const lotLookup = buildLotLookup(drDataRaw || []);

  if (body.items && body.items.length > 0) {
    for (const item of body.items) {
      const k = cleanForMatch(item.kiosk);
      const l = cleanForMatch(item.lot);
      const h = cleanForMatch(item.hybrid);
      const u = cleanForMatch(item.user || body.user);
      const key = `${k}_${l}_${h}_${u}`;
      const existingMatch = currentMonthRowsMap[key];
      const existingRow = existingMatch ? existingMatch.index : null;

      let agingExpVal = "";
      if (item.expired && item.expired !== "N/A") {
        const expD = new Date(item.expired);
        if (!isNaN(expD.getTime())) {
          const today = getJakartaDate();
          today.setHours(0, 0, 0, 0);
          agingExpVal = String(Math.round((expD.getTime() - today.getTime()) / (1000 * 3600 * 24) / 30.416));
        }
      }

      let clusterVal = "";
      if (item.aging && item.aging !== "-" && !isNaN(safeParseFloat(item.aging))) {
        const aVal = safeParseFloat(item.aging);
        if (aVal <= 2) clusterVal = "0-2";
        else if (aVal <= 4) clusterVal = "2-4";
        else if (aVal <= 6) clusterVal = "4-6";
        else if (aVal <= 9) clusterVal = "6-9";
        else if (aVal <= 12) clusterVal = "9-12";
        else clusterVal = ">12";
      }

      const itemMonthIdx = getMonthIndexFromDateString(timestamp);
      const monthColIdx = monthIndices[itemMonthIdx];

      let prevMonthStock = 0;
      if (existingRow) {
        const prevMonthIdx = (itemMonthIdx - 1 + 12) % 12;
        const prevMonthColIdx = monthIndices[prevMonthIdx];
        prevMonthStock =
          prevMonthColIdx !== -1 ? safeParseFloat(data[existingRow - 1][prevMonthColIdx]) : safeParseFloat(item.originalStock);
      } else {
        prevMonthStock = safeParseFloat(item.originalStock);
      }

      if (item.condition === "habis" || safeParseFloat(item.stock) === 0) {
        item.stock = 0;
      }
      const pogVal = prevMonthStock - safeParseFloat(item.stock);

      if (existingRow) {
        const rowIndex = existingRow - 1;
        if (monthColIdx !== -1) data[rowIndex][monthColIdx] = item.stock;
        const updMonthColIdx = updMonthIndices[itemMonthIdx];
        if (updMonthColIdx !== -1) data[rowIndex][updMonthColIdx] = "sales";

        if (idx.qty !== -1) data[rowIndex][idx.qty] = item.stock;
        if (idx.cond !== -1) data[rowIndex][idx.cond] = item.condition;
        timeCols.forEach((colIdx) => {
          data[rowIndex][colIdx] = timestamp;
        });

        if (idx.user !== -1) data[rowIndex][idx.user] = item.user || body.user;
        const resolvedArea = getUserProvince(item.user || body.user, empData) || body.area || "";
        if (idx.area !== -1 && resolvedArea) data[rowIndex][idx.area] = resolvedArea;
        if (idx.agingExp !== -1 && agingExpVal !== "") data[rowIndex][idx.agingExp] = agingExpVal;
        if (idx.cluster !== -1 && clusterVal !== "") data[rowIndex][idx.cluster] = clusterVal;

        const rowCatVal = getGasCategory(item.kiosk, channelCategoryMap, item.category || body.category);
        catCols.forEach((colIdx) => {
          data[rowIndex][colIdx] = rowCatVal;
        });
        if (idx.pog !== -1) data[rowIndex][idx.pog] = pogVal;
      } else {
        const newRow = new Array(headers.length).fill("");
        timeCols.forEach((colIdx) => {
          newRow[colIdx] = timestamp;
        });
        if (idx.kiosk !== -1) newRow[idx.kiosk] = item.kiosk;
        const rowCatVal = getGasCategory(item.kiosk, channelCategoryMap, item.category || body.category);
        catCols.forEach((colIdx) => {
          newRow[colIdx] = rowCatVal;
        });

        if (idx.user !== -1) newRow[idx.user] = item.user || body.user;
        if (idx.lot !== -1) newRow[idx.lot] = String(item.lot).toUpperCase();
        if (monthColIdx !== -1) newRow[monthColIdx] = item.stock;

        const updMonthColIdx = updMonthIndices[itemMonthIdx];
        if (updMonthColIdx !== -1) newRow[updMonthColIdx] = "sales";
        if (idx.qty !== -1) newRow[idx.qty] = item.stock;

        const resolvedArea = getUserProvince(item.user || body.user, empData) || body.area || "";
        if (idx.area !== -1) newRow[idx.area] = resolvedArea;
        if (idx.desc !== -1) newRow[idx.desc] = item.hybrid;
        if (idx.crops !== -1) newRow[idx.crops] = item.crops || "";

        const lotUpper = String(item.lot || "").trim().toUpperCase();
        let resolvedDr = item.drDate || "";
        let resolvedExp = item.expired || "";
        if (lotLookup[lotUpper]) {
          if (!resolvedDr || resolvedDr === "N/A") resolvedDr = lotLookup[lotUpper].drDate;
          if (!resolvedExp || resolvedExp === "N/A") resolvedExp = lotLookup[lotUpper].expDate;
        }
        if (!resolvedExp || resolvedExp === "N/A") resolvedExp = extractExpFromLot(lotUpper);

        if (idx.dr !== -1) newRow[idx.dr] = resolvedDr;
        if (idx.exp !== -1) newRow[idx.exp] = resolvedExp;
        if (idx.agingMonth !== -1) newRow[idx.agingMonth] = item.aging;
        if (idx.cond !== -1) newRow[idx.cond] = item.condition;
        if (idx.agingExp !== -1) newRow[idx.agingExp] = agingExpVal;
        if (idx.cluster !== -1) newRow[idx.cluster] = clusterVal;
        if (idx.pog !== -1) newRow[idx.pog] = pogVal;

        for (let m = 0; m < 12; m++) {
          const colIdx = monthIndices[m];
          if (colIdx !== -1 && colIdx !== monthColIdx) newRow[colIdx] = 0;
        }
        data.push(newRow);
      }
    }
    await updateSheetValues("working", data);
  }
  return { status: "success" };
}

export async function handleUpdateWorkingRowMonth(body: any) {
  const rowNumber = parseInt(body.rowNumber, 10);
  const targetMonthIdx = parseInt(body.targetMonth, 10);

  if (isNaN(rowNumber) || isNaN(targetMonthIdx) || targetMonthIdx < 0 || targetMonthIdx > 11) {
    return { status: "error", message: "Parameter tidak valid" };
  }

  const data = await getSheetValues("working");
  if (!data || data.length <= rowNumber) {
    return { status: "error", message: "Data tidak ditemukan atau baris tidak valid" };
  }

  const headers = data[0];
  const row = data[rowNumber];
  const getIdx = (patterns: RegExp) => headers.findIndex((h) => patterns.test(String(h).trim()));

  const idxQty = getIdx(/^quantity \(kg\)|^qty$|^stock$|^kg$/i);
  const qtyVal = idxQty !== -1 && idxQty < row.length ? safeParseFloat(row[idxQty]) : 0;
  const monthIndices = getMonthIndices(headers);
  const updMonthIndices = getUpdMonthIndices(headers);

  monthIndices.forEach((colIdx) => {
    if (colIdx !== -1) {
      while (row.length <= colIdx) row.push("");
      row[colIdx] = "";
    }
  });
  updMonthIndices.forEach((colIdx) => {
    if (colIdx !== -1) {
      while (row.length <= colIdx) row.push("");
      row[colIdx] = "";
    }
  });

  const targetColIdx = monthIndices[targetMonthIdx];
  if (targetColIdx !== -1) {
    while (row.length <= targetColIdx) row.push("");
    row[targetColIdx] = qtyVal;
  }

  const targetUpdColIdx = updMonthIndices[targetMonthIdx];
  if (targetUpdColIdx !== -1) {
    while (row.length <= targetUpdColIdx) row.push("");
    row[targetUpdColIdx] = "sales";
  }

  await updateSheetValues("working", data);
  return { status: "success", message: "Bulan berhasil dipindahkan" };
}

export async function handleConsolidateDatabase(body: any) {
  const [data, drData, empDataRaw, channelData] = await Promise.all([
    getSheetValues("working"),
    getSheetValues("dr"),
    getSheetValues("employee"),
    getSheetValues("channel"),
  ]);

  if (!data || data.length <= 1) {
    return { status: "success", message: "Tidak ada data untuk dikonsolidasi" };
  }

  const empData = empDataRaw || [];
  const { headers, idxPog } = ensureWorkingColumns(data);
  const { timeCols, catCols, idx } = getWorkingIndices(headers, idxPog);
  const timestamp = getJakartaTimestamp();
  const channelCategoryMap = buildChannelCategoryMap(channelData || []);

  backfillRowsTimeAndCategory(data, timeCols, catCols, idx.kiosk, channelCategoryMap, timestamp, true);

  const monthIndices = getMonthIndices(headers);
  const updMonthIndices = getUpdMonthIndices(headers);

  const isValidVal = (v: any) =>
    v !== undefined &&
    v !== null &&
    String(v).trim() !== "" &&
    String(v).trim().toUpperCase() !== "N/A" &&
    String(v).trim() !== "-";

  const lotLookup = buildLotLookup(drData || []);
  const grouped: Record<string, any> = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && idx.kiosk !== -1 && !row[idx.kiosk]) continue;

    const kioskVal = idx.kiosk !== -1 ? String(row[idx.kiosk] || "").trim() : "";
    const lotVal = idx.lot !== -1 ? String(row[idx.lot] || "").trim() : "";
    const descVal = idx.desc !== -1 ? String(row[idx.desc] || "").trim() : "";
    const userVal = idx.user !== -1 ? String(row[idx.user] || "").trim() : "";

    const groupKey = `${cleanForMatch(kioskVal)}_${cleanForMatch(lotVal)}_${cleanForMatch(descVal)}_${cleanForMatch(userVal)}`;

    let timestampStr = "";
    timeCols.forEach((colIdx) => {
      if (row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== "") {
        timestampStr = String(row[colIdx]).trim();
      }
    });

    const rowDate = timestampStr ? parseGasDate(timestampStr) : new Date(0);
    const rowMonthIdx = getMonthIndexFromDateString(timestampStr);

    let rowCategoryVal = "";
    catCols.forEach((colIdx) => {
      if (
        row[colIdx] !== undefined &&
        row[colIdx] !== null &&
        String(row[colIdx]).trim() !== "" &&
        String(row[colIdx]).trim().toLowerCase() !== "uncategorized"
      ) {
        rowCategoryVal = String(row[colIdx]).trim();
      }
    });
    if (!rowCategoryVal && kioskVal) {
      rowCategoryVal = getGasCategory(kioskVal, channelCategoryMap);
    }
    if (!rowCategoryVal) rowCategoryVal = "R1";

    const monthValsSrc = Array(12).fill(0);
    monthIndices.forEach((colIdx, mIdx) => {
      if (colIdx !== -1 && colIdx < row.length && row[colIdx] !== "") {
        monthValsSrc[mIdx] = safeParseFloat(row[colIdx]);
      }
    });

    const updValsSrc = Array(12).fill("");
    updMonthIndices.forEach((colIdx, mIdx) => {
      if (colIdx !== -1 && colIdx < row.length && row[colIdx] !== undefined && row[colIdx] !== null && row[colIdx] !== "") {
        updValsSrc[mIdx] = String(row[colIdx]).trim();
      }
    });

    const totalMonthVals = monthValsSrc.reduce((a, b) => a + b, 0);
    const qtyVal = idx.qty !== -1 ? safeParseFloat(row[idx.qty]) : 0;
    if (totalMonthVals === 0 && qtyVal > 0) {
      monthValsSrc[rowMonthIdx] = qtyVal;
    }

    const lotUpper = String(lotVal).trim().toUpperCase();
    let currentExp = "";
    let currentDr = "";

    if (lotLookup[lotUpper]) {
      if (isValidVal(lotLookup[lotUpper].drDate)) currentDr = lotLookup[lotUpper].drDate;
      if (isValidVal(lotLookup[lotUpper].expDate)) currentExp = lotLookup[lotUpper].expDate;
    }
    if (!isValidVal(currentExp)) {
      currentExp = idx.exp !== -1 && colIndexInBounds(idx.exp, row) ? row[idx.exp] : "";
    }
    if (!isValidVal(currentDr)) {
      currentDr = idx.dr !== -1 && colIndexInBounds(idx.dr, row) ? row[idx.dr] : "";
    }
    if (!isValidVal(currentExp)) currentExp = extractExpFromLot(lotUpper);
    if (!isValidVal(currentDr)) currentDr = "N/A";

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        kiosk: kioskVal,
        category: rowCategoryVal,
        lot: lotVal,
        desc: descVal,
        user: userVal,
        timestamp: rowDate,
        originalTimestampStr: timestampStr,
        area: getUserProvince(userVal, empData) || (idx.area !== -1 && colIndexInBounds(idx.area, row) ? row[idx.area] : ""),
        crops: idx.crops !== -1 && colIndexInBounds(idx.crops, row) ? row[idx.crops] : "",
        exp: currentExp,
        dr: currentDr,
        agingMonth: idx.agingMonth !== -1 && colIndexInBounds(idx.agingMonth, row) ? row[idx.agingMonth] : "",
        cond: idx.cond !== -1 && colIndexInBounds(idx.cond, row) ? row[idx.cond] : "tetap",
        agingExp: idx.agingExp !== -1 && colIndexInBounds(idx.agingExp, row) ? row[idx.agingExp] : "",
        cluster: idx.cluster !== -1 && colIndexInBounds(idx.cluster, row) ? row[idx.cluster] : "",
        pog: idx.pog !== -1 && colIndexInBounds(idx.pog, row) ? safeParseFloat(row[idx.pog]) : 0,
        monthlyQty: monthValsSrc,
        updMonthVals: updValsSrc,
        rawIndex: i,
      };
    } else {
      const g = grouped[groupKey];
      for (let m = 0; m < 12; m++) {
        g.monthlyQty[m] += monthValsSrc[m];
      }
      if (!g.updMonthVals) g.updMonthVals = Array(12).fill("");
      for (let m = 0; m < 12; m++) {
        const v1 = String(g.updMonthVals[m] || "").trim().toLowerCase();
        const v2 = String(updValsSrc[m] || "").trim().toLowerCase();
        if (v1 === "sales" || v2 === "sales") g.updMonthVals[m] = "sales";
        else if (v1 === "admin" || v2 === "admin") g.updMonthVals[m] = "admin";
        else g.updMonthVals[m] = "";
      }

      const isNewer = rowDate.getTime() > g.timestamp.getTime();
      if (isNewer) {
        g.timestamp = rowDate;
        g.originalTimestampStr = timestampStr;
      }

      const updateField = (gKey: string, rowVal: any) => {
        if (isNewer) {
          if (isValidVal(rowVal)) g[gKey] = rowVal;
        } else {
          if (isValidVal(rowVal) && !isValidVal(g[gKey])) g[gKey] = rowVal;
        }
      };

      if (idx.area !== -1 && colIndexInBounds(idx.area, row)) updateField("area", getUserProvince(userVal, empData) || row[idx.area]);
      if (idx.crops !== -1 && colIndexInBounds(idx.crops, row)) updateField("crops", row[idx.crops]);
      if (idx.exp !== -1) updateField("exp", currentExp);
      if (idx.dr !== -1) updateField("dr", currentDr);
      if (idx.agingMonth !== -1 && colIndexInBounds(idx.agingMonth, row)) updateField("agingMonth", row[idx.agingMonth]);
      if (idx.agingExp !== -1 && colIndexInBounds(idx.agingExp, row)) updateField("agingExp", row[idx.agingExp]);
      if (idx.cluster !== -1 && colIndexInBounds(idx.cluster, row)) updateField("cluster", row[idx.cluster]);
      if (isValidVal(rowCategoryVal)) updateField("category", rowCategoryVal);

      if (idx.cond !== -1 && colIndexInBounds(idx.cond, row)) {
        const rowVal = row[idx.cond];
        if (isNewer && isValidVal(rowVal) && rowVal !== "tetap") {
          g.cond = rowVal;
        } else if (!isNewer && isValidVal(rowVal) && rowVal !== "tetap" && (!g.cond || g.cond === "tetap")) {
          g.cond = rowVal;
        }
      }

      if (idx.pog !== -1 && colIndexInBounds(idx.pog, row)) {
        g.pog += safeParseFloat(row[idx.pog]);
      }
    }
  }

  const todayDate = getJakartaDate();
  todayDate.setHours(0, 0, 0, 0);
  let curMonthIdx = todayDate.getMonth();
  if (body && typeof body.targetMonth === "number" && body.targetMonth >= 0 && body.targetMonth <= 11) {
    curMonthIdx = body.targetMonth;
  }
  const prevMonthIdx = (curMonthIdx - 1 + 12) % 12;

  const newSheetValues = [headers];

  Object.values(grouped).forEach((g: any) => {
    if (!g.monthlyQty) g.monthlyQty = Array(12).fill(0);
    if (!g.updMonthVals) g.updMonthVals = Array(12).fill("");
    if (g.updMonthVals[curMonthIdx] !== "sales") {
      g.monthlyQty[curMonthIdx] = g.monthlyQty[prevMonthIdx] || 0;
      g.updMonthVals[curMonthIdx] = "admin";
    }

    const curStock = safeParseFloat(g.monthlyQty[curMonthIdx]);
    const prevStock = safeParseFloat(g.monthlyQty[prevMonthIdx]);
    g.pog = prevStock - curStock;

    const lotUpper = String(g.lot).trim().toUpperCase();
    if (lotLookup[lotUpper]) {
      if (isValidVal(lotLookup[lotUpper].drDate)) g.dr = lotLookup[lotUpper].drDate;
      if (isValidVal(lotLookup[lotUpper].expDate)) g.exp = lotLookup[lotUpper].expDate;
    }
    if (!isValidVal(g.exp)) g.exp = extractExpFromLot(lotUpper);

    if (isValidVal(g.dr) && g.dr !== "N/A") {
      const formattedDr = formatMyDate(g.dr);
      if (formattedDr && formattedDr !== "N/A") g.dr = formattedDr;
    }
    if (isValidVal(g.exp) && g.exp !== "N/A") {
      const formattedExp = formatMyDate(g.exp);
      if (formattedExp && formattedExp !== "N/A") g.exp = formattedExp;
    }

    if (isValidVal(g.dr) && g.dr !== "N/A") {
      const drD = parseGasDate(g.dr);
      if (drD && !isNaN(drD.getTime()) && drD.getTime() !== 0) {
        const calcAge = Math.round((todayDate.getTime() - drD.getTime()) / (1000 * 3600 * 24) / 30.416);
        g.agingMonth = calcAge >= 0 ? calcAge : 0;
      }
    }

    if (isValidVal(g.exp) && g.exp !== "N/A") {
      const expD = parseGasDate(g.exp);
      if (expD && !isNaN(expD.getTime()) && expD.getTime() !== 0) {
        g.agingExp = Math.round((expD.getTime() - todayDate.getTime()) / (1000 * 3600 * 24) / 30.416);
      }
    }

    if (g.agingMonth !== "" && g.agingMonth !== undefined && g.agingMonth !== null && !isNaN(Number(g.agingMonth))) {
      const aVal = Number(g.agingMonth);
      if (aVal <= 2) g.cluster = "0-2";
      else if (aVal <= 4) g.cluster = "2-4";
      else if (aVal <= 6) g.cluster = "4-6";
      else if (aVal <= 9) g.cluster = "6-9";
      else if (aVal <= 12) g.cluster = "9-12";
      else g.cluster = ">12";
    }

    const totalQty = g.monthlyQty.reduce((a: number, b: number) => a + b, 0);
    const currentMonthQty = g.monthlyQty[curMonthIdx];
    const prevMonthQty = g.monthlyQty[prevMonthIdx];

    if (totalQty === 0) {
      g.cond = "habis";
    } else {
      if (g.cond === "habis") g.cond = "tetap";
      if (g.cond !== "new" && g.cond !== "baru" && g.cond !== "baru (new)") {
        if (currentMonthQty < prevMonthQty) g.cond = "berkurang";
        else if (currentMonthQty > prevMonthQty) g.cond = "bertambah";
        else g.cond = "tetap";
      }
    }

    for (let m = 0; m < 12; m++) {
      const uVal = String(g.updMonthVals[m] || "").trim().toLowerCase();
      if (uVal === "sales") g.updMonthVals[m] = "sales";
      else if (uVal === "admin") g.updMonthVals[m] = "admin";
      else g.updMonthVals[m] = "";
    }

    const newRow = new Array(headers.length).fill("");
    const rowTimestamp = getJakartaTimestamp();
    const isSales = g.updMonthVals[curMonthIdx] === "sales";
    const resolvedTimestamp = isSales ? g.originalTimestampStr || rowTimestamp : rowTimestamp;

    timeCols.forEach((colIdx) => {
      newRow[colIdx] = resolvedTimestamp;
    });

    if (idx.kiosk !== -1) newRow[idx.kiosk] = g.kiosk;
    catCols.forEach((colIdx) => {
      newRow[colIdx] = g.category || "";
    });

    if (idx.user !== -1) newRow[idx.user] = g.user;
    if (idx.lot !== -1) newRow[idx.lot] = String(g.lot).toUpperCase();
    if (idx.qty !== -1) newRow[idx.qty] = g.monthlyQty[curMonthIdx];
    if (idx.area !== -1) newRow[idx.area] = g.area;
    if (idx.desc !== -1) newRow[idx.desc] = g.desc;
    if (idx.crops !== -1) newRow[idx.crops] = g.crops;
    if (idx.dr !== -1) newRow[idx.dr] = g.dr;
    if (idx.exp !== -1) newRow[idx.exp] = g.exp;
    if (idx.agingMonth !== -1) newRow[idx.agingMonth] = g.agingMonth;
    if (idx.cond !== -1) newRow[idx.cond] = g.cond;
    if (idx.agingExp !== -1) newRow[idx.agingExp] = g.agingExp;
    if (idx.cluster !== -1) newRow[idx.cluster] = g.cluster;
    if (idx.pog !== -1) newRow[idx.pog] = g.pog;

    monthIndices.forEach((colIdx, mIdx) => {
      if (colIdx !== -1) {
        newRow[colIdx] = g.monthlyQty[mIdx] !== 0 || g.updMonthVals[mIdx] !== "" ? safeParseFloat(g.monthlyQty[mIdx]) : "";
      }
    });

    updMonthIndices.forEach((colIdx, mIdx) => {
      if (colIdx !== -1) {
        newRow[colIdx] = g.updMonthVals[mIdx] || "";
      }
    });

    newSheetValues.push(newRow);
  });

  await updateSheetValues("working", newSheetValues);
  return { status: "success", message: "Konsolidasi berhasil dilakukan" };
}

export async function handleBackfillEmptyCategories(_body: any) {
  const [data, channelData] = await Promise.all([
    getSheetValues("working"),
    getSheetValues("channel"),
  ]);
  if (!data || data.length === 0) {
    return { status: "error", message: "Sheet 'working' tidak ditemukan atau kosong" };
  }

  const headers = data[0];
  let hasTgl = false;
  let hasCat = false;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).trim().toLowerCase();
    if (h === "tgl" || h === "tanggal") hasTgl = true;
    if (h === "category" || h === "kategori") hasCat = true;
  }
  if (!hasTgl) headers.push("Tgl");
  if (!hasCat) headers.push("Category");

  for (let i = 1; i < data.length; i++) {
    while (data[i].length < headers.length) data[i].push("");
  }

  const { timeCols, catCols, idx } = getWorkingIndices(headers, -1);
  const timestamp = getJakartaTimestamp();
  const channelCategoryMap = buildChannelCategoryMap(channelData || []);

  const { tglFilled, catFilled } = backfillRowsTimeAndCategory(
    data,
    timeCols,
    catCols,
    idx.kiosk,
    channelCategoryMap,
    timestamp,
    false,
  );

  const success = await updateSheetValues("working", data);
  if (!success) {
    return { status: "error", message: "Gagal menyimpan perubahan" };
  }

  return {
    status: "success",
    message: `Berhasil mengisi ${catFilled} kolom category dan ${tglFilled} kolom tanggal yang kosong.`,
  };
}

function getChannelIndices(headers: any[]) {
  return {
    pic: headers.findIndex((h: any) => /pic|user|nama|analyst|solution/i.test(String(h).trim())),
    channel: headers.findIndex((h: any) => /channel|kiosk|nama toko|toko|name|distributor|partner|mitra/i.test(String(h).trim())),
    cat: headers.findIndex((h: any) => /kategori|category|klasifikasi|^cat$/i.test(String(h).trim())),
    upline: headers.findIndex((h: any) => /upline|spv|supervisor/i.test(String(h).trim())),
    province: headers.findIndex((h: any) => /provinsi|province/i.test(String(h).trim())),
    area: headers.findIndex((h: any) => /^area$/i.test(String(h).trim())),
    group: headers.findIndex((h: any) => /group|tim|divisi|division/i.test(String(h).trim())),
  };
}

function findPartnerRowIndex(data: any[][], body: any, idx: ReturnType<typeof getChannelIndices>): number {
  const rowNum = Number(body.id);
  const targetName = body.originalName || body.name;
  if (!targetName) return -1;

  const cleanTargetName = cleanForMatch(targetName);

  if (!isNaN(rowNum) && rowNum > 1 && rowNum <= data.length) {
    const potentialRow = data[rowNum - 1];
    if (potentialRow && idx.channel !== -1 && cleanForMatch(potentialRow[idx.channel]) === cleanTargetName) {
      return rowNum - 1;
    }
  }

  const reqProvince = body.originalProvince || body.province ? cleanForMatch(body.originalProvince || body.province) : "";
  const reqGroup = body.originalGroup || body.group ? cleanForMatch(body.originalGroup || body.group) : "";
  const reqPic = body.originalPic || body.pic ? cleanForMatch(body.originalPic || body.pic) : "";
  const reqCat = body.originalCategory || body.category ? cleanForMatch(body.originalCategory || body.category) : "";

  let bestIndex = -1;
  let bestScore = -1;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || idx.channel === -1) continue;
    if (cleanForMatch(row[idx.channel]) !== cleanTargetName) continue;

    let score = 0;
    if (idx.province !== -1 && reqProvince && cleanForMatch(row[idx.province]) === reqProvince) score += 10;
    if (idx.group !== -1 && reqGroup && cleanForMatch(row[idx.group]) === reqGroup) score += 10;
    if (idx.pic !== -1 && reqPic && cleanForMatch(row[idx.pic]) === reqPic) score += 10;
    if (idx.cat !== -1 && reqCat && cleanForMatch(row[idx.cat]) === reqCat) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = r;
    }
  }

  if (bestIndex !== -1) return bestIndex;

  return data.findIndex((row, idxVal) => idxVal > 0 && cleanForMatch(row[idx.channel]) === cleanTargetName);
}

export async function handleAddPartner(body: any) {
  const data = await getSheetValues("channel");
  if (!data) throw new Error("Sheet 'channel' tidak ditemukan");
  const headers = data[0];
  const idx = getChannelIndices(headers);
  if (idx.channel === -1) throw new Error("Kolom nama partner tidak ditemukan");

  if (body.name) {
    const cleanNewName = cleanForMatch(body.name);
    const existingIndex = data.findIndex(
      (row, idxVal) => idxVal > 0 && cleanForMatch(row[idx.channel]) === cleanNewName,
    );
    if (existingIndex !== -1) {
      let userProvince = body.province || "";
      let userArea = "";

      if (body.pic && data.length > 1) {
        const cleanPic = cleanForMatch(body.pic);
        const existingPicRow = data.find(
          (row, idxVal) =>
            idxVal > 0 && idxVal !== existingIndex && idx.pic !== -1 && cleanForMatch(row[idx.pic]) === cleanPic,
        );
        if (existingPicRow) {
          if (idx.province !== -1 && existingPicRow[idx.province]) userProvince = String(existingPicRow[idx.province]).trim();
          if (idx.area !== -1 && existingPicRow[idx.area]) userArea = String(existingPicRow[idx.area]).trim();
        }
      }

      if (idx.pic !== -1 && body.pic !== undefined) data[existingIndex][idx.pic] = body.pic;
      if (idx.province !== -1 && userProvince) data[existingIndex][idx.province] = userProvince;
      if (idx.area !== -1 && userArea) data[existingIndex][idx.area] = userArea;
      if (idx.cat !== -1 && body.category !== undefined && body.category !== "") data[existingIndex][idx.cat] = body.category;
      if (idx.group !== -1 && body.group !== undefined && body.group !== "") data[existingIndex][idx.group] = body.group;

      const successUpdate = await updateSheetValues("channel", data);
      if (!successUpdate) throw new Error("Gagal memperbarui data partner yang sudah ada di database.");
      return {
        status: "success",
        id: existingIndex + 1,
        message: `Partner "${body.name}" sudah ada di database, data berhasil diperbarui.`,
      };
    }
  }

  let userProvince = body.province || "";
  let userArea = "";

  if (body.pic && data.length > 1) {
    const cleanPic = cleanForMatch(body.pic);
    const existingPicRow = data.find(
      (row, idxVal) => idxVal > 0 && idx.pic !== -1 && cleanForMatch(row[idx.pic]) === cleanPic,
    );
    if (existingPicRow) {
      if (idx.province !== -1 && existingPicRow[idx.province]) userProvince = String(existingPicRow[idx.province]).trim();
      if (idx.area !== -1 && existingPicRow[idx.area]) userArea = String(existingPicRow[idx.area]).trim();
    }
  }

  const newRow = new Array(headers.length).fill("");
  if (idx.channel !== -1) newRow[idx.channel] = body.name || "";
  if (idx.cat !== -1) newRow[idx.cat] = body.category || "";
  if (idx.pic !== -1) newRow[idx.pic] = body.pic || "";
  if (idx.province !== -1) newRow[idx.province] = userProvince || "";
  if (idx.area !== -1) newRow[idx.area] = userArea || "";
  if (idx.group !== -1) newRow[idx.group] = body.group || "";

  const successAppend = await appendSheetRow("channel", newRow);
  if (!successAppend) throw new Error("Gagal menyimpan partner baru ke database.");

  return {
    status: "success",
    id: data.length + 1,
    message: `Partner "${body.name}" berhasil ditambahkan`,
  };
}

export async function handleUpdatePartner(body: any) {
  const data = await getSheetValues("channel");
  if (!data) throw new Error("Sheet 'channel' tidak ditemukan");
  const idx = getChannelIndices(data[0]);
  const rowIndex = findPartnerRowIndex(data, body, idx);

  if (rowIndex > 0 && rowIndex < data.length) {
    let userProvince = body.province || "";
    let userArea = "";

    if (body.pic && data.length > 1) {
      const cleanPic = cleanForMatch(body.pic);
      const existingPicRow = data.find(
        (row, idxVal) =>
          idxVal > 0 && idxVal !== rowIndex && idx.pic !== -1 && cleanForMatch(row[idx.pic]) === cleanPic,
      );
      if (existingPicRow) {
        if (idx.province !== -1 && existingPicRow[idx.province]) userProvince = String(existingPicRow[idx.province]).trim();
        if (idx.area !== -1 && existingPicRow[idx.area]) userArea = String(existingPicRow[idx.area]).trim();
      }
    }

    if (idx.pic !== -1 && body.pic !== undefined) data[rowIndex][idx.pic] = body.pic;
    if (idx.province !== -1) data[rowIndex][idx.province] = body.province || userProvince || data[rowIndex][idx.province] || "";
    if (idx.area !== -1) data[rowIndex][idx.area] = userArea || data[rowIndex][idx.area] || "";
    if (idx.channel !== -1 && body.name !== undefined && body.name !== "") data[rowIndex][idx.channel] = body.name;
    if (idx.cat !== -1 && body.category !== undefined && body.category !== "") data[rowIndex][idx.cat] = body.category;
    if (idx.group !== -1 && body.group !== undefined && body.group !== "") data[rowIndex][idx.group] = body.group;

    const successUpdate = await updateSheetValues("channel", data);
    if (!successUpdate) throw new Error("Gagal menyimpan perubahan partner ke database.");

    try {
      const workingData = await getSheetValues("working");
      if (workingData && workingData.length > 1) {
        const wHeaders = workingData[0];
        const wChannelIdx = wHeaders.findIndex((h: any) => /channel|kiosk|toko|distributor|nama toko/i.test(String(h).trim()));
        const wCatIdx = wHeaders.findIndex((h: any) => /category|kategori/i.test(String(h).trim()));
        const cleanTarget = cleanForMatch(body.originalName || body.name);

        let workingChanged = false;
        if (wChannelIdx !== -1) {
          for (let r = 1; r < workingData.length; r++) {
            if (cleanForMatch(workingData[r][wChannelIdx]) === cleanTarget) {
              if (body.name && workingData[r][wChannelIdx] !== body.name) {
                workingData[r][wChannelIdx] = body.name;
                workingChanged = true;
              }
              if (wCatIdx !== -1 && body.category && workingData[r][wCatIdx] !== body.category) {
                workingData[r][wCatIdx] = body.category;
                workingChanged = true;
              }
            }
          }
        }
        if (workingChanged) await updateSheetValues("working", workingData);
      }
    } catch (syncErr) {
      console.warn("Could not sync updated category to working sheet:", syncErr);
    }
  } else {
    console.warn("Partner row not found for update, attempting to add instead");
    return await handleAddPartner(body);
  }
  return { status: "success", message: `Partner ${body.name} berhasil diperbarui` };
}

export async function handleDeletePartner(body: any) {
  const data = await getSheetValues("channel");
  if (!data) throw new Error("Sheet 'channel' tidak ditemukan");
  const idx = getChannelIndices(data[0]);
  if (idx.channel === -1) throw new Error("Kolom nama partner tidak ditemukan di sheet");

  const rowIndex = findPartnerRowIndex(data, body, idx);

  if (rowIndex > 0 && rowIndex < data.length) {
    const deletedName = data[rowIndex][idx.channel];
    data.splice(rowIndex, 1);
    const success = await updateSheetValues("channel", data);
    if (!success) throw new Error("Gagal menyimpan perubahan ke Google Sheets");
    console.log(`[Delete] Successfully deleted partner: ${deletedName} at row ${rowIndex + 1}`);
    return { status: "success", message: `Partner ${deletedName} berhasil dihapus` };
  }

  return {
    status: "error",
    message: rowIndex === -1 ? `Data partner "${body.name}" tidak ditemukan` : "Indeks baris tidak valid untuk penghapusan",
  };
}

export async function handleUpdateEmployee(body: any) {
  const data = await getSheetValues("employee");
  if (!data) throw new Error("Sheet 'employee' tidak ditemukan");
  const headers = data[0];
  const getIdx = (patterns: RegExp) => headers.findIndex((h) => patterns.test(String(h).trim()));
  const emailIdx = headers.findIndex((h: any) => /email/i.test(String(h).trim()));
  const userIdx = headers.findIndex((h: any) => /^user$|^username$|^user\s*name$/i.test(String(h).trim().toLowerCase()));
  const idx = {
    name: getIdx(/nama|name|pic/i),
    email: emailIdx !== -1 ? emailIdx : getIdx(/email|user/i),
    username: userIdx !== -1 ? userIdx : -1,
    pos: getIdx(/position|jabatan/i),
    prov: getIdx(/province|provinsi/i),
    area: getIdx(/area/i),
    upline: getIdx(/upline|spv|supervisor|atasan|manager/i),
    password: getIdx(/password|pass/i),
    level: getIdx(/level|grade/i),
    group: getIdx(/group|tim|divisi|division/i),
  };

  if (idx.name === -1) throw new Error("Name column not found");

  const targetClean = cleanForMatch(body.originalName);
  let targetRow = -1;
  if (body.originalName) {
    for (let i = 1; i < data.length; i++) {
      if (cleanForMatch(data[i][idx.name]) === targetClean) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow !== -1) {
    const rowIndex = targetRow - 1;
    if (body.name !== undefined) data[rowIndex][idx.name] = body.name;
    if (idx.username !== -1 && body.user !== undefined) data[rowIndex][idx.username] = body.user;
    else if (idx.email !== -1 && body.email !== undefined) data[rowIndex][idx.email] = body.email;
    if (idx.pos !== -1 && body.position !== undefined) data[rowIndex][idx.pos] = body.position;
    if (idx.prov !== -1 && body.province !== undefined) data[rowIndex][idx.prov] = body.province;
    if (idx.area !== -1 && body.area !== undefined) data[rowIndex][idx.area] = body.area;
    if (idx.upline !== -1 && body.upline !== undefined) data[rowIndex][idx.upline] = body.upline;
    if (idx.password !== -1 && body.password !== undefined) data[rowIndex][idx.password] = body.password;
    if (idx.level !== -1 && body.level !== undefined) data[rowIndex][idx.level] = body.level;
    if (idx.group !== -1 && body.group !== undefined) data[rowIndex][idx.group] = body.group;
    await updateSheetValues("employee", data);
  } else {
    const newRow = new Array(headers.length).fill("");
    if (idx.name !== -1 && body.name !== undefined) newRow[idx.name] = body.name;
    if (idx.username !== -1 && body.user !== undefined) newRow[idx.username] = body.user;
    else if (idx.email !== -1 && body.email !== undefined) newRow[idx.email] = body.email;
    if (idx.pos !== -1 && body.position !== undefined) newRow[idx.pos] = body.position;
    if (idx.prov !== -1 && body.province !== undefined) newRow[idx.prov] = body.province;
    if (idx.area !== -1 && body.area !== undefined) newRow[idx.area] = body.area;
    if (idx.upline !== -1 && body.upline !== undefined) newRow[idx.upline] = body.upline;
    if (idx.password !== -1 && body.password !== undefined) newRow[idx.password] = body.password;
    if (idx.level !== -1 && body.level !== undefined) newRow[idx.level] = body.level;
    if (idx.group !== -1 && body.group !== undefined) newRow[idx.group] = body.group;
    await appendSheetRow("employee", newRow);
  }
  clearEmployeeCache();
  return { status: "success" };
}

export async function handleDeleteEmployee(body: any) {
  const data = await getSheetValues("employee");
  if (!data) throw new Error("Sheet 'employee' tidak ditemukan");
  const headers = data[0];
  const nameIdx = headers.findIndex((h: any) => /nama|name|pic/i.test(String(h).trim()));
  if (nameIdx === -1) throw new Error("Kolom nama employee tidak ditemukan");

  const targetClean = cleanForMatch(body.name);
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (cleanForMatch(data[i][nameIdx]) === targetClean) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow !== -1) {
    const deletedName = data[targetRow - 1][nameIdx];
    data.splice(targetRow - 1, 1);
    const success = await updateSheetValues("employee", data);
    if (!success) throw new Error("Gagal menyimpan perubahan ke Google Sheets");
    console.log(`[Delete] Successfully deleted employee: ${deletedName} at row ${targetRow}`);
    clearEmployeeCache();
    return { status: "success", message: `Employee ${deletedName} berhasil dihapus` };
  }
  return { status: "error", message: `Employee dengan nama "${body.name}" tidak ditemukan` };
}

export async function handleSaveAccessRules(body: any) {
  try {
    const rules = body.rules || {};
    const headers = ["position", "home", "partner", "stock", "pog", "overview", "temp", "access"];
    const rows: any[][] = [headers];

    for (const position in rules) {
      const rule = rules[position];
      rows.push([
        position,
        rule.home ? "TRUE" : "FALSE",
        rule.partner ? "TRUE" : "FALSE",
        rule.stock ? "TRUE" : "FALSE",
        rule.pog ? "TRUE" : "FALSE",
        rule.overview ? "TRUE" : "FALSE",
        rule.temp ? "TRUE" : "FALSE",
        rule.access ? "TRUE" : "FALSE",
      ]);
    }

    await updateSheetValues("access", rows);
    return { status: "success" };
  } catch (error: any) {
    return { status: "error", message: error.toString() };
  }
}
