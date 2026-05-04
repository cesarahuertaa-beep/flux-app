import { useState, useEffect, useCallback } from "react";

const SUPA_URL = "https://mciyywpqihnxhvqbznmq.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaXl5d3BxaWhueGh2cWJ6bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzMzNzIsImV4cCI6MjA5MzMwOTM3Mn0.nbPJ8Fa8fVG-Y7O3hj8P7sYKXXzr63T40OQVWNBwCR8";
const ADMIN_KEY = "flux_admin_creds";

const getAdminCreds = () => {
  try { const s = localStorage.getItem(ADMIN_KEY); return s ? JSON.parse(s) : { user: "admin", pass: "admin123" }; } catch { return { user: "admin", pass: "admin123" }; }
};
const setAdminCreds = (c) => { try { localStorage.setItem(ADMIN_KEY, JSON.stringify(c)); } catch {} };

const C = {
  bg: "#000000", surface: "#05192b", card: "#071f33", border: "#0a3050",
  accent: "#56CCF2", accentDark: "#2D9CDB", accentDeep: "#05447A",
  text: "#FFFFFF", muted: "#7ab8d4", dim: "#1a3a52",
  grad: "linear-gradient(135deg, #56CCF2 0%, #2D9CDB 50%, #05447A 100%)",
  gradBtn: "linear-gradient(135deg, #56CCF2, #2D9CDB)",
};

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${C.bg}; color: ${C.text}; font-family: system-ui, sans-serif; }
input, select, textarea { background: ${C.surface}; color: ${C.text}; border: 1px solid ${C.border}; border-radius: 8px; padding: 9px 12px; font-size: 14px; width: 100%; outline: none; font-family: inherit; }
input:focus, select:focus, textarea:focus { border-color: ${C.accent}; box-shadow: 0 0 0 2px ${C.accent}20; }
textarea { resize: vertical; min-height: 70px; }
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb { background: ${C.accentDeep}; border-radius: 4px; }
`;

const q = async (path, opts = {}) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...opts.headers },
    ...opts
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const t = await r.text(); return t ? JSON.parse(t) : [];
};
const dbGet = (p) => q(p);
const dbPost = (p, b) => q(p, { method: "POST", body: JSON.stringify(b) });
const dbPatch = (p, b) => q(p, { method: "PATCH", body: JSON.stringify(b), headers: { Prefer: "return=representation" } });
const dbDel = (p) => q(p, { method: "DELETE" });
const dbUpsert = (p, b) => q(p, { method: "POST", body: JSON.stringify(b), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });

const Btn = ({ children, onClick, grad, color, outline, small, danger, disabled, style = {} }) => (
  <button disabled={disabled} onClick={onClick} style={{
    padding: small ? "6px 14px" : "10px 20px", borderRadius: 8,
    background: danger ? "#ef4444" : outline ? "transparent" : grad ? C.gradBtn : (color || C.accent),
    color: danger ? "#fff" : outline ? (color || C.accent) : "#000",
    border: `1px solid ${danger ? "#ef4444" : (color || C.accent)}`,
    fontWeight: 700, fontSize: small ? 12 : 14, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, ...style
  }}>{children}</button>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, width: "100%", maxWidth: wide ? 700 : 560, maxHeight: "92vh", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.card, borderRadius: "16px 16px 0 0" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: C.accent }}>{title}</span>
        <button onClick={onClose} style={{ background: "none", color: C.muted, fontSize: 22, cursor: "pointer", border: "none" }}>×</button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    {children}
  </div>
);

const Tag = ({ children, color }) => (
  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: (color || C.accent) + "20", color: color || C.accent, border: `1px solid ${(color || C.accent)}30` }}>{children}</span>
);

const FluxLogo = ({ size = 28 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.gradBtn, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.55 }}>💪</div>
    <div>
      <div style={{ fontWeight: 900, fontSize: size * 0.75, background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2, lineHeight: 1 }}>FLUX</div>
      <div style={{ fontSize: size * 0.28, color: C.muted, letterSpacing: 1, lineHeight: 1 }}>SPORT SUPPLEMENTS</div>
    </div>
  </div>
);

const generateNutriPDF = (cliente, nutri, dias) => {
  const win = window.open("", "_blank");
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan Nutricional - ${cliente.nombre}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #000; background: #fff; padding: 30px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 3px solid #2D9CDB; padding-bottom: 20px; margin-bottom: 24px; }
    .logo-title { font-size: 32px; font-weight: 900; color: #05447A; letter-spacing: 4px; }
    .logo-sub { font-size: 12px; color: #2D9CDB; letter-spacing: 2px; }
    .client-info { background: #f0f8ff; border-left: 4px solid #2D9CDB; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
    .macros { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
    .macro-box { background: #05447A; color: white; border-radius: 10px; padding: 14px; text-align: center; }
    .macro-val { font-size: 24px; font-weight: 900; }
    .macro-lbl { font-size: 11px; opacity: 0.8; }
    .dia { margin-bottom: 20px; page-break-inside: avoid; }
    .dia-title { background: #2D9CDB; color: white; padding: 8px 14px; border-radius: 6px 6px 0 0; font-weight: 700; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #e8f4fd; padding: 8px 10px; text-align: left; font-size: 12px; color: #05447A; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 14px; }
  </style></head><body>
  <div class="header">
    <div class="logo-title">FLUX</div>
    <div class="logo-sub">- SPORT SUPPLEMENTS - KEEP GOING</div>
    <h2 style="color:#05447A; margin-top:10px; font-size:18px;">Plan Nutricional Personalizado</h2>
  </div>
  <div class="client-info">
    <strong style="font-size:16px;">${cliente.nombre}</strong><br>
    <span style="color:#666; font-size:13px;">Objetivo: ${cliente.objetivo || "—"}</span>
    <span style="float:right; color:#999; font-size:12px;">${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</span>
  </div>
  ${nutri ? `<div class="macros">
    <div class="macro-box"><div class="macro-val">${nutri.calorias}</div><div class="macro-lbl">Calorías (kcal)</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.proteina}g</div><div class="macro-lbl">Proteína</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.carbohidratos}g</div><div class="macro-lbl">Carbohidratos</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.grasas}g</div><div class="macro-lbl">Grasas</div></div>
  </div>` : ""}
  ${dias.map(d => `
    <div class="dia">
      <div class="dia-title">${d.dia}</div>
      <table><thead><tr><th>Hora</th><th>Comida</th><th>Opción 1</th><th>Opción 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>
      <tbody>${d.comidas.map(c => `<tr>
        <td>${c.hora||""}</td><td><strong>${c.nombre||""}</strong></td>
        <td>${c.opcion1||""}</td><td>${c.opcion2||""}</td>
        <td>${c.calorias||0}</td><td>${c.proteina||0}/${c.carbohidratos||0}/${c.grasas||0}g</td>
      </tr>`).join("")}</tbody></table>
    </div>`).join("")}
  <div class="footer">Plan generado por FLUX Sport Supplements · Keep Going 💪</div>
  </body></html>`;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
};

