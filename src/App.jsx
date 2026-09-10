import { useState, useEffect } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { setAuthToken, restoreSession, restoreProfileId, setProfileId, onSessionExpired, saveRefreshToken, dbGet } from "./lib/supabase";
import { dbUpsert } from "./lib/supabase";
import { syncQueue } from "./lib/offlineQueue";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import { BrandProvider } from "./components/BrandContext";
import { AppUpdater } from "./components/ui/AppUpdater";

const saveSessionMeta = (s) => {
  localStorage.setItem("flux_role", s.role);
  if (s.role === "client" && s.data?.id) localStorage.setItem("flux_client_id", s.data.id);
  else localStorage.removeItem("flux_client_id");
  
  if (s.multiRoles) {
    localStorage.setItem("flux_multi_roles", JSON.stringify(s.multiRoles));
  } else {
    localStorage.removeItem("flux_multi_roles");
  }
};

const clearSessionMeta = () => {
  localStorage.removeItem("flux_role");
  localStorage.removeItem("flux_client_id");
  localStorage.removeItem("flux_multi_roles");
};

export default function App() {
  const [session,    setSession]    = useState(null);
  const [atletaData, setAtletaData] = useState(null);
  const [restoring,  setRestoring]  = useState(true);

  useEffect(() => {
    if (window.location.hash.includes("access_token") || window.location.hash.includes("error=unauthorized_client") || window.location.hash.includes("error_description")) {
      setAuthToken(null);
      setProfileId(null);
      saveRefreshToken(null);
      clearSessionMeta();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login" + window.location.hash;
        return;
      }
    }

    const restore = async () => {
      const token = restoreSession();
      const profileId = restoreProfileId();
      const savedRole = localStorage.getItem("flux_role");
      const savedClientId = localStorage.getItem("flux_client_id");
      const savedMultiRolesRaw = localStorage.getItem("flux_multi_roles");
      let savedMultiRoles = null;
      if (savedMultiRolesRaw) {
        try { savedMultiRoles = JSON.parse(savedMultiRolesRaw); } catch(e) { /* ignore */ }
      }

      if (token && savedRole) {
        try {
          if (savedRole === "client" && savedClientId) {
            const rows = await dbGet(`clientes?id=eq.${savedClientId}&activo=eq.true`);
            if (rows.length) {
              setSession({ role: "client", data: rows[0], token, profileId, multiRoles: savedMultiRoles });
            } else {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else if (profileId) {
            const profiles = await dbGet(`profiles?id=eq.${profileId}`);
            let role = profiles.length ? profiles[0].role : null;
            
            if (role === "administrativo" && profiles[0].nutriologo_id) {
              const boss = await dbGet(`profiles?id=eq.${profiles[0].nutriologo_id}&select=role`);
              if (boss.length && boss[0].role === "superadmin") {
                role = "staff";
              }
            }

            if (role && ["admin", "superadmin", "nutriologo", "administrativo", "staff"].includes(role)) {
              if (["nutriologo", "administrativo", "staff"].includes(role) && profiles[0].activo === false) {
                setAuthToken(null); setProfileId(null); clearSessionMeta();
              } else {
                setSession({ role: role === "admin" ? "admin" : role, token, profileId, multiRoles: savedMultiRoles });
              }
            } else {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else {
            clearSessionMeta();
          }
        } catch {
          setAuthToken(null); setProfileId(null); clearSessionMeta();
        }
      } else {
         // No saved role, clean up
         clearSessionMeta();
      }
      setRestoring(false);
    };
    restore();

    onSessionExpired(() => {
      setSession(null);
      setAtletaData(null);
      clearSessionMeta();
    });

    const handleOnline = () => syncQueue(dbUpsert);
    window.addEventListener('online', handleOnline);
    syncQueue(dbUpsert);

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleLogin = (s) => {
    if (s.token) setAuthToken(s.token);
    saveSessionMeta(s);
    setSession(s);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setProfileId(null);
    saveRefreshToken(null);
    clearSessionMeta();
    setSession(null);
    setAtletaData(null);
  };

  const handleRoleSelect = (roleObj) => {
    const s = {
      role: roleObj.role,
      data: roleObj.data,
      token: session.token,
      profileId: session.profileId,
      multiRoles: session.multiRoles
    };
    saveSessionMeta(s);
    setSession(s);
  };

  const handleModoAtleta  = (clienteRecord) => setAtletaData(clienteRecord);
  const handleBackToAdmin = () => setAtletaData(null);

  const MainApp = () => {
    if (session.role === "client" && !session.data?.nutriologo_id && !atletaData) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.location.search.includes('pwa=true');
      const isAppMode = window.location.protocol === 'file:' || window.location.protocol === 'app:' || Capacitor.isNativePlatform() || isStandalone;
      return <Navigate to={isAppMode ? "/login" : "/"} replace />;
    }

    if (atletaData) return (
      <ClienteView
        session={{ role:"client", data:atletaData, token:session.token, profileId: session.profileId, adminRole: session.role }}
        onLogout={handleLogout}
        isAtletaMode={true}
        onBackToAdmin={handleBackToAdmin}
        onChangeRole={null}
      />
    );
    if (session.role==="admin" || session.role==="superadmin" || session.role==="nutriologo" || session.role==="administrativo" || session.role==="staff")
      return <Admin role={session.role} isSuperadmin={session.role==="superadmin"} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta} onChangeRole={session.multiRoles && session.multiRoles.length > 1 ? handleRoleSelect : null} multiRoles={session.multiRoles} />;
    return <ClienteView session={session} onLogout={handleLogout} onChangeRole={session.multiRoles && session.multiRoles.length > 1 ? handleRoleSelect : null} multiRoles={session.multiRoles} />;
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.location.search.includes('pwa=true');
  const isAppMode = window.location.protocol === 'file:' || window.location.protocol === 'app:' || Capacitor.isNativePlatform() || isStandalone;
  const Router = isAppMode ? HashRouter : BrowserRouter;

  return (
    <BrandProvider session={session}>
      <AppUpdater />
      <Router>
        <Routes>
          <Route path="/" element={
            isAppMode
              ? <Navigate to={session ? "/app" : "/login"} replace />
              : <Landing session={session} onLogout={handleLogout} />
          } />
          <Route path="/login" element={
            restoring ? (
              <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
                <div className="w-11 h-11 rounded-full border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
              </div>
            ) : session ? (
              <Navigate to="/app" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } />
          <Route path="/app/*" element={
            restoring ? (
              <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
                <div className="w-11 h-11 rounded-full border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
              </div>
            ) : !session ? (
              <Navigate to="/login" replace />
            ) : (
              <MainApp />
            )
          } />
          <Route path="*" element={<Navigate to={isAppMode ? "/login" : "/"} replace />} />
        </Routes>
      </Router>
    </BrandProvider>
  );
}