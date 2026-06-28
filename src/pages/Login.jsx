import { useState, useEffect } from "react";
import { C, css } from "../styles/theme";
import { Field, OrbBackground } from "../components/ui";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [mode, setMode]           = useState("login");
  const [email, setEmail]         = useState("");
  const [pass, setPass]           = useState("");
  const [newPass, setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [err, setErr]             = useState("");
  const [info, setInfo]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [focused, setFocused]     = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeSplash(true), 2000);
    const timer2 = setTimeout(() => setShowSplash(false), 2800);
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#","?"));
      const token = params.get("access_token");
      const type  = params.get("type");
      if (token && (type==="invite"||type==="recovery"||type==="signup")) {
        setAccessToken(token); setMode("set_password");
        window.history.replaceState(null,"",window.location.pathname);
      }
    }
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const submit = async () => {
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignIn(email.trim(), pass);
      setAuthToken(data.access_token);
      setProfileId(data.user.id);
      const profiles = await dbGet(`profiles?id=eq.${data.user.id}`);
      const role = profiles.length ? profiles[0].role : null;
      if (role === "admin" || role === "superadmin" || role === "nutriologo" || role === "administrativo") {
        if ((role === "nutriologo" || role === "administrativo") && profiles[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr("Tu cuenta está suspendida. Contacta a soporte.");
          setLoading(false); return;
        }
        onLogin({ role: role === "admin" ? "admin" : role, token: data.access_token, profileId: data.user.id });
        return;
      }
      const rows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}&activo=eq.true`);
      if (!rows.length) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró tu cuenta activa.");
        setLoading(false); return;
      }
      const clientData = rows[0];
      if (clientData.nutriologo_id) {
        const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo`);
        if (nut.length && nut[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr("El servicio de tu clínica está suspendido temporalmente.");
          setLoading(false); return;
        }
      }
      onLogin({ role:"client", data:clientData, token:data.access_token });
    } catch(e) { setAuthToken(null); setProfileId(null); setErr(e.message); setLoading(false); }
  };

  const sendReset = async () => {
    if (!email) { setErr("Escribe tu email"); return; }
    setLoading(true); setErr("");
    try {
      await authResetPassword(email.trim());
      setInfo("✅ Revisa tu email para restablecer tu contraseña.");
      setMode("login");
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const setPassword = async () => {
    if (!newPass || newPass.length < 6) { setErr("Mínimo 6 caracteres"); return; }
    if (newPass !== confirmPass) { setErr("Las contraseñas no coinciden"); return; }
    setLoading(true); setErr("");
    try {
      await authUpdatePassword(accessToken, newPass);
      setInfo("✅ Contraseña establecida. Ya puedes entrar.");
      setMode("login");
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const inputStyle = (field) => ({
    background: focused === field ? "rgba(15,28,46,0.95)" : "rgba(7,16,29,0.85)",
    color: C.text,
    border: `1px solid ${focused === field ? "rgba(46,92,184,0.55)" : "rgba(46,92,184,0.14)"}`,
    borderRadius: 12, padding: "13px 16px", fontSize: 14,
    width: "100%", outline: "none", fontFamily: "'Inter',sans-serif",
    transition: "all 0.25s ease",
    boxShadow: focused === field ? "0 0 0 3px rgba(46,92,184,0.14)" : "none",
  });

  return (
    <div style={{ minHeight:"100vh", background:"#04080f", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", fontFamily:"'Inter',sans-serif" }}>
      <style>{css}</style>

      {/* ── Splash Screen Overlay ── */}
      {showSplash && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "#000000",
          zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: fadeSplash ? 0 : 1,
          transition: "opacity 0.8s ease",
          pointerEvents: fadeSplash ? "none" : "auto"
        }}>
          <img src="/logo.png" alt="Flux Splash" style={{ width: "320px", height: "auto" }} />
        </div>
      )}

      {/* ── Login Card ── */}
      <div className="animate-in" style={{ width:"100%",maxWidth:420,padding:"44px 40px 36px",background:"rgba(15,28,46,0.95)",borderRadius:24,border:"1px solid rgba(46,92,184,0.15)",position:"relative",backdropFilter:"blur(32px)",WebkitBackdropFilter:"blur(32px)",boxShadow:"0 32px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(46,92,184,0.08)",zIndex:1 }}>

        {/* Top Spacer */}
        <div style={{ textAlign: "center", marginBottom: (mode === "reset" || mode === "set_password") ? 24 : 12 }}>
          {(mode === "reset" || mode === "set_password") && (
            <div style={{ marginTop: 12, fontSize: 13, color: "#64748b", letterSpacing: "0.3px" }}>
              {mode === "reset" ? "Recuperar contraseña" : "Crear nueva contraseña"}
            </div>
          )}
        </div>

        {/* Messages */}
        {info && (
          <div style={{
            background: "rgba(8,47,73,0.5)",
            border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: 12, padding: "12px 16px",
            fontSize: 13, color: "#38bdf8",
            marginBottom: 18, lineHeight: 1.6,
            backdropFilter: "blur(8px)"
          }}>{info}</div>
        )}
        {err && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 12, padding: "12px 16px",
            fontSize: 13, color: "#f87171",
            marginBottom: 18, textAlign: "center",
            lineHeight: 1.6
          }}>{err}</div>
        )}

        {/* ── LOGIN FORM ── */}
        {mode === "login" && <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Email</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              placeholder="tu@email.com"
              type="email"
              style={inputStyle("email")}
            />
          </div>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Contraseña</div>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              onFocus={() => setFocused("pass")}
              onBlur={() => setFocused(null)}
              placeholder="••••••••"
              style={inputStyle("pass")}
            />
          </div>

          <button onClick={submit} disabled={loading} className="btn-hover" style={{ width:"100%",padding:"14px",background:loading?"rgba(15,28,46,0.7)":"linear-gradient(135deg,#2e5cb8,#3d6fd0)",border:"none",borderRadius:12,fontWeight:800,fontSize:14,color:loading?"#6e87a2":"#fff",cursor:loading?"not-allowed":"pointer",marginBottom:16,letterSpacing:"1.5px",fontFamily:"'Space Grotesk',sans-serif",boxShadow:"none",transition:"all 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
            {loading ? "Verificando…" : "ENTRAR"}
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => { setMode("reset"); setErr(""); }}
              style={{
                background: "none", border: "none",
                color: "#475569", fontSize: 12,
                cursor: "pointer", fontFamily: "'Inter', sans-serif",
                transition: "color 0.2s",
                textDecoration: "none",
                letterSpacing: "0.2px"
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--brand-accent,#2e5cb8)"}
              onMouseLeave={e => e.currentTarget.style.color = "#475569"}
            >¿Olvidaste tu contraseña?</button>
          </div>
        </>}

        {/* ── RESET FORM ── */}
        {mode === "reset" && <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Tu email</div>
            <input
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" type="email"
              onFocus={() => setFocused("resetEmail")}
              onBlur={() => setFocused(null)}
              style={inputStyle("resetEmail")}
            />
          </div>
          <button onClick={sendReset} disabled={loading} className="btn-hover" style={{ width:"100%",padding:"14px",background:"linear-gradient(135deg,#2e5cb8,#3d6fd0)",border:"none",borderRadius:12,fontWeight:800,fontSize:14,color:"#fff",cursor:loading?"not-allowed":"pointer",marginBottom:14,letterSpacing:"1px",fontFamily:"'Space Grotesk',sans-serif",boxShadow:"none" }}>
            {loading ? "Enviando…" : "Enviar instrucciones"}
          </button>
          <div style={{ textAlign: "center" }}>
            <button onClick={() => { setMode("login"); setErr(""); }} style={{ background:"none",border:"none",color:"#475569",fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif" }} onMouseEnter={e=>e.currentTarget.style.color="var(--brand-accent,#2e5cb8)"} onMouseLeave={e=>e.currentTarget.style.color="#475569"}>
              Volver al login
            </button>
          </div>
        </>}

        {/* ── SET PASSWORD FORM ── */}
        {mode === "set_password" && <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Nueva contraseña</div>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" onFocus={() => setFocused("np")} onBlur={() => setFocused(null)} style={inputStyle("np")} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Confirmar contraseña</div>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => e.key === "Enter" && setPassword()} placeholder="Repite tu contraseña" onFocus={() => setFocused("cp")} onBlur={() => setFocused(null)} style={inputStyle("cp")} />
          </div>
          <button onClick={setPassword} disabled={loading} className="btn-hover" style={{ width:"100%",padding:"14px",background:"linear-gradient(135deg,#2e5cb8,#3d6fd0)",border:"none",borderRadius:12,fontWeight:800,fontSize:14,color:"#fff",cursor:loading?"not-allowed":"pointer",letterSpacing:"1px",fontFamily:"'Space Grotesk',sans-serif",boxShadow:"none" }}>
            {loading ? "Guardando…" : "Establecer contraseña"}
          </button>
        </>}

        {/* Footer */}
        <div style={{
          marginTop: 28, textAlign: "center",
          fontSize: 10, color: "#1e293b",
          letterSpacing: "2px", textTransform: "uppercase",
          fontFamily: "'Space Grotesk', sans-serif"
        }}>KEEP GOING 💪</div>
      </div>
    </div>
  );
}
