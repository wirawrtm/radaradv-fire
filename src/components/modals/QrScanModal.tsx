import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const playBeep = () => {
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    console.warn("Could not play scan beep:", err);
  }
};

interface QrScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QrScanModal: React.FC<QrScanModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setScannerError(null);
      return;
    }

    let isScanningActive = false;
    let html5QrCode: any = null;

    const startCamera = async () => {
      try {
        html5QrCode = new Html5Qrcode("qr-camera-stream");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width: number, height: number) => {
              const size = Math.min(width, height) * 0.95;
              return { width: size, height: size };
            },
          },
          (decodedText: string) => {
            playBeep();
            onScanSuccess(decodedText);
            onClose();
          },
          () => {
            // silent frame error check
          },
        );
        isScanningActive = true;
      } catch (err) {
        console.error("Camera access error:", err);
        setScannerError(
          "Gagal mengakses kamera. Mohon berikan izin kamera pada browser Anda.",
        );
      }
    };

    const timer = setTimeout(() => {
      startCamera();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (html5QrCode && isScanningActive) {
        html5QrCode.stop().catch((e: any) => console.log("Stop failed:", e));
      }
    };
  }, [isOpen, onClose, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-[#181a2c]/80 backdrop-blur-md flex flex-col justify-center items-center p-6 animate-in fade-in duration-200">
      <style>{`
        #qr-camera-stream {
          background-color: transparent !important;
          border: none !important;
        }
        #qr-camera-stream video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 22px !important;
        }
        #qr-camera-stream canvas {
          display: none !important;
        }
        #qr-camera-stream img {
          display: none !important;
        }
      `}</style>
      <div className="bg-white w-full max-w-[340px] rounded-[32px] overflow-hidden shadow-[0_24px_64px_rgba(24,26,44,0.12)] border border-[#f0edff] p-6 flex flex-col items-center relative animate-in fade-in zoom-in-95 duration-250">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-8 rounded-full bg-[#f4f2ff] text-[#8E94B7] hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center cursor-pointer z-10"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        <h3 className="text-base font-bold text-[#181a2c] tracking-wide mb-1 mt-2 text-center">
          Pindai QR / Barcode
        </h3>
        <p className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider text-center mb-6">
          Arahkan kamera ke kode LOT
        </p>

        <div className="relative w-full aspect-square max-w-[260px] p-[10px] rounded-[44px] bg-gradient-to-br from-primary to-cyan-400 shadow-[0_20px_48px_rgba(21,75,226,0.22)] flex items-center justify-center">
          <div className="w-full h-full bg-white rounded-[34px] p-[12px] flex items-center justify-center relative overflow-hidden">
            <div
              id="qr-camera-stream"
              className="w-full h-full object-cover rounded-[22px] overflow-hidden bg-slate-950"
            />

            {!scannerError && (
              <div className="absolute inset-[16px] pointer-events-none flex items-center justify-center z-10">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-primary rounded-tl-md" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-primary rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-cyan-400 rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-cyan-400 rounded-br-md" />

                <div
                  className="w-[95%] h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-85 absolute animate-bounce"
                  style={{ top: "15%", animationDuration: "2.5s" }}
                />
              </div>
            )}

            {scannerError && (
              <div className="absolute inset-0 bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center rounded-[22px] overflow-hidden">
                <span className="material-symbols-outlined text-red-500 text-3xl mb-2">
                  videocam_off
                </span>
                <p className="text-[11px] font-semibold select-none leading-relaxed text-slate-300">
                  {scannerError}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 w-full">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-[#f4f2ff] hover:bg-[#edecff] text-[#8E94B7] hover:text-[#181a2c] rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Tutup Kamera
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrScanModal;
