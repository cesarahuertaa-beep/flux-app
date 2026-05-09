import { useState } from "react";
import { setAuthToken } from "./lib/supabase";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import { BrandProvider } from "./components/BrandContext";

export default function App() {
  const [session,    setSession]    = useState(null);
  const [atletaData, setAtletaData] = useState(null);

  const handleLogin       = (s) => { if (s.token) setAuthToken(s.token); setSession(s); };
  const handleLogout      = ()  => { setAuthToken(null); setSession(null); setAtletaData(null); };
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