const Header = ({ role, nombre, objetivo, onLogout, extra }) => (
  <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
    <FluxLogo size={26} />
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {extra}
      {role === "admin" && <Tag color={C.accentDark}>Admin</Tag>}
      {nombre && <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{nombre}</div>{objetivo && <div style={{ fontSize: 11, color: C.muted }}>{objetivo}</div>}</div>}
      <Btn small outline color={C.muted} onClick={onLogout}>Salir</Btn>
    </div>
  </div>
);

const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
    {tabs.map(([k, ic, lb]) => (
      <button key={k} onClick={() => onChange(k)} style={{ flex: 1, maxWidth: 220, padding: "13px 0", background: "none", color: active === k ? C.accent : C.muted, fontWeight: active === k ? 700 : 400, fontSize: 14, borderBottom: active === k ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer", border: "none", borderBottom: active === k ? `2px solid ${C.accent}` : "2px solid transparent" }}>
        {ic} {lb}
      </button>
    ))}
  </div>
);

function Login({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setErr("");
    const creds = getAdminCreds();
    if (u.trim() === creds.user && p === creds.pass) { onLogin({ role: "admin" }); return; }
    try {
      const rows = await dbGet(`clientes?usuario=eq.${encodeURIComponent(u.trim())}&activo=eq.true`);
      if (!rows.length || rows[0].password !== p) { setErr("Usuario o contraseña incorrectos"); setLoading(false); return; }
      onLogin({ role: "client", data: rows[0] });
    } catch { setErr("Error de conexión"); setLoading(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <style>{css}</style>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: C.accentDeep + "30", top: -100, right: -100, filter: "blur(80px)" }} />
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: C.accentDark + "20", bottom: -80, left: -80, filter: "blur(60px)" }} />
      <div style={{ width: 380, padding: "44px 36px", background: C.surface, borderRadius: 24, border: `1px solid ${C.border}`, position: "relative", boxShadow: `0 0 60px ${C.accentDeep}40` }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <FluxLogo size={36} />
          <div style={{ marginTop: 16, fontSize: 13, color: C.muted }}>Tu programa personalizado</div>
        </div>
        <Field label="Usuario"><input value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Tu usuario" /></Field>
        <Field label="Contraseña"><input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••" /></Field>
        {err && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", padding: 13, background: C.gradBtn, border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15, color: "#000", cursor: "pointer" }}>
          {loading ? "Entrando…" : "ENTRAR"}
        </button>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.dim }}>Keep Going 💪</div>
      </div>
    </div>
  );
}

