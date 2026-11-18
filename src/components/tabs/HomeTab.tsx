import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CROP_OPTIONS } from "../../utils/constants";
import {
  cleanForMatch,
  extractExpFromLot,
  matchNames,
} from "../../utils/formatters";
import { DetailItemSection } from "../common/DetailItemSection";
import { ConfirmModal } from "../modals/ConfirmModal";
import { EditModal } from "../modals/EditModal";

const QrScanModal = lazy(() => import("../modals/QrScanModal"));

interface HomeTabProps {
  isBusinessAnalyst: boolean;
  selectedKiosk: string;
  setSelectedKiosk: (v: string) => void;
  myKiosks: any[];
  kiosks: any[];
  lotNo: string;
  setLotNo: (v: string) => void;
  qty: string;
  setQty: (v: string) => void;
  isLotChecking: boolean;
  lotIntel: any;
  isLotNotFound: boolean;
  manualHybrid: string;
  setManualHybrid: (v: string) => void;
  manualHybridCustom: string;
  setManualHybridCustom: (v: string) => void;
  manualCrop: string;
  setManualCrop: (v: string) => void;
  manualDrDate: string;
  setManualDrDate: (v: string) => void;
  manualExpDate: string;
  setManualExpDate: (v: string) => void;
  materialsList: string[];
  handleAddLocal: () => void;
  workingData: any[];
  editModal: { isOpen: boolean; item: any };
  setEditModal: (v: { isOpen: boolean; item: any }) => void;
  deleteModal: { isOpen: boolean; item: any };
  setDeleteModal: (v: { isOpen: boolean; item: any }) => void;
  handleEditLocal: (id: any, newQty: any, updatedFields?: any) => void;
  handleDeleteLocal: () => void;
  handleUploadActivity: () => void;
  isSyncing: boolean;
  hasChanges: boolean;
  isActionLoading: boolean;
  isScannerOpen: boolean;
  setIsScannerOpen: (v: boolean) => void;
}

