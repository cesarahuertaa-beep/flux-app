import { C } from "../../styles/theme";
import { useBrand } from "../BrandContext";
import { createPortal } from "react-dom";

export const OrbBackground = () => null;
export { AppLayout } from "./AppLayout";

export const Btn = ({ children, onClick, grad, color, outline, small, danger, disabled, style = {}, className = "" }) => {
  const isGrad = grad && !danger && !outline;
  return (
    <button disabled={disabled} onClick={onClick} className={`btn-hover ${className}`} style={{
      padding: small ? "6px 16px" : "11px 24px", borderRadius: 10,
      background: danger ? "linear-gradient(135deg,#ef4444,#dc2626)" : outline ? "rgba(15,28,46,0.6)" : isGrad ? C.gradBtn : (color || C.accentMid),
      color: danger ? "#fff" : outline ? (color || C.accent) : "#fff",
      border: `1px solid ${danger ? "#ef4444" : outline ? (color || "rgba(46,92,184,0.35)") : "transparent"}`,
      fontWeight: 700, fontSize: small ? 12 : 13, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1, letterSpacing: "0.4px", fontFamily: "'Inter',sans-serif",
      backdropFilter: outline ? "blur(8px)" : "none", boxShadow: "none",
      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)", whiteSpace: "nowrap", ...style
    }}>{children}</button>
  );
};

