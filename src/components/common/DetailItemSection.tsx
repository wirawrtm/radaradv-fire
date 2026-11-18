import React from "react";
import { MONTH_KEYS } from "../../utils/constants";
import {
  cleanForMatch,
  extractExpFromLot,
  safeParseFloat,
} from "../../utils/formatters";
import { getResolvedPic } from "../../utils/hierarchy";

interface DetailItemSectionProps {
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onUploadActivity: () => void;
  isSyncing: boolean;
  hasChanges: boolean;
  title: string;
  subtitle: string;
  category?: string;
  kiosks?: any[];
}

export const DetailItemSection: React.FC<DetailItemSectionProps> = ({
  items,
  onEdit,
  onDelete,
  onUploadActivity,
  isSyncing,
  hasChanges,
  title,
  subtitle,
  category,
  kiosks = [],
}) => {
  const getConditionBadge = (cond: any) => {
    const condition = String(cond).toLowerCase();
    if (condition === "new" || condition === "baru")
      return (
        <div className="px-2.5 py-0.5 rounded-full bg-cyan-100/60 border border-cyan-200 text-cyan-800 text-[8px] font-bold uppercase tracking-wider">
          BARU
        </div>
      );
    if (condition === "berkurang")
      return (
        <div className="px-2.5 py-0.5 rounded-full bg-emerald-100/60 border border-emerald-200 text-emerald-800 text-[8px] font-bold uppercase tracking-wider">
          BERKURANG
        </div>
      );
    if (condition === "bertambah")
      return (
        <div className="px-2.5 py-0.5 rounded-full bg-[#edecff] border border-[#c4c5d8] text-primary text-[8px] font-bold uppercase tracking-wider">
          BERTAMBAH
        </div>
      );
    if (condition === "habis")
      return (
        <div className="px-2.5 py-0.5 rounded-full bg-orange-100/60 border border-orange-200 text-orange-850 text-[8px] font-bold uppercase tracking-wider">
          AKAN DIHAPUS
        </div>
      );
    return (
      <div className="px-2.5 py-0.5 rounded-full bg-red-100/60 border border-red-200 text-red-800 text-[8px] font-bold uppercase tracking-wider">
        TETAP
      </div>
    );
  };

  const currentMonthIdx = new Date().getMonth();
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const prevMonthKey = MONTH_KEYS[prevMonthIdx];

  return (
    <div className="-mx-5 bg-white overflow-hidden rounded-[48px] pt-6 px-5 pb-6 mb-8 shadow-[0_4px_44px_rgba(24,26,44,0.15)] border border-[#edecff] font-sans mt-8 relative">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="size-2 bg-primary rounded-full animate-pulse" />
            <h3 className="text-base font-semibold text-[#181a2c] tracking-tight">
              {title}
            </h3>
          </div>
          <p className="text-[11px] text-[#8E94B7] font-semibold uppercase tracking-wider">
            {subtitle}
          </p>
          {category && (
            <p className="text-[9px] text-primary font-bold uppercase tracking-widest mt-0.5">
              {category}
            </p>
          )}
        </div>
        <div className="bg-white shadow-[0_4px_12px_rgba(21,75,226,0.08)] px-3 py-1.5 rounded-full text-right">
          <p className="text-[8px] font-bold text-[#8E94B7] uppercase leading-none mb-0.5">
            Total LOT
          </p>
          <p className="text-xs font-bold text-primary">{items.length}</p>
        </div>
      </div>

      <div className="space-y-3.5 max-h-[480px] overflow-y-auto px-5 py-5 -mx-5 -my-5 custom-scrollbar">
        {items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-white shadow-sm rounded-[24px]">
            <p className="text-[11px] font-semibold text-[#8E94B7] uppercase tracking-wider">
              Feed Kosong
            </p>
          </div>
        ) : (
          items.map((item, index) => {
            const prevVal =
              item[prevMonthKey] !== undefined
                ? safeParseFloat(item[prevMonthKey])
                : 0;
            const kioskInfo = kiosks.find(
              (k) =>
                cleanForMatch(k.name) === cleanForMatch(item.kiosk || subtitle),
            );
            const picName = getResolvedPic(
              item.kiosk || subtitle,
              kioskInfo?.pic,
              item.user,
              item.lot,
              item.pic,
            );
            const stockNum = safeParseFloat(item.stock);

            return (
              <div
                key={item.id || index}
                className="group bg-[#fbfaff] rounded-[18px] p-3.5 flex flex-col gap-3 shadow-[0_16px_36px_rgba(21,75,226,0.25)] hover:shadow-[0_20px_48px_rgba(21,75,226,0.32)] transition-all duration-300"
              >
                <div className="flex items-start justify-between w-full gap-2 font-sans">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#181a2c] text-sm tracking-tight">
                        {item.lot}
                      </p>
                      <div className="px-2 py-0.5 rounded-full bg-red-100/50 border border-red-200 mt-0.5">
                        <p className="text-[8.5px] font-bold text-red-700 uppercase tracking-wide">
                          EXP:{" "}
                          {!item.expired ||
                          item.expired === "N/A" ||
                          item.expired === "-"
                            ? extractExpFromLot(item.lot)
                            : item.expired}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#8E94B7] mt-0.5 font-medium">
                      Bulan lalu ({prevMonthKey.toUpperCase()}):{" "}
                      <span className="text-slate-700 font-semibold">
                        {prevVal} Kg
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {getConditionBadge(item.condition)}
                    {picName && picName !== "Unknown" && (
                      <span className="text-[9px] text-[#8E94B7] font-semibold uppercase tracking-wider text-right">
                        PIC:{" "}
                        <span className="text-primary font-bold">{picName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2 bg-primary px-3 py-1.5 rounded-full min-w-0 flex-1 shadow-[0_10px_24px_rgba(21,75,226,0.38)]">
                    <p className="text-[11px] text-white font-semibold uppercase tracking-tight whitespace-normal break-words leading-tight flex-1">
                      {item.hybrid}
                    </p>
                    <div className="w-px h-3.5 bg-white/25 flex-shrink-0" />
                    <p className="text-[11px] font-black text-white flex-shrink-0">
                      {!isNaN(stockNum) && stockNum < 1
                        ? stockNum.toFixed(2)
                        : item.stock}{" "}
                      <span className="text-[8.5px] text-white/75 font-medium">
                        Kg
                      </span>
                    </p>
                    <div className="w-px h-3.5 bg-white/25 flex-shrink-0" />
                    <p className="text-[10px] font-black text-amber-300 uppercase tracking-tight flex-shrink-0">
                      {item.aging} BLN
                    </p>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onEdit(item)}
                      className="size-9 rounded-full bg-[#edecff] text-primary hover:bg-[#e6e6ff] transition-all flex items-center justify-center border border-[#c4c5d8] shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        edit_square
                      </span>
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="size-9 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center border border-red-100 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete_sweep
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onUploadActivity}
        disabled={isSyncing || !hasChanges}
        className={`w-full h-14 mt-6 text-white rounded-full font-semibold text-xs uppercase tracking-wider shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
          isSyncing || !hasChanges
            ? "bg-[#e0e0fa] text-[#8E94B7] border border-[#edecff] cursor-not-allowed"
            : "bg-gradient-to-r from-primary to-cyan-400 hover:opacity-95 shadow-[0_8px_20px_rgba(21,75,226,0.25)]"
        }`}
      >
        {isSyncing ? (
          <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-sm">
            cloud_upload
          </span>
        )}
        {isSyncing
          ? "Uploading..."
          : hasChanges
            ? "Upload Activity"
            : "Data Tersinkron"}
      </button>
    </div>
  );
};
