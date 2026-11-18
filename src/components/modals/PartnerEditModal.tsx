import React, { useEffect, useMemo, useState } from "react";
import { cleanForMatch } from "../../utils/formatters";

interface PartnerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSave: (id: any, newPic: any, additionalData?: any) => void;
  isSaving: boolean;
  activeEmployees: any[];
  allProvinces: string[];
  allCategories: string[];
  userData: any;
  allGroups: string[];
}

export const PartnerEditModal: React.FC<PartnerEditModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  isSaving,
  activeEmployees,
  allProvinces,
  allCategories,
  userData,
  allGroups,
}) => {
  const [newPic, setNewPic] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [category, setCategory] = useState("");
  const [province, setProvince] = useState("");
  const [group, setGroup] = useState("");

  const categoriesToDisplay = useMemo(() => {
    const defaultCategories = ["Distributor", "R1", "R2", "RTL"];
    const merged = [...defaultCategories];
    if (allCategories && Array.isArray(allCategories)) {
      allCategories.forEach((cat) => {
        const trimmed = String(cat || "").trim();
        if (
          trimmed &&
          trimmed !== "Uncategorized" &&
          !merged.some((m) => m.toLowerCase() === trimmed.toLowerCase())
        ) {
          merged.push(trimmed);
        }
      });
    }
    return merged;
  }, [allCategories]);

  const groupsToDisplay = useMemo(() => {
    const list = new Set(["Field Corn", "Vegetables", "Advanta"]);
    if (allGroups && Array.isArray(allGroups)) {
      allGroups.forEach((g) => {
        const trimmed = String(g || "").trim();
        if (trimmed && trimmed !== "-") {
          list.add(trimmed);
        }
      });
    }
    return Array.from(list);
  }, [allGroups]);

  const provincesToDisplay = useMemo(() => {
    const list = new Set<string>();
    if (allProvinces && Array.isArray(allProvinces)) {
      allProvinces.forEach((p) => {
        const trimmed = String(p || "").trim();
        if (trimmed && trimmed !== "-") {
          list.add(trimmed);
        }
      });
    }
    return Array.from(list);
  }, [allProvinces]);

  useEffect(() => {
    const userProv = String(userData?.province || userData?.area || "").trim();
    const userGroup = String(userData?.group || "").trim() || "Advanta";

    if (item) {
      const rawPic = String(item.pic || "").trim();
      const cleanRawPic = cleanForMatch(rawPic);
      const matchedPic =
        activeEmployees?.find((p) => cleanForMatch(p.name) === cleanRawPic)
          ?.name || rawPic;
      setNewPic(matchedPic);
      setPartnerName(String(item.name || "").trim());
      setCategory(String(item.category || "").trim() || "R1");
      setProvince(String(item.province || item.area || "").trim() || userProv);
      setGroup(String(item.group || "").trim() || userGroup);
    } else {
      setNewPic("");
      setPartnerName("");
      setCategory("R1");
      setProvince(userProv);
      setGroup(userGroup);
    }
  }, [item, activeEmployees, userData]);

  if (!isOpen) return null;

  const isAdd = !!item?.isAdd;

  const handleSave = () => {
    onSave(isAdd ? null : item?.id, newPic, {
      isAdd,
      name: partnerName.trim(),
      category: category.trim(),
      province: province.trim() || item?.province || item?.area || "",
      group: group.trim() || item?.group || "Advanta",
      originalName: isAdd ? "" : item?.name || "",
      originalPic: isAdd ? "" : item?.pic || "",
      originalProvince: isAdd ? "" : item?.province || item?.area || "",
      originalGroup: isAdd ? "" : item?.group || "",
      originalCategory: isAdd ? "" : item?.category || "",
    });
  };

  const isFormValid =
    partnerName.trim() !== "" && category.trim() !== "" && newPic.trim() !== "";

  return (
    <div className="fixed inset-0 z-[110] bg-[#181a2c]/50 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-[24px] p-8 shadow-2xl border border-[#edecff] animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
        <div className="size-14 bg-[#edecff] rounded-full flex items-center justify-center text-primary mb-5">
          <span className="material-symbols-outlined text-[28px]">
            {isAdd ? "add_business" : "manage_accounts"}
          </span>
        </div>
        <h2 className="text-xl font-semibold text-[#181a2c] leading-tight mb-1">
          {isAdd ? "Tambah Partner" : "Edit Partner"}
        </h2>
        <p className="text-[11px] text-[#8E94B7] font-semibold uppercase tracking-wider mb-6">
          {isAdd ? "Buat Partner Baru" : "Sesuaikan Data Partner"}
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              Nama Partner (Kiosk) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              disabled={!isAdd}
              className={`w-full h-11 border border-[#edecff] rounded-xl px-4 text-xs font-bold outline-none transition-all ${
                !isAdd
                  ? "bg-gray-100 cursor-not-allowed text-gray-500"
                  : "bg-[#fbf8ff] text-[#111] focus:border-primary focus:ring-1 focus:ring-primary/10"
              }`}
              placeholder="Contoh: Kios Mandiri Tani"
              required
            />
          </div>

          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              Kategori Partner <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] focus:border-primary focus:ring-1 focus:ring-primary/10 rounded-xl px-4 text-xs font-bold text-[#111] outline-none transition-all appearance-none pr-10 cursor-pointer"
                required
              >
                <option value="">-- Pilih Kategori --</option>
                {categoriesToDisplay.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none text-lg">
                expand_more
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              PIC (Karyawan Aktif) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={newPic}
                onChange={(e) => setNewPic(e.target.value)}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all appearance-none pr-10 cursor-pointer"
                required
              >
                <option value="">-- Pilih PIC --</option>
                {activeEmployees?.map((emp, idx) => (
                  <option key={idx} value={emp.name}>
                    {emp.name} ({emp.position || "Staff"})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none text-lg">
                expand_more
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              Divisi / Group
            </label>
            <div className="relative">
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all appearance-none pr-10 cursor-pointer"
              >
                {groupsToDisplay.map((grp, idx) => (
                  <option key={idx} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none text-lg">
                expand_more
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wider ml-1 mb-1.5 block">
              Provinsi / Wilayah
            </label>
            {provincesToDisplay.length > 0 ? (
              <div className="relative">
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 font-bold text-xs text-[#111] outline-none focus:border-primary transition-all appearance-none pr-10 cursor-pointer"
                >
                  <option value="">-- Pilih Wilayah / Provinsi --</option>
                  {provincesToDisplay.map((prov, idx) => (
                    <option key={idx} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none text-lg">
                  expand_more
                </span>
              </div>
            ) : (
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full h-11 bg-[#fbf8ff] border border-[#edecff] rounded-xl px-4 text-xs font-bold text-[#111] outline-none focus:border-primary transition-all"
                placeholder="Contoh: Jawa Timur / Sumatera"
              />
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-[#635b6e] font-semibold text-xs uppercase tracking-wider hover:bg-[#f4f2ff] rounded-full transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isFormValid}
            className={`flex-[2] py-3 text-white rounded-full font-semibold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer ${
              isSaving || !isFormValid
                ? "bg-[#e0e0fa] text-[#8E94B7] cursor-not-allowed"
                : "bg-gradient-to-r from-primary to-cyan-400 shadow-[0_4px_12px_rgba(21,75,226,0.25)]"
            }`}
          >
            {isSaving ? "Saving..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};
