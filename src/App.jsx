import { useState, useEffect } from"react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from"react-router-dom";
import { Capacitor } from"@capacitor/core";
import { setAuthToken, restoreSession, restoreProfileId, setProfileId, onSessionExpired, saveRefreshToken, dbGet } from"./lib/supabase";
import { dbUpsert } from"./lib/supabase";
import { syncQueue } from"./lib/offlineQueue";
import Landing from"./pages/Landing";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import Privacidad from "./pages/Privacidad";
import Terminos from "./pages/Terminos";
import { BrandProvider } from "./components/BrandContext";
import { AppUpdater } from"./components/ui/AppUpdater";

const saveSessionMeta = (s) => {
  localStorage.setItem("flux_role", s.role);
  //"civil" y"cliente" ambos guardan su ID de cliente en flux_client_id
  if ((s.role ==="cliente" || s.role ==="civil") && s.data?.id) {
    localStorage.setItem("flux_client_id", s.data.id);
  } else {
    localStorage.removeItem("flux_client_id");
  }
  
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
  const [atletaData, setAtletaData] = useState(() => {
    try {
      const s = sessionStorage.getItem("flux_atleta_data");
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  });

  useEffect(() => {
    if (atletaData) sessionStorage.setItem("flux_atleta_data", JSON.stringify(atletaData));
    else sessionStorage.removeItem("flux_atleta_data");
  }, [atletaData]);

  const [restoring,  setRestoring]  = useState(true);

  useEffect(() => {
    if (window.location.hash.includes("access_token") || window.location.hash.includes("error=unauthorized_client") || window.location.hash.includes("error_description")) {
      setAuthToken(null);
      setProfileId(null);
      saveRefreshToken(null);
      clearSessionMeta();
      if (window.location.pathname !=="/login") {
        window.location.href ="/login" + window.location.hash;
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
        // --- OPTIMISTIC RESTORE ---
        let optimisticData = null;
          if (savedMultiRoles) {
            const searchRole = savedRole ==="civil" ?"cliente" : savedRole;
            const matchingRole = savedMultiRoles.find(r => {
              if (r.role !== searchRole) return false;
              if (searchRole ==="cliente" && savedClientId) {
                return String(r.data?.id) === String(savedClientId);
              }
              return true;
            });
            if (matchingRole) optimisticData = matchingRole.data;
          }
        
        if (optimisticData) {
          setSession({ role: savedRole, data: optimisticData, token, profileId, multiRoles: savedMultiRoles });
          setRestoring(false);
          // Revalidate in background
          setTimeout(async () => {
            try {
              if (profileId && Array.isArray(savedMultiRoles) && savedMultiRoles.some(r => ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(r.role))) {
                const profiles = await dbGet(`profiles?id=eq.${profileId}`);
                if (!profiles.length || (profiles[0].activo === false && profiles[0].role !=="superadmin")) {
                  setAuthToken(null); setProfileId(null); clearSessionMeta(); setSession(null);
                }
              }
            } catch(e) {}
          }, 100);
          return;
        }

        try {
          // Fallback al modo lento si no hay datos optimistas
          const hasAdminRole = Array.isArray(savedMultiRoles) &&
            savedMultiRoles.some(r => ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(r.role));

          if (!hasAdminRole && (savedRole ==="cliente" || savedRole ==="civil") && savedClientId) {
            const rows = await dbGet(`clientes?id=eq.${savedClientId}&activo=eq.true`);
            if (rows.length) {
              // Preserve"civil" if no nutriólogo,"cliente" if has one
              const restoredRole = savedRole ==="civil" ?"civil" :
                                   (rows[0].nutriologo_id ?"cliente" :"civil");
              setSession({ role: restoredRole, data: rows[0], token, profileId, multiRoles: savedMultiRoles });
            } else {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else if (profileId) {
            const profiles = await dbGet(`profiles?id=eq.${profileId}`);
            let role = profiles.length ? profiles[0].role : null;
            
            if (role ==="administrativo" && profiles[0].nutriologo_id) {
              const boss = await dbGet(`profiles?id=eq.${profiles[0].nutriologo_id}&select=role`);
              if (boss.length && boss[0].role ==="superadmin") {
                role ="staff";
              }
            }

            if (role && ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(role)) {
              if (["nutriologo","nutriologo_estudiante","administrativo","staff"].includes(role) && profiles[0].activo === false) {
                setAuthToken(null); setProfileId(null); clearSessionMeta();
              } else {
                setSession({ role, data: profiles[0], token, profileId, multiRoles: savedMultiRoles });
              }
            } else {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else {
            clearSessionMeta();
          }
        } catch (e) {
          if (e.message ==="OFFLINE" && savedMultiRoles) {
            // offline logic already handled by optimistic restore above if data exists,
            // but just in case we reach here:
            clearSessionMeta();
          } else {
            clearSessionMeta();
          }
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
    sessionStorage.removeItem('flux_atleta_data');
    setAtletaData(null);
    setSession(null);
  };

  const handleRoleSelect = (roleObj) => {
    const isCivilUser = roleObj.role === 'cliente' && !roleObj.data?.nutriologo_id;
    const finalRole = isCivilUser ? 'civil' : roleObj.role;
    const s = {
      role: finalRole,
      data: roleObj.data,
      token: session.token,
      profileId: session.profileId,
      multiRoles: session.multiRoles
    };
    // Clear saved tabs so the new role always starts on its own default tab
    sessionStorage.removeItem('flux_admin_tab');
    sessionStorage.removeItem('flux_cliente_tab');
    sessionStorage.removeItem('flux_programar_subtab');
    sessionStorage.removeItem('flux_admin_selected_client');
    sessionStorage.removeItem('flux_atleta_data');
    setAtletaData(null);
    saveSessionMeta(s);
    setSession(s);
  };

  const handleModoAtleta  = (clienteRecord) => setAtletaData(clienteRecord);
  const handleBackToAdmin = () => setAtletaData(null);

  const MainApp = () => {
    

    if (atletaData) return (
      <ClienteView
        session={{ role:"cliente", data:atletaData, token:session.token, profileId: session.profileId, adminRole: session.role }}
        onLogout={handleLogout}
        isAtletaMode={true}
        onBackToAdmin={handleBackToAdmin}
        onChangeRole={null}
      />
    );
    const sessionKey = `${session.role}-${session.data?.id || session.profileId}`;
    if (session.role==="superadmin" || session.role==="nutriologo" || session.role==="nutriologo_estudiante" || session.role==="administrativo" || session.role==="staff")
      return <Admin key={sessionKey} role={session.role} isSuperadmin={session.role==="superadmin"} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta} onChangeRole={session.multiRoles && session.multiRoles.length > 1 ? handleRoleSelect : null} multiRoles={session.multiRoles} session={session} />;
    if (session.role ==="civil")
      return <Admin key={sessionKey} role="civil" isSuperadmin={false} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta} onChangeRole={session.multiRoles && session.multiRoles.length > 1 ? handleRoleSelect : null} multiRoles={session.multiRoles} clienteData={session.data} session={session} />;
    return <ClienteView key={sessionKey} session={session} onLogout={handleLogout} onChangeRole={session.multiRoles && session.multiRoles.length > 1 ? handleRoleSelect : null} multiRoles={session.multiRoles} />;
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.location.search.includes('pwa=true');
  const isAppMode = window.location.protocol === 'file:' || window.location.protocol === 'app:' || Capacitor.isNativePlatform() || isStandalone;
  const Router = isAppMode ? HashRouter : BrowserRouter;

  return (
    <BrandProvider session={session}>
      <AppUpdater />
      <Router>
        <Routes>
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/" element={
            isAppMode
              ? <Navigate to={session ?"/app" :"/login"} replace />
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
          <Route path="*" element={<Navigate to={isAppMode ?"/login" :"/"} replace />} />
        </Routes>
      </Router>
    </BrandProvider>
  );
}