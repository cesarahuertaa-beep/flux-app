import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { setAuthToken, restoreSession, restoreProfileId, setProfileId, onSessionExpired, saveRefreshToken, dbGet, dbUpsert, captureAuthHashSynchronously, clearOfflineData, syncNativeCredentials } from "./lib/supabase";
import { syncQueue } from "./lib/offlineQueue";
import { initSyncManager, runSync } from "./lib/syncManager";
import { BrandProvider } from "./components/BrandContext";
import { AppUpdater } from "./components/ui/AppUpdater";
import FloatingTimerBubble from "./components/ui/FloatingTimerBubble";
import NotificationManager from "./components/ui/NotificationManager";
import { initBackButtonHandler } from "./lib/backButtonHandler";
import { initPlayBilling } from "./lib/playBilling";
import { refreshUserRoles } from "./lib/authRoles";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

const isNativePlatform = () => {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "file:" ||
    window.location.protocol === "app:" ||
    Capacitor.isNativePlatform()
  );
};

const detectIsAppMode = () => {
  if (typeof window === "undefined") return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    window.location.search.includes("pwa=true");
  return isNativePlatform() || isStandalone;
};

// Si se abre la PWA o web con un hash antiguo (#/app o #/login), migrar limpiamente a ruta estándar
if (typeof window !== "undefined" && !isNativePlatform() && window.location.hash?.startsWith("#/")) {
  try {
    const hashRoute = window.location.hash.slice(1);
    window.history.replaceState(null, "", hashRoute);
  } catch {}
}

// Interceptar cualquier token de invitación / recuperación ANTES de montar el Router
captureAuthHashSynchronously(isNativePlatform());

