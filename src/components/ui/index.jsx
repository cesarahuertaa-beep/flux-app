import { C } from "../../styles/theme";
import { useBrand } from "../BrandContext";
import { createPortal } from "react-dom";

export const OrbBackground = ({ variant = "default" }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
    <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(8,47,73,0.7) 0%, transparent 70%)", top: "-10%", left: "-5%", animation: "orb-drift 18s ease-in-out infinite", filter: "blur(1px)" }}/>
    <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(30,27,75,0.6) 0%, transparent 70%)", top: "20%", right: "-8%", animation: "orb-drift-reverse 22s ease-in-out infinite" }}/>
    <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(8,47,73,0.5) 0%, transparent 70%)", bottom: "-5%", left: "30%", animation: "orb-drift 26s ease-in-out infinite reverse" }}/>
    <div style={{ position: "absolute", inset: 0, opacity: 0.025, backgroundImage: `linear-gradient(rgba(56,189,248,1) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,1) 1px, transparent 1px)`, backgroundSize: "80px 80px" }}/>
    <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}/>
  </div>
);

export const Btn = ({ children, onClick, grad, color, outline, small, danger, disabled, style = {}, className = "" }) => {
  const isGrad = grad && !danger && !outline;
  return (
    <button disabled={disabled} onClick={onClick} className={`btn-hover ${className}`} style={{
      padding: small ? "6px 16px" : "11px 24px", borderRadius: 10,
      background: danger ? "linear-gradient(135deg, #ef4444, #dc2626)" : outline ? "rgba(10,20,40,0.5)" : isGrad ? C.gradBtn : (color || C.accentMid),
      color: danger ? "#fff" : outline ? (color || C.accent) : "#000",
      border: `1px solid ${danger ? "#ef4444" : outline ? (color || "rgba(56,189,248,0.35)") : "transparent"}`,
      fontWeight: 700, fontSize: small ? 12 : 13, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1, letterSpacing: "0.4px", fontFamily: "'Inter', sans-serif",
      backdropFilter: outline ? "blur(8px)" : "none",
      boxShadow: isGrad && !disabled ? `0 4px 20px rgba(14,165,233,0.35), 0 1px 0 rgba(255,255,255,0.15) inset` : danger && !disabled ? "0 4px 16px rgba(239,68,68,0.35)" : "none",
      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)", whiteSpace: "nowrap", ...style
    }}>{children}</button>
  );
};

