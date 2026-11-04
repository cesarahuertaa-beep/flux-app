import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { setAuthToken, restoreSession, restoreProfileId, setProfileId, saveRefreshToken, dbGetFresh, dbUpsert, captureAuthHashSynchronously, clearOfflineData, syncNativeCredentials, hydrateOfflineCache } from "./lib/supabase";
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

// Si se abre la PWA o web con un hash antiguo (#/app o #/login), migrar limpiamente a ruta estándar
if (typeof window !== "undefined" && !isNativePlatform() && window.location.hash?.startsWith("#/")) {
  try {
    const hashRoute = window.location.hash.slice(1);
    window.history.replaceState(null, "", hashRoute);
  } catch {}
}

// Interceptar cualquier token de invitación / recuperación ANTES de montar el Router
captureAuthHashSynchronously(isNativePlatform());

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import Privacidad from "./pages/Privacidad";
import Terminos from "./pages/Terminos";

const FullScreenLoader = () => {
  const [showRecover, setShowRecover] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowRecover(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center gap-4">
      <div className="w-11 h-11 rounded-full border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
      {showRecover && (
        <button
          type="button"
          onClick={() => {
            try {
              navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
              if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
            } catch {}
            window.location.replace(window.location.pathname + "?_cb=" + Date.now());
          }}
          className="px-4 py-2.5 bg-white border border-[#E2E8F0] shadow-md rounded-xl text-xs font-bold text-[#1A6FD4] hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Actualizar versión ↻
        </button>
      )}
    </div>
  );
};

