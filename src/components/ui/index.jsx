import { C } from "../../styles/theme";

export const Btn = ({ children, onClick, grad, color, outline, small, danger, disabled, style={}, className="" }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`btn-hover ${className}`}
    style={{
      padding: small ? "6px 16px" : "10px 22px",
      borderRadius: 10,
      background: danger
        ? "linear-gradient(135deg,#ef4444,#dc2626)"
        : outline ? "transparent"
        : grad ? C.gradBtn
        : (color || C.accentMid),
      color: danger ? "#fff" : outline ? (color || C.accent) : "#000",
      border: `1px solid ${danger ? "#ef4444" : outline ? (color || C.accent) : "transparent"}`,
      fontWeight: 700,
      fontSize: small ? 12 : 14,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      letterSpacing: "0.3px",
      fontFamily: "'Inter', sans-serif",
      boxShadow: grad && !disabled ? `0 4px 15px ${C.accentDeep}80` : "none",
      ...style
    }}
  >{children}</button>
);

export const Modal = ({ title, onClose, children, wide }) => (
  <div
    style={{
      position:"fixed", inset:0,
      background:"rgba(0,0,0,0.85)",
      backdropFilter:"blur(8px)",
      zIndex:100, display:"flex",
      alignItems:"center", justifyContent:"center", padding:16
    }}
    onClick={e => e.target===e.currentTarget && onClose()}
  >
    <div
      className="animate-in"
      style={{
        background:`linear-gradient(145deg, ${C.card}, ${C.surface})`,
        borderRadius:20,
        border:`1px solid ${C.border}`,
        width:"100%", maxWidth:wide?720:580,
        maxHeight:"92vh", overflow:"auto",
        boxShadow:`0 24px 80px ${C.accentDeep}60, 0 0 0 1px ${C.borderGlow}`
      }}
    >
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"18px 24px",
        borderBottom:`1px solid ${C.border}`,
        background:`linear-gradient(90deg, ${C.accentDeep}20, transparent)`,
        borderRadius:"20px 20px 0 0"
      }}>
        <span style={{ fontWeight:700, fontSize:16, color:C.accent, letterSpacing:"0.3px" }}>{title}</span>
        <button
          onClick={onClose}
          style={{
            background:`${C.accentDeep}40`,
            color:C.muted, fontSize:18, cursor:"pointer",
            border:`1px solid ${C.border}`,
            borderRadius:8, width:32, height:32,
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.2s"
          }}
          onMouseEnter={e=>{e.target.style.color=C.accent; e.target.style.borderColor=C.accent;}}
          onMouseLeave={e=>{e.target.style.color=C.muted; e.target.style.borderColor=C.border;}}
        >×</button>
      </div>
      <div style={{padding:"20px 24px"}}>{children}</div>
    </div>
  </div>
);

export const Field = ({ label, children, hint }) => (
  <div style={{marginBottom:16}}>
    <div style={{
      fontSize:11, color:C.muted, marginBottom:6,
      fontWeight:600, textTransform:"uppercase",
      letterSpacing:"0.8px"
    }}>{label}</div>
    {children}
    {hint && <div style={{fontSize:11,color:C.dim,marginTop:4}}>{hint}</div>}
  </div>
);

export const Tag = ({ children, color, size="sm" }) => (
  <span style={{
    fontSize: size==="md" ? 12 : 11,
    padding: size==="md" ? "4px 12px" : "3px 10px",
    borderRadius:20,
    background:`${color||C.accent}18`,
    color:color||C.accent,
    border:`1px solid ${color||C.accent}30`,
    fontWeight:600, letterSpacing:"0.3px",
    whiteSpace:"nowrap"
  }}>{children}</span>
);

