import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LabelList,
} from "recharts";
import {
  ALL_CLUSTER_KEYS,
  CLUSTER_CONFIG,
  CROP_OPTIONS,
} from "../../utils/constants";
import {
  formatOverviewVal,
  formatOverviewWithUnit,
} from "../../utils/formatters";

export type OverviewDimension =
  | "area"
  | "province"
  | "sales_agronomist"
  | "business_solution"
  | "material"
  | "distributor";

interface OverviewTabProps {
  filterBelowMonth: string;
  setFilterBelowMonth: (v: string) => void;
  filterBelowChannel: string;
  setFilterBelowChannel: (v: string) => void;
  filterBelowMaterial: string;
  setFilterBelowMaterial: (v: string) => void;
  filterBelowTeam: string;
  setFilterBelowTeam: (v: string) => void;
  filterBelowArea: string;
  setFilterBelowArea: (v: string) => void;
  filterBelowCrop: string;
  setFilterBelowCrop: (v: string) => void;
  filterOptions: {
    months: string[];
    channels: string[];
    materials: string[];
    teams: string[];
    areas: string[];
  };
  overviewStats: {
    totalKiosks: number;
    totalOpeningStock: number;
    totalSellIn: number;
    totalSellOut: number;
    totalCurrentStock: number;
    totalIdleStock: number;
    totalPog: number;
    areaChartData: Array<{
      name: string;
      pog: number;
      stock: number;
      sellIn: number;
      sellOut: number;
      opening: number;
      idle: number;
    }>;
    categoryChartData: Array<{ name: string; value: number }>;
  };
  overviewUseMt: boolean;
  overviewGroupDimension: OverviewDimension;
  setOverviewGroupDimension: (v: OverviewDimension) => void;
  overviewMetricFilter: string;
  setOverviewMetricFilter: (v: string) => void;
  employeePerformanceData: {
    highest: Array<{
      employee: string;
      area: string;
      pog: number;
      currentStock: number;
    }>;
    lowest: Array<{
      employee: string;
      area: string;
      pog: number;
      currentStock: number;
    }>;
  };
  overviewHistoryData: Array<{
    monthKey: string;
    monthLabel: string;
    opening: number;
    ending: number;
    stockIn: number;
    idle: number;
    pog: number;
  }>;
  filteredSummaryDataLength: number;
  grandTotalViewBy: "hybrid" | "area";
  setGrandTotalViewBy: (v: "hybrid" | "area") => void;
  totalSummary: Record<string, number>;
  selectedClusters: string[];
  setSelectedClusters: React.Dispatch<React.SetStateAction<string[]>>;
  grandTotalStats: Array<{
    name: string;
    total: number;
    clusters: Record<string, number>;
  }>;
}

const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const value = payload?.value || "";
  const lines = typeof value === "string" ? value.split(" ") : [String(value)];
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fill="#4e5572"
        style={{
          fontSize: "8.5px",
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        {lines.map((word: string, idx: number) => {
          if (idx > 2) return null;
          const displayWord =
            idx === 2 && lines.length > 3 ? word + "..." : word;
          return (
            <tspan key={idx} x={0} dy={idx === 0 ? 8 : 10}>
              {displayWord}
            </tspan>
          );
        })}
      </text>
    </g>
  );
};