const saveSessionMeta = (s) => {
  localStorage.setItem("flux_role", s.role);
  if (s.profileId) setProfileId(s.profileId);
  // Copia de la sesión para arrancar al instante (y sin internet) la próxima vez
  try {
    localStorage.setItem("flux_session_snapshot", JSON.stringify({
      role: s.role, data: s.data, profileId: s.profileId || null, multiRoles: s.multiRoles || null,
    }));
  } catch (e) { /* ignore */ }
  //"civil" y"cliente" ambos guardan su ID de cliente en flux_client_id
  if ((s.role === "cliente" || s.role === "civil") && s.data?.id) {
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
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const isValidatingLivenessRef = useRef(false);
  const lastLivenessCheckRef = useRef(0);
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

  const handleLogout = useCallback((reasonMsg = null) => {
    if (reasonMsg && typeof reasonMsg === "string") {
      sessionStorage.setItem("flux_pending_auth_error", reasonMsg);
      sessionStorage.setItem("flux_login_mode", "login");
    }
    setAuthToken(null);
    setProfileId(null);
    saveRefreshToken(null);
    clearOfflineData();
    clearSessionMeta();
    sessionStorage.removeItem('flux_atleta_data');
    setAtletaData(null);
    setSession(null);
  }, []);

  const validateSessionLiveness = useCallback(async (targetSession, force = false) => {
    const s = targetSession || sessionRef.current;
    if (!s || !s.role) return true;
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    if (isValidatingLivenessRef.current) return true;
    const now = Date.now();
    if (!force && now - lastLivenessCheckRef.current < 15 * 60 * 1000) return true;

    isValidatingLivenessRef.current = true;
    lastLivenessCheckRef.current = now;

    const currentRole = s.role;
    const isClientOrCivil = currentRole === "cliente" || currentRole === "civil";
    const currentClientId = isClientOrCivil
      ? (s.data?.id || localStorage.getItem("flux_client_id"))
      : null;
    const currentProfileId = s.profileId || s.data?.auth_id || restoreProfileId() || (!isClientOrCivil ? s.data?.id : null);

    try {
      if (currentClientId) {
        const rows = await dbGetFresh(`clientes?id=eq.${currentClientId}&select=id,activo,nutriologo_id`);
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.activo === false) {
          handleLogout("Esta cuenta ha sido dada de baja o desactivada.");
          return false;
        }
      } else if (currentProfileId && ["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(currentRole)) {
        const profiles = await dbGetFresh(`profiles?id=eq.${currentProfileId}&select=id,activo,role`);
        if (Array.isArray(profiles) && profiles.length > 0 && profiles[0]?.activo === false && profiles[0]?.role !== "superadmin") {
          handleLogout("Tu cuenta profesional ha sido desactivada.");
          return false;
        }
      }

      const emailToLookup = s.data?.email;
      if (currentProfileId || emailToLookup) {
        const latestRoles = await refreshUserRoles(currentProfileId, emailToLookup);
        if (Array.isArray(latestRoles) && latestRoles.length > 0) {
          localStorage.setItem("flux_multi_roles", JSON.stringify(latestRoles));
          setSession(prev => {
            if (!prev) return prev;
            const searchRole = prev.role === "civil" ? "cliente" : prev.role;
            const match = latestRoles.find(r => {
              if (r.role !== searchRole) return false;
              if (searchRole === "cliente" && prev.data?.id) return String(r.data?.id) === String(prev.data?.id);
              if (prev.profileId && r.data?.id) return String(r.data?.id) === String(prev.profileId);
              return true;
            });
            const nextData = match?.data ? { ...prev.data, ...match.data } : prev.data;
            const dataChanged = JSON.stringify(prev.data) !== JSON.stringify(nextData);
            const rolesChanged = JSON.stringify(prev.multiRoles) !== JSON.stringify(latestRoles);
            if (!dataChanged && !rolesChanged) return prev;
            const nextSession = { ...prev, data: nextData, multiRoles: latestRoles };
            try {
              localStorage.setItem("flux_session_snapshot", JSON.stringify({ role: nextSession.role, data: nextSession.data, profileId: nextSession.profileId, multiRoles: latestRoles }));
            } catch {}
            return nextSession;
          });
        }
      }
      return true;
    } catch {
      // Sesión permanente: nunca cerrar sesión por expiración de token, errores de red o timeouts
      return true;
    } finally {
      isValidatingLivenessRef.current = false;
    }
  }, [handleLogout]);

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

    // Temporizador de seguridad: Si la restauración se demora más de 1.8s, desbloquear la interfaz
    const safetyTimer = setTimeout(() => {
      console.warn("[Restore] Timeout de seguridad alcanzado: forzando fin de restoring.");
      setRestoring(false);
    }, 1800);

    const restore = async () => {
      try {
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
            try {
              await Promise.race([
                hydrateOfflineCache(),
                new Promise((r) => setTimeout(r, 800)),
              ]);
            } catch (e) { /* ignore */ }
            const sObj = { role: savedRole, data: optimisticData, token: token || "offline", profileId, multiRoles: savedMultiRoles };
            setSession(sObj);
            clearTimeout(safetyTimer);
            setRestoring(false);
            syncNativeCredentials();
            setTimeout(() => {
              validateSessionLiveness(sObj);
            }, 400);
            return;
          }

          try {
            // Fallback si no había snapshot en localStorage
            const hasAdminRole = Array.isArray(savedMultiRoles) &&
              savedMultiRoles.some(r => ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(r.role));

            if (!hasAdminRole && (savedRole === "cliente" || savedRole === "civil") && savedClientId) {
              let rows = await dbGetFresh(`clientes?id=eq.${savedClientId}&activo=eq.true`).catch(() => []);
              if (!rows.length) rows = await dbGetFresh(`clientes?id=eq.${savedClientId}`).catch(() => []);
              if (rows.length && rows[0].activo !== false) {
                const restoredRole = savedRole === "civil" ? "civil" :
                                     (rows[0].nutriologo_id ? "cliente" : "civil");
                const sObj = { role: restoredRole, data: rows[0], token: token || "offline", profileId, multiRoles: savedMultiRoles };
                saveSessionMeta(sObj);
                setSession(sObj);
              } else if (rows.length && rows[0].activo === false) {
                handleLogout("Esta cuenta fue dada de baja.");
              }
            } else if (profileId) {
              const profiles = await dbGetFresh(`profiles?id=eq.${profileId}`);
              let role = profiles.length ? profiles[0].role : null;
              
              if (role === "administrativo" && profiles[0].nutriologo_id) {
                const boss = await dbGetFresh(`profiles?id=eq.${profiles[0].nutriologo_id}&select=role`);
                if (boss.length && boss[0].role === "superadmin") {
                  role = "staff";
                }
              }

              if (role && ["superadmin","nutriologo","nutriologo_estudiante","administrativo","staff"].includes(role)) {
                if (["nutriologo","nutriologo_estudiante","administrativo","staff"].includes(role) && profiles[0].activo === false) {
                  handleLogout("Esta cuenta profesional ha sido desactivada.");
                } else {
                  const sObj = { role, data: profiles[0], token: token || "offline", profileId, multiRoles: savedMultiRoles };
                  saveSessionMeta(sObj);
                  setSession(sObj);
                }
              }
            }
          } catch {
            // Conservar datos de sesión ante errores de red o timeouts
          }
        } else {
          clearSessionMeta();
        }
      } catch (err) {
        console.error("[Restore] Error inesperado restaurando sesión:", err);
      } finally {
        clearTimeout(safetyTimer);
        setRestoring(false);
      }
    };
    restore();

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