export default function HomeTab({
  isBusinessAnalyst,
  selectedKiosk,
  setSelectedKiosk,
  myKiosks,
  kiosks,
  lotNo,
  setLotNo,
  qty,
  setQty,
  isLotChecking,
  lotIntel,
  isLotNotFound,
  manualHybrid,
  setManualHybrid,
  manualHybridCustom,
  setManualHybridCustom,
  manualCrop,
  setManualCrop,
  manualDrDate,
  setManualDrDate,
  manualExpDate,
  setManualExpDate,
  materialsList,
  handleAddLocal,
  workingData,
  editModal,
  setEditModal,
  deleteModal,
  setDeleteModal,
  handleEditLocal,
  handleDeleteLocal,
  handleUploadActivity,
  isSyncing,
  hasChanges,
  isActionLoading,
  isScannerOpen,
  setIsScannerOpen,
}: HomeTabProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredKiosks = useMemo(
    () =>
      myKiosks.filter((k) =>
        String(k.name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [myKiosks, searchTerm],
  );

  const selectedCategory = useMemo(
    () =>
      kiosks.find(
        (k) => cleanForMatch(k.name) === cleanForMatch(selectedKiosk),
      )?.category || "Uncategorized",
    [kiosks, selectedKiosk],
  );

  const currentKioskItems = useMemo(
    () =>
      workingData.filter(
        (item) =>
          cleanForMatch(item.kiosk) === cleanForMatch(selectedKiosk) ||
          matchNames(item.kiosk, selectedKiosk),
      ),
    [workingData, selectedKiosk],
  );

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      {isBusinessAnalyst ? (
        <div className="bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.12)] border border-[#edecff] text-center max-w-md mx-auto my-12">
          <span className="material-symbols-outlined text-[48px] text-primary/40 mb-3">
            analytics
          </span>
          <h2 className="text-base font-semibold text-[#181a2c] mb-1.5">
            Akses Analis Bisnis
          </h2>
          <p className="text-xs text-[#8E94B7] leading-relaxed">
            Sebagai Business Analyst, Anda tidak perlu menginput stok secara
            manual untuk masing-masing Toko/Channel Partner melainkan memantau
            visualisasi, performa, dan ringkasan data. Silakan buka tab{" "}
            <strong className="text-primary font-medium">Stock</strong> atau{" "}
            <strong className="text-primary font-medium">POG</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 ml-1">
            <h1 className="text-lg font-semibold text-[#181a2c] tracking-tight">
              Channel <span className="text-primary font-bold">Partner</span>
            </h1>
          </div>
          <div className="relative mb-8" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between w-full px-6 py-4 bg-gradient-to-r from-primary to-cyan-400 text-white rounded-full shadow-[0_12px_32px_rgba(21,75,226,0.25)] hover:shadow-[0_16px_40px_rgba(21,75,226,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all relative z-30"
            >
              <span className="font-semibold text-sm truncate">
                {selectedKiosk}
              </span>
              <span className="material-symbols-outlined text-white/80">
                unfold_more
              </span>
            </button>
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-md shadow-[0_12px_32px_rgba(21,75,226,0.15)] z-[100] rounded-[24px] p-4 animate-in fade-in slide-in-from-top-4">
                <input
                  type="text"
                  placeholder="Search channel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.06)] rounded-full px-5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary/20 mb-3"
                />
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1">
                  {filteredKiosks.map((k, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedKiosk(k.name);
                        setIsDropdownOpen(false);
                        setSearchTerm("");
                      }}
                      className={`w-full text-left px-5 py-2.5 rounded-full font-semibold text-[11px] uppercase transition-all ${
                        selectedKiosk === k.name
                          ? "bg-[#edecff] text-primary"
                          : "text-[#635b6e] hover:bg-[#fbf8ff]"
                      }`}
                    >
                      {k.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-4 ml-1">
            <h1 className="text-lg font-semibold text-[#181a2c] tracking-tight">
              Tambah <span className="text-primary font-bold">LOT</span>
            </h1>
          </div>
          <div className="bg-white p-5 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.15)] mb-6">
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3 relative">
                  <button
                    type="button"
                    onClick={() => !isLotChecking && setIsScannerOpen(true)}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full flex items-center justify-center transition-all z-20 ${
                      isLotChecking
                        ? "cursor-not-allowed text-primary animate-spin"
                        : "cursor-pointer hover:bg-[#f4f2ff] text-primary active:scale-[0.93]"
                    }`}
                    title="Scan QR / Barcode"
                  >
                    <span className="material-symbols-outlined text-lg leading-none">
                      {isLotChecking ? "sync" : "photo_camera"}
                    </span>
                  </button>
                  <input
                    value={lotNo}
                    onChange={(e) => setLotNo(e.target.value)}
                    className="w-full h-14 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.08)] rounded-full pl-14 pr-6 font-semibold text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                    placeholder="Batch / Lot No"
                  />
                </div>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="col-span-2 h-14 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.08)] rounded-full px-6 font-semibold text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="Qty (Kg)"
                  type="number"
                />
              </div>

              {isLotChecking && (
                <div className="bg-[#f0f3ff] border border-[#dce2ff] p-3.5 rounded-[18px] flex items-center gap-2.5 animate-pulse shadow-sm">
                  <span className="material-symbols-outlined text-primary text-lg animate-spin">
                    sync
                  </span>
                  <p className="text-xs font-semibold text-primary">
                    Mengecek LOT di database...
                  </p>
                </div>
              )}

              {!isLotChecking && lotIntel && typeof lotIntel === "object" && (
                <div className="space-y-2">
                  <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-[18px] flex items-center gap-2.5 animate-in slide-in-from-top-2 shadow-sm">
                    <span className="material-symbols-outlined text-emerald-500 text-lg">
                      check_circle
                    </span>
                    <p className="text-xs font-semibold text-emerald-800">
                      [OK] LOT ditemukan di database!
                    </p>
                  </div>
                  <div className="bg-white shadow-[0_4px_16px_rgba(21,75,226,0.06)] p-4 rounded-[20px] animate-in slide-in-from-top-2">
                    <div className="mb-3">
                      <p className="text-[8.5px] font-bold text-[#8E94B7] uppercase tracking-wider mb-0.5">
                        Hybrid Description
                      </p>
                      <p className="text-xs font-semibold text-[#181a2c] leading-snug">
                        {lotIntel.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 border-t border-[#edecff] pt-3">
                      <div className="flex-1">
                        <p className="text-[8.5px] font-bold text-[#8E94B7] uppercase tracking-wider mb-0.5">
                          Dr Date
                        </p>
                        <p className="text-[10px] font-semibold text-[#181a2c]">
                          {lotIntel.drDate}
                        </p>
                      </div>
                      <div className="w-px h-6 bg-[#edecff]" />
                      <div className="flex-1">
                        <p className="text-[8.5px] font-bold text-red-400 uppercase tracking-wider mb-0.5">
                          Exp Date
                        </p>
                        <p className="text-[10px] font-bold text-red-700">
                          {!lotIntel.expDate ||
                          lotIntel.expDate === "N/A" ||
                          lotIntel.expDate === "-"
                            ? extractExpFromLot(lotNo)
                            : lotIntel.expDate}
                        </p>
                      </div>
                    </div>
                  </div>
                  {lotIntel.channel &&
                    cleanForMatch(lotIntel.channel) !==
                      cleanForMatch(selectedKiosk) && (
                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-[18px] flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">
                          warning
                        </span>
                        <div>
                          <p className="text-xs font-bold text-amber-800">
                            Perhatian: LOT milik Channel lain!
                          </p>
                          <p className="text-[10px] font-medium text-amber-700 mt-0.5 leading-relaxed">
                            Menurut database, LOT ini dikirim ke toko:{" "}
                            <span className="font-bold uppercase">
                              {lotIntel.channel}
                            </span>
                            .
                          </p>
                        </div>
                      </div>
                    )}
                </div>
              )}

              {!isLotChecking && lotIntel && typeof lotIntel === "string" && (
                <div className="space-y-2">
                  <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-[18px] flex items-center gap-2.5 animate-in slide-in-from-top-2 shadow-sm">
                    <span className="material-symbols-outlined text-emerald-500 text-lg">
                      check_circle
                    </span>
                    <p className="text-xs font-semibold text-emerald-800">
                      [OK] LOT ditemukan di database!
                    </p>
                  </div>
                  <div className="bg-white shadow-[0_4px_16px_rgba(21,75,226,0.06)] p-4 rounded-[18px] animate-in slide-in-from-top-2">
                    <p className="text-[8.5px] font-bold text-primary uppercase mb-0.5">
                      Lot Metadata Note
                    </p>
                    <p className="text-xs font-semibold text-[#181a2c]">
                      {lotIntel}
                    </p>
                  </div>
                </div>
              )}

              {!isLotChecking && isLotNotFound && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-red-50 border border-red-100 p-3.5 rounded-[18px] flex items-center gap-2.5 shadow-sm">
                    <span className="material-symbols-outlined text-red-500 text-lg flex-shrink-0">
                      warning
                    </span>
                    <div className="flex flex-col">
                      <p className="text-xs font-bold text-red-700 leading-tight">
                        [!] LOT tidak ditemukan di database!
                      </p>
                      <p className="text-[10px] text-red-600 mt-0.5 font-medium leading-relaxed">
                        LOT ini belum terdaftar. Agar data stock tetap valid,
                        Anda wajib melengkapi data Hybrid & Komoditas secara
                        manual di bawah ini.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 block">
                      Hybrid / Varietas <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={manualHybrid}
                        onChange={(e) => setManualHybrid(e.target.value)}
                        className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all appearance-none pr-10"
                        required
                      >
                        <option value="">-- Pilih Hybrid / Varietas --</option>
                        {materialsList.map((mat) => (
                          <option key={mat} value={mat}>
                            {mat}
                          </option>
                        ))}
                        <option value="CUSTOM">
                          -- Ketik Manual (Varietas Baru) --
                        </option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none text-lg">
                        expand_more
                      </span>
                    </div>
                    {manualHybrid === "CUSTOM" && (
                      <input
                        type="text"
                        value={manualHybridCustom}
                        onChange={(e) => setManualHybridCustom(e.target.value)}
                        placeholder="Ketik Nama Hybrid Baru..."
                        className="w-full h-11 mt-2 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all"
                        required
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 block">
                      Komoditas <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={manualCrop}
                        onChange={(e) => setManualCrop(e.target.value)}
                        className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all appearance-none pr-10"
                        required
                      >
                        {CROP_OPTIONS.map((crop) => (
                          <option key={crop} value={crop}>
                            {crop}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none text-lg">
                        expand_more
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 block">
                        Tgl DR / Shipping
                      </label>
                      <input
                        type="date"
                        value={manualDrDate}
                        onChange={(e) => setManualDrDate(e.target.value)}
                        className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 block">
                        Expired Date
                      </label>
                      <input
                        type="date"
                        value={manualExpDate}
                        onChange={(e) => setManualExpDate(e.target.value)}
                        className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleAddLocal}
                disabled={
                  !lotNo ||
                  !qty ||
                  (isLotNotFound &&
                    (!manualHybrid ||
                      (manualHybrid === "CUSTOM" &&
                        !manualHybridCustom.trim()) ||
                      !manualCrop))
                }
                className={`w-full h-14 rounded-full font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  !lotNo ||
                  !qty ||
                  (isLotNotFound &&
                    (!manualHybrid ||
                      (manualHybrid === "CUSTOM" &&
                        !manualHybridCustom.trim()) ||
                      !manualCrop))
                    ? "bg-[#e0e0fa] text-[#8E94B7] shadow-none cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-[#00D2FF] text-white shadow-[0_8px_20px_rgba(16,185,129,0.2)] hover:opacity-95"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_box
                </span>{" "}
                Tambah ke List
              </button>
            </div>
          </div>

          <DetailItemSection
            items={currentKioskItems}
            onEdit={(item) => setEditModal({ isOpen: true, item })}
            onDelete={(item) => setDeleteModal({ isOpen: true, item })}
            onUploadActivity={handleUploadActivity}
            isSyncing={isSyncing}
            hasChanges={hasChanges}
            title="Existing Stock"
            subtitle={selectedKiosk}
            category={selectedCategory}
            kiosks={kiosks}
          />

          <EditModal
            isOpen={editModal.isOpen}
            item={editModal.item}
            onClose={() => setEditModal({ isOpen: false, item: null })}
            onSave={handleEditLocal}
            isSaving={isActionLoading}
          />
          <ConfirmModal
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal({ isOpen: false, item: null })}
            onConfirm={handleDeleteLocal}
            isProcessing={isActionLoading}
          />
          {isScannerOpen && (
            <Suspense fallback={null}>
              <QrScanModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={(val) => setLotNo(val)}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
