import React from "react";

export const SessionCheckLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] gap-6 bg-gradient-to-br from-[#F2E7FE] via-[#fbf8ff] to-[#edecff] text-[#181a2c]">
    <div className="relative">
      <div className="size-20 border-4 border-[#edecff] rounded-full" />
      <div className="size-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="material-symbols-outlined text-[32px] text-primary animate-pulse">
          sync
        </span>
      </div>
    </div>
    <div className="text-center animate-pulse">
      <h3 className="text-[#181a2c] font-bold text-sm mb-1">
        Membuka Workspace...
      </h3>
      <p className="text-[#8E94B7] text-[9px] font-semibold uppercase tracking-widest">
        Memeriksa Sesi Pengguna
      </p>
    </div>
  </div>
);

export const DatabaseSyncLoader: React.FC<{ loadProgress: number }> = ({
  loadProgress,
}) => (
  <div className="flex flex-col items-center justify-center min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] bg-[#f8fafc] px-4 pb-20 animate-in fade-in duration-500">
    <div className="bg-white p-8 rounded-[32px] shadow-[0_24px_64px_rgba(24,26,44,0.06)] border border-[#e2e8f0] flex flex-col items-center max-w-sm w-full gap-6">
      <div className="relative">
        <div className="size-24 border-4 border-[#edecff] rounded-full flex items-center justify-center">
          <span className="text-xl font-extrabold text-primary select-none">
            {loadProgress}%
          </span>
        </div>
        <div className="size-24 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
      </div>

      <div className="text-center w-full">
        <h3 className="text-[#181a2c] font-black text-xl mb-1 select-none">
          Menyiapkan Data...
        </h3>
        <p className="text-[#8E94B7] text-[10px] font-bold uppercase tracking-widest select-none">
          SINKRONISASI DATABASE
        </p>
      </div>

      <div className="w-full flex flex-col items-center gap-2">
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-[1px] border border-[#f1f5f9]">
          <div
            className="bg-gradient-to-r from-primary to-cyan-400 h-full rounded-full transition-all duration-150 ease-out shadow-[0_2px_8px_rgba(21,75,226,0.25)]"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      </div>
    </div>
  </div>
);

export const TabSuspenseFallback: React.FC = () => (
  <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#8E94B7]">
    <div className="size-8 border-2 border-[#edecff] border-t-primary rounded-full animate-spin" />
    <span className="text-[10px] font-bold uppercase tracking-widest">
      Memuat Modul...
    </span>
  </div>
);
