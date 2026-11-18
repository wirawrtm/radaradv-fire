import React from "react";
import firebaseConfig from "../../firebase-applet-config.json";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  declare state: ErrorBoundaryState;
  declare props: { children: React.ReactNode };
  declare setState: (
    state:
      | Partial<ErrorBoundaryState>
      | ((prevState: Readonly<ErrorBoundaryState>) => Partial<ErrorBoundaryState>),
  ) => void;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      isQuotaError: false,
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || "Terjadi kesalahan aplikasi.";
    let friendly = raw;
    let isPermissionError = false;
    let isQuotaError = false;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "operationType" in parsed) {
        const inner = String(parsed.error || "");
        if (inner.toLowerCase().includes("quota")) {
          isQuotaError = true;
          friendly =
            "Kuota harian gratis Firestore tercapai. Kuota akan direset besok.";
        } else if (
          inner.toLowerCase().includes("permission") ||
          inner.toLowerCase().includes("insufficient")
        ) {
          isPermissionError = true;
          friendly = `Akses Firestore ditolak pada operasi ${parsed.operationType} (${parsed.path || "-"}). Pastikan Anda masuk dengan akun Google terverifikasi yang memiliki izin.`;
        } else {
          friendly = inner || friendly;
        }
      }
    } catch {
      if (raw.toLowerCase().includes("quota")) {
        isQuotaError = true;
        friendly =
          "Kuota harian gratis Firestore tercapai. Kuota akan direset besok.";
      }
    }

    return {
      hasError: true,
      errorMessage: friendly,
      isQuotaError,
      isPermissionError,
    };
  }

  render() {
    if (this.state.hasError) {
      const quotaUpgradeUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

      return (
        <div className="min-h-screen bg-[#fbf8ff] flex items-center justify-center p-6 font-sans text-[#181a2c]">
          <div className="max-w-md w-full bg-white rounded-3xl p-7 shadow-xl border border-[#e0e0fa] space-y-4">
            <div className="size-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">
                {this.state.isPermissionError ? "lock" : "error"}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#181a2c]">
                {this.state.isQuotaError
                  ? "Kuota Database Tercapai"
                  : this.state.isPermissionError
                    ? "Izin Database Diperlukan"
                    : "Terjadi Gangguan Aplikasi"}
              </h2>
              <p className="text-xs text-[#434655] mt-1.5 leading-relaxed">
                {this.state.errorMessage}
              </p>
            </div>
            {this.state.isQuotaError && (
              <a
                href={quotaUpgradeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                Buka pengaturan kuota Firestore
              </a>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, errorMessage: "" })}
                className="flex-1 h-10 rounded-xl bg-[#154be2] text-white text-xs font-bold cursor-pointer hover:opacity-95"
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-10 px-4 rounded-xl bg-[#f4f2ff] text-[#181a2c] text-xs font-bold cursor-pointer hover:bg-[#e6e6ff]"
              >
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