export const Modal = ({ title, onClose, children, wide }) => createPortal(
  <div
    style={{
      position: "fixed", inset: 0,
      background: "rgba(3,5,10,0.8)",
      backdropFilter: "blur(16px)",
      zIndex: 100,
      overflowY: "auto",
      padding: "5vh 16px 10vh",
    }}
    onClick={e => e.target === e.currentTarget && onClose()}
  >
    <div
      className="animate-in-scale"
      style={{
        margin: "0 auto",
        background: "linear-gradient(145deg, rgba(10,20,40,0.95), rgba(7,13,24,0.98))",
        borderRadius: 20,
        border: "1px solid rgba(56,189,248,0.12)",
        width: "100%", maxWidth: wide ? 720 : 560,
        minHeight: wide ? "60vh" : "auto",
        display: "flex", flexDirection: "column",
        boxShadow: `0 0 0 1px rgba(56,189,248,0.06), 0 32px 100px rgba(0,0,0,0.6), 0 0 80px rgba(8,47,73,0.3), inset 0 1px 0 rgba(56,189,248,0.08)`,
        position: "relative",
        overflow: "clip",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.6), rgba(129,140,248,0.4), transparent)", borderRadius: "0 0 4px 4px", zIndex: 2 }}/>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(56,189,248,0.07)", flexShrink: 0, background: "rgba(7,13,24,0.4)", backdropFilter: "blur(8px)", zIndex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.3px" }}>{title}</span>
        <button onClick={onClose} className="btn-hover" style={{ background: "rgba(56,189,248,0.06)", color: C.muted, fontSize: 18, cursor: "pointer", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontFamily: "monospace" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#38bdf8"; e.currentTarget.style.borderColor = "rgba(56,189,248,0.3)"; e.currentTarget.style.background = "rgba(56,189,248,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = "rgba(56,189,248,0.1)"; e.currentTarget.style.background = "rgba(56,189,248,0.06)"; }}
        >×</button>
      </div>
      <div style={{ padding: "22px 24px" }}>
        {children}
      </div>
    </div>
  </div>,
  document.body
);

export const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'Inter', sans-serif" }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>{hint}</div>}
  </div>
);

export const Tag = ({ children, color, size = "sm" }) => (
  <span style={{ fontSize: size === "md" ? 12 : 11, padding: size === "md" ? "4px 12px" : "3px 10px", borderRadius: 20, background: `${color || "#38bdf8"}14`, color: color || "#38bdf8", border: `1px solid ${color || "#38bdf8"}28`, fontWeight: 600, letterSpacing: "0.2px", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{children}</span>
);

export const FluxLogo = ({ size = 28, animated = false, large = false }) => {
  const brand = useBrand();
  const logo = brand?.logo_url || "/logo.png";
  const nombre = brand?.nombre_marca || "FLUX Sport Supplements";
  return large ? (
    <img src={logo} alt={nombre} className={animated ? "float" : ""} style={{ height: 160, objectFit: "contain", filter: "drop-shadow(0 0 32px rgba(56,189,248,0.4)) drop-shadow(0 0 60px rgba(56,189,248,0.15))" }}/>
  ) : (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <img src={logo} alt={nombre} style={{ height: size * 1.8, objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(56,189,248,0.35))" }}/>
    </div>
  );
};

export const Header = ({ role, nombre, objetivo, onLogout, extra }) => (
  <div style={{ background: "rgba(3,5,10,0.7)", borderBottom: "1px solid rgba(56,189,248,0.08)", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", boxShadow: "0 4px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(56,189,248,0.05) inset" }}>
    <FluxLogo size={24} />
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {extra}
      {role === "admin" && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", padding: "4px 12px", borderRadius: 20, background: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(129,140,248,0.15))", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontFamily: "'Inter', sans-serif" }}>⚡ ADMIN</div>}
      {role === "superadmin" && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", padding: "4px 12px", borderRadius: 20, background: "linear-gradient(135deg, rgba(129,140,248,0.2), rgba(56,189,248,0.15))", border: "1px solid rgba(129,140,248,0.3)", color: "#818cf8", fontFamily: "'Inter', sans-serif" }}>✦ SUPERADMIN</div>}
      {nombre && <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{nombre}</div>{objetivo && <div style={{ fontSize: 11, color: C.muted }}>{objetivo}</div>}</div>}
      <button onClick={onLogout} className="btn-hover" style={{ padding: "7px 16px", borderRadius: 9, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", color: C.mutedLight, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.2s", letterSpacing: "0.2px" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(56,189,248,0.12)"; e.currentTarget.style.color = "#38bdf8"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(56,189,248,0.06)"; e.currentTarget.style.color = C.mutedLight; }}
      >Salir</button>
    </div>
  </div>
);

export const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display: "flex", background: "rgba(7,13,24,0.6)", borderBottom: "1px solid rgba(56,189,248,0.07)", overflowX: "auto", scrollbarWidth: "none", backdropFilter: "blur(12px)", padding: "0 8px" }}>
    {tabs.map(([k, ic, lb]) => (
      <button key={k} onClick={() => onChange(k)} className={`tab-btn ${active === k ? "active" : ""}`} style={{ flex: 1, maxWidth: 200, padding: "15px 8px 14px", background: "none", color: active === k ? "#38bdf8" : "#64748b", fontWeight: active === k ? 700 : 500, fontSize: 13, border: "none", cursor: "pointer", letterSpacing: "0.3px", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", flexShrink: 0, transition: "color 0.25s ease" }}>
        {active === k && <span style={{ display: "inline-block", marginRight: 6, fontSize: 8, background: "linear-gradient(135deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", verticalAlign: "middle" }}>●</span>}
        {ic} {lb}
      </button>
    ))}
  </div>
);

export const StatCard = ({ icon, label, value, unit, color }) => (
  <div className="card-hover" style={{ background: "linear-gradient(145deg, rgba(10,20,40,0.8), rgba(7,13,24,0.9))", borderRadius: 16, padding: "18px 14px", textAlign: "center", border: "1px solid rgba(56,189,248,0.08)", position: "relative", overflow: "hidden", backdropFilter: "blur(12px)" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color || "#38bdf8"}90, transparent)` }}/>
    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: color || "#38bdf8", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1, filter: `drop-shadow(0 0 8px ${color || "#38bdf8"}60)` }}>{value}</div>
    {unit && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, letterSpacing: "0.5px", textTransform: "uppercase" }}>{unit}</div>}
    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontWeight: 500 }}>{label}</div>
  </div>
);