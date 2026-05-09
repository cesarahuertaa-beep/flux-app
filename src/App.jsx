import { useState, useEffect } from "react";
import { setAuthToken } from "./lib/supabase";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import { BrandProvider } from "./components/BrandContext";

export default function App() {
  const [session,    setSession]    = useState(() => {
    const saved = localStorage.getItem("flux_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [atletaData, setAtletaData] = useState(null);

  // Restaurar el token de autenticación si hay sesión guardada
  useEffect(() => {
    if (session?.token) setAuthToken(session.token);
  }, [session]);

  const handleLogin       = (s) => { 
    if (s.token) setAuthToken(s.token); 
    setSession(s); 
    localStorage.setItem("flux_session", JSON.stringify(s));
  };
  const handleLogout      = ()  => { 
    setAuthToken(null); 
    setSession(null); 
    setAtletaData(null); 
    localStorage.removeItem("flux_session");
  };
  const handleModoAtleta  = (clienteRecord) => setAtletaData(clienteRecord);
  const handleBackToAdmin = () => setAtletaData(null);

  const renderView = () => {
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
    </BrandProvider>
  );
}