import React, { useEffect, useState } from "react";
import { MONTH_KEYS } from "../../utils/constants";
import { safeParseFloat } from "../../utils/formatters";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSave: (id: any, newQty: string, updatedFields?: any) => void;
  isSaving: boolean;
}

export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  isSaving,
}) => {
  const [newQty, setNewQty] = useState("");

  useEffect(() => {
    if (item) {
      setNewQty(item.stock);
    }
  }, [item]);

  if (!isOpen) return null;

  const currentMonthIdx = new Date().getMonth();
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const prevMonthKey = MONTH_KEYS[prevMonthIdx];
  const prevMonthLabel = prevMonthKey.toUpperCase();
  const prevVal =
    item && item[prevMonthKey] !== undefined
      ? safeParseFloat(item[prevMonthKey])
      : 0;

  const handleSaveClick = () => {
    onSave(item.id, newQty, {});
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#181a2c]/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-[380px] rounded-[24px] p-6 shadow-2xl border border-[#edecff] animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="size-12 bg-[#edecff] rounded-full flex items-center justify-center text-primary mb-4">
          <span className="material-symbols-outlined text-[24px]">
            edit_note
          </span>
        </div>
        <h2 className="text-lg font-semibold text-[#181a2c] leading-tight mb-1">
          Edit Detail LOT & Stock
        </h2>
        <p className="text-[10px] text-[#8E94B7] font-semibold uppercase tracking-wider mb-5">
          Sesuaikan Qty untuk LOT ini
        </p>

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-[#fbf8ff] border border-[#edecff] rounded-2xl space-y-3">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider">
                Hybrid / Varietas
              </span>
              <span
                className="text-xs font-bold text-primary text-right max-w-[180px] truncate"
                title={item?.hybrid}
              >
                {item?.hybrid}
              </span>
            </div>

            <div className="h-px bg-[#edecff]" />

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider">
                Nomor Lot
              </span>
              <span className="text-xs font-mono font-bold text-[#181a2c]">
                {item?.lot}
              </span>
            </div>

            <div className="h-px bg-[#edecff]" />

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider">
                Qty Bulan Lalu ({prevMonthLabel})
              </span>
              <span className="text-xs font-bold text-slate-700">
                {prevVal} Kg
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 block">
              Quantity Baru (Kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Masukkan quantity baru"
              className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-[#635b6e] font-semibold text-xs uppercase tracking-wider hover:bg-[#f4f2ff] rounded-full transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving || !newQty || isNaN(Number(newQty))}
            className={`flex-[2] py-3 rounded-full font-semibold text-xs uppercase tracking-wider transition-all ${
              isSaving || !newQty || isNaN(Number(newQty))
                ? "bg-[#e0e0fa] text-[#8E94B7] cursor-not-allowed"
                : "bg-gradient-to-r from-primary to-cyan-400 text-white shadow-[0_4px_12px_rgba(21,75,226,0.25)] active:scale-[0.98]"
            }`}
          >
            {isSaving ? "Saving..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};
