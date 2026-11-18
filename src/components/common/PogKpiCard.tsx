import React from "react";
import { ALL_CLUSTER_KEYS, CLUSTER_CONFIG } from "../../utils/constants";
import { cleanForMatch, formatOverviewVal } from "../../utils/formatters";

interface PogKpiCardProps {
  isSummaryTab: boolean;
  filteredSummaryDataLength: number;
  aggregatedPogDataLength: number;
  totalSummaryPog: any;
  totalPog: any;
  totalSummary: Record<string, number>;
  overviewUseMt: boolean;
  filterBelowCrop: string;
  selectedClusters: string[];
  setSelectedClusters: React.Dispatch<React.SetStateAction<string[]>>;
  isSummaryFilterOpen: boolean;
  setIsSummaryFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPogFilterOpen: boolean;
  setIsPogFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeVisitStats: { visited: number; total: number; percentage: number };
  mappingPic: string;
  normalizeName: (name: string) => string;
  categoryDistributionStats: { data: any[]; total: number };
  categoryChartSegments: any[];
}

export const PogKpiCard: React.FC<PogKpiCardProps> = ({
  isSummaryTab,
  filteredSummaryDataLength,
  aggregatedPogDataLength,
  totalSummaryPog,
  totalPog,
  totalSummary,
  overviewUseMt,
  filterBelowCrop,
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
}) => {
  const dataEmpty = isSummaryTab
    ? filteredSummaryDataLength === 0
    : aggregatedPogDataLength === 0;
  if (dataEmpty) return null;

  const currentTotal = isSummaryTab ? totalSummaryPog : totalPog;
  const toggleFilter = () =>
    isSummaryTab
      ? setIsSummaryFilterOpen(!isSummaryFilterOpen)
      : setIsPogFilterOpen(!isPogFilterOpen);

  return (
    <div
      onClick={() => {
        if (window.innerWidth < 768) {
          toggleFilter();
        }
      }}
      className="flex-1 w-full min-w-0 bg-gradient-to-br from-primary to-cyan-400 p-5 md:px-7 rounded-[36px] shadow-[0_12px_32px_rgba(21,75,226,0.35)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.45)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-250 cursor-pointer md:cursor-default select-none text-white mb-1.5 md:mb-0 md:hover:scale-100 md:active:scale-100"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-white/80">
            tune
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-sm uppercase tracking-wider text-white/90">
              Grand Total
            </span>
            {isSummaryTab && (
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
                {filterBelowCrop || "All"}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-bold text-xl xl:text-2xl text-white">
            {
              formatOverviewVal(
                isSummaryTab ? totalSummary.selectedTotal : currentTotal.pog,
                overviewUseMt,
              ).valueStr
            }
          </span>
          <span className="text-[8px] text-white/80 uppercase tracking-widest font-bold">
            {isSummaryTab
              ? `Total ${formatOverviewVal(totalSummary.selectedTotal, overviewUseMt).unit}`
              : `POG (${formatOverviewVal(currentTotal.pog, overviewUseMt).unit})`}
          </span>
        </div>
      </div>

      {isSummaryTab ? (
        <div className="flex w-full divide-x divide-white/15 border-t border-white/15 pt-4 mt-2">
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
                className={`flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isSelected
                    ? "opacity-100 hover:bg-white/10 rounded-md"
                    : "opacity-40 hover:opacity-60"
                }`}
              >
                <span className="text-[9px] xl:text-[10px] font-bold uppercase tracking-wider text-white/85 mb-1 truncate w-full">
                  {clusterConfig?.label || clusterKey}
                </span>
                <span className="font-bold text-sm xl:text-base truncate w-full text-white">
                  {
                    formatOverviewVal(totalSummary[clusterKey], overviewUseMt)
                      .valueStr
                  }
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-row w-full gap-1.5 md:gap-2 border-t border-white/15 pt-3.5 mt-1">
          <div className="flex-[2] flex divide-x divide-white/15 bg-white/5 rounded-[12px] p-0.5">
            <div className="flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/85 mb-0.5 truncate w-full">
                Opening
              </span>
              <span className="font-bold text-xs truncate w-full text-white">
                {formatOverviewVal(currentTotal.lastQty, overviewUseMt).valueStr}
              </span>
            </div>
            <div className="flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/85 mb-0.5 truncate w-full">
                End Inv
              </span>
              <span className="font-bold text-xs truncate w-full text-white">
                {
                  formatOverviewVal(currentTotal.currentQty, overviewUseMt)
                    .valueStr
                }
              </span>
            </div>
          </div>

          <div className="flex-[3] flex divide-x divide-white/20 bg-gradient-to-br from-white/25 via-white/15 to-white/25 border border-white/20 rounded-[12px] p-0.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
            <div className="flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/95 mb-0.5 truncate w-full">
                Stock In
              </span>
              <span className="font-extrabold text-xs truncate w-full text-white">
                {formatOverviewVal(currentTotal.sellIn, overviewUseMt).valueStr}
              </span>
            </div>
            <div className="flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors rounded-[12px]">
              <span className="text-[8px] font-bold uppercase tracking-wider text-amber-200 mb-0.5 truncate w-full">
                Idle Stock
              </span>
              <span className="font-extrabold text-xs truncate w-full text-amber-100">
                {
                  formatOverviewVal(currentTotal.idleStock, overviewUseMt)
                    .valueStr
                }
              </span>
            </div>
            <div className="flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors rounded-[12px]">
              <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-200 mb-0.5 truncate w-full">
                POG
              </span>
              <span className="font-black text-xs truncate w-full text-cyan-50">
                {formatOverviewVal(currentTotal.pog, overviewUseMt).valueStr}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-white/15 pt-5 mt-4 w-full">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8 items-start justify-center">
          <div className="flex flex-col items-center text-center p-1 sm:p-3">
            <h4 className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-white/90 mb-3 sm:mb-4 font-sans line-clamp-1">
              Kunjungan (Visit)
            </h4>
            <div className="relative flex items-center justify-center shrink-0 mb-3 sm:mb-4 animate-in zoom-in duration-500">
              <svg
                viewBox="0 0 220 220"
                className="rotate-[-90deg] w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 xl:w-44 xl:h-44"
              >
                <circle
                  stroke="rgba(255, 255, 255, 0.15)"
                  fill="transparent"
                  strokeWidth={16}
                  r={95}
                  cx={110}
                  cy={110}
                />
                <circle
                  stroke="white"
                  fill="transparent"
                  strokeWidth={16}
                  strokeDasharray={`${2 * Math.PI * 95} ${2 * Math.PI * 95}`}
                  strokeDashoffset={
                    2 * Math.PI * 95 -
                    (activeVisitStats.percentage / 100) * (2 * Math.PI * 95)
                  }
                  style={{
                    strokeDashoffset: `${2 * Math.PI * 95 - (activeVisitStats.percentage / 100) * (2 * Math.PI * 95)}px`,
                  }}
                  r={95}
                  cx={110}
                  cy={110}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg sm:text-2xl md:text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-none">
                  {activeVisitStats.percentage}%
                </span>
                <span className="text-[7px] sm:text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-white/70 mt-0.5 sm:mt-1">
                  Visited
                </span>
              </div>
            </div>
            <p className="text-[9.5px] sm:text-[11px] md:text-[11.5px] leading-relaxed text-white/90 max-w-sm">
              {!mappingPic ||
              cleanForMatch(mappingPic) === "allteam" ||
              cleanForMatch(mappingPic) === "all_team"
                ? "Team"
                : normalizeName(mappingPic)}{" "}
              sudah melakukan visit sebanyak{" "}
              <span className="font-bold text-white">
                {activeVisitStats.visited}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-white">
                {activeVisitStats.total}
              </span>{" "}
              Partner{" "}
              <span className="text-white/80">
                ({activeVisitStats.percentage}%)
              </span>
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-1 sm:p-3 border-l border-white/15">
            <h4 className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-white/90 mb-3 sm:mb-4 font-sans line-clamp-1">
              Kategori Partner
            </h4>
            <div className="relative flex items-center justify-center shrink-0 mb-3 sm:mb-4 md:mb-5 animate-in zoom-in duration-500">
              <svg
                viewBox="0 0 220 220"
                className="rotate-[-90deg] w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 xl:w-44 xl:h-44"
              >
                <circle
                  stroke="rgba(255, 255, 255, 0.1)"
                  fill="transparent"
                  strokeWidth={16}
                  r={95}
                  cx={110}
                  cy={110}
                />
                {categoryChartSegments.map((segment) => (
                  <circle
                    key={segment.name}
                    stroke={segment.color}
                    fill="transparent"
                    strokeWidth={16}
                    strokeLinecap="round"
                    strokeDasharray={segment.strokeDasharray}
                    strokeDashoffset={segment.strokeDashoffset}
                    style={{
                      strokeDashoffset: `${segment.strokeDashoffset}px`,
                    }}
                    r={95}
                    cx={110}
                    cy={110}
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                  />
                ))}
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg sm:text-2xl md:text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-none font-sans">
                  {categoryDistributionStats.total}
                </span>
                <span className="text-[7px] sm:text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-white/70 mt-0.5 sm:mt-1 font-mono">
                  Partners
                </span>
              </div>
            </div>
            <div className="w-full mt-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 px-0.5 sm:px-1 text-[8.5px] sm:text-[10px] text-white/90">
                {categoryChartSegments.map((segment) => (
                  <div
                    key={segment.name}
                    className="flex items-center gap-1 sm:gap-1.5 bg-black/12 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-full border border-black/5 truncate hover:bg-black/25 transition-colors shadow-sm animate-in fade-in-50 duration-300"
                  >
                    <span
                      className="inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="font-semibold text-white/90 truncate flex-1 text-left">
                      {segment.name}
                    </span>
                    <span className="font-mono font-bold text-white shrink-0">
                      {segment.value}{" "}
                      <span className="text-[7px] sm:text-[8px] font-normal text-white/75">
                        ({Math.round(segment.percentage)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
