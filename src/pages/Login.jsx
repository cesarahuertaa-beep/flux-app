import { useState, useEffect } from "react";
import { C, css } from "../styles/theme";
import { FluxLogo, Field } from "../components/ui";
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet } from "../lib/supabase";

// Partícula animada de fondo
function Particle({ style }) {
  return (
    <div style={{
      position:"absolute",
      width:3, height:3,
      borderRadius:"50%",
      background:C.accent,
      opacity:0.4,
      ...style
    }}/>
  );
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#","?"));
      const token = params.get("access_token");
      const type = params.get("type");
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
          setAuthToken(null); setProfileId(null); setErr("Tu cuenta está suspendida. Contacta a soporte."); setLoading(false); return;
        }
        onLogin({ role: role === "admin" ? "admin" : role, token: data.access_token, profileId: data.user.id });
        return;
      }
      const rows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}&activo=eq.true`);
      if (!rows.length) { setAuthToken(null); setProfileId(null); setErr("No se encontró tu cuenta activa."); setLoading(false); return; }
      
      const clientData = rows[0];
      if (clientData.nutriologo_id) {
        const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo`);
        if (nut.length && nut[0].activo === false) {
          setAuthToken(null); setProfileId(null); setErr("El servicio de tu clínica está suspendido temporalmente."); setLoading(false); return;
        }
      }
      
      onLogin({ role:"client", data:clientData, token:data.access_token });
    } catch(e) { setAuthToken(null); setProfileId(null); setErr(e.message); setLoading(false); }
  };

  const sendReset = async () => {
    if (!email) { setErr("Escribe tu email"); return; }
    setLoading(true); setErr("");
    try { await authResetPassword(email.trim()); setInfo("✅ Revisa tu email para restablecer tu contraseña."); setMode("login"); }
    catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const setPassword = async () => {
    if (!newPass||newPass.length<6) { setErr("Mínimo 6 caracteres"); return; }
    if (newPass!==confirmPass) { setErr("Las contraseñas no coinciden"); return; }
    setLoading(true); setErr("");
    try { await authUpdatePassword(accessToken, newPass); setInfo("✅ Contraseña establecida. Ya puedes entrar."); setMode("login"); }
    catch(e) { setErr(e.message); }
    setLoading(false);
  };

  // Partículas de fondo
  const particles = [
    {top:"15%",left:"10%",animationDelay:"0s",animationDuration:"6s"},
    {top:"25%",right:"15%",animationDelay:"1s",animationDuration:"8s"},
    {top:"60%",left:"5%",animationDelay:"2s",animationDuration:"7s"},
    {top:"75%",right:"8%",animationDelay:"0.5s",animationDuration:"9s"},
    {top:"40%",left:"88%",animationDelay:"3s",animationDuration:"6s"},
    {top:"85%",left:"20%",animationDelay:"1.5s",animationDuration:"8s"},
    {top:"10%",right:"30%",animationDelay:"2.5s",animationDuration:"7s"},
  ];

  return (
    <div style={{
      minHeight:"100vh",
      background:C.bg,
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      position:"relative",
      overflow:"hidden"
    }}>
      <style>{css}</style>

      {/* Fondo animado */}
      <div style={{
        position:"absolute", inset:0,
        background:`
          radial-gradient(ellipse at 15% 50%, ${C.accentDeep}25 0%, transparent 55%),
          radial-gradient(ellipse at 85% 20%, ${C.accentMid}12 0%, transparent 45%),
          radial-gradient(ellipse at 50% 90%, ${C.accentDeep}15 0%, transparent 50%)
        `
      }}/>

      {/* Grid sutil */}
      <div style={{
        position:"absolute", inset:0, opacity:0.04,
        backgroundImage:`
          linear-gradient(${C.accent} 1px, transparent 1px),
          linear-gradient(90deg, ${C.accent} 1px, transparent 1px)
        `,
        backgroundSize:"60px 60px"
      }}/>

      {/* Partículas flotantes */}
      {particles.map((p,i) => (
        <Particle key={i} style={{
          ...p,
          animation:`float ${p.animationDuration} ease-in-out infinite`,
          animationDelay:p.animationDelay,
          boxShadow:`0 0 6px ${C.accent}`
        }}/>
      ))}

      {/* Anillo decorativo grande */}
      <div style={{
        position:"absolute",
        width:700, height:700,
        borderRadius:"50%",
        border:`1px solid ${C.accentDeep}40`,
        top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        pointerEvents:"none"
      }}/>
      <div style={{
        position:"absolute",
        width:500, height:500,
        borderRadius:"50%",
        border:`1px solid ${C.accentDeep}30`,
        top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        pointerEvents:"none"
      }}/>

      {/* Card de login */}
      <div className="animate-in glow-pulse" style={{
        width:"100%", maxWidth:420,
        padding:"44px 40px",
        background:`linear-gradient(145deg, ${C.card}f0, ${C.surface}e0)`,
        borderRadius:24,
        border:`1px solid ${C.border}`,
        position:"relative",
        backdropFilter:"blur(20px)",
        boxShadow:`
          0 0 0 1px ${C.borderGlow},
          0 24px 80px ${C.accentDeep}50,
          inset 0 1px 0 ${C.accentDeep}60
        `,
        zIndex:1
      }}>
        {/* Línea superior decorativa */}
        <div style={{
          position:"absolute", top:0, left:"15%", right:"15%", height:2,
          background:`linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          borderRadius:"0 0 2px 2px"
        }}/>

        {/* Logo */}
        <div style={{textAlign:"center", marginBottom:28}}>
          <FluxLogo size={38} animated large/>
          <div style={{
            marginTop:8,
            fontSize:12, color:C.muted,
            letterSpacing:"0.5px"
          }}>
            {mode==="reset" && "Recuperar contraseña"}
            {mode==="set_password" && "Crea tu nueva contraseña"}
          </div>
        </div>

        {/* Mensajes */}
        {info && (
          <div style={{
            background:`${C.accentDeep}50`,
            border:`1px solid ${C.accent}40`,
            borderRadius:10, padding:"11px 14px",
            fontSize:13, color:C.accent,
            marginBottom:16, lineHeight:1.5
          }}>{info}</div>
        )}
        {err && (
          <div style={{
            background:"#ef444420",
            border:"1px solid #ef444440",
            borderRadius:10, padding:"11px 14px",
            fontSize:13, color:"#f87171",
            marginBottom:16, textAlign:"center"
          }}>{err}</div>
        )}

        {/* Modo login */}
        {mode==="login" && <>
          <Field label="Email">
            <input
              value={email}
              onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()}
              placeholder="tu@email.com"
              type="email"
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              value={pass}
              onChange={e=>setPass(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()}
              placeholder="••••••••"
            />
          </Field>
          <button
            onClick={submit}
            disabled={loading}
            className="btn-hover"
            style={{
              width:"100%", padding:"13px",
              background:loading ? C.accentDeep : C.gradBtn,
              border:"none", borderRadius:12,
              fontWeight:800, fontSize:15,
              color:"#000", cursor:loading?"not-allowed":"pointer",
              marginBottom:14, marginTop:4,
              letterSpacing:"1px",
              fontFamily:"'Rajdhani', sans-serif",
              boxShadow:loading ? "none" : `0 4px 20px ${C.accentMid}50`,
              transition:"all 0.2s"
            }}
          >
            {loading ? "Verificando…" : "ENTRAR"}
          </button>
          <div style={{textAlign:"center"}}>
            <button
              onClick={()=>{setMode("reset");setErr("");}}
              style={{
                background:"none", border:"none",
                color:C.muted, fontSize:12,
                cursor:"pointer", textDecoration:"underline",
                fontFamily:"'Inter', sans-serif"
              }}
            >¿Olvidaste tu contraseña?</button>
          </div>
        </>}

        {/* Modo reset */}
        {mode==="reset" && <>
          <Field label="Tu email">
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" type="email"/>
          </Field>
          <button onClick={sendReset} disabled={loading} className="btn-hover" style={{width:"100%",padding:"13px",background:C.gradBtn,border:"none",borderRadius:12,fontWeight:800,fontSize:15,color:"#000",cursor:loading?"not-allowed":"pointer",marginBottom:14,letterSpacing:"0.5px",fontFamily:"'Rajdhani',sans-serif",boxShadow:`0 4px 20px ${C.accentMid}50`}}>
            {loading ? "Enviando…" : "Enviar instrucciones"}
          </button>
          <div style={{textAlign:"center"}}>
            <button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",textDecoration:"underline",fontFamily:"'Inter',sans-serif"}}>
              Volver al login
            </button>
          </div>
        </>}

        {/* Modo set_password */}
        {mode==="set_password" && <>
          <Field label="Nueva contraseña">
            <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres"/>
          </Field>
          <Field label="Confirmar contraseña">
            <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setPassword()} placeholder="Repite tu contraseña"/>
          </Field>
          <button onClick={setPassword} disabled={loading} className="btn-hover" style={{width:"100%",padding:"13px",background:C.gradBtn,border:"none",borderRadius:12,fontWeight:800,fontSize:15,color:"#000",cursor:loading?"not-allowed":"pointer",letterSpacing:"0.5px",fontFamily:"'Rajdhani',sans-serif",boxShadow:`0 4px 20px ${C.accentMid}50`}}>
            {loading ? "Guardando…" : "Establecer contraseña"}
          </button>
        </>}

        {/* Footer */}
        <div style={{
          marginTop:28, textAlign:"center",
          fontSize:11, color:C.dim,
          letterSpacing:"1px", textTransform:"uppercase",
          fontFamily:"'Rajdhani', sans-serif"
        }}>Keep Going 💪</div>
      </div>
    </div>
  );
}
