import React, { useEffect, useState } from "react";
import { useFirebase } from "../../contexts/FirebaseContext";
import {
  addDrShipmentFirestore,
  addHybridFirestore,
  addLotFirestore,
  addOpnameLogFirestore,
} from "../../services/firestoreDb";
import { extractExpFromLot } from "../../utils/formatters";
import type { DivisionStrict } from "../../utils/firestoreNormalization";

export type OperationalCollectionKey =
  | "opname_logs"
  | "dr_shipments"
  | "lots"
  | "hybrids";

const FISCAL_MONTH_OPTIONS: Array<{
  key: "apr" | "mei" | "jun" | "jul" | "ags" | "sep" | "okt" | "nov" | "des" | "jan" | "feb" | "mar";
  label: string;
}> = [
  { key: "apr", label: "April (2026-04)" },
  { key: "mei", label: "Mei (2026-05)" },
  { key: "jun", label: "Juni (2026-06)" },
  { key: "jul", label: "Juli (2026-07)" },
  { key: "ags", label: "Agustus (2026-08)" },
  { key: "sep", label: "September (2026-09)" },
  { key: "okt", label: "Oktober (2026-10)" },
  { key: "nov", label: "November (2026-11)" },
  { key: "des", label: "Desember (2026-12)" },
  { key: "jan", label: "Januari (2027-01)" },
  { key: "feb", label: "Februari (2027-02)" },
  { key: "mar", label: "Maret (2027-03)" },
];

interface DatabaseAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCollection: OperationalCollectionKey;
  activeDivision: DivisionStrict;
  partnersCol: Array<{ doc_id: string; partner_name: string; category: string; division_group: string }>;
  employeesCol: Array<{ doc_id: string; full_name: string; position: string; division_group: string }>;
  hybridsCol: Array<{ doc_id: string; hybrid_name: string; crop_type: string }>;
  lotsCol: Array<{ doc_id: string; hybrid_id: string | null; exp_date: string; initial_dr_kg: number }>;
  onSuccess: (message: string, targetCollection: OperationalCollectionKey) => void;
}

