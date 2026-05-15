import { useState, useEffect } from "react";
import { setAuthToken, restoreSession, restoreProfileId, setProfileId, onSessionExpired, dbGet } from "./lib/supabase";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import { BrandProvider } from "./components/BrandContext";
import InstallPrompt from "./components/InstallPrompt";

export default function App() {
  const [session,    setSession]    = useState(null);
  const [atletaData, setAtletaData] = useState(null);
  const [restoring,  setRestoring]  = useState(true);

  // Restaurar sesión guardada al montar
  useEffect(() => {
    const restore = async () => {
      const token = restoreSession();
      const profileId = restoreProfileId();
      if (token && profileId) {
        try {
          const profiles = await dbGet(`profiles?id=eq.${profileId}`);
          const role = profiles.length ? profiles[0].role : null;
          if (role) {
            // Verificar si la cuenta está activa
            if ((role === "nutriologo" || role === "administrativo") && profiles[0].activo === false) {
              setAuthToken(null); setProfileId(null);
            } else if (role === "admin" || role === "superadmin" || role === "nutriologo" || role === "administrativo") {
              setSession({ role: role === "admin" ? "admin" : role, token, profileId });
            } else {
              // Cliente
              const email = profiles[0].email;
              const rows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email)}&activo=eq.true`);
              if (rows.length) {
                setSession({ role: "client", data: rows[0], token });
              } else {
                setAuthToken(null); setProfileId(null);
              }
            }
          }
        } catch {
          // Token expirado u otro error — limpiar
          setAuthToken(null); setProfileId(null);
        }
      }
      setRestoring(false);
    };
    restore();

    // Registrar handler para sesión expirada
    onSessionExpired(() => {
      setSession(null);
      setAtletaData(null);
    });
  }, []);

  const handleLogin = (s) => {
    if (s.token) {
      setAuthToken(s.token);
    }
    setSession(s);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setProfileId(null);
    setSession(null);
    setAtletaData(null);
  };

  const handleModoAtleta  = (clienteRecord) => setAtletaData(clienteRecord);
  const handleBackToAdmin = () => setAtletaData(null);

  const renderView = () => {
    if (restoring) {
      return (
        <div style={{ minHeight:"100vh", background:"#04080f", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{
            width:44, height:44, borderRadius:"50%",
            border:"3px solid rgba(46,92,184,0.15)",
            borderTopColor:"#2e5cb8",
            animation:"rotateSlow 0.8s linear infinite"
          }}/>
        </div>
      );
    }
    if (!session) return <Login onLogin={handleLogin}/>;
    // Modo Atleta: nutriólogo temporalmente en vista de cliente
    if (atletaData) return (
      <ClienteView
        session={{ role:"client", data:atletaData, token:session.token }}
        onLogout={handleLogout}
        isAtletaMode={true}
        onBackToAdmin={handleBackToAdmin}
      />
    );
    if (session.role==="admin" || session.role==="superadmin" || session.role==="nutriologo" || session.role==="administrativo")
      return <Admin role={session.role} isSuperadmin={session.role==="superadmin"} profileId={session.profileId} onLogout={handleLogout} onModoAtleta={handleModoAtleta}/>;
    return <ClienteView session={session} onLogout={handleLogout}/>;
  };

  return (
    <BrandProvider session={session}>
      {renderView()}
      <InstallPrompt />
    </BrandProvider>
  );
}