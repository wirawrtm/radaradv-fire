import React, { useState } from "react";
import { AdvantaLogo } from "../../AdvantaLogo";
import { useFirebase } from "../../contexts/FirebaseContext";
import { BOOTSTRAPPED_ADMIN_EMAIL, isBootstrappedAdminEmail } from "../../firebase";

interface LoginProps {
  onLogin: (userData: any) => void;
  onClose?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onClose }) => {
  const { connectGoogle, authError } = useFirebase();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const displayError = errorMsg || authError || "";

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg("");
    try {
      const fbUser = await connectGoogle();
      const emailLower = String(fbUser.email || "").trim().toLowerCase();
      if (!isBootstrappedAdminEmail(emailLower)) {
        setErrorMsg(
          `Akses admin ditolak. Perubahan & pengelolaan database hanya dapat dilakukan oleh ${BOOTSTRAPPED_ADMIN_EMAIL}.`,
        );
        return;
      }
      onLogin({
        name: fbUser.displayName || "Admin Villatama",
        position: "Business Analyst",
        division: "All",
        group: "All",
        reportTo: "-",
        office: "Head Office",
        area: "Head Office",
        user: emailLower,
        level: "5",
        email: emailLower,
        isPublic: false,
      });
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          `Gagal login dengan Google. Gunakan akun ${BOOTSTRAPPED_ADMIN_EMAIL}.`,
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf8ff]/95 backdrop-blur-md font-sans text-[#181a2c] min-h-screen flex flex-col justify-between relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#154be2]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-cyan-400/5 rounded-full blur-3xl pointer-events-none"></div>

      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="mb-3 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
              <AdvantaLogo className="h-20 w-auto object-contain" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#154be2] to-cyan-500 bg-clip-text text-transparent font-sans">
              RADAR
            </h1>
            <p className="text-[#434655] text-sm mt-1 font-medium tracking-wide">
              Real-time Advanta Data &amp; Analytics Reporting
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-[28px] p-8 shadow-[0_20px_50px_rgba(21,75,226,0.12)] border border-white relative">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-[#434655] flex items-center justify-center transition-colors cursor-pointer"
                title="Kembali ke Tampilan Publik"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}

            <div className="mb-6 pr-6">
              <h2 className="text-xl font-bold text-[#181a2c]">
                Akun Admin (Opsional)
              </h2>
              <p className="text-xs text-[#747687] mt-1">
                Dashboard dapat diakses &amp; diedit oleh semua pengunjung tanpa login. Masuk opsional dengan akun{" "}
                <span className="font-mono font-bold text-[#181a2c]">
                  {BOOTSTRAPPED_ADMIN_EMAIL}
                </span>
                .
              </p>
            </div>

            {displayError && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                  error
                </span>
                <span>{displayError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full py-4 bg-gradient-to-r from-[#154be2] to-cyan-500 text-white font-bold text-sm rounded-2xl shadow-[0_10px_25px_rgba(21,75,226,0.25)] hover:shadow-[0_12px_30px_rgba(21,75,226,0.35)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              {googleLoading ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Akun Google...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">
                    verified_user
                  </span>
                  <span>Masuk dengan Google ({BOOTSTRAPPED_ADMIN_EMAIL})</span>
                </>
              )}
            </button>

            <div className="mt-5 p-3.5 rounded-2xl bg-[#f4f2ff]/80 border border-[#e0e0fa] text-[11px] text-[#434655] leading-relaxed">
              Semua pengunjung dapat membaca, menginput, dan mengedit data di{" "}
              <span className="font-mono font-semibold text-[#181a2c]">radaradv-95dbf</span>{" "}
              tanpa perlu login.
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold text-[#635b6e] hover:bg-[#f4f2ff] transition-colors cursor-pointer"
              >
                Lanjutkan Tanpa Login
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="py-6 text-center z-10">
        <p className="text-[11px] font-medium text-[#8E94B7]">
          &copy; {new Date().getFullYear()} Advanta Seeds Indonesia. All rights
          reserved.
        </p>
      </footer>
    </div>
  );
};
