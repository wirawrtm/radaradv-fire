import React from "react";
import { CLUSTER_CONFIG } from "../../utils/constants";
import { formatOverviewVal } from "../../utils/formatters";
import { PogKpiCard } from "../common/PogKpiCard";

interface StockSummaryTabProps {
  filteredSummaryData: any[];
  aggregatedPogDataLength: number;
  totalSummaryPog: any;
  totalPog: any;
  totalSummary: Record<string, number>;
  overviewUseMt: boolean;
  filterBelowCrop: string;
  setFilterBelowCrop: (v: string) => void;
  selectedClusters: string[];
  setSelectedClusters: React.Dispatch<React.SetStateAction<string[]>>;
  isSummaryFilterOpen: boolean;
  setIsSummaryFilterOpen: (v: boolean) => void;
  isPogFilterOpen: boolean;
  setIsPogFilterOpen: (v: boolean) => void;
  activeVisitStats: { visited: number; total: number; percentage: number };
  mappingPic: string;
  normalizeName: (name: string) => string;
  categoryDistributionStats: {
    data: Array<{ name: string; value: number }>;
    total: number;
  };
  categoryChartSegments: Array<{
    name: string;
    value: number;
    percentage: number;
    strokeDasharray: string;
    strokeDashoffset: number;
    color: string;
  }>;
  summaryGroupBy: string;
  setSummaryGroupBy: (v: string) => void;
  summarySubGroupBy: string;
  setSummarySubGroupBy: (v: string) => void;
  availableCrops: string[];
  expandedRows: Record<string, boolean>;
  toggleRow: (name: string) => void;
  handleDownloadSummaryExcel: () => void;
  renderMaybeChannelName: (name: string, defaultClass?: string) => React.ReactNode;
  getStatsForPic: (name: string) => {
    visited: number;
    total: number;
    percentage: number;
  };
  isRowVisitZero: (rowName: string) => boolean;
}

