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

// Helpers para persistir el tipo de sesión
const saveSessionMeta = (role, clientId = null) => {
  localStorage.setItem("flux_role", role);
  if (clientId) localStorage.setItem("flux_client_id", clientId);
  else localStorage.removeItem("flux_client_id");
};
const clearSessionMeta = () => {
  localStorage.removeItem("flux_role");
  localStorage.removeItem("flux_client_id");
};

export default function App() {
  const [session,    setSession]    = useState(null);
  const [atletaData, setAtletaData] = useState(null);
  const [restoring,  setRestoring]  = useState(true);

  // Restaurar sesión guardada al montar
  useEffect(() => {
    const restore = async () => {
      const token = restoreSession();
      const profileId = restoreProfileId();
      const savedRole = localStorage.getItem("flux_role");
      const savedClientId = localStorage.getItem("flux_client_id");

      if (token && savedRole) {
        try {
          if (savedRole === "client" && savedClientId) {
            // Restaurar sesión de cliente directo desde la BD
            const rows = await dbGet(`clientes?id=eq.${savedClientId}&activo=eq.true`);
            if (rows.length) {
              setSession({ role: "client", data: rows[0], token });
            } else {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else if (profileId) {
            // Restaurar sesión de admin/nutriologo/superadmin
            const profiles = await dbGet(`profiles?id=eq.${profileId}`);
            let role = profiles.length ? profiles[0].role : null;
            
            // Si es un administrativo pero su jefe es el superadmin, lo elevamos a "staff" virtualmente
            if (role === "administrativo" && profiles[0].nutriologo_id) {
              const boss = await dbGet(`profiles?id=eq.${profiles[0].nutriologo_id}&select=role`);
              if (boss.length && boss[0].role === "superadmin") {
                role = "staff";
              }
            }

            if (role && (role === "admin" || role === "superadmin" || role === "nutriologo" || role === "administrativo" || role === "staff")) {
              if ((role === "nutriologo" || role === "administrativo" || role === "staff") && profiles[0].activo === false) {
                setAuthToken(null); setProfileId(null); clearSessionMeta();
              } else {
                setSession({ role: role === "admin" ? "admin" : role, token, profileId });
              }
            } else {
              setAuthToken(null); setProfileId(null); clearSessionMeta();
            }
          } else {
            clearSessionMeta();
          }
        } catch {
          // Token expirado u otro error -> limpiar todo
          setAuthToken(null); setProfileId(null); clearSessionMeta();
        }
      }
      setRestoring(false);
    };
    restore();

    // Registrar handler para sesión expirada
    onSessionExpired(() => {
      setSession(null);
      setAtletaData(null);
      clearSessionMeta();
    });

    // Sincronizar cola offline silenciosamente cuando vuelva la conexión
    const handleOnline = () => syncQueue(dbUpsert);
    window.addEventListener('online', handleOnline);
    syncQueue(dbUpsert);

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleLogin = (s) => {
    if (s.token) setAuthToken(s.token);
    // Guardar meta de sesión para restauración futura
    if (s.role === "client") {
      saveSessionMeta("client", s.data?.id);
    } else {
      saveSessionMeta(s.role);
    }
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

  const handleModoAtleta  = (clienteRecord) => setAtletaData(clienteRecord);
  const handleBackToAdmin = () => setAtletaData(null);

  const MainApp = () => {
    // Si es un cliente huérfano (solo comprador de E-commerce), no tiene acceso a la App privada
    if (session.role === "client" && !session.data?.nutriologo_id && !atletaData) {
      const isAppMode = window.location.protocol === 'file:' || window.location.protocol === 'app:' || Capacitor.isNativePlatform();
      return <Navigate to={isAppMode ? "/login" : "/"} replace />;
    }

    if (atletaData) return (
      <ClienteView
        session={{ role:"client", data:atletaData, token:session.token }}
        onLogout={handleLogout}
        isAtletaMode={true}
        onBackToAdmin={handleBackToAdmin}
      />
    );
    if (session.role==="admin" || session.role==="superadmin" || session.role==="nutriologo" || session.role==="administrativo" || session.role==="staff")
      return <Admin role={session.role} isSuperadmin={session.role==="superadmin"} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta}/>;
    return <ClienteView session={session} onLogout={handleLogout}/>;
  };

  const isAppMode = window.location.protocol === 'file:' || window.location.protocol === 'app:' || Capacitor.isNativePlatform();
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