export const DatabaseAddModal: React.FC<DatabaseAddModalProps> = ({
  isOpen,
  onClose,
  initialCollection,
  activeDivision,
  partnersCol,
  employeesCol,
  hybridsCol,
  lotsCol,
  onSuccess,
}) => {
  const { firebaseUser, firestoreDataset } = useFirebase();
  const [targetCol, setTargetCol] = useState<OperationalCollectionKey>(initialCollection);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hybrid fields
  const [hybridName, setHybridName] = useState("");
  const [cropType, setCropType] = useState<DivisionStrict>(activeDivision);

  // Lot fields
  const [lotNo, setLotNo] = useState("");
  const [lotHybridMode, setLotHybridMode] = useState<"existing" | "new">("existing");
  const [selectedHybridId, setSelectedHybridId] = useState("");
  const [newHybridNameForLot, setNewHybridNameForLot] = useState("");
  const [lotShippingDate, setLotShippingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lotExpDate, setLotExpDate] = useState("");
  const [lotInitialDrKg, setLotInitialDrKg] = useState("0");

  // DR Shipment fields
  const [drShippingDate, setDrShippingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [drPartnerId, setDrPartnerId] = useState("");
  const [drLotNo, setDrLotNo] = useState("");
  const [drExpDate, setDrExpDate] = useState("");
  const [drQtyKg, setDrQtyKg] = useState("0");
  const [drHybridId, setDrHybridId] = useState("");

  // Opname Log fields
  const [opPartnerId, setOpPartnerId] = useState("");
  const [opLotNo, setOpLotNo] = useState("");
  const [opCheckerId, setOpCheckerId] = useState("");
  const [opCropYear, setOpCropYear] = useState("FY2026");
  const [opMonthKey, setOpMonthKey] = useState<(typeof FISCAL_MONTH_OPTIONS)[number]["key"]>(() => {
    const m = new Date().getMonth();
    const map: Record<number, (typeof FISCAL_MONTH_OPTIONS)[number]["key"]> = {
      0: "jan", 1: "feb", 2: "mar", 3: "apr", 4: "mei", 5: "jun",
      6: "jul", 7: "ags", 8: "sep", 9: "okt", 10: "nov", 11: "des",
    };
    return map[m] || "apr";
  });
  const [opInKg, setOpInKg] = useState("0");
  const [opIdleKg, setOpIdleKg] = useState("0");
  const [opPogKg, setOpPogKg] = useState("0");

  useEffect(() => {
    if (!isOpen) return;
    setTargetCol(initialCollection);
    setCropType(activeDivision);
    setErrorMsg(null);
    setHybridName("");
    setLotNo("");
    setNewHybridNameForLot("");
    setLotExpDate("");
    setLotInitialDrKg("0");
    setDrLotNo("");
    setDrExpDate("");
    setDrQtyKg("0");
    setOpLotNo("");
    setOpInKg("0");
    setOpIdleKg("0");
    setOpPogKg("0");
    if (hybridsCol.length > 0 && !selectedHybridId) {
      setSelectedHybridId(hybridsCol[0].doc_id);
      setDrHybridId(hybridsCol[0].doc_id);
    }
    if (partnersCol.length > 0) {
      if (!drPartnerId) setDrPartnerId(partnersCol[0].doc_id);
      if (!opPartnerId) setOpPartnerId(partnersCol[0].doc_id);
    }
    if (employeesCol.length > 0 && !opCheckerId) {
      setOpCheckerId(employeesCol[0].doc_id);
    }
  }, [isOpen, initialCollection, activeDivision, hybridsCol, partnersCol, employeesCol]);

  // Auto-derive expired date when Lot No changes
  useEffect(() => {
    if (lotNo.trim().length >= 5) {
      const derived = extractExpFromLot(lotNo);
      if (derived && derived !== "N/A") setLotExpDate(derived);
    }
  }, [lotNo]);

  useEffect(() => {
    if (drLotNo.trim().length >= 5) {
      const matchedLot = lotsCol.find(
        (l) => l.doc_id.toUpperCase() === drLotNo.trim().toUpperCase(),
      );
      if (matchedLot?.exp_date) {
        setDrExpDate(matchedLot.exp_date);
      } else {
        const derived = extractExpFromLot(drLotNo);
        if (derived && derived !== "N/A") setDrExpDate(derived);
      }
    }
  }, [drLotNo, lotsCol]);

  if (!isOpen) return null;

  const fsHybrids = firestoreDataset?.hybrids || [];
  const fsLots = firestoreDataset?.lots || [];
  const fsDrShipments = firestoreDataset?.dr_shipments || [];
  const fsOpnameLogs = firestoreDataset?.opname_logs || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);
    try {
      if (targetCol === "hybrids") {
        const created = await addHybridFirestore(firebaseUser, {
          hybrid_name: hybridName,
          crop_type: cropType,
          existingHybrids: fsHybrids,
        });
        onSuccess(`Hybrid ${created.doc_id} (${created.hybrid_name}) berhasil ditambahkan ke Firestore.`, "hybrids");
        onClose();
        return;
      }

      if (targetCol === "lots") {
        const created = await addLotFirestore(firebaseUser, {
          lot_no: lotNo,
          hybrid_id: lotHybridMode === "existing" ? selectedHybridId || null : null,
          new_hybrid_name: lotHybridMode === "new" ? newHybridNameForLot : undefined,
          crop_type: cropType,
          shipping_date: lotShippingDate,
          exp_date: lotExpDate,
          initial_dr_kg: Number(lotInitialDrKg) || 0,
          existingHybrids: fsHybrids,
          existingLots: fsLots,
        });
        onSuccess(`Lot ${created.doc_id} berhasil disimpan ke Firestore.`, "lots");
        onClose();
        return;
      }

      if (targetCol === "dr_shipments") {
        const created = await addDrShipmentFirestore(firebaseUser, {
          shipping_date: drShippingDate,
          partner_id: drPartnerId || null,
          lot_no: drLotNo,
          exp_date: drExpDate,
          shipped_qty_kg: Number(drQtyKg) || 0,
          hybrid_id: drHybridId || null,
          existingLots: fsLots,
          existingDrShipments: fsDrShipments,
        });
        onSuccess(`DR Shipment ${created.doc_id} (Lot ${created.lot_no}) berhasil ditambahkan ke Firestore.`, "dr_shipments");
        onClose();
        return;
      }

      if (targetCol === "opname_logs") {
        await addOpnameLogFirestore(firebaseUser, {
          partner_id: opPartnerId || null,
          lot_no: opLotNo,
          checker_id: opCheckerId || null,
          crop_year: opCropYear,
          monthKey: opMonthKey,
          inKg: Number(opInKg) || 0,
          idleKg: Number(opIdleKg) || 0,
          pogKg: Number(opPogKg) || 0,
          existingLots: fsLots,
          existingLogs: fsOpnameLogs,
        });
        onSuccess(`Log Opname untuk Lot ${opLotNo.toUpperCase()} (${opMonthKey.toUpperCase()}) berhasil disimpan ke Firestore.`, "opname_logs");
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal menyimpan data ke Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  const tabMeta: Array<{ key: OperationalCollectionKey; label: string }> = [
    { key: "opname_logs", label: "Opname Log" },
    { key: "dr_shipments", label: "DR Shipment" },
    { key: "lots", label: "Lot" },
    { key: "hybrids", label: "Hybrid" },
  ];

  return (
    <div className="fixed inset-0 z-[110] bg-[#181a2c]/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[480px] max-h-[90vh] rounded-[28px] shadow-2xl border border-[#edecff] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#edecff] flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className="size-11 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">add_circle</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#181a2c] leading-tight">
                Tambah Data Database
              </h2>
              <p className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider mt-0.5">
                Simpan Langsung ke Firestore (radaradv-95dbf)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full hover:bg-[#f4f2ff] text-[#8E94B7] hover:text-[#181a2c] flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Collection Tabs */}
        <div className="px-6 pt-3 pb-2 bg-[#fbf8ff] border-b border-[#edecff] flex gap-1.5 overflow-x-auto">
          {tabMeta.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTargetCol(t.key);
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                targetCol === t.key
                  ? "bg-[#154be2] text-white shadow-sm"
                  : "bg-white text-[#635b6e] border border-[#edecff] hover:bg-[#f4f2ff]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-2xl text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {/* FORM: HYBRIDS */}
            {targetCol === "hybrids" && (
              <>
                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Nama Hybrid / Varietas
                  </label>
                  <input
                    type="text"
                    required
                    value={hybridName}
                    onChange={(e) => setHybridName(e.target.value)}
                    placeholder="Contoh: ADV-777 atau PAC-789"
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Divisi / Crop Type
                  </label>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value as DivisionStrict)}
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                  >
                    <option value="Field Corn">Field Corn</option>
                    <option value="Vegetables">Vegetables</option>
                  </select>
                </div>
              </>
            )}

            {/* FORM: LOTS */}
            {targetCol === "lots" && (
              <>
                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Nomor Lot (PK: doc_id)
                  </label>
                  <input
                    type="text"
                    required
                    value={lotNo}
                    onChange={(e) => setLotNo(e.target.value)}
                    placeholder="Contoh: A260401001"
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none uppercase"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-1">
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider">
                      Hybrid Terkait
                    </label>
                    <button
                      type="button"
                      onClick={() => setLotHybridMode((m) => (m === "existing" ? "new" : "existing"))}
                      className="text-[10px] font-bold text-[#154be2] hover:underline cursor-pointer"
                    >
                      {lotHybridMode === "existing" ? "+ Buat Hybrid Baru" : "Pilih Hybrid Existing"}
                    </button>
                  </div>
                  {lotHybridMode === "existing" ? (
                    <select
                      value={selectedHybridId}
                      onChange={(e) => setSelectedHybridId(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    >
                      <option value="">-- Tanpa Hybrid --</option>
                      {hybridsCol.map((h) => (
                        <option key={h.doc_id} value={h.doc_id}>
                          {h.doc_id} · {h.hybrid_name} ({h.crop_type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={newHybridNameForLot}
                        onChange={(e) => setNewHybridNameForLot(e.target.value)}
                        placeholder="Nama Hybrid Baru"
                        className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none uppercase"
                      />
                      <select
                        value={cropType}
                        onChange={(e) => setCropType(e.target.value as DivisionStrict)}
                        className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                      >
                        <option value="Field Corn">Field Corn</option>
                        <option value="Vegetables">Vegetables</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Tanggal Kirim (DR)
                    </label>
                    <input
                      type="date"
                      value={lotShippingDate}
                      onChange={(e) => setLotShippingDate(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Expired Date
                    </label>
                    <input
                      type="text"
                      value={lotExpDate}
                      onChange={(e) => setLotExpDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Initial DR Qty (Kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lotInitialDrKg}
                    onChange={(e) => setLotInitialDrKg(e.target.value)}
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                  />
                </div>
              </>
            )}

            {/* FORM: DR SHIPMENTS */}
            {targetCol === "dr_shipments" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Tanggal Kirim
                    </label>
                    <input
                      type="date"
                      required
                      value={drShippingDate}
                      onChange={(e) => setDrShippingDate(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Qty Kirim (Kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={drQtyKg}
                      onChange={(e) => setDrQtyKg(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Partner / Kios Tujuan
                  </label>
                  <select
                    value={drPartnerId}
                    onChange={(e) => setDrPartnerId(e.target.value)}
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                  >
                    <option value="">-- Pilih Partner --</option>
                    {partnersCol.map((p) => (
                      <option key={p.doc_id} value={p.doc_id}>
                        {p.doc_id} · {p.partner_name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Nomor Lot (Ketik baru atau pilih yang ada)
                  </label>
                  <input
                    type="text"
                    required
                    list="lots-datalist-dr"
                    value={drLotNo}
                    onChange={(e) => setDrLotNo(e.target.value)}
                    placeholder="Contoh: A260401001"
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none uppercase"
                  />
                  <datalist id="lots-datalist-dr">
                    {lotsCol.map((l) => (
                      <option key={l.doc_id} value={l.doc_id} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Hybrid (Jika Lot Baru)
                    </label>
                    <select
                      value={drHybridId}
                      onChange={(e) => setDrHybridId(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    >
                      <option value="">-- Opsional --</option>
                      {hybridsCol.map((h) => (
                        <option key={h.doc_id} value={h.doc_id}>
                          {h.hybrid_name} ({h.crop_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Expired Date
                    </label>
                    <input
                      type="text"
                      value={drExpDate}
                      onChange={(e) => setDrExpDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* FORM: OPNAME LOGS */}
            {targetCol === "opname_logs" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Partner / Kios
                    </label>
                    <select
                      value={opPartnerId}
                      onChange={(e) => setOpPartnerId(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    >
                      <option value="">-- Pilih Partner --</option>
                      {partnersCol.map((p) => (
                        <option key={p.doc_id} value={p.doc_id}>
                          {p.doc_id} · {p.partner_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Nomor Lot
                    </label>
                    <input
                      type="text"
                      required
                      list="lots-datalist-op"
                      value={opLotNo}
                      onChange={(e) => setOpLotNo(e.target.value)}
                      placeholder="Contoh: A260401001"
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none uppercase"
                    />
                    <datalist id="lots-datalist-op">
                      {lotsCol.map((l) => (
                        <option key={l.doc_id} value={l.doc_id} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Checker (Employee)
                    </label>
                    <select
                      value={opCheckerId}
                      onChange={(e) => setOpCheckerId(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    >
                      <option value="">-- Pilih Checker --</option>
                      {employeesCol.map((emp) => (
                        <option key={emp.doc_id} value={emp.doc_id}>
                          {emp.doc_id} · {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      Crop Year
                    </label>
                    <input
                      type="text"
                      value={opCropYear}
                      onChange={(e) => setOpCropYear(e.target.value)}
                      placeholder="FY2026"
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                    Periode Bulan Opname
                  </label>
                  <select
                    value={opMonthKey}
                    onChange={(e) =>
                      setOpMonthKey(e.target.value as (typeof FISCAL_MONTH_OPTIONS)[number]["key"])
                    }
                    className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                  >
                    {FISCAL_MONTH_OPTIONS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      IN (Kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={opInKg}
                      onChange={(e) => setOpInKg(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-3 text-xs font-semibold text-[#111] outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-700 font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      IDLE (Kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={opIdleKg}
                      onChange={(e) => setOpIdleKg(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-3 text-xs font-semibold text-[#111] outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-blue-700 font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                      POG (Kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={opPogKg}
                      onChange={(e) => setOpPogKg(e.target.value)}
                      className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-3 text-xs font-semibold text-[#111] outline-none text-center"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-6 border-t border-[#edecff] flex gap-3 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 text-[#635b6e] font-semibold text-xs uppercase tracking-wider hover:bg-[#f4f2ff] rounded-full transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-[2] h-11 bg-gradient-to-r from-primary to-cyan-400 text-white rounded-full font-semibold text-xs uppercase tracking-wider shadow-[0_4px_12px_rgba(21,75,226,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan ke Firestore"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