export default function OverviewTab({
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
  filterOptions,
  overviewStats,
  overviewUseMt,
  overviewGroupDimension,
  setOverviewGroupDimension,
  overviewMetricFilter,
  setOverviewMetricFilter,
  employeePerformanceData,
  overviewHistoryData,
  filteredSummaryDataLength,
  grandTotalViewBy,
  setGrandTotalViewBy,
  totalSummary,
  selectedClusters,
  setSelectedClusters,
  grandTotalStats,
}: OverviewTabProps) {
  const [isOverviewFilterOpen, setIsOverviewFilterOpen] = useState(false);
  const [isChartFocusedModalOpen, setIsChartFocusedModalOpen] = useState(false);
  const [historyChartType, setHistoryChartType] = useState<
    "opening" | "ending" | "stockIn" | "idle" | "pog"
  >("pog");

  const currentBarGap = 0;
  const currentBarCategoryGap = "10%";
  const currentMaxBarSize = 75;

  const renderGrandTotalCard = () => {
    if (filteredSummaryDataLength === 0) return null;
    return (
      <div className="flex-1 w-full min-w-0 bg-gradient-to-br from-primary to-cyan-400 p-4 md:py-4 md:px-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.35)] transition-all duration-250 select-none text-white flex flex-col gap-3 lg:gap-4">
        {/* Left Side: Grand Total & Clusters */}
        <div className="flex flex-col w-full shrink-0 justify-center">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-white/80">
                tune
              </span>
              <div className="flex flex-col mr-2">
                <span className="font-semibold text-xs uppercase tracking-wider text-white/90">
                  Grand Total
                </span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
                  {filterBelowCrop || "All"}
                </span>
              </div>
              <div className="flex bg-white/10 p-0.5 rounded-lg border border-white/10 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGrandTotalViewBy("hybrid");
                  }}
                  className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    grandTotalViewBy === "hybrid"
                      ? "bg-white text-primary shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Hybrid
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGrandTotalViewBy("area");
                  }}
                  className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    grandTotalViewBy === "area"
                      ? "bg-white text-primary shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Province
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-bold text-xl xl:text-2xl text-white tracking-tight">
                {
                  formatOverviewVal(totalSummary.selectedTotal, overviewUseMt)
                    .valueStr
                }
              </span>
              <span className="text-[8px] xl:text-[9px] text-white/80 uppercase tracking-widest font-bold">
                Total{" "}
                {
                  formatOverviewVal(totalSummary.selectedTotal, overviewUseMt)
                    .unit
                }
              </span>
            </div>
          </div>
          <div className="flex w-full divide-x divide-white/15 border-t border-white/15 pt-2.5 mt-1">
            {ALL_CLUSTER_KEYS.map((clusterKey) => {
              if (
                clusterKey === "Uncategorized" &&
                (!totalSummary[clusterKey] || totalSummary[clusterKey] === 0)
              )
                return null;
              const clusterConfig = CLUSTER_CONFIG.find(
                (c) => c.key === clusterKey,
              );
              const isSelected = selectedClusters.includes(clusterKey);
              return (
                <div
                  key={clusterKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClusters((prev) =>
                      prev.includes(clusterKey)
                        ? prev.filter((k) => k !== clusterKey)
                        : [...prev, clusterKey],
                    );
                  }}
                  className={`flex-1 min-w-0 py-1 px-0.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isSelected
                      ? "opacity-100 hover:bg-white/10 rounded-md"
                      : "opacity-40 hover:opacity-60"
                  }`}
                >
                  <span className="text-[9px] xl:text-[10px] font-bold uppercase tracking-wider text-white/85 mb-0.5 truncate w-full">
                    {clusterConfig?.label || clusterKey}
                  </span>
                  <span className="font-bold text-xs xl:text-sm truncate w-full text-white">
                    {formatOverviewWithUnit(
                      totalSummary[clusterKey],
                      overviewUseMt,
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Total per Item & Aging */}
        <div className="flex flex-col flex-1 border-t border-white/15 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 w-full max-h-[300px] lg:max-h-none overflow-y-auto pr-1 custom-scrollbar">
            {grandTotalStats.map((stat, index) => (
              <div
                key={stat.name}
                className="bg-white/12 hover:bg-white/15 transition-all border border-white/25 py-2 px-2 rounded-[16px] flex flex-col shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-6 rounded-lg bg-white/25 flex items-center justify-center text-white font-black text-xs shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1 flex justify-between items-center gap-2">
                    <p
                      className="text-xs md:text-[13px] font-bold text-white uppercase tracking-wider truncate leading-none"
                      title={stat.name}
                    >
                      {stat.name}
                    </p>
                    <p className="text-xs md:text-[13px] font-extrabold text-white tracking-tight leading-none shrink-0">
                      {formatOverviewWithUnit(stat.total, overviewUseMt)}
                    </p>
                  </div>
                </div>
                <div className="flex w-full divide-x divide-white/20 border-t border-white/20 pt-2 mt-1">
                  {selectedClusters.map((clusterKey) => {
                    const val = stat.clusters[clusterKey] || 0;
                    if (clusterKey === "Uncategorized" && val === 0)
                      return null;
                    const clusterConfig = CLUSTER_CONFIG.find(
                      (c) => c.key === clusterKey,
                    );
                    return (
                      <div
                        key={clusterKey}
                        className="flex-1 min-w-0 px-0.5 flex flex-col items-center justify-center text-center"
                      >
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/80 mb-0.5 truncate w-full">
                          {clusterConfig?.label || clusterKey}
                        </span>
                        <span className="font-bold text-[11px] md:text-[12px] truncate w-full text-white">
                          {formatOverviewVal(val, overviewUseMt).valueStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {grandTotalStats.length === 0 && (
              <div className="col-span-full py-6 text-center text-white/60 text-xs font-medium">
                Tidak ada data.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="mb-2 ml-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#181a2c] tracking-tight">
            Executive{" "}
            <span className="text-primary font-bold">Overview</span>
          </h1>
          <p className="text-[11px] text-[#8E94B7] font-semibold uppercase tracking-wider mt-0.5">
            Analisis Kinerja & Pemantauan Tingkat Nasional
          </p>
        </div>
      </div>

      {/* Floating Filter Button */}
      <button
        onClick={() => setIsOverviewFilterOpen(!isOverviewFilterOpen)}
        className="fixed bottom-[110px] right-6 lg:bottom-10 lg:right-10 z-[60] bg-gradient-to-br from-[#154be2] to-[#123ebd] text-white p-3.5 lg:p-4 rounded-full shadow-[0_12px_32px_rgba(21,75,226,0.35)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.45)] hover:scale-105 active:scale-95 transition-all duration-300"
      >
        <span className="material-symbols-outlined text-[24px] lg:text-[28px]">
          filter_alt
        </span>
      </button>

      {/* Floating Detailed Filters */}
      <div
        className={`fixed inset-0 z-[70] transition-all duration-300 flex items-center justify-center p-4 ${
          isOverviewFilterOpen
            ? "opacity-100 visible pointer-events-auto"
            : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOverviewFilterOpen(false)}
        />

        <div
          className={`relative w-full max-w-4xl bg-white p-6 md:p-8 rounded-[32px] shadow-[0_24px_64px_rgba(0,0,0,0.25)] transition-all duration-300 transform ${
            isOverviewFilterOpen
              ? "scale-100 translate-y-0"
              : "scale-95 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px] lg:text-[24px] font-semibold">
                filter_alt
              </span>
              <h4 className="text-xs lg:text-sm font-bold text-[#181a2c] uppercase tracking-wider">
                Filter Dashboard Analisis
              </h4>
            </div>
            <button
              onClick={() => setIsOverviewFilterOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                close
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5">
            {/* Filter - Month */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] lg:text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Bulan
              </label>
              <div className="relative">
                <select
                  value={filterBelowMonth}
                  onChange={(e) => setFilterBelowMonth(e.target.value)}
                  className="w-full bg-[#fbfaff] border border-[#e2e8f0] rounded-xl px-4 py-3 text-xs lg:text-sm font-bold text-[#181a2c] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="All">Semua Bulan</option>
                  {filterOptions.months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Filter - Channel */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] lg:text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Channel
              </label>
              <div className="relative">
                <select
                  value={filterBelowChannel}
                  onChange={(e) => setFilterBelowChannel(e.target.value)}
                  className="w-full bg-[#fbfaff] border border-[#e2e8f0] rounded-xl px-4 py-3 text-xs lg:text-sm font-bold text-[#181a2c] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="All">Semua Channel</option>
                  {filterOptions.channels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Filter - Material */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] lg:text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Hybrid
              </label>
              <div className="relative">
                <select
                  value={filterBelowMaterial}
                  onChange={(e) => setFilterBelowMaterial(e.target.value)}
                  className="w-full bg-[#fbfaff] border border-[#e2e8f0] rounded-xl px-4 py-3 text-xs lg:text-sm font-bold text-[#181a2c] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="All">Semua Hybrid</option>
                  {filterOptions.materials.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Filter - Team */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] lg:text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Tim (PIC)
              </label>
              <div className="relative">
                <select
                  value={filterBelowTeam}
                  onChange={(e) => setFilterBelowTeam(e.target.value)}
                  className="w-full bg-[#fbfaff] border border-[#e2e8f0] rounded-xl px-4 py-3 text-xs lg:text-sm font-bold text-[#181a2c] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="All">Semua PIC</option>
                  {filterOptions.teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Filter - Area */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] lg:text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Wilayah
              </label>
              <div className="relative">
                <select
                  value={filterBelowArea}
                  onChange={(e) => setFilterBelowArea(e.target.value)}
                  className="w-full bg-[#fbfaff] border border-[#e2e8f0] rounded-xl px-4 py-3 text-xs lg:text-sm font-bold text-[#181a2c] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="All">Semua Wilayah</option>
                  {filterOptions.areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Filter - Crop */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] lg:text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Komoditas
              </label>
              <div className="relative">
                <select
                  value={filterBelowCrop}
                  onChange={(e) => setFilterBelowCrop(e.target.value)}
                  className="w-full bg-[#fbfaff] border border-[#e2e8f0] rounded-xl px-4 py-3 text-xs lg:text-sm font-bold text-[#181a2c] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="All">Semua Crop</option>
                  {CROP_OPTIONS.map((crop) => (
                    <option key={crop} value={crop}>
                      {crop}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-3.5">
        {/* KPI 1: Opening Inv */}
        <div className="bg-white p-4 rounded-[22px] shadow-[0_8px_24px_rgba(21,75,226,0.12)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.22)] border border-[#154be2]/15 flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[36px] text-amber-500">
              inventory_2
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-extrabold text-[#5c648e] uppercase tracking-wider leading-none mb-1">
            OPENING INV
          </p>
          <div className="mt-2 font-sans font-bold text-amber-600">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {
                formatOverviewVal(
                  overviewStats.totalOpeningStock,
                  overviewUseMt,
                ).valueStr
              }
            </span>
            <span className="text-[10px] text-amber-500 font-bold ml-1">
              {
                formatOverviewVal(
                  overviewStats.totalOpeningStock,
                  overviewUseMt,
                ).unit
              }
            </span>
          </div>
        </div>

        {/* KPI 2: Ending Inv */}
        <div className="bg-white p-4 rounded-[22px] shadow-[0_8px_24px_rgba(21,75,226,0.12)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.22)] border border-[#154be2]/15 flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[36px] text-purple-500">
              warehouse
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-extrabold text-[#5c648e] uppercase tracking-wider leading-none mb-1">
            ENDING INV
          </p>
          <div className="mt-2 font-sans font-bold text-purple-600">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {
                formatOverviewVal(
                  overviewStats.totalCurrentStock,
                  overviewUseMt,
                ).valueStr
              }
            </span>
            <span className="text-[10px] text-purple-500 font-bold ml-1">
              {
                formatOverviewVal(
                  overviewStats.totalCurrentStock,
                  overviewUseMt,
                ).unit
              }
            </span>
          </div>
        </div>

        {/* KPI 3: Stock In */}
        <div className="bg-white p-4 rounded-[22px] shadow-[0_8px_24px_rgba(21,75,226,0.12)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.22)] border border-[#154be2]/15 flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[36px] text-green-500">
              add_shopping_cart
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-extrabold text-[#5c648e] uppercase tracking-wider leading-none mb-1">
            STOCK IN
          </p>
          <div className="mt-2 text-green-600 font-sans font-bold">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {
                formatOverviewVal(overviewStats.totalSellIn, overviewUseMt)
                  .valueStr
              }
            </span>
            <span className="text-[10px] text-green-500 font-bold ml-1">
              {formatOverviewVal(overviewStats.totalSellIn, overviewUseMt).unit}
            </span>
          </div>
        </div>

        {/* KPI 4: Idle Stock */}
        <div className="bg-white p-4 rounded-[22px] shadow-[0_8px_24px_rgba(21,75,226,0.12)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.22)] border border-[#154be2]/15 flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[36px] text-indigo-500">
              hourglass_empty
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-extrabold text-[#5c648e] uppercase tracking-wider leading-none mb-1">
            IDLE STOCK
          </p>
          <div className="mt-2 text-indigo-600 font-sans font-bold">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {
                formatOverviewVal(overviewStats.totalIdleStock, overviewUseMt)
                  .valueStr
              }
            </span>
            <span className="text-[10px] text-indigo-500 font-bold ml-1">
              {
                formatOverviewVal(overviewStats.totalIdleStock, overviewUseMt)
                  .unit
              }
            </span>
          </div>
        </div>

        {/* KPI 5: POG */}
        <div className="bg-white p-4 rounded-[22px] shadow-[0_8px_24px_rgba(21,75,226,0.12)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.22)] border border-[#154be2]/15 flex flex-col justify-between relative overflow-hidden group transition-all duration-300 col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[36px] text-blue-500">
              trending_up
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] font-extrabold text-[#5c648e] uppercase tracking-wider leading-none mb-1">
            POG
          </p>
          <div className="mt-2 text-blue-600 font-sans font-bold">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {
                formatOverviewVal(overviewStats.totalPog, overviewUseMt)
                  .valueStr
              }
            </span>
            <span className="text-[10px] text-blue-500 font-bold ml-1">
              {formatOverviewVal(overviewStats.totalPog, overviewUseMt).unit}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-3.5">{renderGrandTotalCard()}</div>

      {/* Charts Grid Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Chart 1: Sales (POG) & Stock per Area / Dimension */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.03)] border border-[#154be2]/5 flex flex-col justify-between">
          <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-[#f0effc]/60">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm font-semibold border-b border-primary/20 pb-0.5">
                    {overviewGroupDimension === "material"
                      ? "widgets"
                      : overviewGroupDimension === "province"
                        ? "map"
                        : "analytics"}
                  </span>
                  <h3 className="text-xs font-bold text-[#181a2c] tracking-tight">
                    {overviewGroupDimension === "area"
                      ? "Performa Kinerja Wilayah (Area)"
                      : overviewGroupDimension === "province"
                        ? "Performa Kinerja per Provinsi"
                        : overviewGroupDimension === "sales_agronomist"
                          ? "Performa Kinerja Sales Agronomist (SA)"
                          : overviewGroupDimension === "business_solution"
                            ? "Performa Kinerja Business Solution (BS)"
                            : overviewGroupDimension === "distributor"
                              ? "Performa Kinerja per Distributor"
                              : "Performa Kinerja per Hybrid"}
                  </h3>
                </div>
                <p className="text-[10px] text-[#8E94B7] mt-0.5">
                  {overviewMetricFilter === "movement"
                    ? "Analisis perbandingan Stock In (Stok Masuk) vs POG (Penjualan)"
                    : overviewMetricFilter === "idle"
                      ? "Analisis perbandingan Idle Stock vs Sisa Stok Akhir"
                      : overviewMetricFilter === "total_stock"
                        ? "Analisis total sisa stok akhir"
                        : overviewMetricFilter === "Opening"
                          ? "Analisis perbandingan Stok Awal vs Sisa Stok Akhir"
                          : "Analisis perbandingan POG (Penjualan) vs Sisa Stok Akhir"}
                </p>
              </div>

              <button
                onClick={() => setIsChartFocusedModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold text-[#154be2] bg-[#154be2]/5 hover:bg-[#154be2]/10 active:bg-[#154be2]/20 transition-all rounded-xl border border-[#154be2]/10 shrink-0"
              >
                <span className="material-symbols-outlined text-sm font-bold">
                  zoom_in
                </span>
                <span>Fokus Grafik</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-[#fbfaff] px-2.5 py-1 rounded-xl border border-[#e2e8f0]/80">
                <span className="text-[9.5px] font-bold text-[#8E94B7] uppercase tracking-wider">
                  Dimensi:
                </span>
                <div className="relative">
                  <select
                    value={overviewGroupDimension}
                    onChange={(e) =>
                      setOverviewGroupDimension(
                        e.target.value as OverviewDimension,
                      )
                    }
                    className="bg-transparent text-[10.5px] font-black text-[#154be2] focus:outline-none focus:ring-0 appearance-none cursor-pointer pr-6 py-0.5"
                  >
                    <option value="area">Area</option>
                    <option value="province">Province</option>
                    <option value="sales_agronomist">Sales Agronomist</option>
                    <option value="business_solution">Business Solution</option>
                    <option value="material">Hybrid</option>
                    <option value="distributor">Distributor</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[14px] text-primary pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#fbfaff] px-2.5 py-1 rounded-xl border border-[#e2e8f0]/80">
                <span className="text-[9.5px] font-bold text-[#8E94B7] uppercase tracking-wider">
                  Metrik:
                </span>
                <div className="relative">
                  <select
                    value={overviewMetricFilter}
                    onChange={(e) => setOverviewMetricFilter(e.target.value)}
                    className="bg-transparent text-[10.5px] font-black text-[#154be2] focus:outline-none focus:ring-0 appearance-none cursor-pointer pr-6 py-0.5"
                  >
                    <option value="movement">Movement</option>
                    <option value="idle">Idle Stock</option>
                    <option value="total_stock">Total Stock</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[14px] text-primary pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#fbfaff] px-2.5 py-1 rounded-xl border border-[#e2e8f0]/40 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[4px] bg-gradient-to-tr from-[#154be2] to-[#3b82f6]" />
                  <span className="text-[10px] font-extrabold text-[#4e5572]">
                    {overviewMetricFilter === "movement"
                      ? "Stock In"
                      : overviewMetricFilter === "idle"
                        ? "Idle Stock"
                        : overviewMetricFilter === "total_stock"
                          ? "Total Stock"
                          : overviewMetricFilter === "Opening"
                            ? "Stok Awal"
                            : "POG (Penjualan)"}
                  </span>
                </div>
                {overviewMetricFilter !== "idle" &&
                  overviewMetricFilter !== "total_stock" && (
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[4px] bg-gradient-to-tr from-[#06b6d4] to-[#22d3ee]" />
                      <span className="text-[10px] font-extrabold text-[#4e5572]">
                        {overviewMetricFilter === "movement"
                          ? "POG"
                          : "Stok Akhir"}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto scrollbar-thin select-none">
            <div
              style={{
                minWidth: `${Math.max(600, overviewStats.areaChartData.length * 95)}px`,
                width: "100%",
                height: "280px",
              }}
              className="font-sans"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overviewStats.areaChartData}
                  margin={{ top: 25, right: 10, left: -10, bottom: 35 }}
                  barGap={currentBarGap}
                  barCategoryGap={currentBarCategoryGap}
                >
                  <defs>
                    <linearGradient
                      id="colorAreaPog"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#154be2"
                        stopOpacity={0.95}
                      />
                      <stop
                        offset="100%"
                        stopColor="#3b82f6"
                        stopOpacity={0.7}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorAreaStock"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#06b6d4"
                        stopOpacity={0.95}
                      />
                      <stop
                        offset="100%"
                        stopColor="#22d3ee"
                        stopOpacity={0.7}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={<CustomXAxisTick />}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={45}
                  />
                  <YAxis
                    tick={{ fill: "#8E94B7", fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(21, 75, 226, 0.03)" }}
                    contentStyle={{
                      backgroundColor: "white",
                      borderRadius: "16px",
                      border: "1px solid #edecff",
                      boxShadow: "0 12px 32px rgba(21,75,226,0.1)",
                    }}
                    labelStyle={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#181a2c",
                    }}
                    itemStyle={{ fontSize: "10px", padding: "1px 0" }}
                    formatter={(value: any, name: any) => {
                      if (
                        value === undefined ||
                        value === null ||
                        isNaN(Number(value))
                      )
                        return [value, name];
                      return [
                        Math.round(Number(value)).toLocaleString("id-ID"),
                        name,
                      ];
                    }}
                  />
                  <Bar
                    dataKey={
                      overviewMetricFilter === "movement"
                        ? "sellIn"
                        : overviewMetricFilter === "idle"
                          ? "idle"
                          : overviewMetricFilter === "total_stock"
                            ? "stock"
                            : overviewMetricFilter === "Opening"
                              ? "opening"
                              : "pog"
                    }
                    name={
                      overviewMetricFilter === "movement"
                        ? "Stock In"
                        : overviewMetricFilter === "idle"
                          ? "Idle Stock"
                          : overviewMetricFilter === "total_stock"
                            ? "Total Stock"
                            : overviewMetricFilter === "Opening"
                              ? "Stok Awal"
                              : "Penjualan (POG)"
                    }
                    fill="url(#colorAreaPog)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={currentMaxBarSize}
                  >
                    <LabelList
                      dataKey={
                        overviewMetricFilter === "movement"
                          ? "sellIn"
                          : overviewMetricFilter === "idle"
                            ? "idle"
                            : overviewMetricFilter === "total_stock"
                              ? "stock"
                              : overviewMetricFilter === "Opening"
                                ? "opening"
                                : "pog"
                      }
                      position="top"
                      offset={8}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        fill: "#154be2",
                        fontFamily: "sans-serif",
                      }}
                      formatter={(val: any) => {
                        if (
                          val === undefined ||
                          val === null ||
                          isNaN(Number(val))
                        )
                          return "";
                        const num = Number(val);
                        if (num === 0) return "0";
                        return Math.abs(num) < 10
                          ? num.toFixed(1)
                          : Math.round(num).toLocaleString();
                      }}
                    />
                  </Bar>
                  {overviewMetricFilter !== "idle" &&
                    overviewMetricFilter !== "total_stock" && (
                      <Bar
                        dataKey={
                          overviewMetricFilter === "movement" ? "pog" : "stock"
                        }
                        name={
                          overviewMetricFilter === "movement"
                            ? "POG"
                            : "Stok Akhir"
                        }
                        fill="url(#colorAreaStock)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={currentMaxBarSize}
                      >
                        <LabelList
                          dataKey={
                            overviewMetricFilter === "movement"
                              ? "pog"
                              : "stock"
                          }
                          position="top"
                          offset={8}
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            fill: "#0a90a6",
                            fontFamily: "sans-serif",
                          }}
                          formatter={(val: any) => {
                            if (
                              val === undefined ||
                              val === null ||
                              isNaN(Number(val))
                            )
                              return "";
                            const num = Number(val);
                            if (num === 0) return "0";
                            return Math.abs(num) < 10
                              ? num.toFixed(1)
                              : Math.round(num).toLocaleString();
                          }}
                        />
                      </Bar>
                    )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 2: Kiosk Category Breakdown */}
        <div className="bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.03)] border border-[#154be2]/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-[#f0effc]/60">
              <span className="material-symbols-outlined text-purple-500 text-sm font-semibold">
                pie_chart
              </span>
              <h3 className="text-xs font-bold text-[#181a2c] tracking-tight">
                Segmentasi Partner
              </h3>
            </div>
            <p className="text-[10px] text-[#8E94B7] mt-1.5 leading-relaxed">
              Klasifikasi kelas kios berdasarkan kriteria volume penjualan
              nasional
            </p>
          </div>

          <div className="h-44 w-full relative my-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overviewStats.categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {overviewStats.categoryChartData.map((_, index) => {
                    const colors = [
                      "#154be2",
                      "#06b6d4",
                      "#a855f7",
                      "#f59e0b",
                      "#ec4899",
                    ];
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors[index % colors.length]}
                        stroke="rgba(255,255,255,0.8)"
                        strokeWidth={2}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    border: "1px solid #edecff",
                    boxShadow: "0 8px 24px rgba(21,75,226,0.08)",
                  }}
                  itemStyle={{ fontSize: "10px", fontWeight: "bold" }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
              <span className="text-2xl font-black text-[#181a2c] tracking-tight">
                {overviewStats.totalKiosks}
              </span>
              <span className="text-[8px] text-[#8E94B7] font-bold uppercase tracking-wider text-center">
                Outlet
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#f0effc]">
            {overviewStats.categoryChartData.map((item, index) => {
              const colors = [
                "#154be2",
                "#06b6d4",
                "#a855f7",
                "#f59e0b",
                "#ec4899",
              ];
              return (
                <div
                  key={item.name}
                  className="flex flex-col items-center p-1 bg-[#fbfaff] rounded-lg border border-[#f0effc]"
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: colors[index % colors.length],
                      }}
                    />
                    <span className="text-[9px] font-bold text-[#181a2c]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#555a77] font-bold mt-0.5">
                    {item.value} Kios
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section: Employee Sales Ranking (Highest & Lowest) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top 5 Employees - Highest Sales */}
        <div className="bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.03)] border border-[#154be2]/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-sm font-semibold">
                trending_up
              </span>
              <h3 className="text-xs font-bold text-[#181a2c] tracking-tight">
                Top 5 Employee dengan Penjualan Tertinggi
              </h3>
            </div>
            <p className="text-[10px] text-[#8E94B7] mt-0.5">
              Daftar tim penjualan dengan pencapaian POG tertinggi saat ini
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            {employeePerformanceData.highest.map((item, index) => (
              <div
                key={item.employee}
                className="flex items-center justify-between p-3 rounded-xl bg-[#fbfaff] border border-[#f0effc] hover:border-[#154be2]/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                      index === 0
                        ? "bg-amber-100 text-amber-700"
                        : index === 1
                          ? "bg-slate-200 text-slate-700"
                          : index === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-[#154be2]/10 text-primary"
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-[#181a2c] leading-tight truncate max-w-[200px] sm:max-w-[400px]">
                      {item.employee}
                    </h4>
                    <p className="text-[9px] text-[#8E94B7] mt-0.5 truncate">
                      Area:{" "}
                      <span className="font-semibold text-primary">
                        {item.area}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-emerald-600 font-sans">
                    {item.pog.toLocaleString()}{" "}
                    <span className="text-[9px] text-[#8E94B7] font-normal">
                      POG
                    </span>
                  </p>
                  <p className="text-[8.5px] text-[#8E94B7] mt-0.5">
                    Sisa stok:{" "}
                    <span className="font-medium text-slate-700">
                      {item.currentStock.toLocaleString()} Kg
                    </span>
                  </p>
                </div>
              </div>
            ))}

            {employeePerformanceData.highest.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <span className="material-symbols-outlined text-[36px] text-[#8E94B7]/40 mb-2">
                  trending_flat
                </span>
                <p className="text-xs text-[#8E94B7]">
                  Data POG belum dimasukkan bulan ini.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Employees - Lowest Sales */}
        <div className="bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.03)] border border-[#154be2]/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500 text-sm font-semibold">
                trending_down
              </span>
              <h3 className="text-xs font-bold text-[#181a2c] tracking-tight">
                Top 5 Employee dengan Penjualan Terendah
              </h3>
            </div>
            <p className="text-[10px] text-[#8E94B7] mt-0.5">
              Daftar tim penjualan dengan pencapaian POG terendah saat ini
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            {employeePerformanceData.lowest.map((item, index) => (
              <div
                key={item.employee}
                className="flex items-center justify-between p-3 rounded-xl bg-[#fbfaff] border border-[#f0effc] hover:border-[#154be2]/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                      index === 0
                        ? "bg-rose-100 text-rose-700"
                        : index === 1
                          ? "bg-orange-50 text-orange-700 border border-orange-200"
                          : index === 2
                            ? "bg-orange-50 text-orange-600"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-[#181a2c] leading-tight truncate max-w-[200px] sm:max-w-[400px]">
                      {item.employee}
                    </h4>
                    <p className="text-[9px] text-[#8E94B7] mt-0.5 truncate">
                      Area:{" "}
                      <span className="font-semibold text-primary">
                        {item.area}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-rose-600 font-sans">
                    {item.pog.toLocaleString()}{" "}
                    <span className="text-[9px] text-[#8E94B7] font-normal">
                      POG
                    </span>
                  </p>
                  <p className="text-[8.5px] text-[#8E94B7] mt-0.5">
                    Sisa stok:{" "}
                    <span className="font-medium text-slate-700">
                      {item.currentStock.toLocaleString()} Kg
                    </span>
                  </p>
                </div>
              </div>
            ))}

            {employeePerformanceData.lowest.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <span className="material-symbols-outlined text-[36px] text-[#8E94B7]/40 mb-2">
                  trending_flat
                </span>
                <p className="text-xs text-[#8E94B7]">
                  Data POG belum dimasukkan bulan ini.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: History Bulanan */}
      <div className="bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.03)] border border-[#154be2]/5 flex flex-col justify-between mt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 pb-4 border-b border-[#f0effc]/60 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm font-semibold border-b border-primary/20 pb-0.5">
                timeline
              </span>
              <h3 className="text-xs font-bold text-[#181a2c] tracking-tight">
                Tren Perkembangan Data (History Bulanan)
              </h3>
            </div>
            <p className="text-[10px] text-[#8E94B7] mt-0.5">
              Analisis perbandingan histori total volume perkembangan data dari
              bulan ke bulan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
            <button
              onClick={() => setHistoryChartType("opening")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                historyChartType === "opening"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-[#fbfaff] text-[#8E94B7] hover:bg-slate-100 border border-slate-100/40"
              }`}
            >
              Opening Inv
            </button>
            <button
              onClick={() => setHistoryChartType("ending")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                historyChartType === "ending"
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-[#fbfaff] text-[#8E94B7] hover:bg-slate-100 border border-slate-100/40"
              }`}
            >
              Ending Inv
            </button>
            <button
              onClick={() => setHistoryChartType("stockIn")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                historyChartType === "stockIn"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-[#fbfaff] text-[#8E94B7] hover:bg-slate-100 border border-slate-100/40"
              }`}
            >
              Stock In
            </button>
            <button
              onClick={() => setHistoryChartType("idle")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                historyChartType === "idle"
                  ? "bg-amber-600 text-white shadow-md"
                  : "bg-[#fbfaff] text-[#8E94B7] hover:bg-slate-100 border border-slate-100/40"
              }`}
            >
              Idle Stock
            </button>
            <button
              onClick={() => setHistoryChartType("pog")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                historyChartType === "pog"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-[#fbfaff] text-[#8E94B7] hover:bg-slate-100 border border-slate-100/40"
              }`}
            >
              POG
            </button>
          </div>
        </div>

        {overviewHistoryData && overviewHistoryData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 bg-[#fbfaff] p-4 rounded-2xl border border-slate-100">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Rata-rata POG Bulanan
              </span>
              <span className="text-sm font-bold text-blue-600 mt-1">
                {Math.round(
                  overviewHistoryData.reduce(
                    (acc, curr) => acc + curr.pog,
                    0,
                  ) / overviewHistoryData.length,
                ).toLocaleString()}{" "}
                <span className="text-[10px] font-medium text-slate-400">
                  Kg
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Total Penyerapan POG
              </span>
              <span className="text-sm font-bold text-indigo-600 mt-1">
                {overviewHistoryData
                  .reduce((acc, curr) => acc + curr.pog, 0)
                  .toLocaleString()}{" "}
                <span className="text-[10px] font-medium text-slate-400">
                  Kg
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Mutasi Maksimal Stok
              </span>
              <span className="text-sm font-bold text-teal-600 mt-1">
                {Math.max(
                  ...overviewHistoryData.map((d) => d.ending),
                ).toLocaleString()}{" "}
                <span className="text-[10px] font-medium text-slate-400">
                  Kg
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[#8E94B7] uppercase tracking-wider">
                Bulan Teraktif
              </span>
              <span className="text-sm font-bold text-amber-600 mt-1 truncate">
                {(() => {
                  const maxPogObj = [...overviewHistoryData].sort(
                    (a, b) => b.pog - a.pog,
                  )[0];
                  return maxPogObj ? maxPogObj.monthLabel : "-";
                })()}
              </span>
            </div>
          </div>
        )}

        <div className="h-64 w-full font-sans">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={overviewHistoryData}
              margin={{ top: 25, right: 15, left: -15, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="historyColorOpening"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient
                  id="historyColorEnding"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient
                  id="historyColorStockIn"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient
                  id="historyColorIdle"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient
                  id="historyColorPog"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: "#4e5572", fontSize: 8.5, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8E94B7", fontSize: 9, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                cursor={{
                  stroke: "#154be2",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
                contentStyle={{
                  backgroundColor: "white",
                  borderRadius: "16px",
                  border: "1px solid #e1e7ff",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                }}
                labelStyle={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#181a2c",
                }}
                itemStyle={{ fontSize: "10px", padding: "1px 0" }}
              />

              <Legend
                iconSize={10}
                iconType="circle"
                wrapperStyle={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  marginTop: "10px",
                }}
              />

              {historyChartType === "opening" && (
                <Area
                  type="monotone"
                  dataKey="opening"
                  name="Opening Inv (Kg)"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#historyColorOpening)"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#4f46e5",
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6, strokeWidth: 1 }}
                >
                  <LabelList
                    dataKey="opening"
                    position="top"
                    offset={10}
                    style={{ fontSize: 9, fontWeight: 700, fill: "#4f46e5" }}
                    formatter={(value: any) =>
                      value ? Math.round(Number(value)).toLocaleString() : "0"
                    }
                  />
                </Area>
              )}

              {historyChartType === "ending" && (
                <Area
                  type="monotone"
                  dataKey="ending"
                  name="Ending Inv (Kg)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#historyColorEnding)"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#a855f7",
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6, strokeWidth: 1 }}
                >
                  <LabelList
                    dataKey="ending"
                    position="top"
                    offset={10}
                    style={{ fontSize: 9, fontWeight: 700, fill: "#a855f7" }}
                    formatter={(value: any) =>
                      value ? Math.round(Number(value)).toLocaleString() : "0"
                    }
                  />
                </Area>
              )}

              {historyChartType === "stockIn" && (
                <Area
                  type="monotone"
                  dataKey="stockIn"
                  name="Stock In (Kg)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#historyColorStockIn)"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#10b981",
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6, strokeWidth: 1 }}
                >
                  <LabelList
                    dataKey="stockIn"
                    position="top"
                    offset={10}
                    style={{ fontSize: 9, fontWeight: 700, fill: "#10b981" }}
                    formatter={(value: any) =>
                      value ? Math.round(Number(value)).toLocaleString() : "0"
                    }
                  />
                </Area>
              )}

              {historyChartType === "idle" && (
                <Area
                  type="monotone"
                  dataKey="idle"
                  name="Idle Stock (Kg)"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#historyColorIdle)"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#f59e0b",
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6, strokeWidth: 1 }}
                >
                  <LabelList
                    dataKey="idle"
                    position="top"
                    offset={10}
                    style={{ fontSize: 9, fontWeight: 700, fill: "#f59e0b" }}
                    formatter={(value: any) =>
                      value ? Math.round(Number(value)).toLocaleString() : "0"
                    }
                  />
                </Area>
              )}

              {historyChartType === "pog" && (
                <Area
                  type="monotone"
                  dataKey="pog"
                  name="POG (Kg)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#historyColorPog)"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#2563eb",
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6, strokeWidth: 1 }}
                >
                  <LabelList
                    dataKey="pog"
                    position="top"
                    offset={10}
                    style={{ fontSize: 9, fontWeight: 700, fill: "#2563eb" }}
                    formatter={(value: any) =>
                      value ? Math.round(Number(value)).toLocaleString() : "0"
                    }
                  />
                </Area>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Focused Chart Modal */}
      {isChartFocusedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-[0_24px_64px_rgba(21,75,226,0.15)] border border-[#154be2]/10 p-6 md:p-8 flex flex-col justify-between max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between pb-4 border-b border-[#f0effc]">
              <div>
                <div className="flex items-center gap-2 text-primary font-bold">
                  <span className="material-symbols-outlined text-[#154be2]">
                    analytics
                  </span>
                  <span className="text-[14px] uppercase tracking-wider text-[#154be2] font-black">
                    Detail Fokus Grafik
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#181a2c] tracking-tight mt-1">
                  {overviewGroupDimension === "area"
                    ? "Performa Kinerja Wilayah (Area)"
                    : overviewGroupDimension === "province"
                      ? "Performa Kinerja per Provinsi"
                      : overviewGroupDimension === "sales_agronomist"
                        ? "Performa Kinerja Sales Agronomist (SA)"
                        : overviewGroupDimension === "business_solution"
                          ? "Performa Kinerja Business Solution (BS)"
                          : overviewGroupDimension === "distributor"
                            ? "Performa Kinerja per Distributor"
                            : "Performa Kinerja per Hybrid"}
                </h3>
                <p className="text-xs text-[#8E94B7] mt-1">
                  {overviewMetricFilter === "movement"
                    ? "Analisis perbandingan Stock In (Stok Masuk) vs POG (Penjualan)"
                    : overviewMetricFilter === "idle"
                      ? "Analisis perbandingan Idle Stock vs Sisa Stok Akhir"
                      : overviewMetricFilter === "total_stock"
                        ? "Analisis total sisa stok akhir"
                        : overviewMetricFilter === "Opening"
                          ? "Analisis perbandingan Stok Awal vs Sisa Stok Akhir"
                          : "Analisis perbandingan POG (Penjualan) vs Sisa Stok Akhir"}
                </p>
              </div>
              <button
                onClick={() => setIsChartFocusedModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 py-4 bg-[#fbfaff] px-4 rounded-2xl border border-[#e2e8f0]/60 my-4 shrink-0">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider">
                    Dimensi:
                  </span>
                  <select
                    value={overviewGroupDimension}
                    onChange={(e) =>
                      setOverviewGroupDimension(
                        e.target.value as OverviewDimension,
                      )
                    }
                    className="bg-white border border-[#e2e8f0] rounded-xl px-2.5 py-1 text-xs font-black text-[#154be2] focus:outline-none focus:ring-1 focus:ring-[#154be2] cursor-pointer"
                  >
                    <option value="area">Area</option>
                    <option value="province">Province</option>
                    <option value="sales_agronomist">Sales Agronomist</option>
                    <option value="business_solution">Business Solution</option>
                    <option value="material">Hybrid</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider">
                    Metrik:
                  </span>
                  <select
                    value={overviewMetricFilter}
                    onChange={(e) => setOverviewMetricFilter(e.target.value)}
                    className="bg-white border border-[#e2e8f0] rounded-xl px-2.5 py-1 text-xs font-black text-[#154be2] focus:outline-none focus:ring-1 focus:ring-[#154be2] cursor-pointer"
                  >
                    <option value="movement">Movement</option>
                    <option value="idle">Idle Stock</option>
                    <option value="total_stock">Total Stock</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-gradient-to-tr from-[#154be2] to-[#3b82f6]" />
                  <span className="text-xs font-extrabold text-[#4e5572]">
                    {overviewMetricFilter === "movement"
                      ? "Stock In"
                      : overviewMetricFilter === "idle"
                        ? "Idle Stock"
                        : overviewMetricFilter === "total_stock"
                          ? "Total Stock"
                          : overviewMetricFilter === "Opening"
                            ? "Stok Awal"
                            : "POG (Penjualan)"}
                  </span>
                </div>
                {overviewMetricFilter !== "idle" &&
                  overviewMetricFilter !== "total_stock" && (
                    <div className="flex items-center gap-1.5">
                      <span className="size-3 rounded-[4px] bg-gradient-to-tr from-[#06b6d4] to-[#22d3ee]" />
                      <span className="text-xs font-extrabold text-[#4e5572]">
                        {overviewMetricFilter === "movement"
                          ? "POG"
                          : "Stok Akhir"}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            <div className="w-full flex-1 min-h-[350px] overflow-x-auto overflow-y-hidden scrollbar-thin select-none">
              <div
                style={{
                  minWidth: `${Math.max(800, overviewStats.areaChartData.length * 120)}px`,
                  width: "100%",
                  height: "350px",
                }}
                className="font-sans"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overviewStats.areaChartData}
                    margin={{ top: 25, right: 15, left: -10, bottom: 35 }}
                    barGap={currentBarGap}
                    barCategoryGap={currentBarCategoryGap}
                  >
                    <defs>
                      <linearGradient
                        id="modalColorAreaPog"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#154be2"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="#3b82f6"
                          stopOpacity={0.7}
                        />
                      </linearGradient>
                      <linearGradient
                        id="modalColorAreaStock"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#06b6d4"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="#22d3ee"
                          stopOpacity={0.7}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="name"
                      tick={<CustomXAxisTick />}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      height={45}
                    />
                    <YAxis
                      tick={{ fill: "#8E94B7", fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(21, 75, 226, 0.03)" }}
                      contentStyle={{
                        backgroundColor: "white",
                        borderRadius: "16px",
                        border: "1px solid #edecff",
                        boxShadow: "0 12px 32px rgba(21,75,226,0.1)",
                      }}
                      labelStyle={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#181a2c",
                      }}
                      itemStyle={{ fontSize: "11px", padding: "1px 0" }}
                      formatter={(value: any, name: any) => {
                        if (
                          value === undefined ||
                          value === null ||
                          isNaN(Number(value))
                        )
                          return [value, name];
                        return [
                          Math.round(Number(value)).toLocaleString("id-ID"),
                          name,
                        ];
                      }}
                    />
                    <Bar
                      dataKey={
                        overviewMetricFilter === "movement"
                          ? "sellIn"
                          : overviewMetricFilter === "idle"
                            ? "idle"
                            : overviewMetricFilter === "total_stock"
                              ? "stock"
                              : overviewMetricFilter === "Opening"
                                ? "opening"
                                : "pog"
                      }
                      name={
                        overviewMetricFilter === "movement"
                          ? "Stock In"
                          : overviewMetricFilter === "idle"
                            ? "Idle Stock"
                            : overviewMetricFilter === "total_stock"
                              ? "Total Stock"
                              : overviewMetricFilter === "Opening"
                                ? "Stok Awal"
                                : "Penjualan (POG)"
                      }
                      fill="url(#modalColorAreaPog)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={currentMaxBarSize}
                    >
                      <LabelList
                        dataKey={
                          overviewMetricFilter === "movement"
                            ? "sellIn"
                            : overviewMetricFilter === "idle"
                              ? "idle"
                              : overviewMetricFilter === "total_stock"
                                ? "stock"
                                : overviewMetricFilter === "Opening"
                                  ? "opening"
                                  : "pog"
                        }
                        position="top"
                        offset={8}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fill: "#154be2",
                          fontFamily: "sans-serif",
                        }}
                        formatter={(val: any) => {
                          if (
                            val === undefined ||
                            val === null ||
                            isNaN(Number(val))
                          )
                            return "";
                          const num = Number(val);
                          if (num === 0) return "0";
                          return Math.abs(num) < 10
                            ? num.toFixed(1)
                            : Math.round(num).toLocaleString();
                        }}
                      />
                    </Bar>
                    {overviewMetricFilter !== "idle" &&
                      overviewMetricFilter !== "total_stock" && (
                        <Bar
                          dataKey={
                            overviewMetricFilter === "movement"
                              ? "pog"
                              : "stock"
                          }
                          name={
                            overviewMetricFilter === "movement"
                              ? "POG"
                              : "Stok Akhir"
                          }
                          fill="url(#modalColorAreaStock)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={currentMaxBarSize}
                        >
                          <LabelList
                            dataKey={
                              overviewMetricFilter === "movement"
                                ? "pog"
                                : "stock"
                            }
                            position="top"
                            offset={8}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              fill: "#0ea5e9",
                              fontFamily: "sans-serif",
                            }}
                            formatter={(val: any) => {
                              if (
                                val === undefined ||
                                val === null ||
                                isNaN(Number(val))
                              )
                                return "";
                              const num = Number(val);
                              if (num === 0) return "0";
                              return Math.abs(num) < 10
                                ? num.toFixed(1)
                                : Math.round(num).toLocaleString();
                            }}
                          />
                        </Bar>
                      )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