function Admin({ onLogout }) {
  const [tab, setTab] = useState("clientes");
  const [clientes, setClientes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [newClient, setNewClient] = useState({ usuario: "", password: "", nombre: "", objetivo: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [creds, setCreds] = useState(getAdminCreds());
  const [newCreds, setNewCreds] = useState({ user: "", pass: "", confirm: "" });
  const [credsErr, setCredsErr] = useState("");

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try { const r = await dbGet("clientes?order=created_at.asc"); setClientes(r); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { loadClientes(); }, [loadClientes]);

  const createClient = async () => {
    if (!newClient.usuario || !newClient.password || !newClient.nombre) { setMsg("⚠️ Completa todos los campos"); return; }
    setSaving(true);
    try {
      await dbPost("clientes", { ...newClient, activo: true });
      setShowNewClient(false); setNewClient({ usuario: "", password: "", nombre: "", objetivo: "" });
      await loadClientes(); setMsg("✅ Cliente creado");
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const toggleActivo = async (c) => { await dbPatch(`clientes?id=eq.${c.id}`, { activo: !c.activo }); await loadClientes(); };

  const saveCreds = () => {
    setCredsErr("");
    if (!newCreds.user || !newCreds.pass) { setCredsErr("Completa usuario y contraseña"); return; }
    if (newCreds.pass !== newCreds.confirm) { setCredsErr("Las contraseñas no coinciden"); return; }
    const nc = { user: newCreds.user, pass: newCreds.pass };
    setAdminCreds(nc); setCreds(nc); setShowCreds(false);
    setNewCreds({ user: "", pass: "", confirm: "" }); setMsg("✅ Credenciales actualizadas");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{css}</style>
      <Header role="admin" onLogout={onLogout} extra={
        <Btn small outline color={C.accentDark} onClick={() => { setShowCreds(true); setNewCreds({ user: creds.user, pass: "", confirm: "" }); }}>🔐 Credenciales</Btn>
      } />
      <TabBar tabs={[["clientes","👥","Clientes"],["programar","📋","Programar"]]} active={tab} onChange={setTab} />
      <div style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>
        {msg && <div onClick={() => setMsg("")} style={{ background: C.accentDeep + "40", border: `1px solid ${C.accent}40`, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14, cursor: "pointer", color: C.accent }}>{msg}</div>}
        {tab === "clientes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Clientes <span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>({clientes.length})</span></span>
              <Btn small grad onClick={() => setShowNewClient(true)}>+ Nuevo cliente</Btn>
            </div>
            {loading ? <div style={{ color: C.muted, textAlign: "center", padding: 50 }}>Cargando…</div>
              : clientes.length === 0 ? <div style={{ color: C.muted, textAlign: "center", padding: 60 }}>Sin clientes aún.</div>
              : clientes.map(c => (
                <div key={c.id} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.nombre} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>@{c.usuario}</span></div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{c.objetivo || "Sin objetivo"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Tag color={c.activo ? C.accent : "#f87171"}>{c.activo ? "Activo" : "Inactivo"}</Tag>
                    <Btn small outline color={C.accentDark} onClick={() => { setSelected(c); setTab("programar"); }}>Programar</Btn>
                    <Btn small outline color={c.activo ? "#f87171" : C.accent} onClick={() => toggleActivo(c)}>{c.activo ? "Desactivar" : "Activar"}</Btn>
                  </div>
                </div>
              ))}
          </div>
        )}
        {tab === "programar" && <ProgramarCliente clientes={clientes} selected={selected} setSelected={setSelected} setMsg={setMsg} />}
      </div>

      {showNewClient && (
        <Modal title="➕ Nuevo cliente" onClose={() => setShowNewClient(false)}>
          <Field label="Nombre completo"><input value={newClient.nombre} onChange={e => setNewClient(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Ana García" /></Field>
          <Field label="Usuario (login)"><input value={newClient.usuario} onChange={e => setNewClient(p => ({ ...p, usuario: e.target.value.toLowerCase() }))} placeholder="ej. anagarcia" /></Field>
          <Field label="Contraseña"><input value={newClient.password} onChange={e => setNewClient(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 4 caracteres" /></Field>
          <Field label="Objetivo"><input value={newClient.objetivo} onChange={e => setNewClient(p => ({ ...p, objetivo: e.target.value }))} placeholder="Pérdida de peso, ganancia muscular…" /></Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowNewClient(false)}>Cancelar</Btn>
            <Btn grad onClick={createClient} disabled={saving}>{saving ? "Guardando…" : "Crear cliente"}</Btn>
          </div>
        </Modal>
      )}

      {showCreds && (
        <Modal title="🔐 Cambiar credenciales Admin" onClose={() => setShowCreds(false)}>
          <div style={{ background: C.accentDeep + "30", border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.muted }}>
            Admin actual: <strong style={{ color: C.accent }}>@{creds.user}</strong>
          </div>
          <Field label="Nuevo usuario"><input value={newCreds.user} onChange={e => setNewCreds(p => ({ ...p, user: e.target.value }))} /></Field>
          <Field label="Nueva contraseña"><input type="password" value={newCreds.pass} onChange={e => setNewCreds(p => ({ ...p, pass: e.target.value }))} /></Field>
          <Field label="Confirmar contraseña"><input type="password" value={newCreds.confirm} onChange={e => setNewCreds(p => ({ ...p, confirm: e.target.value }))} /></Field>
          {credsErr && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{credsErr}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowCreds(false)}>Cancelar</Btn>
            <Btn grad onClick={saveCreds}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProgramarCliente({ clientes, selected, setSelected, setMsg }) {
  const [subtab, setSubtab] = useState("nutri");
  const [nutri, setNutri] = useState(null);
  const [dias, setDias] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [macros, setMacros] = useState({ calorias: "", proteina: "", carbohidratos: "", grasas: "" });
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [editDia, setEditDia] = useState(null);
  const [diaForm, setDiaForm] = useState({ dia: "", orden: 0, comidas: [] });
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editRutina, setEditRutina] = useState(null);
  const [rutinaForm, setRutinaForm] = useState({ nombre: "", semanas: 8, ejercicios: [] });

  const loadData = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const ns = await dbGet(`nutricion?cliente_id=eq.${selected.id}`);
      if (ns.length) {
        setNutri(ns[0]); setMacros({ calorias: ns[0].calorias||"", proteina: ns[0].proteina||"", carbohidratos: ns[0].carbohidratos||"", grasas: ns[0].grasas||"" });
        const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&order=orden.asc`);
        setDias(await Promise.all(ds.map(async d => ({ ...d, comidas: await dbGet(`comidas?dia_id=eq.${d.id}&order=orden.asc`) }))));
      } else { setNutri(null); setMacros({ calorias:"", proteina:"", carbohidratos:"", grasas:"" }); setDias([]); }
      const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&order=orden.asc`);
      setRutinas(await Promise.all(rs.map(async r => ({ ...r, ejercicios: await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`) }))));
    } catch (e) { setMsg("❌ " + e.message); }
    setLoading(false);
  }, [selected]);
  useEffect(() => { loadData(); }, [loadData]);

  const saveMacros = async () => {
    setSaving(true);
    try {
      if (nutri) await dbPatch(`nutricion?id=eq.${nutri.id}`, { ...macros, updated_at: new Date().toISOString() });
      else { const r = await dbPost("nutricion", { cliente_id: selected.id, ...macros }); setNutri(r[0]); }
      setMsg("✅ Macros guardados");
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const openNewDia = () => { setEditDia(null); setDiaForm({ dia: "", orden: dias.length, comidas: [{ hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }); setShowDiaModal(true); };
  const openEditDia = (d) => { setEditDia(d); setDiaForm({ dia: d.dia, orden: d.orden, comidas: d.comidas.map(c=>({...c})) }); setShowDiaModal(true); };

  const saveDia = async () => {
    if (!nutri) { setMsg("⚠️ Guarda los macros primero"); return; }
    setSaving(true);
    try {
      let diaId;
      if (editDia) { await dbPatch(`nutricion_dias?id=eq.${editDia.id}`, { dia: diaForm.dia, orden: diaForm.orden }); diaId = editDia.id; await dbDel(`comidas?dia_id=eq.${diaId}`); }
      else { const r = await dbPost("nutricion_dias", { nutricion_id: nutri.id, dia: diaForm.dia, orden: diaForm.orden }); diaId = r[0].id; }
      for (let i = 0; i < diaForm.comidas.length; i++) {
        const c = diaForm.comidas[i];
        await dbPost("comidas", { ...c, dia_id: diaId, orden: i, calorias:+c.calorias||0, proteina:+c.proteina||0, carbohidratos:+c.carbohidratos||0, grasas:+c.grasas||0 });
      }
      setShowDiaModal(false); setMsg("✅ Día guardado"); await loadData();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const deleteDia = async (d) => { await dbDel(`nutricion_dias?id=eq.${d.id}`); setMsg("🗑️ Día eliminado"); await loadData(); };
  const addComida = () => setDiaForm(p => ({ ...p, comidas: [...p.comidas, { hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }));
  const updComida = (i,f,v) => setDiaForm(p => { const cs=[...p.comidas]; cs[i]={...cs[i],[f]:v}; return {...p,comidas:cs}; });
  const remComida = (i) => setDiaForm(p => ({ ...p, comidas: p.comidas.filter((_,x)=>x!==i) }));

  const openNewRutina = () => { setEditRutina(null); setRutinaForm({ nombre:"", semanas:8, ejercicios:[{nombre:"",series:""}] }); setShowRutinaModal(true); };
  const openEditRutina = (r) => { setEditRutina(r); setRutinaForm({ nombre:r.nombre, semanas:r.semanas, ejercicios:r.ejercicios.map(e=>({...e})) }); setShowRutinaModal(true); };

  const saveRutina = async () => {
    setSaving(true);
    try {
      let rid;
      if (editRutina) { await dbPatch(`rutinas?id=eq.${editRutina.id}`, { nombre:rutinaForm.nombre, semanas:+rutinaForm.semanas }); rid=editRutina.id; await dbDel(`ejercicios?rutina_id=eq.${rid}`); }
      else { const r = await dbPost("rutinas", { cliente_id:selected.id, nombre:rutinaForm.nombre, semanas:+rutinaForm.semanas, orden:rutinas.length }); rid=r[0].id; }
      for (let i=0; i<rutinaForm.ejercicios.length; i++) await dbPost("ejercicios", { rutina_id:rid, nombre:rutinaForm.ejercicios[i].nombre, series:rutinaForm.ejercicios[i].series, orden:i });
      setShowRutinaModal(false); setMsg("✅ Rutina guardada"); await loadData();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const deleteRutina = async (r) => { await dbDel(`rutinas?id=eq.${r.id}`); setMsg("🗑️ Rutina eliminada"); await loadData(); };
  const addEj = () => setRutinaForm(p => ({ ...p, ejercicios:[...p.ejercicios,{nombre:"",series:""}] }));
  const updEj = (i,f,v) => setRutinaForm(p => { const es=[...p.ejercicios]; es[i]={...es[i],[f]:v}; return {...p,ejercicios:es}; });
  const remEj = (i) => setRutinaForm(p => ({ ...p, ejercicios:p.ejercicios.filter((_,x)=>x!==i) }));

  if (!selected) return (
    <div style={{ textAlign:"center", padding:60, color:C.muted }}>
      <div style={{ fontSize:40, marginBottom:12 }}>👆</div>
      <div style={{ marginBottom:16 }}>Selecciona un cliente para programar su plan</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
        {clientes.map(c => <Btn key={c.id} small outline color={C.accentDark} onClick={()=>setSelected(c)}>{c.nombre}</Btn>)}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ background:C.accentDeep+"50", border:`1px solid ${C.accent}40`, borderRadius:10, padding:"8px 16px" }}>
          <span style={{ fontWeight:700, color:C.accent }}>{selected.nombre}</span>
          <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>@{selected.usuario}</span>
        </div>
        <Btn small outline color={C.muted} onClick={()=>setSelected(null)}>Cambiar</Btn>
        {dias.length > 0 && <Btn small outline color={C.accentDark} onClick={()=>generateNutriPDF(selected,nutri,dias)}>📄 PDF Nutrición</Btn>}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["nutri","🥗","Nutrición"],["deporte","🏋️","Rutinas"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setSubtab(k)} style={{ padding:"8px 20px", borderRadius:20, background:subtab===k?C.gradBtn:C.card, color:subtab===k?"#000":C.muted, fontWeight:subtab===k?700:400, fontSize:13, border:`1px solid ${subtab===k?C.accent:C.border}`, cursor:"pointer" }}>
            {ic} {lb}
          </button>
        ))}
      </div>
      {loading ? <div style={{ color:C.muted, textAlign:"center", padding:40 }}>Cargando…</div> : <>
        {subtab==="nutri" && (
          <div>
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:16, marginBottom:14 }}>
              <div style={{ fontWeight:600, marginBottom:14, color:C.accent }}>Macros diarios</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[["calorias","🔥 Calorías (kcal)"],["proteina","🥩 Proteína (g)"],["carbohidratos","🍚 Carbohidratos (g)"],["grasas","🫒 Grasas (g)"]].map(([k,lb])=>(
                  <Field key={k} label={lb}><input type="number" value={macros[k]} onChange={e=>setMacros(p=>({...p,[k]:e.target.value}))} placeholder="0" /></Field>
                ))}
              </div>
              <Btn small grad onClick={saveMacros} disabled={saving}>{saving?"Guardando…":"Guardar macros"}</Btn>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontWeight:600 }}>Días del plan <span style={{ color:C.muted, fontWeight:400 }}>({dias.length})</span></span>
              <Btn small grad onClick={openNewDia}>+ Día</Btn>
            </div>
            {dias.map(d=>(
              <div key={d.id} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><span style={{ fontWeight:600 }}>{d.dia}</span><span style={{ fontSize:12, color:C.muted, marginLeft:10 }}>{d.comidas.length} comidas</span></div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn small outline color={C.accent} onClick={()=>openEditDia(d)}>Editar</Btn>
                  <Btn small danger onClick={()=>deleteDia(d)}>Borrar</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        {subtab==="deporte" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontWeight:600 }}>Rutinas <span style={{ color:C.muted, fontWeight:400 }}>({rutinas.length})</span></span>
              <Btn small grad onClick={openNewRutina}>+ Rutina</Btn>
            </div>
            {rutinas.map(r=>(
              <div key={r.id} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, padding:"10px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div><span style={{ fontWeight:600 }}>{r.nombre}</span><span style={{ fontSize:12, color:C.muted, marginLeft:10 }}>{r.ejercicios.length} ejercicios · {r.semanas} sem</span></div>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn small outline color={C.accentDark} onClick={()=>openEditRutina(r)}>Editar</Btn>
                    <Btn small danger onClick={()=>deleteRutina(r)}>Borrar</Btn>
                  </div>
                </div>
                {r.ejercicios.length>0 && (
                  <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:5 }}>
                    {r.ejercicios.map(e=><Tag key={e.id} color={C.accentDark}>{e.nombre} <span style={{opacity:0.7}}>({e.series})</span></Tag>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>}

      {showDiaModal && (
        <Modal title={editDia?`Editar: ${editDia.dia}`:"Nuevo día"} onClose={()=>setShowDiaModal(false)} wide>
          <Field label="Nombre del día"><input value={diaForm.dia} onChange={e=>setDiaForm(p=>({...p,dia:e.target.value}))} placeholder="Lunes, Día 1…" /></Field>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:600, fontSize:14 }}>Comidas</span>
            <Btn small outline color={C.accent} onClick={addComida}>+ Comida</Btn>
          </div>
          {diaForm.comidas.map((c,i)=>(
            <div key={i} style={{ background:C.bg, borderRadius:10, border:`1px solid ${C.border}`, padding:12, marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:12, color:C.muted }}>Comida {i+1}</span>
                <button onClick={()=>remComida(i)} style={{ background:"none", color:"#f87171", fontSize:18, cursor:"pointer", border:"none" }}>×</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <Field label="Hora"><input value={c.hora} onChange={e=>updComida(i,"hora",e.target.value)} placeholder="7:00 am" /></Field>
                <Field label="Nombre"><input value={c.nombre} onChange={e=>updComida(i,"nombre",e.target.value)} placeholder="Desayuno" /></Field>
              </div>
              <Field label="Opción 1"><textarea value={c.opcion1} onChange={e=>updComida(i,"opcion1",e.target.value)} placeholder="Descripción…" /></Field>
              <Field label="Opción 2"><textarea value={c.opcion2} onChange={e=>updComida(i,"opcion2",e.target.value)} placeholder="Descripción…" /></Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6 }}>
                {[["calorias","Kcal"],["proteina","Prot g"],["carbohidratos","Carbs g"],["grasas","Grasas g"]].map(([f,lb])=>(
                  <Field key={f} label={lb}><input type="number" value={c[f]} onChange={e=>updComida(i,f,e.target.value)} placeholder="0" /></Field>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <Btn outline color={C.muted} onClick={()=>setShowDiaModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveDia} disabled={saving}>{saving?"Guardando…":"Guardar día"}</Btn>
          </div>
        </Modal>
      )}

      {showRutinaModal && (
        <Modal title={editRutina?`Editar: ${editRutina.nombre}`:"Nueva rutina"} onClose={()=>setShowRutinaModal(false)}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <Field label="Nombre"><input value={rutinaForm.nombre} onChange={e=>setRutinaForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Pecho y Tríceps" /></Field>
            <Field label="Semanas"><input type="number" value={rutinaForm.semanas} onChange={e=>setRutinaForm(p=>({...p,semanas:e.target.value}))} /></Field>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:600, fontSize:14 }}>Ejercicios</span>
            <Btn small outline color={C.accentDark} onClick={addEj}>+ Ejercicio</Btn>
          </div>
          {rutinaForm.ejercicios.map((e,i)=>(
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 100px 32px", gap:8, marginBottom:8, alignItems:"center" }}>
              <input value={e.nombre} onChange={ev=>updEj(i,"nombre",ev.target.value)} placeholder={`Ejercicio ${i+1}`} />
              <input value={e.series} onChange={ev=>updEj(i,"series",ev.target.value)} placeholder="4x10" />
              <button onClick={()=>remEj(i)} style={{ background:"#ef444430", color:"#ef4444", borderRadius:6, padding:6, cursor:"pointer", fontSize:14, border:"none" }}>×</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn outline color={C.muted} onClick={()=>setShowRutinaModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveRutina} disabled={saving}>{saving?"Guardando…":"Guardar rutina"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClienteView({ session, onLogout }) {
  const { data: cliente } = session;
  const [tab, setTab] = useState("nutricion");
  const [nutri, setNutri] = useState(null);
  const [dias, setDias] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [diaIdx, setDiaIdx] = useState(0);
  const [rutinaIdx, setRutinaIdx] = useState(0);
  const [opcion, setOpcion] = useState({});
  const [progreso, setProgreso] = useState({});
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ns = await dbGet(`nutricion?cliente_id=eq.${cliente.id}`);
        if (ns.length) {
          setNutri(ns[0]);
          const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&order=orden.asc`);
          setDias(await Promise.all(ds.map(async d => ({ ...d, comidas: await dbGet(`comidas?dia_id=eq.${d.id}&order=orden.asc`) }))));
        }
        const rs = await dbGet(`rutinas?cliente_id=eq.${cliente.id}&order=orden.asc`);
        const rsFull = await Promise.all(rs.map(async r => ({ ...r, ejercicios: await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`) })));
        setRutinas(rsFull);
        const allIds = rsFull.flatMap(r => r.ejercicios.map(e => e.id));
        if (allIds.length) {
          const ps = await dbGet(`progreso?cliente_id=eq.${cliente.id}&ejercicio_id=in.(${allIds.join(",")})`);
          const pm = {}; ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}`] = p.valor; }); setProgreso(pm);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [cliente.id]);

  const commitEdit = async () => {
    if (!editCell) return;
    const [ejId, semana] = editCell.split("__");
    setProgreso(p => ({ ...p, [`${ejId}-${semana}`]: editVal }));
    await dbUpsert("progreso", { ejercicio_id:ejId, cliente_id:cliente.id, semana:+semana, valor:editVal, updated_at:new Date().toISOString() });
    setEditCell(null); setEditVal("");
  };

  const rutina = rutinas[rutinaIdx];
  const diaActual = dias[diaIdx];
  const semanas = rutina ? Array.from({ length: rutina.semanas }, (_,i) => `S${i+1}`) : [];

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <style>{css}</style>
      <Header nombre={cliente.nombre} objetivo={cliente.objetivo} onLogout={onLogout}
        extra={dias.length>0 && tab==="nutricion" ? <Btn small outline color={C.accentDark} onClick={()=>generateNutriPDF(cliente,nutri,dias)}>📄 PDF</Btn> : null}
      />
      <TabBar tabs={[["nutricion","🥗","Nutrición"],["deporte","🏋️","Entrenamiento"]]} active={tab} onChange={setTab} />
      <div style={{ padding:"20px 16px", maxWidth:800, margin:"0 auto" }}>
        {loading ? <div style={{ color:C.muted, textAlign:"center", padding:60 }}>Cargando tu programa…</div> : <>
          {tab==="nutricion" && (
            <div>
              {nutri && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
                  {[["🔥","Calorías",nutri.calorias,"kcal",C.accent],["🥩","Proteína",nutri.proteina,"g",C.accentDark],["🍚","Carbos",nutri.carbohidratos,"g","#7b8eff"],["🫒","Grasas",nutri.grasas,"g","#ffcc44"]].map(([ic,lb,v,u,col])=>(
                    <div key={lb} style={{ background:C.card, borderRadius:12, padding:"14px 10px", textAlign:"center", border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:20 }}>{ic}</div>
                      <div style={{ fontSize:22, fontWeight:800, color:col }}>{v}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{u}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{lb}</div>
                    </div>
                  ))}
                </div>
              )}
              {dias.length===0
                ? <div style={{ color:C.muted, textAlign:"center", padding:60 }}>Tu plan de nutrición aún no está listo.</div>
                : <>
                  <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
                    {dias.map((d,i)=>(
                      <button key={i} onClick={()=>setDiaIdx(i)} style={{ flexShrink:0, padding:"8px 18px", borderRadius:20, background:diaIdx===i?C.gradBtn:C.card, color:diaIdx===i?"#000":C.muted, fontWeight:diaIdx===i?700:400, fontSize:13, border:`1px solid ${diaIdx===i?C.accent:C.border}`, cursor:"pointer" }}>
                        {d.dia}
                      </button>
                    ))}
                  </div>
                  {diaActual && diaActual.comidas.map((c,ci)=>{
                    const sel = opcion[`${diaIdx}-${ci}`]||1;
                    return (
                      <div key={ci} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, marginBottom:10, overflow:"hidden" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:`1px solid ${C.border}`, background:C.accentDeep+"30" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, color:C.muted, background:C.dim, padding:"2px 9px", borderRadius:20 }}>{c.hora}</span>
                            <span style={{ fontWeight:700, fontSize:14 }}>{c.nombre}</span>
                          </div>
                          <span style={{ fontSize:13, color:C.accent, fontWeight:800 }}>{c.calorias} kcal</span>
                        </div>
                        <div style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                            {[1,2].map(n=>(
                              <button key={n} onClick={()=>setOpcion(p=>({...p,[`${diaIdx}-${ci}`]:n}))} style={{ padding:"5px 14px", borderRadius:20, fontSize:12, background:sel===n?C.gradBtn:"transparent", color:sel===n?"#000":C.muted, border:`1px solid ${sel===n?C.accent:C.border}`, fontWeight:sel===n?700:400, cursor:"pointer" }}>
                                Opción {n}
                              </button>
                            ))}
                          </div>
                          <div style={{ fontSize:13, marginBottom:10, lineHeight:1.6 }}>{sel===1?c.opcion1:c.opcion2}</div>
                          <div style={{ display:"flex", gap:14 }}>
                            {[["P",c.proteina,C.accent],["C",c.carbohidratos,"#7b8eff"],["G",c.grasas,"#ffcc44"]].map(([l,v,col])=>(
                              <span key={l} style={{ fontSize:12, color:col, fontWeight:700 }}>{l}: {v}g</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>}
            </div>
          )}
          {tab==="deporte" && (
            <div>
              {rutinas.length===0
                ? <div style={{ color:C.muted, textAlign:"center", padding:60 }}>Tu plan de entrenamiento aún no está listo.</div>
                : <>
                  <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
                    {rutinas.map((r,i)=>(
                      <button key={i} onClick={()=>setRutinaIdx(i)} style={{ flexShrink:0, padding:"8px 18px", borderRadius:20, background:rutinaIdx===i?C.gradBtn:C.card, color:rutinaIdx===i?"#000":C.muted, fontWeight:rutinaIdx===i?700:400, fontSize:13, border:`1px solid ${rutinaIdx===i?C.accent:C.border}`, cursor:"pointer" }}>
                        {r.nombre}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Toca cualquier celda para registrar tu avance 💪</div>
                  {rutina && (
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 6px" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign:"left", fontSize:11, color:C.muted, padding:"0 10px 6px", minWidth:140, fontWeight:600 }}>Ejercicio</th>
                            <th style={{ textAlign:"center", fontSize:11, color:C.muted, padding:"0 8px 6px", minWidth:70, fontWeight:600 }}>Series</th>
                            {semanas.map(s=><th key={s} style={{ textAlign:"center", fontSize:11, color:C.muted, padding:"0 4px 6px", minWidth:58, fontWeight:600 }}>{s}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {rutina.ejercicios.map(ej=>(
                            <tr key={ej.id}>
                              <td style={{ background:C.card, borderRadius:"10px 0 0 10px", padding:"10px 12px", fontSize:13, fontWeight:500, border:`1px solid ${C.border}`, borderRight:"none" }}>{ej.nombre}</td>
                              <td style={{ background:C.card, padding:"10px 8px", fontSize:12, color:C.accent, textAlign:"center", fontWeight:700, border:`1px solid ${C.border}`, borderLeft:"none", borderRight:"none" }}>{ej.series}</td>
                              {semanas.map((s,si)=>{
                                const cellKey=`${ej.id}__${si}`;
                                const val=progreso[`${ej.id}-${si}`]||"";
                                const isEdit=editCell===cellKey;
                                const hasVal=val&&val.trim()!=="";
                                return (
                                  <td key={si} onClick={()=>{if(!isEdit){setEditCell(cellKey);setEditVal(val);}}}
                                    style={{ background:hasVal?C.accentDeep+"60":C.card, padding:"6px 3px", textAlign:"center", border:`1px solid ${hasVal?C.accent+"50":C.border}`, borderLeft:"none", borderRight:si===semanas.length-1?`1px solid ${hasVal?C.accent+"50":C.border}`:"none", borderRadius:si===semanas.length-1?"0 10px 10px 0":0, cursor:"pointer" }}>
                                    {isEdit
                                      ? <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape"){setEditCell(null);setEditVal("");}}} style={{ width:52, padding:"4px 2px", fontSize:12, borderRadius:6, border:`1px solid ${C.accent}`, textAlign:"center", background:C.surface }} />
                                      : <span style={{ fontSize:12, color:hasVal?C.accent:C.dim, fontWeight:hasVal?700:400 }}>{hasVal?val:"—"}</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>}
            </div>
          )}
        </>}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  if (!session) return <Login onLogin={setSession} />;
  if (session.role === "admin") return <Admin onLogout={() => setSession(null)} />;
  return <ClienteView session={session} onLogout={() => setSession(null)} />;
}