export const Modal = ({ title, onClose, children, wide }) => createPortal(
  <div style={{ position:"fixed",inset:0,background:"rgba(4,8,15,0.88)",backdropFilter:"blur(16px)",zIndex:100,overflowY:"auto",padding:"5vh 16px 10vh" }}
    onClick={e => e.target===e.currentTarget && onClose()}>
    <div className="animate-in-scale" style={{
      margin:"0 auto", background:"linear-gradient(145deg,rgba(15,28,46,0.97),rgba(7,16,29,0.99))",
      borderRadius:20, border:`1px solid rgba(46,92,184,0.15)`,
      width:"100%", maxWidth:wide?720:560, minHeight:wide?"60vh":"auto",
      display:"flex", flexDirection:"column",
      boxShadow:"0 32px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(46,92,184,0.08)",
      position:"relative", overflow:"clip"
    }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:"1px solid rgba(46,92,184,0.10)",flexShrink:0,background:"rgba(7,16,29,0.5)",backdropFilter:"blur(8px)" }}>
        <span style={{ fontWeight:700,fontSize:15,color:C.text,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.3px" }}>{title}</span>
        <button onClick={onClose} className="btn-hover" style={{ background:"rgba(46,92,184,0.06)",color:C.muted,fontSize:18,cursor:"pointer",border:"1px solid rgba(46,92,184,0.12)",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",fontFamily:"monospace" }}
          onMouseEnter={e=>{e.currentTarget.style.color="var(--brand-accent,#2e5cb8)";e.currentTarget.style.background="rgba(46,92,184,0.12)";}}
          onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.background="rgba(46,92,184,0.06)";}}>×</button>
      </div>
      <div style={{ padding:"22px 24px" }}>{children}</div>
    </div>
  </div>, document.body
);

export const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom:18 }}>
    <div style={{ fontSize:11,color:C.muted,marginBottom:7,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'Inter',sans-serif" }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize:11,color:C.dim,marginTop:5,lineHeight:1.5 }}>{hint}</div>}
  </div>
);

export const Tag = ({ children, color, size="sm" }) => (
  <span style={{ fontSize:size==="md"?12:11,padding:size==="md"?"4px 12px":"3px 10px",borderRadius:20,background:`${color||"rgba(46,92,184,1)"}22`,color:color||"var(--brand-accent,#2e5cb8)",border:`1px solid ${color||"rgba(46,92,184,0.30)"}`,fontWeight:600,letterSpacing:"0.2px",whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif" }}>{children}</span>
);

export const FluxLogo = ({ size=28, animated=false, large=false }) => {
  const brand = useBrand();
  const logo = brand?.logo_url || "/logo.png";
  const nombre = brand?.nombre_marca || "FLUX Sport Supplements";
  return large ? (
    <img src={logo} alt={nombre} className={animated?"float":""} style={{ height:160,objectFit:"contain" }}/>
  ) : (
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <img src={logo} alt={nombre} style={{ height:size*1.8,objectFit:"contain" }}/>
    </div>
  );
};

export const Header = ({ role, nombre, objetivo, onLogout, extra, onMenuClick }) => (
  <div style={{ background:"rgba(4,8,15,0.88)",borderBottom:"1px solid rgba(46,92,184,0.10)",padding:"12px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",boxShadow:"0 1px 0 rgba(46,92,184,0.06)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {onMenuClick && (
        <button onClick={onMenuClick} style={{ background: "none", border: "none", color: C.text, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
          ☰
        </button>
      )}
      <FluxLogo size={24} />
    </div>
    <div style={{ display:"flex",alignItems:"center",gap:12 }}>
      {extra}
      {role==="admin"&&<div style={{ fontSize:11,fontWeight:700,letterSpacing:"1px",padding:"4px 12px",borderRadius:20,background:"rgba(46,92,184,0.12)",border:"1px solid rgba(46,92,184,0.25)",color:"var(--brand-accent,#2e5cb8)",fontFamily:"'Inter',sans-serif" }}>⚡ ADMIN</div>}
      {role==="superadmin"&&<div style={{ fontSize:11,fontWeight:700,letterSpacing:"1px",padding:"4px 12px",borderRadius:20,background:"rgba(124,142,245,0.12)",border:"1px solid rgba(124,142,245,0.25)",color:"#7c8ef5",fontFamily:"'Inter',sans-serif" }}>❆ SUPERADMIN</div>}
      {nombre&&<div style={{ textAlign:"right" }}><div style={{ fontSize:13,fontWeight:600,color:C.text }}>{nombre}</div>{objetivo&&<div style={{ fontSize:11,color:C.muted }}>{objetivo}</div>}</div>}
    </div>
  </div>
);

export const Sidebar = ({ isOpen, onClose, tabs, active, onChange, onLogout, role, nombre }) => {
  return createPortal(
    <>
      <div 
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.3s ease", zIndex: 1000
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed", top: 0, bottom: 0, left: 0, width: "280px", maxWidth: "85vw",
          background: "linear-gradient(180deg, #0f1c2e, #07101d)",
          borderRight: "1px solid rgba(46,92,184,0.15)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1001, display: "flex", flexDirection: "column",
          boxShadow: isOpen ? "20px 0 60px rgba(0,0,0,0.5)" : "none"
        }}
      >
        {/* Header del Sidebar */}
        <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(46,92,184,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <FluxLogo size={24} />
          {(role || nombre) && (
            <div style={{ textAlign: "right" }}>
              {nombre && <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{nombre}</div>}
              {role === "superadmin" && <div style={{ fontSize: 10, color: "#7c8ef5", fontWeight: 700, letterSpacing: "0.5px" }}>❆ SUPERADMIN</div>}
              {role === "admin" && <div style={{ fontSize: 10, color: "var(--brand-accent,#2e5cb8)", fontWeight: 700, letterSpacing: "0.5px" }}>⚡ ADMIN</div>}
            </div>
          )}
        </div>

        {/* Lista de secciones */}
        <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1, overflowY: "auto" }}>
          {tabs.map(([k, ic, lb]) => (
            <button
              key={k}
              onClick={() => { onChange(k); onClose(); }}
              style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "13px 16px",
                borderRadius: "12px", border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                background: active === k ? "rgba(46,92,184,0.15)" : "transparent",
                color: active === k ? "var(--brand-accent,#2e5cb8)" : C.muted,
                fontWeight: active === k ? 700 : 500, fontSize: "14px",
                fontFamily: "'Inter', sans-serif", transition: "all 0.2s"
              }}
              onMouseEnter={e => { if (active !== k) e.currentTarget.style.background = "rgba(46,92,184,0.07)" }}
              onMouseLeave={e => { if (active !== k) e.currentTarget.style.background = "transparent" }}
            >
              <span style={{ fontSize: "17px", width: 22, textAlign: "center" }}>{ic}</span>
              {lb}
            </button>
          ))}
        </div>

        {/* Botón Cerrar Sesión al fondo */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(239,68,68,0.12)" }}>
          <button
            onClick={() => { onClose(); onLogout(); }}
            style={{
              display: "flex", alignItems: "center", gap: "14px", padding: "13px 16px",
              borderRadius: "12px", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer",
              textAlign: "left", width: "100%",
              background: "rgba(239,68,68,0.05)",
              color: "#f87171",
              fontWeight: 600, fontSize: "14px",
              fontFamily: "'Inter', sans-serif", transition: "all 0.25s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.05)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; }}
          >
            <span style={{ fontSize: "17px", width: 22, textAlign: "center" }}>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};

export const StatCard = ({ icon, label, value, unit, color }) => (
  <div className="card-hover" style={{ background:C.card,borderRadius:16,padding:"18px 14px",textAlign:"center",border:`1px solid ${C.border}`,position:"relative",overflow:"hidden" }}>
    <div style={{ fontSize:24,marginBottom:8 }}>{icon}</div>
    <div style={{ fontSize:28,fontWeight:800,color:color||"var(--brand-accent,#2e5cb8)",fontFamily:"'Space Grotesk',sans-serif",lineHeight:1 }}>{value}</div>
    {unit&&<div style={{ fontSize:10,color:C.muted,marginTop:2,letterSpacing:"0.5px",textTransform:"uppercase" }}>{unit}</div>}
    <div style={{ fontSize:11,color:C.muted,marginTop:6,fontWeight:500 }}>{label}</div>
  </div>
);