import React, { useEffect, useState } from "react";
import { matchNames } from "../../utils/formatters";
import {
  compareMembersByLevel,
  getFromRecord,
  getUplineInTeam,
  normalizePosition,
} from "../../utils/hierarchy";
import { EmployeeDeleteModal } from "../modals/EmployeeDeleteModal";
import { EmployeeEditModal } from "../modals/EmployeeEditModal";
import { PartnerDeleteModal } from "../modals/PartnerDeleteModal";
import { PartnerEditModal } from "../modals/PartnerEditModal";

interface PartnerTabProps {
  userData: any;
  userLevel: number;
  teamMembers: string[];
  teamPositions: Record<string, string>;
  teamProvinces: Record<string, string>;
  teamUpLines: Record<string, string>;
  teamLevels: Record<string, number>;
  employees: any[];
  normalizeName: (name: string) => string;
  mappingPic: string;
  setMappingPic: (v: string) => void;
  mappingCategories: string[];
  mappingCategory: string;
  setMappingCategory: (v: string) => void;
  displayedPartnerChannels: any[];
  partnerEditModal: { isOpen: boolean; item: any };
  setPartnerEditModal: (v: { isOpen: boolean; item: any }) => void;
  partnerDeleteModal: { isOpen: boolean; item: any };
  setPartnerDeleteModal: (v: { isOpen: boolean; item: any }) => void;
  employeeEditModal: { isOpen: boolean; item: any };
  setEmployeeEditModal: (v: { isOpen: boolean; item: any }) => void;
  employeeDeleteModal: { isOpen: boolean; item: any };
  setEmployeeDeleteModal: (v: { isOpen: boolean; item: any }) => void;
  handleEditPartnerSave: (
    id: any,
    newPic: any,
    additionalData?: any,
  ) => Promise<void>;
  handleDeletePartnerConfirm: () => Promise<void>;
  handleEditEmployeeSave: (
    originalName: string,
    updatedFields: any,
    isAdd?: boolean,
  ) => Promise<void>;
  handleDeleteEmployeeConfirm: () => Promise<void>;
  isActionLoading: boolean;
  myActiveSubordinates: any[];
  availableProvinces: string[];
  allCategories: string[];
  availableGroups: string[];
  accessRules: Record<string, Record<string, boolean>>;
  canEdit?: boolean;
}