// Precargar la pantalla que se va a necesitar en paralelo a la restauración de sesión
try {
  const _r = localStorage.getItem("flux_role");
  if (!_r) import("./pages/Login");
  else if (_r === "cliente") import("./pages/Cliente");
  else import("./pages/Admin");
} catch (e) { /* ignore */ }

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Admin = lazy(() => import("./pages/Admin"));
const ClienteView = lazy(() => import("./pages/Cliente"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const Terminos = lazy(() => import("./pages/Terminos"));

const FullScreenLoader = () => (
  <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
    <div className="w-11 h-11 rounded-full border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
  </div>
);

const saveSessionMeta = (s) => {
  localStorage.setItem("flux_role", s.role);
  // Copia de la sesión para arrancar al instante (y sin internet) la próxima vez
  try {
    localStorage.setItem("flux_session_snapshot", JSON.stringify({
      role: s.role, data: s.data, profileId: s.profileId || null, multiRoles: s.multiRoles || null,
    }));
  } catch (e) { /* ignore */ }
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
  syncNativeCredentials();
};

const clearSessionMeta = () => {
  localStorage.removeItem("flux_session_snapshot");
  localStorage.removeItem("flux_role");
  localStorage.removeItem("flux_client_id");
  localStorage.removeItem("flux_multi_roles");
};

export default function App() {
  // Asegurar intercepción también en cada render inicial por si cambió el hash
  captureAuthHashSynchronously(isNativePlatform());

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
    initBackButtonHandler();
    const handleHashChange = () => {
      if (captureAuthHashSynchronously(isNativePlatform())) {
        setSession(null);
        setAtletaData(null);
        setRestoring(false);
      }
    };
    window.addEventListener("hashchange", handleHashChange);

    const restore = async () => {
      // Si hay un flujo pendiente de invitación, recuperación o error de correo, NO restaurar sesión previa
      if (
        sessionStorage.getItem("flux_pending_auth_token") ||
        sessionStorage.getItem("flux_pending_auth_error") ||
        sessionStorage.getItem("flux_pending_auth_info")
      ) {
        clearSessionMeta();
        setRestoring(false);
        return;
      }

      const token = restoreSession();
      const profileId = restoreProfileId();
      const savedRole = localStorage.getItem("flux_role");
      const savedClientId = localStorage.getItem("flux_client_id");
      const savedMultiRolesRaw = localStorage.getItem("flux_multi_roles");
      let savedMultiRoles = null;
      if (savedMultiRolesRaw) {
        try { savedMultiRoles = JSON.parse(savedMultiRolesRaw); } catch(e) { /* ignore */ }
      }

      if (savedRole) {
        // --- OPTIMISTIC RESTORE (Local-First: funciona en 0 ms con o sin internet) ---
        let optimisticData = null;
        if (savedMultiRoles) {
          const searchRole = savedRole === "civil" ? "cliente" : savedRole;
          const matchingRole = savedMultiRoles.find(r => {
            if (r.role !== searchRole) return false;
            if (searchRole === "cliente" && savedClientId) {
              return String(r.data?.id) === String(savedClientId);
            }
            return true;
          });
          if (matchingRole) optimisticData = matchingRole.data;
        }
        
        if (!optimisticData) {
          try {
            const snap = JSON.parse(localStorage.getItem("flux_session_snapshot") || "null");
            if (snap && snap.data) optimisticData = snap.data;
          } catch (e) { /* ignore */ }
        }

        if (optimisticData) {
          setSession({ role: savedRole, data: optimisticData, token: token || "offline", profileId, multiRoles: savedMultiRoles });
          setRestoring(false);
          syncNativeCredentials();
          // Revalidar en segundo plano SOLO si hay conexión real y la cuenta fue explícitamente desactivada
          setTimeout(async () => {
            if (typeof navigator !== "undefined" && !navigator.onLine) return;
            try {
              if (profileId && Array.isArray(savedMultiRoles) && savedMultiRoles.some(r => ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(r.role))) {
                const profiles = await dbGet(`profiles?id=eq.${profileId}`);
                if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].activo === false && profiles[0].role !== "superadmin") {
                  setAuthToken(null); setProfileId(null); clearSessionMeta(); setSession(null);
                  return;
                }
              } else if ((savedRole === "cliente" || savedRole === "civil") && savedClientId) {
                const rows = await dbGet(`clientes?id=eq.${savedClientId}`);
                if (Array.isArray(rows) && rows.length > 0 && rows[0].activo === false) {
                  setAuthToken(null); setProfileId(null); clearSessionMeta(); setSession(null);
                  return;
                }
              }

              // Sincronizar roles disponibles en segundo plano para reflejar invitaciones o nuevos perfiles
              const emailToLookup = optimisticData?.email;
              if (profileId || emailToLookup) {
                const latestRoles = await refreshUserRoles(profileId, emailToLookup);
                if (latestRoles && latestRoles.length > 0) {
                  localStorage.setItem("flux_multi_roles", JSON.stringify(latestRoles));
                  setSession(prev => prev ? { ...prev, multiRoles: latestRoles } : prev);
                }
              }
            } catch(e) { /* sin internet o error temporal: conservar siempre la sesión local */ }
          }, 800);
          return;
        }

        try {
          // Fallback si no había snapshot en localStorage
          const hasAdminRole = Array.isArray(savedMultiRoles) &&
            savedMultiRoles.some(r => ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(r.role));

          if (!hasAdminRole && (savedRole ==="cliente" || savedRole ==="civil") && savedClientId) {
            let rows = await dbGet(`clientes?id=eq.${savedClientId}&activo=eq.true`).catch(() => []);
            if (!rows.length) rows = await dbGet(`clientes?id=eq.${savedClientId}`).catch(() => []);
            if (rows.length) {
              const restoredRole = savedRole ==="civil" ?"civil" :
                                   (rows[0].nutriologo_id ?"cliente" :"civil");
              const sObj = { role: restoredRole, data: rows[0], token: token || "offline", profileId, multiRoles: savedMultiRoles };
              saveSessionMeta(sObj);
              setSession(sObj);
            } else if (typeof navigator !== "undefined" && navigator.onLine) {
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
                const sObj = { role, data: profiles[0], token: token || "offline", profileId, multiRoles: savedMultiRoles };
                saveSessionMeta(sObj);
                setSession(sObj);
              }
            } else if (typeof navigator !== "undefined" && navigator.onLine) {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else {
            clearSessionMeta();
          }
        } catch (e) {
          if (e.message ==="OFFLINE") {
            // sin internet: conservar datos de sesión
          } else if (typeof navigator !== "undefined" && navigator.onLine) {
            clearSessionMeta();
          }
        }
      } else {
         clearSessionMeta();
      }
      setRestoring(false);
    };
    restore();

    onSessionExpired(() => {
      // Solo cerrar sesión si el servidor revocó explícitamente el refresh_token;
      // NUNCA borrar IndexedDB automáticamente para no perder registros pendientes.
      setSession(null);
      setAtletaData(null);
      clearSessionMeta();
    });

    const handleOnline = () => syncQueue(dbUpsert);
    window.addEventListener('online', handleOnline);
    syncQueue(dbUpsert);
    initSyncManager();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    const uid = session?.data?.id || session?.data?.auth_id;
    if (uid) {
      initPlayBilling(uid).catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (typeof document !== "undefined") {
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute("content", "#FFFFFF");
    }
    if (typeof window !== "undefined" && window.FluxAndroidBars) {
      try { window.FluxAndroidBars.setBars("#FFFFFF", true); } catch (e) { /* ignore */ }
    }
  }, [session]);

  const handleLogin = (s) => {
    if (s.token) setAuthToken(s.token);
    saveSessionMeta(s);
    localStorage.removeItem("flux_last_prefetch");
    setSession(s);
    setTimeout(runSync, 1500); // precargar datos para uso offline
    const uid = s?.data?.id || s?.data?.auth_id;
    if (uid) initPlayBilling(uid).catch(() => {});
  };

  const handleLogout = () => {
    setAuthToken(null);
    setProfileId(null);
    saveRefreshToken(null);
    clearOfflineData();
    clearSessionMeta();
    sessionStorage.removeItem('flux_atleta_data');
    setAtletaData(null);
    setSession(null);
  };

  const handleRoleSelect = (roleObj, latestRoles) => {
    const isCivilUser = roleObj.role === 'cliente' && !roleObj.data?.nutriologo_id;
    const finalRole = isCivilUser ? 'civil' : roleObj.role;
    const rolesToKeep = latestRoles || session?.multiRoles || [];
    const s = {
      role: finalRole,
      data: roleObj.data,
      token: session?.token,
      profileId: session?.profileId,
      multiRoles: rolesToKeep
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

  const handleRolesUpdated = (newRoles) => {
    if (!newRoles || !Array.isArray(newRoles) || newRoles.length === 0) return;
    try { localStorage.setItem("flux_multi_roles", JSON.stringify(newRoles)); } catch {}
    setSession(prev => prev ? { ...prev, multiRoles: newRoles } : prev);
  };

  const handleModoAtleta  = (clienteRecord) => setAtletaData(clienteRecord);
  const handleBackToAdmin = () => setAtletaData(null);

  const renderMain = () => {
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
      return <Admin key={sessionKey} role={session.role} isSuperadmin={session.role==="superadmin"} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta} onChangeRole={handleRoleSelect} onRolesUpdated={handleRolesUpdated} multiRoles={session.multiRoles} session={session} />;
    if (session.role ==="civil")
      return <Admin key={sessionKey} role="civil" isSuperadmin={false} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta} onChangeRole={handleRoleSelect} onRolesUpdated={handleRolesUpdated} multiRoles={session.multiRoles} clienteData={session.data} session={session} />;
    return <ClienteView key={sessionKey} session={session} onLogout={handleLogout} onChangeRole={handleRoleSelect} onRolesUpdated={handleRolesUpdated} multiRoles={session.multiRoles} />;
  };

  const isNative = isNativePlatform();
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.location.search.includes('pwa=true')
  );
  const isAppMode = isNative || isStandalone;
  const Router = isNative ? HashRouter : BrowserRouter;

  return (
    <BrandProvider session={session}>
      <AppUpdater />
      <FloatingTimerBubble />
      <NotificationManager session={session} />
      <Router>
        <ErrorBoundary>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path="/privacidad" element={<Privacidad />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/" element={
                isAppMode
                  ? <Navigate to={session ? "/app" : "/login"} replace />
                  : <Landing session={session} onLogout={handleLogout} />
              } />
              <Route path="/login" element={
                restoring ? (
                  <FullScreenLoader />
                ) : session ? (
                  <Navigate to="/app" replace />
                ) : (
                  <Login onLogin={handleLogin} />
                )
              } />
              <Route path="/app/*" element={
                restoring ? (
                  <FullScreenLoader />
                ) : !session ? (
                  <Navigate to="/login" replace />
                ) : (
                  renderMain()
                )
              } />
              <Route path="*" element={<Navigate to={isAppMode ? "/login" : "/"} replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </BrandProvider>
  );
}