import React, { useState } from "react";
import { AdvantaLogo } from "../../AdvantaLogo";

interface LoginProps {
  onLogin: (
    u: string,
    p: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async () => {
    setErrorMsg("");
    setIsLoggingIn(true);
    try {
      const res = await onLogin(username, password);
      if (!res.success) {
        setErrorMsg(res.error || "Username atau password salah.");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] font-sans flex items-center justify-center p-6 bg-gradient-to-br from-[#F2E7FE] via-[#fbf8ff] to-[#edecff]">
      <div className="glass-panel w-full max-w-sm rounded-[24px] p-8 shadow-[0_20px_40px_rgba(24,26,44,0.06)] border border-white/60 animate-in fade-in zoom-in-95 duration-500">
        <div className="size-24 bg-gradient-to-br from-primary to-cyan-400 rounded-[28px] mx-auto mb-5 shadow-[0_12px_32px_rgba(21,75,226,0.3)] flex items-center justify-center text-white p-3">
          <AdvantaLogo className="w-[64px] h-[64px] text-white" />
        </div>
        <h1 className="text-xl font-bold text-center text-[#181a2c] tracking-tight mb-1 uppercase">
          RADAR ADVANTA
        </h1>
        <p className="text-[10px] text-center text-[#8E94B7] font-semibold uppercase tracking-widest mb-6 leading-relaxed">
          REKAN ADVANTA DAN ANALISA REPORT
        </p>
        <div className="space-y-4">
          {errorMsg && (
            <div className="bg-red-50 text-red-500 font-semibold text-xs px-4 py-2.5 rounded-full border border-red-100 flex items-center gap-2 animate-in fade-in duration-300">
              <span className="material-symbols-outlined text-sm shrink-0">
                error
              </span>
              <span className="truncate">{errorMsg}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider ml-4 mb-2 block">
                username
              </label>
              <input
                type="text"
                value={username}
                onChange={(v) => setUsername(v.target.value)}
                disabled={isLoggingIn}
                className="w-full h-14 bg-white/80 border-0 rounded-full px-6 font-semibold text-sm text-[#181a2c] outline-none focus:bg-white transition-all shadow-[0_4px_18px_rgba(21,75,226,0.08)] focus:shadow-[0_8px_28px_rgba(21,75,226,0.18)] mb-4 disabled:opacity-50"
                placeholder="Enter username..."
              />
              <label className="text-[11px] font-bold text-[#8E94B7] uppercase tracking-wider ml-4 mb-2 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(v) => setPassword(v.target.value)}
                disabled={isLoggingIn}
                className="w-full h-14 bg-white/80 border-0 rounded-full px-6 font-semibold text-sm text-[#181a2c] outline-none focus:bg-white transition-all shadow-[0_4px_18px_rgba(21,75,226,0.08)] focus:shadow-[0_8px_28px_rgba(21,75,226,0.18)] disabled:opacity-50"
                placeholder="Enter password..."
              />
            </div>
            <button
              onClick={handleLoginSubmit}
              disabled={
                username.trim() === "" || password.trim() === "" || isLoggingIn
              }
              className={`w-full h-14 rounded-full font-semibold text-xs uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                username.trim() === "" || password.trim() === "" || isLoggingIn
                  ? "bg-[#e0e0fa] text-[#8E94B7] cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-primary to-cyan-400 text-white hover:opacity-95 shadow-[0_12px_28px_rgba(21,75,226,0.35)]"
              }`}
            >
              {isLoggingIn ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Logging In...</span>
                </>
              ) : (
                <span>Enter Now</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
