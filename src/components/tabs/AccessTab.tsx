import React from "react";

interface AccessTabProps {
  allPositionsList: string[];
  accessRules: Record<string, Record<string, boolean>>;
  toggleAccessRule: (position: string, page: string) => void;
  removeAccessRule: (position: string) => void;
  accessSaveSuccess: boolean;
  handleSaveAccessRules: () => Promise<void>;
  isSavingAccess: boolean;
}

export default function AccessTab({
  allPositionsList,
  accessRules,
  toggleAccessRule,
  removeAccessRule,
  accessSaveSuccess,
  handleSaveAccessRules,
  isSavingAccess,
}: AccessTabProps) {
  const renderAccessCheckbox = (position: string, page: string) => {
    const isChecked = !!accessRules[position]?.[page];
    return (
      <button
        onClick={() => toggleAccessRule(position, page)}
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wide transition-colors ${
          isChecked
            ? "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer"
            : "text-slate-400 bg-slate-50 border-slate-200 hover:bg-slate-100 cursor-pointer"
        }`}
      >
        <span className="material-symbols-outlined text-[12px]">
          {isChecked ? "check_circle" : "cancel"}
        </span>
        {isChecked ? "Yes" : "No"}
      </button>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-6 ml-1 flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-[#181a2c] tracking-tight">
          Access Control Menu
        </h1>
        <p className="text-[#8E94B7] text-[11px] font-semibold tracking-wide">
          Level permissions and access rights mapping
        </p>
      </div>

      <div className="bg-white rounded-[24px] shadow-[0_12px_32px_rgba(21,75,226,0.03)] border border-[#154be2]/5 overflow-hidden">
        <div className="p-6 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[20px]">
                admin_panel_settings
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#181a2c]">
                System Access Rights
              </h3>
              <p className="text-[10px] font-semibold text-[#8E94B7] mt-0.5">
                Matrix of features available for each organizational level
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#fbfaff]">
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Position
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Home Tab
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Data Partner
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Stock Summary
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  POG Tracking
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Overview Tab
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Database Tab
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9]">
                  Access Menu
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#8E94B7] uppercase tracking-wider border-b border-[#f1f5f9] text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {allPositionsList.map((position) => (
                <tr
                  key={position}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <span className="text-[11px] font-semibold text-[#181a2c] bg-slate-100 px-2 py-1 rounded-md">
                      {position}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "home")}
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "partner")}
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "stock")}
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "pog")}
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "overview")}
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "temp")}
                  </td>
                  <td className="px-5 py-4">
                    {renderAccessCheckbox(position, "access")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => removeAccessRule(position)}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Hapus Rule"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-[#f1f5f9] bg-[#fbfaff] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <span className="material-symbols-outlined text-[#8E94B7] text-[18px]">
              info
            </span>
            <p className="text-[10px] font-semibold text-[#8E94B7] leading-relaxed">
              <span className="text-[#181a2c] font-bold uppercase tracking-wider block mb-1">
                General Access Rules
              </span>
              All levels have access to the{" "}
              <strong className="text-primary">Home</strong>,{" "}
              <strong className="text-primary">Data Partner</strong>,{" "}
              <strong className="text-primary">Stock Summary</strong>, and{" "}
              <strong className="text-primary">POG Tracking</strong> tabs. The
              data visible within these tabs is automatically filtered based on
              the user's{" "}
              <strong className="text-primary">Data Visibility</strong> level.
              The <strong className="text-primary">Access Menu</strong> tab is
              strictly limited to authorized system administrators.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 w-full md:w-auto mt-2 md:mt-0">
            {accessSaveSuccess && (
              <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
                <span className="material-symbols-outlined text-[16px]">
                  check_circle
                </span>
                Saved
              </div>
            )}
            <button
              onClick={handleSaveAccessRules}
              disabled={isSavingAccess}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#154be2] hover:bg-[#154be2]/90 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingAccess ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">
                  save
                </span>
              )}
              {isSavingAccess ? "Saving..." : "Save Role Access"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