export default function PartnerTab({
  userData,
  userLevel,
  teamMembers,
  teamPositions,
  teamProvinces,
  teamUpLines,
  teamLevels,
  employees,
  normalizeName,
  mappingPic,
  setMappingPic,
  mappingCategories,
  mappingCategory,
  setMappingCategory,
  displayedPartnerChannels,
  partnerEditModal,
  setPartnerEditModal,
  partnerDeleteModal,
  setPartnerDeleteModal,
  employeeEditModal,
  setEmployeeEditModal,
  employeeDeleteModal,
  setEmployeeDeleteModal,
  handleEditPartnerSave,
  handleDeletePartnerConfirm,
  handleEditEmployeeSave,
  handleDeleteEmployeeConfirm,
  isActionLoading,
  myActiveSubordinates,
  availableProvinces,
  allCategories,
  availableGroups,
  accessRules,
  canEdit = true,
}: PartnerTabProps) {
  const [partnerSubTab, setPartnerSubTab] = useState<"team" | "channel">(
    userLevel === 1 ? "channel" : "team",
  );
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    setPartnerSubTab(userLevel === 1 ? "channel" : "team");
  }, [userData, userLevel]);

  const getDirectSubordinates = (parentName: string) => {
    return teamMembers.filter((member) => {
      if (matchNames(member, parentName)) return false;
      if (matchNames(member, userData.name)) return false;

      const mPos = normalizePosition(
        getFromRecord<string>(teamPositions, member) || "",
      );
      if (mPos === "Unknown") return false;

      const uplineResolved = getUplineInTeam(member, teamMembers, teamUpLines);
      return (
        uplineResolved !== null && matchNames(uplineResolved, parentName)
      );
    });
  };

  const renderRecursiveTeamNode = (
    parentName: string,
    depth = 1,
  ): React.ReactNode => {
    const directSubordinates = getDirectSubordinates(parentName);
    if (directSubordinates.length === 0) return null;

    return (
      <div className="space-y-4 pl-3 border-l border-[#edecff]/70 ml-1.5 mt-2 animate-in fade-in duration-300">
        {directSubordinates.map((sub, idx) => {
          const subPos =
            getFromRecord<string>(teamPositions, sub) || "Sales Agronomist";
          const subProvince =
            getFromRecord<string>(teamProvinces, sub) || "-";
          const isCollapsed = collapsedNodes[sub] !== false;
          const subSubs = getDirectSubordinates(sub);
          const hasChildren = subSubs.length > 0;

          return (
            <div key={idx} className="space-y-4">
              <div className="flex items-start">
                <div
                  onClick={() => {
                    if (hasChildren) {
                      setCollapsedNodes((prev) => ({
                        ...prev,
                        [sub]: prev[sub] === false,
                      }));
                    }
                  }}
                  className={`bg-white hover:bg-slate-50 transition-all px-4 py-2.5 rounded-[18px] border border-slate-100 shadow-[0_8px_24px_rgba(21,75,226,0.06)] hover:shadow-[0_12px_28px_rgba(21,75,226,0.12)] flex-1 flex items-center justify-between ${
                    hasChildren ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2 text-left">
                    <p className="font-bold text-xs text-[#181a2c]">
                      {normalizeName(sub)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className={`text-[7.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                          depth === 1
                            ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                            : depth === 2
                              ? "text-blue-600 bg-blue-50 border-blue-100"
                              : "text-purple-600 bg-purple-50 border-purple-100"
                        }`}
                      >
                        {normalizePosition(subPos)}
                      </span>
                      {subProvince && subProvince !== "-" && (
                        <span className="text-[7.5px] font-bold text-[#8E94B7] bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100 uppercase tracking-wide">
                          {subProvince}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 z-10 relative">
                    {canEdit && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const emp = employees.find((emp) =>
                              matchNames(emp.name, sub),
                            );
                            setEmployeeEditModal({
                              isOpen: true,
                              item: emp || {
                                name: sub,
                                position: subPos,
                                province: subProvince,
                              },
                            });
                          }}
                          className="size-7 bg-[#edecff]/60 hover:bg-[#edecff] text-primary rounded-full border border-[#c4c5d8]/40 flex items-center justify-center transition-all shadow-none cursor-pointer"
                          title="Edit Karyawan"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            edit
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const emp = employees.find((emp) =>
                              matchNames(emp.name, sub),
                            );
                            setEmployeeDeleteModal({
                              isOpen: true,
                              item: emp || { name: sub },
                            });
                          }}
                          className="size-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-full border border-red-100 flex items-center justify-center transition-all shadow-none cursor-pointer"
                          title="Hapus Karyawan"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            delete
                          </span>
                        </button>
                      </>
                    )}
                    {hasChildren && (
                      <span className="material-symbols-outlined text-[#8E94B7] text-md leading-none select-none ml-1">
                        {isCollapsed ? "expand_more" : "expand_less"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {hasChildren &&
                !isCollapsed &&
                renderRecursiveTeamNode(sub, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const rootSubordinates = getDirectSubordinates(userData.name);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-6 ml-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#181a2c] tracking-tight">
            Mapping <span className="text-primary font-bold">Partner</span>
          </h1>
          <p className="text-[11px] text-[#8E94B7] font-semibold uppercase tracking-wider mt-0.5">
            Kelola Channel Area & Tim
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-[#edecff]/45 rounded-full w-full md:w-auto max-w-xs md:max-w-none border border-[#edecff]/60 shadow-[inset_0_1px_2px_rgba(21,75,226,0.03)] shrink-0 self-start md:self-auto">
          <button
            onClick={() => setPartnerSubTab("team")}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-full font-bold text-[9.5px] uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              partnerSubTab === "team"
                ? "bg-gradient-to-r from-primary to-cyan-400 text-white shadow-[0_4px_10px_rgba(21,75,226,0.18)]"
                : "text-[#8E94B7] hover:bg-white/50 hover:text-[#181a2c]"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] leading-none">
                groups
              </span>
              <span>Tim & Hirarki</span>
            </div>
          </button>
          <button
            onClick={() => setPartnerSubTab("channel")}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-full font-bold text-[9.5px] uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              partnerSubTab === "channel"
                ? "bg-gradient-to-r from-primary to-cyan-400 text-white shadow-[0_4px_10px_rgba(21,75,226,0.18)]"
                : "text-[#8E94B7] hover:bg-white/50 hover:text-[#181a2c]"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] leading-none">
                storefront
              </span>
              <span>Mapping Channel</span>
            </div>
          </button>
        </div>
      </div>

      {partnerSubTab === "team" && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="bg-white p-6 rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.1)] mb-6 border border-[#edecff] animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-[#edecff]">
              <div>
                <h3 className="text-xs font-bold text-[#181a2c] uppercase tracking-wider">
                  Hirarki Posisi Tim
                </h3>
              </div>
              {canEdit && (
                <button
                  disabled={userLevel === 1}
                  onClick={() =>
                    setEmployeeEditModal({
                      isOpen: true,
                      item: {
                        isAdd: true,
                        name: "",
                        position: "",
                        province: "",
                        email: "",
                        password: "",
                        upline: userData?.name || "",
                      },
                    })
                  }
                  className={`h-8 px-4 rounded-full font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
                    userLevel === 1
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:opacity-95 shadow-md active:scale-[97%] cursor-pointer"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    person_add
                  </span>
                  Tambah Anggota
                </button>
              )}
            </div>

            {teamMembers.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary shrink-0 shadow-sm border border-primary/10 mt-1.5">
                    0
                  </div>
                  <div
                    onClick={() => {
                      setCollapsedNodes((prev) => ({
                        ...prev,
                        [userData.name]: prev[userData.name] === false,
                      }));
                    }}
                    className={`bg-gradient-to-r from-[#edecff] to-sky-50/50 px-4 py-2.5 rounded-[18px] flex-1 relative overflow-hidden group shadow-[0_8px_24px_rgba(21,75,226,0.08)] hover:shadow-[0_12px_30px_rgba(21,75,226,0.14)] border-0 transition-all flex items-center justify-between ${
                      rootSubordinates.length > 0
                        ? "cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-[#181a2c]">
                        {normalizeName(userData.name)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[7.5px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/10 uppercase tracking-wider">
                          {normalizePosition(
                            userData.position || "Business Analyst",
                          )}
                        </span>
                        {userData.province && userData.province !== "-" && (
                          <span className="text-[7.5px] font-bold text-[#8E94B7] bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100 uppercase tracking-wide">
                            {userData.province}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3 z-10 relative">
                      {canEdit && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const emp = employees.find((emp) =>
                                matchNames(emp.name, userData.name),
                              );
                              setEmployeeEditModal({
                                isOpen: true,
                                item: emp || {
                                  name: userData.name,
                                  position: userData.position,
                                  province: userData.province || "",
                                  email: userData.email || "",
                                },
                              });
                            }}
                            className="size-7 bg-white/80 hover:bg-white text-primary rounded-full border border-[#edecff] flex items-center justify-center transition-all shadow-sm cursor-pointer"
                            title="Edit Karyawan"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const emp = employees.find((emp) =>
                                matchNames(emp.name, userData.name),
                              );
                              setEmployeeDeleteModal({
                                isOpen: true,
                                item: emp || { name: userData.name },
                              });
                            }}
                            className="size-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-full border border-red-100 flex items-center justify-center transition-all shadow-sm cursor-pointer"
                            title="Hapus Karyawan"
                            disabled={matchNames(userData.name, "Aditya Wiratama")}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              delete
                            </span>
                          </button>
                        </>
                      )}
                      {rootSubordinates.length > 0 && (
                        <span className="material-symbols-outlined text-[#8E94B7] text-md leading-none select-none ml-1">
                          {collapsedNodes[userData.name] !== false
                            ? "expand_more"
                            : "expand_less"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {collapsedNodes[userData.name] === false &&
                  renderRecursiveTeamNode(userData.name, 1)}
              </div>
            ) : (
              <p className="text-[9px] font-semibold text-[#8E94B7] text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-[#edecff] uppercase tracking-wide">
                Tidak ada anggota tim di bawah Anda. Silakan klik tombol "Tambah
                Anggota" di atas untuk menambahkan.
              </p>
            )}
          </div>
        </div>
      )}

      {partnerSubTab === "channel" && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          {teamMembers.length > 1 && (
            <div className="mb-6">
              <label className="text-[10px] text-[#8E94B7] font-bold uppercase tracking-wide ml-1 mb-2 block">
                Pilih PIC / Tim
              </label>
              <div className="relative">
                <select
                  value={mappingPic}
                  onChange={(e) => setMappingPic(e.target.value)}
                  className="w-full h-14 bg-white shadow-[0_4px_16px_rgba(21,75,226,0.08)] rounded-full px-6 font-semibold text-xs text-[#111] outline-none focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer pr-12"
                >
                  <option value="ALL_TEAM">Semua PIC</option>
                  {[...teamMembers]
                    .sort((a, b) =>
                      compareMembersByLevel(
                        a,
                        b,
                        teamLevels,
                        teamPositions,
                        userData,
                      ),
                    )
                    .map((picName, idx) => (
                      <option key={idx} value={picName}>
                        {picName}
                      </option>
                    ))}
                </select>
                <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-[#8E94B7] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          )}

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
            {mappingCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setMappingCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full font-semibold text-[10.5px] uppercase tracking-wide transition-all ${
                  mappingCategory === cat
                    ? "bg-gradient-to-r from-primary to-cyan-400 text-white shadow-[0_4px_12px_rgba(21,75,226,0.2)]"
                    : "bg-[#f4f2ff] text-[#8E94B7] hover:bg-[#edecff]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between bg-white px-5 py-3.5 rounded-[20px] shadow-sm border border-[#edecff]">
            <div>
              <h3 className="font-bold text-xs text-[#181a2c]">
                Daftar Partner
              </h3>
            </div>
            {canEdit && (
              <button
                onClick={() =>
                  setPartnerEditModal({
                    isOpen: true,
                    item: {
                      isAdd: true,
                      category: mappingCategory || "Kios",
                      name: "",
                      pic: "",
                    },
                  })
                }
                className="h-8 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-full font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5 hover:opacity-95 transition-all shadow-md active:scale-[97%] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">add</span>
                Tambah Partner
              </button>
            )}
          </div>

          <div className="space-y-3">
            {displayedPartnerChannels.length === 0 ? (
              <div className="py-12 bg-white rounded-[24px] shadow-sm flex flex-col justify-center items-center">
                <span className="material-symbols-outlined text-[#8E94B7] text-3xl mb-2">
                  sentiment_dissatisfied
                </span>
                <p className="text-[11px] font-semibold text-[#8E94B7] uppercase tracking-wider">
                  Tidak Ada Data
                </p>
              </div>
            ) : (
              displayedPartnerChannels.map((channel, i) => (
                <div
                  key={i}
                  className="bg-white shadow-[0_4px_16px_rgba(21,75,226,0.06)] hover:shadow-[0_8px_24px_rgba(21,75,226,0.12)] p-4 rounded-[16px] flex items-center justify-between transition-all duration-250"
                >
                  <div className="flex-1 pr-4">
                    <p className="font-semibold text-xs text-[#181a2c] leading-tight mb-0.5">
                      {channel.name}
                    </p>
                    <p className="text-[10px] font-bold text-[#8E94B7] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-[#8E94B7]/80">
                        person
                      </span>
                      {normalizeName(channel.pic) || "-"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {channel.category && (
                        <span className="text-[9px] font-extrabold bg-[#154be2]/10 text-primary px-2.5 py-0.5 rounded-full uppercase border border-[#154be2]/5">
                          {channel.category}
                        </span>
                      )}
                      {channel.group && (
                        <span className="text-[9px] font-extrabold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full uppercase">
                          {channel.group}
                        </span>
                      )}
                      {(channel.province || channel.area) && (
                        <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full uppercase border border-emerald-100/30">
                          {channel.province || channel.area}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setPartnerEditModal({ isOpen: true, item: channel })
                        }
                        className="size-9 bg-[#edecff] text-primary rounded-full border border-[#c4c5d8] flex items-center justify-center hover:bg-[#e6e6ff] transition-all shadow-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          setPartnerDeleteModal({
                            isOpen: true,
                            item: channel,
                          })
                        }
                        className="size-9 bg-red-50 text-red-500 rounded-full border border-red-100 flex items-center justify-center hover:bg-red-100 transition-all shadow-none cursor-pointer"
                        title="Hapus Partner"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          delete
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <PartnerEditModal
        isOpen={partnerEditModal.isOpen}
        item={partnerEditModal.item}
        onClose={() => setPartnerEditModal({ isOpen: false, item: null })}
        onSave={handleEditPartnerSave}
        isSaving={isActionLoading}
        activeEmployees={myActiveSubordinates}
        allProvinces={availableProvinces}
        allCategories={allCategories}
        userData={userData}
        allGroups={availableGroups}
      />
      <PartnerDeleteModal
        isOpen={partnerDeleteModal.isOpen}
        onClose={() => setPartnerDeleteModal({ isOpen: false, item: null })}
        onConfirm={handleDeletePartnerConfirm}
        isProcessing={isActionLoading}
        itemName={partnerDeleteModal.item?.name}
      />
      <EmployeeEditModal
        isOpen={employeeEditModal.isOpen}
        item={employeeEditModal.item}
        onClose={() => setEmployeeEditModal({ isOpen: false, item: null })}
        onSave={handleEditEmployeeSave}
        isSaving={isActionLoading}
        userData={userData}
        allProvinces={availableProvinces}
        accessRules={accessRules}
      />
      <EmployeeDeleteModal
        isOpen={employeeDeleteModal.isOpen}
        onClose={() => setEmployeeDeleteModal({ isOpen: false, item: null })}
        onConfirm={handleDeleteEmployeeConfirm}
        isProcessing={isActionLoading}
        itemName={employeeDeleteModal.item?.name}
      />
    </div>
  );
}
