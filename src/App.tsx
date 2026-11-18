import React, { useState, useEffect, useMemo } from "react";
import { AdvantaLogo } from "./AdvantaLogo";
import { SCRIPT_URL, DEFAULT_ACCESS_RULES } from "./utils/constants";
import { customFetch } from "./utils/api";
import { cleanForMatch } from "./utils/formatters";
import { getResolvedRole } from "./utils/hierarchy";
import { Login } from "./components/auth/Login";
import Dashboard from "./components/Dashboard";
import { useFirebase } from "./contexts/FirebaseContext";
import { BOOTSTRAPPED_ADMIN_EMAIL, isBootstrappedAdminEmail } from "./firebase";

const PUBLIC_VIEWER_SESSION = {
  name: "RADAR User",
  position: "Business Analyst",
  division: "All",
  group: "All",
  reportTo: "-",
  office: "Akses Terbuka",
  area: "All Area",
  user: "public",
  email: "",
  level: "5",
  isPublic: true,
};

export default function App() {
  const {
    firebaseUser,
    isAuthReady,
    isAuthorizedFirebase,
    disconnectGoogle,
  } = useFirebase();
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [userData, setUserData] = useState<any>(() => {
    try {
      const session = localStorage.getItem("radar_user_session");
      if (session) {
        const parsed = JSON.parse(session);
        const u = String(parsed?.user || parsed?.email || "").trim().toLowerCase();
        if (u === "adityahead" || u === "adityaheadoffice") {
          localStorage.removeItem("radar_user_session");
          return PUBLIC_VIEWER_SESSION;
        }
        if (isBootstrappedAdminEmail(parsed?.email || parsed?.user)) {
          return { ...parsed, isPublic: false };
        }
        localStorage.removeItem("radar_user_session");
      }
    } catch (e) {
      console.error("Failed to load user session", e);
    }
    return PUBLIC_VIEWER_SESSION;
  });

  const [activeTab, setActiveTab] = useState<string>("overview");

  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [overviewMetricFilter, setOverviewMetricFilter] = useState("movement");
  const [filterBelowMonth, setFilterBelowMonth] = useState("All");
  const [filterBelowChannel, setFilterBelowChannel] = useState("All");
  const [filterBelowMaterial, setFilterBelowMaterial] = useState("All");
  const [filterBelowTeam, setFilterBelowTeam] = useState("All");
  const [filterBelowArea, setFilterBelowArea] = useState("All");
  const [filterBelowCrop, setFilterBelowCrop] = useState("All");

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const isSoleAdmin = Boolean(
    userData &&
      !userData.isPublic &&
      isBootstrappedAdminEmail(userData.email || userData.user),
  );

  const normalizedPosition = useMemo(() => {
    if (!userData) return "";
    return getResolvedRole(userData.position);
  }, [userData]);

  const [accessRules, setAccessRules] = useState<Record<string, any>>(() => {
    try {
      const rules = localStorage.getItem("appAccessRules");
      if (rules) return JSON.parse(rules);
    } catch (e) {
      console.error("Failed to load access rules from localStorage", e);
    }
    return { ...DEFAULT_ACCESS_RULES };
  });

  const handleLoginState = (session: any) => {
    try {
      if (session && !session.isPublic) {
        const adminSession = { ...session, isPublic: false };
        localStorage.setItem("radar_user_session", JSON.stringify(adminSession));
        localStorage.removeItem("radar_logged_out");
        setActiveTab("overview");
        setFilterBelowCrop("All");
        setUserData(adminSession);
        setShowAdminLoginModal(false);
        return;
      } else {
        localStorage.removeItem("radar_user_session");
        localStorage.setItem("radar_logged_out", "true");
        setActiveTab("overview");
        setFilterBelowCrop("All");
      }
    } catch (e) {
      console.error("Failed to save user session", e);
    }
    setUserData(PUBLIC_VIEWER_SESSION);
  };

  const handleLogout = () => {
    handleLoginState(null);
    disconnectGoogle().catch(() => {});
    try {
      localStorage.removeItem("appAccessRules");
    } catch (e) {
      console.error("Failed to clear appAccessRules on logout", e);
    }
    setAccessRules({ ...DEFAULT_ACCESS_RULES });
  };

  const tabPermissions = useMemo(() => {
    if (!userData || userData.isPublic) {
      return {
        home: true,
        partner: true,
        stock: true,
        pog: true,
        overview: true,
        temp: true,
        access: true,
      };
    }
    const pos = userData.position || "";
    const cleanPos = cleanForMatch(pos);
    const cleanNormalized = cleanForMatch(normalizedPosition);

    let matchingKey = Object.keys(accessRules || {}).find(
      (key) => cleanForMatch(key) === cleanPos,
    );
    if (!matchingKey) {
      matchingKey = Object.keys(accessRules || {}).find(
        (key) => cleanForMatch(key) === cleanNormalized,
      );
    }

    if (matchingKey && accessRules[matchingKey]) {
      const rules = accessRules[matchingKey];
      return {
        home: rules.home ?? true,
        partner: rules.partner ?? true,
        stock: rules.stock ?? true,
        pog: rules.pog ?? true,
        overview: rules.overview ?? true,
        temp: rules.temp ?? true,
        access: rules.access ?? true,
      };
    }
    return {
      home: true,
      partner: true,
      stock: true,
      pog: true,
      overview: true,
      temp: true,
      access: true,
    };
  }, [userData, isSoleAdmin, normalizedPosition, accessRules]);

  const hasHomeTab = userData ? !!tabPermissions.home : false;
  const hasPartnerTab = userData ? !!tabPermissions.partner : false;
  const hasStockTab = userData ? !!tabPermissions.stock : false;
  const hasPogTab = userData ? !!tabPermissions.pog : false;
  const hasOverviewTab = userData ? !!tabPermissions.overview : false;
  const hasTempTab = userData ? !!tabPermissions.temp : false;
  const hasAccessTab = userData
    ? !!tabPermissions.access || isSoleAdmin
    : false;

  if (
    userData &&
    ((activeTab === "home" && !hasHomeTab) ||
      (activeTab === "partner" && !hasPartnerTab) ||
      (activeTab === "summary" && !hasStockTab) ||
      (activeTab === "pog" && !hasPogTab) ||
      (activeTab === "temp" && !hasTempTab) ||
      (activeTab === "overview" && !hasOverviewTab) ||
      (activeTab === "access" && !hasAccessTab))
  ) {
    let fallback = "";
    if (hasHomeTab) fallback = "home";
    else if (hasOverviewTab) fallback = "overview";
    else if (hasPartnerTab) fallback = "partner";
    else if (hasStockTab) fallback = "summary";
    else if (hasPogTab) fallback = "pog";
    else if (hasTempTab) fallback = "temp";
    else if (hasAccessTab) fallback = "access";

    if (fallback && fallback !== activeTab) {
      setActiveTab(fallback);
    }
  }

  useEffect(() => {
    if (
      userData &&
      ((!hasHomeTab && activeTab === "home") ||
        (!hasPartnerTab && activeTab === "partner") ||
        (!hasStockTab && activeTab === "summary") ||
        (!hasPogTab && activeTab === "pog") ||
        (!hasTempTab && activeTab === "temp") ||
        (!hasOverviewTab && activeTab === "overview") ||
        (!hasAccessTab && activeTab === "access"))
    ) {
      if (hasHomeTab) setActiveTab("home");
      else if (hasOverviewTab) setActiveTab("overview");
      else if (hasPartnerTab) setActiveTab("partner");
      else if (hasStockTab) setActiveTab("summary");
      else if (hasPogTab) setActiveTab("pog");
      else if (hasTempTab) setActiveTab("temp");
      else if (hasAccessTab) setActiveTab("access");
    }
  }, [
    userData,
    activeTab,
    hasHomeTab,
    hasPartnerTab,
    hasStockTab,
    hasPogTab,
    hasTempTab,
    hasOverviewTab,
    hasAccessTab,
  ]);

  const handleUserLogin = async (userVal: string, passVal: string) => {
    try {
      const res = await customFetch(
        `${SCRIPT_URL}?action=getUserProfile&user=${encodeURIComponent(userVal)}`,
      );
      const data = await res.json();
      if (data.status === "success" && data.data) {
        const profile = { ...data.data };
        const dbPassword = String(profile.password || "").trim();
        if (String(passVal || "").trim() !== dbPassword) {
          return { success: false, error: "Password salah." };
        }

        const isBA =
          cleanForMatch(userVal) === "adityawiratama" ||
          cleanForMatch(userVal) === "aditya" ||
          cleanForMatch(profile.name || "") === "adityawiratama" ||
          cleanForMatch(profile.name || "") === "aditya" ||
          cleanForMatch(profile.user || "") === "aditya" ||
          cleanForMatch(profile.user || "") === "adityawiratama";

        if (isBA) {
          profile.position = "Business Analyst";
        } else {
          profile.position = getResolvedRole(profile.position);
        }

        try {
          const rulesRes = await customFetch(
            `${SCRIPT_URL}?action=getAccessRules`,
          );
          const rulesData = await rulesRes.json();
          if (
            rulesData.status === "success" &&
            rulesData.data &&
            Object.keys(rulesData.data).length > 0
          ) {
            setAccessRules(rulesData.data);
            try {
              localStorage.setItem(
                "appAccessRules",
                JSON.stringify(rulesData.data),
              );
            } catch (e) {
              console.error("Failed to save appAccessRules on login", e);
            }
          }
        } catch (e) {
          console.warn("Failed to pre-fetch access rules during login:", e);
        }

        handleLoginState(profile);
        return { success: true };
      } else {
        return {
          success: false,
          error: data.message || "Username tidak ditemukan.",
        };
      }
    } catch (e) {
      console.warn("Login call error:", e);
      return { success: false, error: "Terjadi kesalahan jaringan." };
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;

    if (isAuthorizedFirebase && firebaseUser) {
      const emailLower = String(
        firebaseUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
      ).toLowerCase();
      setShowAdminLoginModal(false);
      setUserData((prev: any) => {
        if (prev && !prev.isPublic && isBootstrappedAdminEmail(prev.email || prev.user)) {
          return prev;
        }
        const session = {
          name: firebaseUser.displayName || "Admin Villatama",
          position: "Business Analyst",
          division: "All",
          group: "All",
          reportTo: "-",
          office: "Head Office",
          area: "Head Office",
          user: emailLower,
          email: emailLower,
          level: "5",
          isPublic: false,
        };
        try {
          localStorage.setItem("radar_user_session", JSON.stringify(session));
          localStorage.removeItem("radar_logged_out");
        } catch {
          // ignore storage quota
        }
        setActiveTab("overview");
        return session;
      });
    } else {
      try {
        localStorage.removeItem("radar_user_session");
      } catch {
        // ignore storage quota
      }
      setUserData(PUBLIC_VIEWER_SESSION);
    }

    setIsCheckingSession(false);
  }, [isAuthReady, isAuthorizedFirebase, firebaseUser]);

  if (isCheckingSession && !userData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] gap-6 bg-gradient-to-br from-[#F2E7FE] via-[#fbf8ff] to-[#edecff] text-[#181a2c]">
        <div className="relative">
          <div className="size-20 border-4 border-[#edecff] rounded-full" />
          <div className="size-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-primary animate-pulse">
              sync
            </span>
          </div>
        </div>
        <div className="text-center animate-pulse">
          <h3 className="text-[#181a2c] font-bold text-sm mb-1">
            Membuka Workspace...
          </h3>
          <p className="text-[#8E94B7] text-[9px] font-semibold uppercase tracking-widest">
            Memeriksa Sesi Pengguna
          </p>
        </div>
      </div>
    );
  }

  return userData ? (
    <div className="min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] bg-[#fbf8ff] font-sans selection:bg-[#edecff] text-[#181a2c] flex flex-col md:flex-row w-full mx-auto relative transition-all duration-300">
      {/* Sidebar Desktop */}
      <div
        className={`hidden md:flex flex-col ${
          isSidebarExpanded ? "w-20 lg:w-64" : "w-20"
        } bg-gradient-to-b from-[#154be2]/[0.09] via-[#154be2]/[0.04] to-white/70 backdrop-blur-xl border-r border-[#154be2]/12 h-screen sticky top-0 z-50 transition-all duration-300 left-0`}
      >
        <div
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="flex items-center justify-center lg:justify-start gap-4 h-24 px-0 lg:px-8 border-b border-[#154be2]/10 cursor-pointer hover:bg-white/40 transition-colors"
        >
          <div className="size-11 shrink-0 bg-gradient-to-br from-[#154be2] to-cyan-400 rounded-xl flex items-center justify-center shadow-[0_4px_16px_rgba(21,75,226,0.25)]">
            <AdvantaLogo className="size-6 text-white" />
          </div>
          <span
            className={`font-bold text-lg hidden tracking-tight text-[#154be2] ${
              isSidebarExpanded ? "lg:block" : ""
            }`}
          >
            RADAR ADVANTA
          </span>
        </div>

        <div className="flex flex-col gap-2.5 mt-6 px-2.5 lg:px-4 flex-1">
          {hasHomeTab ? (
            <button
              onClick={() => setActiveTab("home")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === "home"
                  ? "bg-gradient-to-r from-[#154be2] to-cyan-500 text-white font-extrabold shadow-[0_6px_20px_rgba(21,75,226,0.3)] ring-1 ring-[#154be2]/20 scale-[1.02]"
                  : "bg-gradient-to-r from-[#154be2]/10 to-cyan-400/10 hover:from-[#154be2]/15 hover:to-cyan-400/15 text-[#154be2] border border-[#154be2]/20 font-bold"
              }`}
            >
              <span className="material-symbols-outlined ml-0 lg:ml-4">
                edit_note
              </span>
              <span
                className={`font-extrabold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Input Activity
              </span>
            </button>
          ) : hasOverviewTab ? (
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === "overview"
                  ? "bg-gradient-to-r from-[#154be2] to-cyan-500 text-white font-extrabold shadow-[0_6px_20px_rgba(21,75,226,0.3)] ring-1 ring-[#154be2]/20 scale-[1.02]"
                  : "bg-gradient-to-r from-[#154be2]/10 to-cyan-400/10 hover:from-[#154be2]/15 hover:to-cyan-400/15 text-[#154be2] border border-[#154be2]/20 font-bold"
              }`}
            >
              <span className="material-symbols-outlined ml-0 lg:ml-4">
                analytics
              </span>
              <span
                className={`font-extrabold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Executive Overview
              </span>
            </button>
          ) : null}

          <div className="h-[1px] bg-[#154be2]/10 my-1 lg:mx-2" />

          {hasOverviewTab && (
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all ${
                activeTab === "overview"
                  ? "bg-[#154be2]/15 text-[#154be2] shadow-[0_4px_12px_rgba(21,75,226,0.12)] ring-1 ring-[#154be2]/15 font-bold"
                  : "text-[#8E94B7] hover:bg-white/40 hover:text-[#181a2c]"
              }`}
            >
              <span
                className={`material-symbols-outlined ml-0 lg:ml-4 ${activeTab === "overview" ? "font-normal" : ""}`}
              >
                analytics
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Executive Overview
              </span>
            </button>
          )}

          {hasPartnerTab && (
            <button
              onClick={() => setActiveTab("partner")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all ${
                activeTab === "partner"
                  ? "bg-[#154be2]/15 text-[#154be2] shadow-[0_4px_12px_rgba(21,75,226,0.12)] ring-1 ring-[#154be2]/15 font-bold"
                  : "text-[#8E94B7] hover:bg-white/40 hover:text-[#181a2c]"
              }`}
            >
              <span
                className={`material-symbols-outlined ml-0 lg:ml-4 ${activeTab === "partner" ? "font-normal" : ""}`}
              >
                handshake
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Data Partner
              </span>
            </button>
          )}

          {hasStockTab && (
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all ${
                activeTab === "summary"
                  ? "bg-[#154be2]/15 text-[#154be2] shadow-[0_4px_12px_rgba(21,75,226,0.12)] ring-1 ring-[#154be2]/15 font-bold"
                  : "text-[#8E94B7] hover:bg-white/40 hover:text-[#181a2c]"
              }`}
            >
              <span
                className={`material-symbols-outlined ml-0 lg:ml-4 ${activeTab === "summary" ? "font-normal" : ""}`}
              >
                donut_large
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Stock Summary
              </span>
            </button>
          )}

          {hasPogTab && (
            <button
              onClick={() => setActiveTab("pog")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all ${
                activeTab === "pog"
                  ? "bg-[#154be2]/15 text-[#154be2] shadow-[0_4px_12px_rgba(21,75,226,0.12)] ring-1 ring-[#154be2]/15 font-bold"
                  : "text-[#8E94B7] hover:bg-white/40 hover:text-[#181a2c]"
              }`}
            >
              <span
                className={`material-symbols-outlined ml-0 lg:ml-4 ${activeTab === "pog" ? "font-normal" : ""}`}
              >
                trending_up
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                POG Tracking
              </span>
            </button>
          )}

          {hasTempTab && (
            <button
              onClick={() => setActiveTab("temp")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all ${
                activeTab === "temp"
                  ? "bg-[#154be2]/15 text-[#154be2] shadow-[0_4px_12px_rgba(21,75,226,0.12)] ring-1 ring-[#154be2]/15 font-bold"
                  : "text-[#8E94B7] hover:bg-white/40 hover:text-[#181a2c]"
              }`}
            >
              <span
                className={`material-symbols-outlined ml-0 lg:ml-4 ${activeTab === "temp" ? "font-normal" : ""}`}
              >
                database
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Database
              </span>
            </button>
          )}

          {hasAccessTab && (
            <button
              onClick={() => setActiveTab("access")}
              className={`flex items-center justify-center lg:justify-start gap-3 h-13 rounded-xl transition-all ${
                activeTab === "access"
                  ? "bg-[#154be2]/15 text-[#154be2] shadow-[0_4px_12px_rgba(21,75,226,0.12)] ring-1 ring-[#154be2]/15 font-bold"
                  : "text-[#8E94B7] hover:bg-white/40 hover:text-[#181a2c]"
              }`}
            >
              <span
                className={`material-symbols-outlined ml-0 lg:ml-4 ${activeTab === "access" ? "font-normal" : ""}`}
              >
                admin_panel_settings
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Access Menu
              </span>
            </button>
          )}
        </div>

        <div className="p-3 lg:p-4 pb-6 border-t border-[#154be2]/10">
          {isSoleAdmin ? (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center lg:justify-start gap-3 h-12 w-full rounded-xl transition-all text-[#8E94B7] hover:bg-red-50 hover:text-red-600 cursor-pointer"
            >
              <span className="material-symbols-outlined ml-0 lg:ml-4">
                logout
              </span>
              <span
                className={`font-semibold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Keluar Akun
              </span>
            </button>
          ) : (
            <div className="flex items-center justify-center lg:justify-start gap-3 h-12 w-full rounded-xl text-emerald-700 bg-emerald-50/80 border border-emerald-200/70">
              <span className="material-symbols-outlined ml-0 lg:ml-4 text-[19px]">
                lock_open
              </span>
              <span
                className={`font-bold text-xs hidden ${isSidebarExpanded ? "lg:block" : ""}`}
              >
                Akses Terbuka
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto shadow-2xl md:shadow-none bg-[#fbf8ff] relative overflow-hidden pb-24 md:pb-8">
        <Dashboard
          userData={userData}
          activeTab={activeTab}
          onLogout={handleLogout}
          onOpenAdminLogin={() => setShowAdminLoginModal(true)}
          onUserSwitch={handleUserLogin}
          setUserData={setUserData}
          setActiveTab={setActiveTab}
          accessRules={accessRules}
          setAccessRules={setAccessRules}
          overviewMetricFilter={overviewMetricFilter}
          setOverviewMetricFilter={setOverviewMetricFilter}
          filterBelowMonth={filterBelowMonth}
          setFilterBelowMonth={setFilterBelowMonth}
          filterBelowChannel={filterBelowChannel}
          setFilterBelowChannel={setFilterBelowChannel}
          filterBelowMaterial={filterBelowMaterial}
          setFilterBelowMaterial={setFilterBelowMaterial}
          filterBelowTeam={filterBelowTeam}
          setFilterBelowTeam={setFilterBelowTeam}
          filterBelowArea={filterBelowArea}
          setFilterBelowArea={setFilterBelowArea}
          filterBelowCrop={filterBelowCrop}
          setFilterBelowCrop={setFilterBelowCrop}
        />
      </div>

      {/* Mobile Navigation */}
      <div
        className={`md:hidden fixed bottom-3 left-4 right-4 max-w-sm mx-auto flex items-end justify-between gap-3 z-50 transition-all duration-300 ${
          isMenuVisible
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-95 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex-1 flex flex-col bg-gradient-to-b from-[#154be2]/[0.12] via-white/80 to-white/95 backdrop-blur-xl py-1 shadow-[0_12px_36px_rgba(21,75,226,0.12)] rounded-[24px] border border-white/60 relative">
          <button
            onClick={() => setIsMenuVisible(false)}
            className="absolute -top-3 right-6 bg-white/90 backdrop-blur-sm text-[#8E94B7] hover:text-[#181a2c] size-6 rounded-full border border-blue-100/55 shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center z-50 cursor-pointer"
            title="Sembunyikan Menu"
          >
            <span className="material-symbols-outlined text-xs font-bold">
              keyboard_arrow_down
            </span>
          </button>

          <div className="flex flex-row items-center justify-around h-13 px-2">
            {hasOverviewTab && (
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex flex-col items-center justify-center h-11 px-2.5 rounded-xl transition-all duration-200 select-none ${
                  activeTab === "overview"
                    ? "bg-[#154be2]/12 text-[#154be2] font-extrabold"
                    : "text-[#8E94B7] hover:text-[#181a2c]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] leading-tight ${activeTab === "overview" ? "font-semibold" : ""}`}
                >
                  analytics
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-0.5">
                  Overview
                </span>
              </button>
            )}

            {hasPartnerTab && (
              <button
                onClick={() => setActiveTab("partner")}
                className={`flex flex-col items-center justify-center h-11 px-2.5 rounded-xl transition-all duration-200 select-none ${
                  activeTab === "partner"
                    ? "bg-[#154be2]/12 text-[#154be2] font-extrabold"
                    : "text-[#8E94B7] hover:text-[#181a2c]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] leading-tight ${activeTab === "partner" ? "font-semibold" : ""}`}
                >
                  handshake
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-0.5">
                  Partner
                </span>
              </button>
            )}

            {hasStockTab && (
              <button
                onClick={() => setActiveTab("summary")}
                className={`flex flex-col items-center justify-center h-11 px-2.5 rounded-xl transition-all duration-200 select-none ${
                  activeTab === "summary"
                    ? "bg-[#154be2]/12 text-[#154be2] font-extrabold"
                    : "text-[#8E94B7] hover:text-[#181a2c]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] leading-tight ${activeTab === "summary" ? "font-semibold" : ""}`}
                >
                  donut_large
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-0.5">
                  Stock
                </span>
              </button>
            )}

            {hasPogTab && (
              <button
                onClick={() => setActiveTab("pog")}
                className={`flex flex-col items-center justify-center h-11 px-2.5 rounded-xl transition-all duration-200 select-none ${
                  activeTab === "pog"
                    ? "bg-[#154be2]/12 text-[#154be2] font-extrabold"
                    : "text-[#8E94B7] hover:text-[#181a2c]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] leading-tight ${activeTab === "pog" ? "font-semibold" : ""}`}
                >
                  trending_up
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-0.5">
                  POG
                </span>
              </button>
            )}

            {hasTempTab && (
              <button
                onClick={() => setActiveTab("temp")}
                className={`flex flex-col items-center justify-center h-11 px-2.5 rounded-xl transition-all duration-200 select-none ${
                  activeTab === "temp"
                    ? "bg-[#154be2]/12 text-[#154be2] font-extrabold"
                    : "text-[#8E94B7] hover:text-[#181a2c]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[19px] leading-tight ${activeTab === "temp" ? "font-semibold" : ""}`}
                >
                  database
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-0.5">
                  Database
                </span>
              </button>
            )}

            {hasAccessTab && (
              <button
                onClick={() => setActiveTab("access")}
                className={`flex flex-col items-center justify-center h-11 px-2.5 rounded-xl transition-all duration-200 select-none ${
                  activeTab === "access"
                    ? "bg-[#154be2]/12 text-[#154be2] font-extrabold"
                    : "text-[#8E94B7] hover:text-[#181a2c]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[19px] leading-tight ${activeTab === "access" ? "font-semibold" : ""}`}
                >
                  admin_panel_settings
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-0.5">
                  Access
                </span>
              </button>
            )}
          </div>
        </div>

        {hasHomeTab ? (
          <button
            onClick={() => setActiveTab("home")}
            className="flex items-center justify-center shrink-0 size-[56px] rounded-full transition-all duration-200 select-none shadow-[0_8px_20px_rgba(21,75,226,0.35)] active:scale-95 cursor-pointer text-white bg-gradient-to-tr from-[#154be2] to-cyan-500"
          >
            <span className="material-symbols-outlined text-[26px]">
              edit_note
            </span>
          </button>
        ) : hasOverviewTab ? (
          <button
            onClick={() => setActiveTab("overview")}
            className="flex items-center justify-center shrink-0 size-[56px] rounded-full transition-all duration-200 select-none shadow-[0_8px_20px_rgba(21,75,226,0.35)] active:scale-95 cursor-pointer text-white bg-gradient-to-tr from-[#154be2] to-cyan-500"
          >
            <span className="material-symbols-outlined text-[26px]">
              analytics
            </span>
          </button>
        ) : null}
      </div>

      {!isMenuVisible && (
        <button
          onClick={() => setIsMenuVisible(true)}
          className="md:hidden fixed bottom-4 right-4 bg-gradient-to-r from-primary to-cyan-400 text-white size-9 rounded-full shadow-[0_6px_20px_rgba(21,75,226,0.25)] flex items-center justify-center hover:opacity-95 active:scale-[0.98] transition-all z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 cursor-pointer"
          title="Tampilkan Menu"
        >
          <span className="material-symbols-outlined text-base">
            keyboard_arrow_up
          </span>
        </button>
      )}

      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[120] overflow-y-auto animate-in fade-in duration-200">
          <Login
            onLogin={handleLoginState}
            onClose={() => setShowAdminLoginModal(false)}
          />
        </div>
      )}
    </div>
  ) : (
    <Login onLogin={handleLoginState} />
  );
}