export const FluxLogo = ({ size=28, animated=false }) => (
  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
    <div
      className={animated ? "float" : ""}
      style={{
        width:size*1.4, height:size*1.4,
        borderRadius:"50%",
        background:C.gradBtn,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:size*0.6,
        boxShadow:`0 0 ${size}px ${C.accentMid}50`,
        flexShrink:0
      }}
    >💪</div>
    <div>
      <div style={{
        fontFamily:"'Rajdhani', sans-serif",
        fontWeight:700, fontSize:size*0.9,
        background:C.grad,
        WebkitBackgroundClip:"text",
        WebkitTextFillColor:"transparent",
        letterSpacing:size*0.08,
        lineHeight:1, textTransform:"uppercase"
      }}>FLUX</div>
      <div style={{
        fontSize:size*0.25, color:C.muted,
        letterSpacing:size*0.05, lineHeight:1,
        textTransform:"uppercase", fontWeight:500
      }}>Sport Supplements</div>
    </div>
  </div>
);

export const Header = ({ role, nombre, objetivo, onLogout, extra }) => (
  <div style={{
    background:`linear-gradient(90deg, ${C.surface}, ${C.surfaceAlt})`,
    borderBottom:`1px solid ${C.border}`,
    padding:"14px 24px",
    display:"flex", alignItems:"center", justifyContent:"space-between",
    position:"sticky", top:0, zIndex:10,
    backdropFilter:"blur(12px)",
    boxShadow:`0 4px 24px ${C.accentDeep}30`
  }}>
    <FluxLogo size={24}/>
    <div style={{display:"flex", alignItems:"center", gap:12}}>
      {extra}
      {role==="admin" && (
        <Tag color={C.accentMid} size="md">⚡ Admin</Tag>
      )}
      {nombre && (
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:13, fontWeight:600, color:C.text}}>{nombre}</div>
          {objetivo && <div style={{fontSize:11, color:C.muted}}>{objetivo}</div>}
        </div>
      )}
      <Btn small outline color={C.muted} onClick={onLogout}>Salir</Btn>
    </div>
  </div>
);

export const TabBar = ({ tabs, active, onChange }) => (
  <div style={{
    display:"flex",
    background:C.surfaceAlt,
    borderBottom:`1px solid ${C.border}`,
    overflowX:"auto",
    scrollbarWidth:"none"
  }}>
    {tabs.map(([k, ic, lb]) => (
      <button
        key={k}
        onClick={() => onChange(k)}
        className="tab-btn"
        style={{
          flex:1, maxWidth:240,
          padding:"14px 0",
          background:"none",
          color: active===k ? C.accent : C.muted,
          fontWeight: active===k ? 700 : 500,
          fontSize:14,
          border:"none",
          borderBottom: active===k ? `2px solid ${C.accent}` : "2px solid transparent",
          cursor:"pointer",
          letterSpacing:"0.3px",
          fontFamily:"'Inter', sans-serif",
          position:"relative",
          whiteSpace:"nowrap",
          flexShrink:0
        }}
      >
        {active===k && (
          <span style={{
            position:"absolute", top:0, left:"20%", right:"20%", height:2,
            background:`linear-gradient(90deg, transparent, ${C.accent}60, transparent)`,
            borderRadius:"0 0 4px 4px"
          }}/>
        )}
        {ic} {lb}
      </button>
    ))}
  </div>
);

export const StatCard = ({ icon, label, value, unit, color }) => (
  <div className="card-hover" style={{
    background:C.gradCard,
    borderRadius:16,
    padding:"16px 14px",
    textAlign:"center",
    border:`1px solid ${C.border}`,
    position:"relative",
    overflow:"hidden"
  }}>
    <div style={{
      position:"absolute", top:0, left:0, right:0, height:2,
      background:`linear-gradient(90deg, transparent, ${color||C.accent}, transparent)`
    }}/>
    <div style={{fontSize:24, marginBottom:6}}>{icon}</div>
    <div style={{
      fontSize:26, fontWeight:800,
      color: color || C.accent,
      fontFamily:"'Rajdhani', sans-serif",
      lineHeight:1
    }}>{value}</div>
    <div style={{fontSize:11, color:C.muted, marginTop:2}}>{unit}</div>
    <div style={{fontSize:11, color:C.muted, marginTop:4, fontWeight:500}}>{label}</div>
  </div>
);