export default function StockSummaryTab({
  filteredSummaryData,
  aggregatedPogDataLength,
  totalSummaryPog,
  totalPog,
  totalSummary,
  overviewUseMt,
  filterBelowCrop,
  setFilterBelowCrop,
  selectedClusters,
  setSelectedClusters,
  isSummaryFilterOpen,
  setIsSummaryFilterOpen,
  isPogFilterOpen,
  setIsPogFilterOpen,
  activeVisitStats,
  mappingPic,
  normalizeName,
  categoryDistributionStats,
  categoryChartSegments,
  summaryGroupBy,
  setSummaryGroupBy,
  summarySubGroupBy,
  setSummarySubGroupBy,
  availableCrops,
  expandedRows,
  toggleRow,
  handleDownloadSummaryExcel,
  renderMaybeChannelName,
  getStatsForPic,
  isRowVisitZero,
}: StockSummaryTabProps) {
  const renderRecursiveSummaryRow = (
    row: any,
    depth = 0,
  ): React.ReactNode => {
    const hasChildren = row.children && row.children.length > 0;
    const isExpanded = !!expandedRows[row.name];
    const isZeroTotal = isRowVisitZero(row.name);

    return (
      <div
        key={row.name}
        className={`overflow-hidden transition-all ${
          isZeroTotal ? "bg-red-50/40 border-l-[3px] border-red-300" : ""
        } ${
          depth === 0
            ? "md:bg-white md:rounded-[32px] md:shadow-[0_4px_24px_rgba(24,26,44,0.08)] md:border md:border-[#edecff]"
            : ""
        }`}
      >
        <div
          className={`flex justify-between items-center px-5 py-4 pb-2 transition-colors duration-150 animate-in fade-in slide-in-from-left-2 duration-200 ${
            isZeroTotal ? "hover:bg-red-100/40" : "hover:bg-slate-50/60"
          }`}
          style={{ paddingLeft: `${Math.max(20, depth * 20)}px` }}
        >
          <div className="flex flex-col min-w-0 flex-1 pr-2">
            <span
              className="font-semibold text-xs md:text-sm text-[#181a2c] uppercase flex items-center gap-1.5 cursor-pointer select-none"
              onClick={() => {
                if (hasChildren) {
                  toggleRow(row.name);
                }
              }}
            >
              {hasChildren && (
                <span
                  className={`material-symbols-outlined text-[20px] shrink-0 ${
                    isZeroTotal ? "text-red-500" : "text-primary"
                  }`}
                >
                  {isExpanded ? "keyboard_arrow_down" : "keyboard_arrow_right"}
                </span>
              )}
              <span className="truncate">
                {renderMaybeChannelName(row.name)}
              </span>
              {isZeroTotal && (
                <span className="text-[7.5px] font-extrabold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider">
                  Belum Dikunjungi
                </span>
              )}
              {row.isLeaf &&
                summarySubGroupBy === "channel" &&
                row.category && (
                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                    {row.category}
                  </span>
                )}
            </span>
            {row.isLeaf && summarySubGroupBy === "channel" && row.pic && (
              <div className="text-[10px] text-[#8E94B7] mt-1 truncate">
                {row.pic}
              </div>
            )}
            {!row.isLeaf && getStatsForPic(row.name) && (
              <div className="flex gap-1.5 mt-1 ml-6 text-[8.5px] uppercase tracking-wide font-bold text-[#8E94B7] flex-wrap">
                <span className="bg-[#f4f2ff] px-2 py-0.5 rounded-full border border-[#edecff] flex gap-1">
                  V:{" "}
                  <span className="text-primary">
                    {getStatsForPic(row.name)?.visited}
                  </span>
                </span>
                <span className="bg-[#f4f2ff] px-2 py-0.5 rounded-full border border-[#edecff] flex gap-1">
                  C:{" "}
                  <span className="text-[#181a2c]">
                    {getStatsForPic(row.name)?.total}
                  </span>
                </span>
                <span className="bg-[#f4f2ff] px-2 py-0.5 rounded-full border border-[#edecff] flex gap-1">
                  %:{" "}
                  <span className="text-emerald-600">
                    {getStatsForPic(row.name)?.percentage}%
                  </span>
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span
              className={`font-bold text-sm ${
                isZeroTotal ? "text-red-600" : "text-primary"
              }`}
            >
              {formatOverviewVal(row.selectedTotal, overviewUseMt).valueStr}
            </span>
            <span className="text-[8px] text-[#8E94B7] uppercase tracking-widest font-bold">
              Total {formatOverviewVal(row.selectedTotal, overviewUseMt).unit}
            </span>
          </div>
        </div>

        <div
          className={`mx-5 mb-3 mt-2 flex divide-x rounded-[14px] overflow-hidden ${
            isZeroTotal
              ? "divide-red-200 bg-red-300 shadow-[0_12px_32px_rgba(239,68,68,0.18)]"
              : "divide-white/20 bg-primary shadow-[0_12px_32px_rgba(21,75,226,0.35)]"
          }`}
          style={{ marginLeft: `${Math.max(20, depth * 20)}px` }}
        >
          {selectedClusters.map((clusterKey) => {
            if (
              clusterKey === "Uncategorized" &&
              (!row[clusterKey] || row[clusterKey] === 0)
            )
              return null;
            const clusterConfig = CLUSTER_CONFIG.find(
              (c) => c.key === clusterKey,
            );
            return (
              <div
                key={clusterKey}
                className={`flex-1 min-w-0 p-2 flex flex-col items-center justify-center text-center transition-colors ${
                  isZeroTotal ? "hover:bg-white/15" : "hover:bg-white/10"
                }`}
              >
                <span
                  className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 truncate w-full ${
                    isZeroTotal ? "text-white/80" : "text-white/85"
                  }`}
                >
                  {clusterConfig?.label || clusterKey}
                </span>
                <span className="font-semibold text-[10.5px] truncate w-full text-white">
                  {formatOverviewVal(row[clusterKey], overviewUseMt).valueStr}
                </span>
              </div>
            );
          })}
        </div>

        {isExpanded && hasChildren && (
          <div className="pb-2 border-t border-[#edecff] bg-slate-50/15">
            {row.children.map((child: any) =>
              renderRecursiveSummaryRow(child, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRecursiveSubordinate = (
    child: any,
    depth = 0,
  ): React.ReactNode => {
    const isChildZeroTeam = isRowVisitZero(child.name);
    const hasSubChildren = child.children && child.children.length > 0;
    const isSubExpanded = !!expandedRows[child.name];

    return (
      <div
        key={child.name}
        className="flex flex-col w-full animate-in fade-in slide-in-from-left-2 duration-200"
        style={{ paddingLeft: depth > 0 ? "16px" : "0px" }}
      >
        <div
          className={`flex flex-col p-3.5 rounded-[18px] transition-all duration-200 mb-2 ${
            isChildZeroTeam
              ? "bg-red-50/70 border border-red-200/60 shadow-[0_10px_28px_rgba(239,68,68,0.12)]"
              : "bg-[#fbfaff] shadow-[0_10px_28px_rgba(21,75,226,0.18)]"
          }`}
        >
          <div className="flex justify-between items-center mb-2 px-1 flex-wrap gap-2">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                {hasSubChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRow(child.name);
                    }}
                    className="focus:outline-none flex items-center justify-center p-0.5 hover:bg-slate-200/50 rounded-full"
                  >
                    <span className="material-symbols-outlined text-primary text-[16px]">
                      {isSubExpanded
                        ? "keyboard_arrow_down"
                        : "keyboard_arrow_right"}
                    </span>
                  </button>
                )}
                <span className="font-bold text-[11px] text-[#181a2c] uppercase flex items-center gap-1.5 flex-wrap">
                  <span className="truncate">
                    {renderMaybeChannelName(child.name)}
                  </span>
                  {isChildZeroTeam && (
                    <span className="text-[7.5px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider animate-pulse font-bold">
                      Belum Dikunjungi
                    </span>
                  )}
                </span>
              </div>
              {getStatsForPic(child.name) && (
                <div className="flex gap-1.2 mt-1 ml-5 text-[8px] uppercase tracking-wide font-bold text-[#8E94B7] flex-wrap">
                  <span className="bg-[#f4f2ff] px-1.5 py-0.5 rounded-full border border-[#edecff] flex gap-1">
                    V:{" "}
                    <span className="text-primary">
                      {getStatsForPic(child.name)?.visited}
                    </span>
                  </span>
                  <span className="bg-[#f4f2ff] px-1.5 py-0.5 rounded-full border border-[#edecff] flex gap-1">
                    C:{" "}
                    <span className="text-[#181a2c]">
                      {getStatsForPic(child.name)?.total}
                    </span>
                  </span>
                  <span className="bg-[#f4f2ff] px-1.5 py-0.5 rounded-full border border-[#edecff] flex gap-1">
                    %:{" "}
                    <span className="text-emerald-600">
                      {getStatsForPic(child.name)?.percentage}%
                    </span>
                  </span>
                </div>
              )}
            </div>
            <span
              className={`font-bold text-[11.5px] shrink-0 ${
                isChildZeroTeam ? "text-red-600" : "text-[#181a2c]"
              }`}
            >
              {formatOverviewVal(child.selectedTotal, overviewUseMt).valueStr}{" "}
              <span className="text-[8.5px] text-[#8E94B7]">
                {formatOverviewVal(child.selectedTotal, overviewUseMt).unit}
              </span>
            </span>
          </div>
          <div
            className={`flex w-full divide-x rounded-[14px] overflow-hidden ${
              isChildZeroTeam
                ? "divide-red-200 bg-red-100/40"
                : "divide-primary/10 bg-primary/8"
            }`}
          >
            {selectedClusters.map((clusterKey) => {
              if (
                clusterKey === "Uncategorized" &&
                (!child[clusterKey] || child[clusterKey] === 0)
              )
                return null;
              const clusterConfig = CLUSTER_CONFIG.find(
                (c) => c.key === clusterKey,
              );
              return (
                <div
                  key={clusterKey}
                  className={`flex-1 min-w-0 p-1.5 flex flex-col items-center justify-center text-center transition-colors ${
                    isChildZeroTeam
                      ? "hover:bg-red-100/30"
                      : "hover:bg-primary/5"
                  }`}
                >
                  <span
                    className={`text-[7px] font-bold uppercase tracking-wider mb-0.5 truncate w-full ${
                      isChildZeroTeam ? "text-red-700/80" : "text-[#8E94B7]"
                    }`}
                  >
                    {clusterConfig?.label || clusterKey}
                  </span>
                  <span
                    className={`font-semibold text-[9.5px] truncate w-full ${
                      isChildZeroTeam ? "text-red-600" : "text-[#181a2c]"
                    }`}
                  >
                    {
                      formatOverviewVal(child[clusterKey], overviewUseMt)
                        .valueStr
                    }
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isSubExpanded && hasSubChildren && (
          <div className="flex flex-col border-l border-[#edecff] ml-3 pl-1 gap-1 mb-2">
            {child.children.map((subChild: any) =>
              renderRecursiveSubordinate(subChild, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-4 ml-1 flex items-center gap-3">
        <h1 className="text-lg font-semibold text-[#181a2c] tracking-tight">
          Stock <span className="text-primary font-bold">Summary</span>
        </h1>
        {filteredSummaryData.length > 0 && (
          <button
            onClick={handleDownloadSummaryExcel}
            className="h-8.5 w-16 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center hover:opacity-95 transition-all shadow-md active:scale-[97%] cursor-pointer shrink-0"
            title="Download Excel"
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5 mb-6">
        <div className="flex flex-col md:flex-row-reverse gap-4 md:gap-6 md:items-stretch">
          {filteredSummaryData.length > 0 && (
            <PogKpiCard
              isSummaryTab={true}
              filteredSummaryDataLength={filteredSummaryData.length}
              aggregatedPogDataLength={aggregatedPogDataLength}
              totalSummaryPog={totalSummaryPog}
              totalPog={totalPog}
              totalSummary={totalSummary}
              overviewUseMt={overviewUseMt}
              filterBelowCrop={filterBelowCrop}
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
            />
          )}

          <div
            className={`w-full md:w-64 lg:w-72 xl:w-80 shrink-0 transition-all ${
              isSummaryFilterOpen ? "block" : "hidden md:block"
            }`}
          >
            <div className="bg-white p-4 md:px-6 md:py-5 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.15)] animate-in fade-in slide-in-from-top-3 duration-300 h-full flex flex-col justify-center">
              <div className="flex flex-row md:flex-col gap-2 md:gap-3.5">
                <div className="flex-1 min-w-0">
                  <label className="text-[9px] text-[#8E94B7] font-bold uppercase tracking-wider block mb-1.5 truncate ml-1">
                    Group By
                  </label>
                  <div className="relative">
                    <select
                      value={summaryGroupBy}
                      onChange={(e) => setSummaryGroupBy(e.target.value)}
                      className="w-full h-10 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.08)] rounded-full px-4 font-semibold text-[10.5px] text-primary outline-none truncate appearance-none"
                    >
                      <option value="hybrid">Hybrid</option>
                      <option value="subordinate">Team</option>
                      <option value="area">Area</option>
                      <option value="category">Category</option>
                      <option value="crops">Crops</option>
                      <option value="area_crops">Area & Crops</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-base pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[9px] text-[#8E94B7] font-bold uppercase tracking-wider block mb-1.5 truncate ml-1">
                    Sub
                  </label>
                  <div className="relative">
                    <select
                      value={summarySubGroupBy}
                      onChange={(e) => setSummarySubGroupBy(e.target.value)}
                      className="w-full h-10 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.08)] rounded-full px-4 font-semibold text-[10.5px] text-primary outline-none truncate appearance-none"
                    >
                      <option value="channel">Channel</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="subordinate">Team</option>
                      <option value="area">Area</option>
                      <option value="category">Category</option>
                      <option value="crops">Crops</option>
                      <option value="area_crops">Area & Crops</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-base pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[9px] text-[#8E94B7] font-bold uppercase tracking-wider block mb-1.5 truncate ml-1">
                    Crop
                  </label>
                  <div className="relative">
                    <select
                      value={filterBelowCrop}
                      onChange={(e) => setFilterBelowCrop(e.target.value)}
                      className="w-full h-10 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.08)] rounded-full px-4 font-semibold text-[10.5px] text-primary outline-none truncate appearance-none"
                    >
                      {availableCrops.map((crop) => (
                        <option key={crop} value={crop}>
                          {crop}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-base pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {filteredSummaryData.length > 0 && (
          <div className="-mx-5 md:mx-0 md:bg-transparent md:border-none md:shadow-none md:divide-y-0 bg-white overflow-hidden md:overflow-visible rounded-[48px] md:rounded-none pt-4 md:pt-0 pb-4 md:pb-0 mb-8 shadow-[0_4px_44px_rgba(24,26,44,0.15)] border border-[#edecff] divide-y divide-[#edecff] transition-all md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-2">
            {summaryGroupBy === "subordinate"
              ? filteredSummaryData.map((row) => renderRecursiveSummaryRow(row))
              : filteredSummaryData.map((row, i) => (
                  <div
                    key={i}
                    className="p-0 overflow-hidden transition-all md:bg-white md:rounded-[32px] md:shadow-[0_4px_24px_rgba(24,26,44,0.08)] md:border md:border-[#edecff]"
                  >
                    <div
                      className={`flex justify-between items-center ${
                        row.isExpandable ? "cursor-pointer" : ""
                      } px-5 py-4 pb-2 hover:bg-slate-50/60 transition-colors`}
                      onClick={() => row.isExpandable && toggleRow(row.name)}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs md:text-sm text-[#181a2c] uppercase flex items-center gap-1.5">
                          {row.isExpandable && (
                            <span className="material-symbols-outlined text-primary text-[20px]">
                              {expandedRows[row.name]
                                ? "keyboard_arrow_down"
                                : "keyboard_arrow_right"}
                            </span>
                          )}
                          {row.name}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-sm text-primary">
                          {
                            formatOverviewVal(row.selectedTotal, overviewUseMt)
                              .valueStr
                          }
                        </span>
                        <span className="text-[8px] text-[#8E94B7] uppercase tracking-widest font-bold">
                          Total{" "}
                          {
                            formatOverviewVal(row.selectedTotal, overviewUseMt)
                              .unit
                          }
                        </span>
                      </div>
                    </div>

                    <div className="mx-5 mb-3 mt-2 flex divide-x divide-white/20 bg-primary shadow-[0_12px_32px_rgba(21,75,226,0.35)] rounded-[14px] overflow-hidden">
                      {selectedClusters.map((clusterKey) => {
                        if (
                          clusterKey === "Uncategorized" &&
                          (!row[clusterKey] || row[clusterKey] === 0)
                        )
                          return null;
                        const clusterConfig = CLUSTER_CONFIG.find(
                          (c) => c.key === clusterKey,
                        );
                        return (
                          <div
                            key={clusterKey}
                            className="flex-1 min-w-0 p-2 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-colors"
                          >
                            <span className="text-[8px] font-bold uppercase tracking-wider text-white/85 mb-0.5 truncate w-full">
                              {clusterConfig?.label || clusterKey}
                            </span>
                            <span className="font-semibold text-[10.5px] truncate w-full text-white">
                              {
                                formatOverviewVal(
                                  row[clusterKey],
                                  overviewUseMt,
                                ).valueStr
                              }
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {expandedRows[row.name] && row.children?.length > 0 && (
                      <div className="pb-4 pt-3 border-t border-[#edecff] flex flex-col gap-3.5 px-5 bg-slate-50/50">
                        {summarySubGroupBy === "subordinate"
                          ? row.children.map((child: any) =>
                              renderRecursiveSubordinate(child),
                            )
                          : row.children.map((child: any, j: number) => {
                              const isChildZeroTeam = isRowVisitZero(
                                child.name,
                              );
                              return (
                                <div
                                  key={`${i}-${j}`}
                                  className={`flex flex-col p-3.5 rounded-[18px] transition-all duration-200 ${
                                    isChildZeroTeam
                                      ? "bg-red-50/70 border border-red-200/60 shadow-[0_10px_28px_rgba(239,68,68,0.12)]"
                                      : "bg-[#fbfaff] shadow-[0_10px_28px_rgba(21,75,226,0.18)]"
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-2 px-1">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-[11px] text-[#181a2c] uppercase pr-2 flex items-center gap-1.5 flex-wrap">
                                        <span>
                                          {renderMaybeChannelName(child.name)}
                                        </span>
                                        {isChildZeroTeam && (
                                          <span className="text-[7.5px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                            Belum Dikunjungi
                                          </span>
                                        )}
                                        {summarySubGroupBy === "channel" &&
                                          child.category && (
                                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                              {child.category}
                                            </span>
                                          )}
                                      </span>
                                      {summarySubGroupBy === "channel" &&
                                        child.pic && (
                                          <div className="text-[10px] text-[#8E94B7] mt-1 truncate">
                                            {child.pic}
                                          </div>
                                        )}
                                    </div>
                                    <span
                                      className={`font-bold text-[11.5px] shrink-0 ${
                                        isChildZeroTeam
                                          ? "text-red-600"
                                          : "text-[#181a2c]"
                                      }`}
                                    >
                                      {
                                        formatOverviewVal(
                                          child.selectedTotal,
                                          overviewUseMt,
                                        ).valueStr
                                      }{" "}
                                      <span className="text-[8.5px] text-[#8E94B7]">
                                        {
                                          formatOverviewVal(
                                            child.selectedTotal,
                                            overviewUseMt,
                                          ).unit
                                        }
                                      </span>
                                    </span>
                                  </div>
                                  <div
                                    className={`flex w-full divide-x rounded-[14px] overflow-hidden ${
                                      isChildZeroTeam
                                        ? "divide-red-200 bg-red-100/40"
                                        : "divide-primary/10 bg-primary/8"
                                    }`}
                                  >
                                    {selectedClusters.map((clusterKey) => {
                                      if (
                                        clusterKey === "Uncategorized" &&
                                        (!child[clusterKey] ||
                                          child[clusterKey] === 0)
                                      )
                                        return null;
                                      const clusterConfig = CLUSTER_CONFIG.find(
                                        (c) => c.key === clusterKey,
                                      );
                                      return (
                                        <div
                                          key={clusterKey}
                                          className={`flex-1 min-w-0 p-1.5 flex flex-col items-center justify-center text-center transition-colors ${
                                            isChildZeroTeam
                                              ? "hover:bg-red-200/30"
                                              : "hover:bg-primary/5"
                                          }`}
                                        >
                                          <span
                                            className={`text-[7.5px] font-bold uppercase tracking-wider mb-0.5 truncate w-full ${
                                              isChildZeroTeam
                                                ? "text-red-700/60"
                                                : "text-primary/70"
                                            }`}
                                          >
                                            {clusterConfig?.label || clusterKey}
                                          </span>
                                          <span
                                            className={`font-black text-[10px] truncate w-full ${
                                              isChildZeroTeam
                                                ? "text-red-700"
                                                : "text-primary"
                                            }`}
                                          >
                                            {
                                              formatOverviewVal(
                                                child[clusterKey],
                                                overviewUseMt,
                                              ).valueStr
                                            }
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                      </div>
                    )}
                  </div>
                ))}
          </div>
        )}

        {filteredSummaryData.length === 0 && (
          <div className="py-16 text-center flex flex-col items-center bg-white rounded-[24px] border border-[#edecff] shadow-sm">
            <span className="material-symbols-outlined text-[40px] text-[#8E94B7] mb-4">
              inventory_2
            </span>
            <p className="font-semibold text-[#8E94B7] text-xs">
              No data available for the selected filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
