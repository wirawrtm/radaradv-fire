import React from "react";

export interface ToastState {
  message: string;
  type: "success" | "error";
}

interface ToastBannerProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isSuccess = toast.type === "success";
  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto z-[150] flex justify-end pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-[0_12px_36px_rgba(24,26,44,0.16)] border max-w-md w-full md:w-auto animate-in fade-in slide-in-from-top-3 duration-200 ${
          isSuccess
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-red-50 border-red-200 text-red-900"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${
            isSuccess ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {isSuccess ? "check_circle" : "error"}
        </span>
        <span className="text-xs font-bold leading-snug flex-1">
          {toast.message}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className={`p-1 rounded-full transition-colors cursor-pointer shrink-0 ${
            isSuccess
              ? "text-emerald-600/70 hover:bg-emerald-100 hover:text-emerald-800"
              : "text-red-600/70 hover:bg-red-100 hover:text-red-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
