import { useState, useEffect } from "react";
import { C, css } from "../styles/theme";
import { FluxLogo, Field, OrbBackground } from "../components/ui";
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

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#","?"));
      const token = params.get("access_token");
      const type  = params.get("type");
      if (token && (type==="invite"||type==="recovery")) {
        setAccessToken(token); setMode("set_password");
        window.history.replaceState(null,"",window.location.pathname);
      }
    }
  }, []);

  const submit = async () => {
    setLoading(true); setErr(""); setInfo("");
    try {
      const data = await authSignIn(email.trim(), pass);
      setAuthToken(data.access_token);
      setProfileId(data.user.id);
      const profiles = await dbGet(`profiles?id=eq.${data.user.id}`);
      const role = profiles.length ? profiles[0].role : null;
      if (role === "admin" || role === "superadmin" || role === "nutriologo") {
        if (role === "nutriologo" && profiles[0].activo === false) {
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
    background: focused === field ? "rgba(10,20,40,0.95)" : "rgba(7,13,24,0.8)",
    color: "#e2eeff",
    border: `1px solid ${focused === field ? "rgba(56,189,248,0.5)" : "rgba(56,189,248,0.1)"}`,
    borderRadius: 12,
    padding: "13px 16px",
    fontSize: 14,
    width: "100%",
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    transition: "all 0.25s ease",
    boxShadow: focused === field
      ? "0 0 0 3px rgba(56,189,248,0.1), 0 0 20px rgba(56,189,248,0.06)"
      : "none",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#03050a",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{css}</style>

      {/* ── Ambient orbs ── */}
      <OrbBackground />

      {/* ── Extra decorative rings ── */}
      <div style={{
        position: "absolute",
        width: 800, height: 800, borderRadius: "50%",
        border: "1px solid rgba(56,189,248,0.04)",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        pointerEvents: "none", animation: "spinRing 60s linear infinite"
      }}/>
      <div style={{
        position: "absolute",
        width: 550, height: 550, borderRadius: "50%",
        border: "1px solid rgba(129,140,248,0.05)",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        pointerEvents: "none", animation: "spinRing 40s linear infinite reverse"
      }}/>

      {/* ── Login Card ── */}
      <div
        className="animate-in"
        style={{
          width: "100%", maxWidth: 420,
          padding: "44px 40px 36px",
          background: "linear-gradient(160deg, rgba(12,24,48,0.85) 0%, rgba(7,13,24,0.95) 100%)",
          borderRadius: 24,
          border: "1px solid rgba(56,189,248,0.1)",
          position: "relative",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          boxShadow: `
            0 0 0 1px rgba(56,189,248,0.05),
            0 32px 100px rgba(0,0,0,0.6),
            0 0 80px rgba(8,47,73,0.4),
            inset 0 1px 0 rgba(56,189,248,0.1),
            inset 0 -1px 0 rgba(0,0,0,0.2)
          `,
          zIndex: 1,
        }}
      >
        {/* Top shimmer line */}
        <div style={{
          position: "absolute", top: 0, left: "12%", right: "12%", height: 1,
          background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.7), rgba(129,140,248,0.5), transparent)",
          borderRadius: "0 0 2px 2px"
        }}/>

        {/* Corner accents */}
        <div style={{ position:"absolute", top:16, left:16, width:20, height:20, borderTop:"1px solid rgba(56,189,248,0.3)", borderLeft:"1px solid rgba(56,189,248,0.3)", borderRadius:"4px 0 0 0" }}/>
        <div style={{ position:"absolute", top:16, right:16, width:20, height:20, borderTop:"1px solid rgba(56,189,248,0.3)", borderRight:"1px solid rgba(56,189,248,0.3)", borderRadius:"0 4px 0 0" }}/>
        <div style={{ position:"absolute", bottom:16, left:16, width:20, height:20, borderBottom:"1px solid rgba(56,189,248,0.3)", borderLeft:"1px solid rgba(56,189,248,0.3)", borderRadius:"0 0 0 4px" }}/>
        <div style={{ position:"absolute", bottom:16, right:16, width:20, height:20, borderBottom:"1px solid rgba(56,189,248,0.3)", borderRight:"1px solid rgba(56,189,248,0.3)", borderRadius:"0 0 4px 0" }}/>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <FluxLogo size={38} animated large />
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

          <button
            onClick={submit}
            disabled={loading}
            className="btn-hover"
            style={{
              width: "100%", padding: "14px",
              background: loading
                ? "rgba(8,47,73,0.6)"
                : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #818cf8 100%)",
              border: "none", borderRadius: 12,
              fontWeight: 800, fontSize: 14,
              color: loading ? "#64748b" : "#030a14",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: 16,
              letterSpacing: "1.5px",
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: loading ? "none" : "0 8px 32px rgba(56,189,248,0.35), 0 2px 0 rgba(255,255,255,0.1) inset",
              transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
              position: "relative", overflow: "hidden"
            }}
          >
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
              onMouseEnter={e => e.currentTarget.style.color = "#38bdf8"}
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
          <button onClick={sendReset} disabled={loading} className="btn-hover" style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #38bdf8, #818cf8)", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, color: "#030a14", cursor: loading ? "not-allowed" : "pointer", marginBottom: 14, letterSpacing: "1px", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 8px 28px rgba(56,189,248,0.3)" }}>
            {loading ? "Enviando…" : "Enviar instrucciones"}
          </button>
          <div style={{ textAlign: "center" }}>
            <button onClick={() => { setMode("login"); setErr(""); }} style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }} onMouseEnter={e => e.currentTarget.style.color = "#38bdf8"} onMouseLeave={e => e.currentTarget.style.color = "#475569"}>
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
          <button onClick={setPassword} disabled={loading} className="btn-hover" style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #38bdf8, #818cf8)", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, color: "#030a14", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "1px", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 8px 28px rgba(56,189,248,0.3)" }}>
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
