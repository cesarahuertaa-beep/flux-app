import { useState } from "react";
import { setAuthToken } from "./lib/supabase";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";
import { BrandProvider } from "./components/BrandContext";

export default function App() {
  const [session, setSession] = useState(null);

  const handleLogin  = (s) => { if (s.token) setAuthToken(s.token); setSession(s); };
  const handleLogout = ()  => { setAuthToken(null); setSession(null); };

  const renderView = () => {
    if (!session)                                    return <Login onLogin={handleLogin}/>;
    if (session.role==="admin" || session.role==="superadmin" || session.role==="nutriologo")
      return <Admin isSuperadmin={session.role==="superadmin"} profileId={session.profileId} onLogout={handleLogout}/>;
    return <ClienteView session={session} onLogout={handleLogout}/>;
  };

  return (
    <BrandProvider session={session}>
      {renderView()}
    </BrandProvider>
  );
}