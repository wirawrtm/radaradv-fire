import React, { useEffect, useMemo, useState } from "react";
import { DEFAULT_POSITIONS } from "../../utils/constants";
import {
  getPositionRank,
  normalizePosition,
  parseLevelStr,
} from "../../utils/hierarchy";

interface EmployeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSave: (originalName: string, updatedFields: any, isAdd?: boolean) => void;
  isSaving: boolean;
  userData: any;
  allProvinces: string[];
  accessRules: Record<string, any>;
  allEmployees?: any[];
}

export const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  isSaving,
  userData,
  allProvinces,
  accessRules,
  allEmployees = [],
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [province, setProvince] = useState("");
  const [password, setPassword] = useState("");
  const [upline, setUpline] = useState("");
  const [group, setGroup] = useState<"Field Corn" | "Fresh Corn" | "Vegetables" | "All">("Field Corn");

  const isAdd = !!item?.isAdd;

  const userLevel = useMemo(() => {
    if (!userData) return 0;
    if (
      userData.level !== undefined &&
      userData.level !== null &&
      String(userData.level).trim() !== ""
    ) {
      const parsed = parseLevelStr(userData.level);
      if (!isNaN(parsed)) return parsed;
    }
    const rank = getPositionRank(userData.position);
    if (rank === 1) return 5;
    if (rank === 2) return 4;
    if (rank === 3) return 3;
    if (rank === 4) return 2;
    if (rank === 5) return 1;
    return 0;
  }, [userData]);

  const isLoginLevel2 = isAdd && userLevel === 2;

  useEffect(() => {
    if (item) {
      setName(String(item.name || ""));
      setEmail(String(item.user || item.email || ""));
      setPassword(String(item.password || "123"));
      setUpline(String(item.upline || ""));
      const rawDiv = String(item.group || userData?.group || "Field Corn").trim().toLowerCase();
      const initDiv: "Field Corn" | "Fresh Corn" | "Vegetables" | "All" =
        rawDiv === "all"
          ? "All"
          : rawDiv.includes("fresh")
            ? "Fresh Corn"
            : rawDiv.includes("veg")
              ? "Vegetables"
              : "Field Corn";
      setGroup(initDiv);

      if (isAdd && userLevel === 2) {
        setPosition("Business Solution");
        setProvince(String(userData?.province || "").trim() || "-");
      } else {
        setPosition(String(item.position || "Business Solution"));
        setProvince(String(item.province || ""));
      }
    }
  }, [item, isAdd, userLevel, userData]);

  // Filter kandidat Upline (Atasan Langsung) berdasarkan Divisi (Field Corn / Vegetables) & Level di atasnya
  const candidateUplines = useMemo(() => {
    const posLower = String(position || "").toLowerCase();
    let targetRank = 5; // Business Solution -> butuh atasan rank <= 4 (Sales Agronomist / ASM)
    if (posLower.includes("business solution")) targetRank = 5;
    else if (posLower.includes("sales agronomist")) targetRank = 4;
    else if (posLower.includes("area sales manager")) targetRank = 3;
    else if (posLower.includes("sales manager") || posLower.includes("commercial lead"))
      targetRank = 2;
    else targetRank = 1;

    return (allEmployees || []).filter((emp) => {
      if (!emp?.name) return false;
      if (emp.name.toLowerCase().trim() === name.toLowerCase().trim()) return false;
      const empDivRaw = String(emp.group || emp.position || "").trim().toLowerCase();
      const empDiv =
        empDivRaw === "all"
          ? "All"
          : empDivRaw.includes("veg")
            ? "Vegetables"
            : "Field Corn";
      if (group !== "All" && empDiv !== "All" && empDiv !== group) return false;
      const r = getPositionRank(emp.position);
      return r < targetRank;
    });
  }, [allEmployees, position, group, name]);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const rank = getPositionRank(position);
    let levelVal = 1;
    if (rank === 1) levelVal = 5;
    else if (rank === 2) levelVal = 4;
    else if (rank === 3) levelVal = 3;
    else if (rank === 4) levelVal = 2;
    else if (rank === 5) levelVal = 1;

    const matchedUplineObj = (allEmployees || []).find(
      (emp) =>
        String(emp?.name || "").toLowerCase().trim() ===
        String(upline || "").toLowerCase().trim(),
    );

    onSave(
      isAdd ? "" : item?.name || "",
      {
        name: name.trim(),
        email: (email || name.replace(/\s+/g, "").toLowerCase()).trim(),
        user: (email || name.replace(/\s+/g, "").toLowerCase()).trim(),
        position,
        province: province || matchedUplineObj?.province || "Central Java",
        area: matchedUplineObj?.area || province || "-",
        password: password || "123",
        upline: upline || userData?.name || "-",
        level: String(levelVal),
        group,
      },
      isAdd,
    );
  };

  const isSelf =
    !isAdd &&
    !!(
      userData?.name &&
      item?.name &&
      String(userData.name).toLowerCase().trim() ===
        String(item.name).toLowerCase().trim()
    );

  const loggedInRank = getPositionRank(userData?.position || "");
  const allPos = useMemo(() => {
    const filteredList = Object.keys(accessRules || {}).filter(
      (p) => p !== "Sales Manager",
    );
    DEFAULT_POSITIONS.forEach((d) => {
      if (!filteredList.includes(d)) filteredList.push(d);
    });
    return filteredList;
  }, [accessRules]);

  const positions = allPos.filter((p) => {
    if (item && normalizePosition(item.position) === normalizePosition(p))
      return true;
    return getPositionRank(p) >= loggedInRank;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-[#181a2c]/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[420px] max-h-[88vh] rounded-[28px] shadow-2xl border border-[#edecff] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 pb-4 border-b border-[#edecff] flex items-center gap-3 bg-white">
          <div className="size-11 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">
              {isAdd ? "person_add" : "face"}
            </span>
          </div>
          <div>
            <h2 className="text-base font-bold text-[#181a2c] leading-tight">
              {isAdd ? "Tambah Karyawan Baru" : "Edit Detail Karyawan"}
            </h2>
            <p className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider mt-0.5">
              {isAdd
                ? "Otomatis Sinkron ke Hierarki Upline & ASM"
                : `${item?.name} ${isSelf ? "(Anda)" : ""}`}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white">
          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              Nama Lengkap
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={!isAdd}
              className={`w-full h-11 border border-[#edecff] rounded-full px-4 text-xs font-semibold outline-none transition-all ${
                !isAdd
                  ? "bg-gray-100 cursor-not-allowed text-gray-400"
                  : "bg-[#fbf8ff] text-[#111] focus:border-primary focus:ring-1 focus:ring-primary/10"
              }`}
              placeholder="Masukkan nama lengkap"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                Divisi Sales
              </label>
              <select
                value={group}
                onChange={(e) =>
                  setGroup(e.target.value as "Field Corn" | "Fresh Corn" | "Vegetables" | "All")
                }
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
              >
                <option value="Field Corn">Field Corn</option>
                <option value="Fresh Corn">Fresh Corn</option>
                <option value="Vegetables">Vegetables</option>
                <option value="All">All (Super User · Semua Divisi)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                Posisi / Jabatan
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={isSelf || isLoginLevel2}
                className={`w-full h-11 border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold outline-none ${
                  isSelf || isLoginLevel2
                    ? "bg-slate-100 text-[#8E94B7] cursor-not-allowed"
                    : "bg-[#fbf8ff] text-[#111]"
                }`}
              >
                <option value="">-- Pilih Posisi --</option>
                {positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dropdown Upline (Atasan Langsung) -> Otomatis mengupdate subordinate_ids Sales Agronomist & ASM di atasnya */}
          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              Atasan Langsung (Upline)
            </label>
            <select
              value={upline}
              onChange={(e) => setUpline(e.target.value)}
              className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
            >
              <option value="">-- Pilih Atasan Langsung (Upline) --</option>
              {candidateUplines.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name} ({u.position} · {u.area || u.province || "-"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                Username Login
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                placeholder="Username"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                Password Login
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
                placeholder="Password"
              />
            </div>
          </div>

          {!isLoginLevel2 && (
            <div>
              <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
                Provinsi
              </label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                disabled={isSelf}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary rounded-full px-4 text-xs font-semibold text-[#111] outline-none"
              >
                <option value="">-- Pilih Provinsi --</option>
                {(allProvinces || []).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
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
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-[2] h-11 bg-gradient-to-r from-primary to-cyan-400 text-white rounded-full font-semibold text-xs uppercase tracking-wider shadow-[0_4px_12px_rgba(21,75,226,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};
