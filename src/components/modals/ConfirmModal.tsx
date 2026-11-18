import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] bg-[#181a2c]/50 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-[340px] rounded-[24px] p-8 shadow-2xl border border-[#edecff] text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="size-16 bg-red-50 rounded-full flex items-center justify-center text-[#ba1a1a] mx-auto mb-5">
          <span className="material-symbols-outlined text-[32px]">
            priority_high
          </span>
        </div>
        <h2 className="text-xl font-semibold text-[#181a2c] leading-tight mb-1">
          Konfirmasi Hapus
        </h2>
        <p className="text-xs font-semibold text-[#8E94B7] uppercase tracking-wider mb-6">
          Anda yakin ingin menghapus LOT ini?
        </p>
        <div className="space-y-2">
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="w-full py-3 bg-gradient-to-r from-[#ba1a1a] to-rose-600 text-white rounded-full font-semibold text-xs uppercase tracking-wider active:scale-[0.98] shadow-md"
          >
            {isProcessing ? "Processing..." : "Ya, Hapus Data"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-[#635b6e] font-semibold text-xs uppercase tracking-wider hover:bg-[#f4f2ff] rounded-full transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
