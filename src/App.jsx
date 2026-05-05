import { useState } from "react";
import { setAuthToken } from "./lib/supabase";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import ClienteView from "./pages/Cliente";

export default function App() {
  const [session, setSession] = useState(null);

  const handleLogin  = (s) => { if (s.token) setAuthToken(s.token); setSession(s); };
  const handleLogout = ()  => { setAuthToken(null); setSession(null); };

  if (!session)             return <Login onLogin={handleLogin}/>;
  if (session.role==="admin") return <Admin onLogout={handleLogout}/>;
  return <ClienteView session={session} onLogout={handleLogout}/>;
}