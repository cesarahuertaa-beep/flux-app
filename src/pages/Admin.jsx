import { useState, useEffect, useCallback } from "react";
import { C, css } from "../styles/theme";
import { Btn, Modal, Field, Tag, Header, TabBar, OrbBackground } from "../components/ui";
import { Biblioteca } from "../components/admin/Biblioteca";
import { ProgramarCliente } from "../components/admin/ProgramarCliente";
import { Nutriologos } from "../components/admin/Nutriologos";
import { authInvite, dbGet, dbPost, dbPatch, getProfileId } from "../lib/supabase";

export default function Admin({ onLogout, isSuperadmin, profileId, onModoAtleta, role }) {
  const [tab, setTab]                       = useState("clientes");
  const [clientes, setClientes]             = useState([]);
  const [selected, setSelected]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showNewClient, setShowNewClient]   = useState(false);
  const [newClient, setNewClient]           = useState({ nombre:"", email:"", objetivo:"", telefono:"" });
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState("");
  const [biblioteca, setBiblioteca]         = useState([]);
  const [nutriologoMap, setNutrioMap]       = useState({});
  const [searchClientes, setSearchClientes] = useState("");

  // Filtro por nutriologo_id — superadmin ve todo, nutriólogo ve los suyos
  const myId = profileId || getProfileId();
  const clientesFilter = isSuperadmin
    ? "clientes?order=created_at.asc"
    : `clientes?nutriologo_id=eq.${myId}&order=created_at.asc`;
  const bibliotecaFilter = "biblioteca_ejercicios?order=nombre.asc";

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try { const r = await dbGet(clientesFilter); setClientes(r); } catch{}
    setLoading(false);
  }, [clientesFilter]);

  const loadBiblioteca = useCallback(async () => {
    try { const r = await dbGet(bibliotecaFilter); setBiblioteca(r); } catch{}
  }, [bibliotecaFilter]);

  useEffect(() => { loadClientes(); loadBiblioteca(); }, [loadClientes, loadBiblioteca]);

  // Cargar mapa id→nombre de nutriólogos (solo superadmin)
  useEffect(() => {
    if (!isSuperadmin) return;
    dbGet("profiles?role=eq.nutriologo&select=id,nombre").then(rows => {
      const map = {};
      rows.forEach(r => { map[r.id] = r.nombre; });
      setNutrioMap(map);
    }).catch(() => {});
  }, [isSuperadmin]);

  const createClient = async () => {
    if (!newClient.email||!newClient.nombre) { setMsg("⚠️ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      const authUser = await authInvite(newClient.email, { role: "cliente", nombre: newClient.nombre });
      await dbPost("clientes", {
        nombre: newClient.nombre,
        objetivo: newClient.objetivo,
        email: newClient.email,
        telefono: newClient.telefono,
        auth_id: authUser.id,
        activo: true,
        nutriologo_id: myId   // ← asignar al nutriólogo que lo crea
      });
      setShowNewClient(false); setNewClient({ nombre:"", email:"", objetivo:"", telefono:"" });
      await loadClientes(); setMsg("✅ Cliente creado — se le envió email de invitación");
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const toggleActivo = async (c) => {
    try {
      await dbPatch(`clientes?id=eq.${c.id}`, { activo:!c.activo });
      await loadClientes();
      setMsg(`✅ Cliente ${!c.activo ? "activado" : "desactivado"}`);
    } catch(e) { setMsg("❌ Error: "+e.message); }
  };

  const activarModoAtleta = async () => {
    try {
      // 1. Obtener email y nombre propio del nutriólogo
      const profiles = await dbGet(`profiles?id=eq.${myId}&select=id,nombre,email`);
      if (!profiles.length) { setMsg("❌ No se encontró tu perfil"); return; }
      const { nombre, email } = profiles[0];

      // 2. Buscar registro de atleta propio ya creado
      const existing = await dbGet(`clientes?nutriologo_id=eq.${myId}&email=ilike.${encodeURIComponent(email)}&limit=1`);
      let clienteRecord;
      if (existing.length) {
        clienteRecord = existing[0];
      } else {
        // 3. Crear registro de cliente-atleta (sin invitación por email)
        const created = await dbPost("clientes", {
          nombre, email,
          objetivo: "Mi entrenamiento personal",
          nutriologo_id: myId,
          activo: true,
        });
        clienteRecord = Array.isArray(created) ? created[0] : created;
      }
      onModoAtleta(clienteRecord);
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const activeCount = clientes.filter(c=>c.activo).length;
  const filteredClientes = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(searchClientes.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchClientes.toLowerCase())
  );

  // Tabs: administrativo solo ve clientes (y pronto agenda), nutriólogo ve todo
  const tabs = role === "administrativo"
    ? [
        ["clientes","👥","Clientes"]
        // TODO: Agregar pestaña Agenda aquí
      ]
    : [
        ["clientes","👥","Clientes"],
        ["biblioteca","📚","Biblioteca"],
        ["programar","📋","Programar"],
        ...(isSuperadmin ? [["nutriologos","🌐","Nutriólogos"]] : [])
      ];

  return (
    <div style={{ minHeight:"100vh", background:"#03050a", position:"relative" }}>
      <style>{css}</style>
      <OrbBackground/>

      <Header
        role={isSuperadmin ? "superadmin" : "admin"}
        onLogout={onLogout}
        extra={
          !isSuperadmin && (
            <button
              onClick={activarModoAtleta}
              style={{
                padding:"7px 14px", borderRadius:9,
                background:"rgba(46,92,184,0.10)",
                border:"1px solid rgba(46,92,184,0.25)",
                color:"var(--brand-accent,#2e5cb8)",
                fontSize:13, fontWeight:700,
                cursor:"pointer", fontFamily:"'Inter',sans-serif",
                transition:"all 0.2s", whiteSpace:"nowrap"
              }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(46,92,184,0.20)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(46,92,184,0.10)";}}
            >💪 Modo Atleta</button>
          )
        }
      />

      <TabBar tabs={tabs} active={tab} onChange={setTab}/>

      <div style={{ padding:"28px 24px", maxWidth:980, margin:"0 auto", position:"relative", zIndex:1 }}>

        {/* Toast de mensajes */}
        {msg && (
          <div
            className="animate-in"
            onClick={()=>setMsg("")}
            style={{
              background: msg.startsWith("❌") ? "#ef444420" : `color-mix(in srgb, ${C.accentDeep} 38%, transparent)`,
              border:`1px solid ${msg.startsWith("❌") ? "#ef444440" : C.accent+"40"}`,
              borderRadius:12, padding:"12px 18px",
              fontSize:13, marginBottom:20,
              cursor:"pointer", color: msg.startsWith("❌") ? "#f87171" : C.accent,
              display:"flex", alignItems:"center", justifyContent:"space-between",
              backdropFilter:"blur(4px)"
            }}
          >
            <span>{msg}</span>
            <span style={{opacity:0.5,fontSize:16}}>×</span>
          </div>
        )}

        {/* ── TAB CLIENTES ── */}
        {tab==="clientes" && (
          <div className="animate-in">
              <div style={{
                display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12
              }}>
                <div>
                  <h2 style={{
                    fontFamily:"'Space Grotesk',sans-serif",
                    fontWeight:700, fontSize:24,
                    color:"#e2eeff", letterSpacing:"0.3px", marginBottom:4
                  }}>Clientes</h2>
                  <div style={{fontSize:13,color:"#64748b"}}>
                    {filteredClientes.filter(c=>c.activo).length} activos· {filteredClientes.filter(c=>!c.activo).length} inactivos
                    {searchClientes && <span style={{color:"var(--brand-accent,#2e5cb8)",marginLeft:6}}>({filteredClientes.length} de {clientes.length})</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input
                    value={searchClientes}
                    onChange={e=>setSearchClientes(e.target.value)}
                    placeholder="🔍 Buscar cliente…"
                    style={{
                      background:"rgba(7,16,29,0.7)",
                      border:"1px solid rgba(46,92,184,0.18)",
                      borderRadius:9, padding:"8px 14px",
                      color:"#e2eeff", fontSize:13,
                      fontFamily:"'Inter',sans-serif",
                      outline:"none", width:200
                    }}
                  />
                  <Btn grad onClick={()=>setShowNewClient(true)}>+ Nuevo cliente</Btn>
                </div>
              </div>

            {loading ? (
              <div style={{ textAlign:"center", padding:"80px 0", color:"#64748b", fontSize:14 }}>
                <div style={{
                  width:44, height:44, borderRadius:"50%",
                  border:"2px solid rgba(56,189,248,0.1)",
                  borderTopColor:"#38bdf8",
                  animation:"rotateSlow 0.8s linear infinite",
                  margin:"0 auto 16px",
                  boxShadow:"0 0 20px rgba(56,189,248,0.2)"
                }}/>
                Cargando clientes…
              </div>
            ) : filteredClientes.length === 0 ? (
              <div style={{
                textAlign:"center", padding:"60px 0", color:"#475569",
                background:"rgba(7,13,24,0.4)", borderRadius:16,
                border:"1px solid rgba(56,189,248,0.05)"
              }}>
                <div style={{fontSize:40,marginBottom:12,opacity:0.3}}>🔍</div>
                <div style={{fontSize:15,fontWeight:600,color:"#64748b"}}>Sin resultados para "{searchClientes}"</div>
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {filteredClientes.map((c, i) => (
                  <div
                    key={c.id}
                    className="card-hover animate-in"
                    style={{
                      background:"linear-gradient(145deg, rgba(10,20,40,0.8), rgba(7,13,24,0.9))",
                      borderRadius:16,
                      border:"1px solid rgba(56,189,248,0.07)",
                      padding:"16px 20px",
                      display:"flex", alignItems:"center",
                      justifyContent:"space-between",
                      flexWrap:"wrap", gap:12,
                      animationDelay:`${i*0.05}s`,
                      position:"relative", overflow:"hidden",
                      backdropFilter:"blur(12px)"
                    }}
                  >
                    {/* Left accent bar */}
                    <div style={{
                      position:"absolute", left:0, top:"15%", bottom:"15%",
                      width:3, borderRadius:"0 3px 3px 0",
                      background: c.activo
                        ? "linear-gradient(180deg, #38bdf8, #818cf8)"
                        : "rgba(239,68,68,0.6)",
                      boxShadow: c.activo ? "0 0 12px rgba(56,189,248,0.4)" : "0 0 8px rgba(239,68,68,0.3)"
                    }}/>
                    <div style={{paddingLeft:12}}>
                      <div style={{ fontWeight:700, fontSize:15, color:"#e2eeff", marginBottom:3, fontFamily:"'Space Grotesk',sans-serif" }}>
                        {c.nombre}
                        <span style={{fontSize:12, color:"#475569", fontWeight:400, fontFamily:"'Inter',sans-serif", marginLeft:8}}>{c.email}</span>
                      </div>
                      <div style={{fontSize:12, color:"#64748b"}}>
                        {c.objetivo||"Sin objetivo definido"}
                        {c.telefono && (
                          <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{marginLeft:12, color:"#22c55e", textDecoration:"none", fontWeight:600, display:"inline-flex", alignItems:"center", gap:4}}>
                            <span style={{fontSize:14}}>💬</span> WhatsApp
                          </a>
                        )}
                      </div>
                      {isSuperadmin && c.nutriologo_id && (
                        <div style={{fontSize:11, color:"#818cf8", marginTop:3, fontWeight:500}}>
                          👤 {nutriologoMap[c.nutriologo_id] || "Nutriólogo desconocido"}
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{
                        fontSize:11, fontWeight:700, letterSpacing:"0.5px",
                        padding:"4px 12px", borderRadius:20,
                        background: c.activo ? "rgba(56,189,248,0.12)" : "rgba(239,68,68,0.12)",
                        border: `1px solid ${c.activo ? "rgba(56,189,248,0.25)" : "rgba(239,68,68,0.25)"}`,
                        color: c.activo ? "#38bdf8" : "#f87171",
                        fontFamily:"'Inter',sans-serif"
                      }}>{c.activo ? "● Activo" : "○ Inactivo"}</span>
                      {role !== "administrativo" && (
                        <Btn small outline color="rgba(129,140,248,0.8)" onClick={()=>{setSelected(c);setTab("programar");}}>
                          Programar
                        </Btn>
                      )}
                      <Btn small outline color={c.activo ? "rgba(239,68,68,0.8)" : "rgba(56,189,248,0.8)"} onClick={()=>toggleActivo(c)}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="biblioteca" && (
          <div className="animate-in">
            <Biblioteca biblioteca={biblioteca} onUpdate={loadBiblioteca} setMsg={setMsg} isSuperadmin={isSuperadmin}/>
          </div>
        )}
        {tab==="programar" && (
          <div className="animate-in">
            <ProgramarCliente
              clientes={clientes}
              selected={selected}
              setSelected={setSelected}
              setMsg={setMsg}
              biblioteca={biblioteca}
            />
          </div>
        )}
        {tab==="nutriologos" && isSuperadmin && (
          <div className="animate-in">
            <Nutriologos setMsg={setMsg}/>
          </div>
        )}
      </div>

      {/* Modal nuevo cliente */}
      {showNewClient && (
        <Modal title="➕ Nuevo cliente" onClose={()=>setShowNewClient(false)}>
          <Field label="Nombre completo">
            <input value={newClient.nombre} onChange={e=>setNewClient(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Ana García"/>
          </Field>
          <Field label="Email">
            <input type="email" value={newClient.email} onChange={e=>setNewClient(p=>({...p,email:e.target.value}))} placeholder="ana@email.com"/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input type="tel" value={newClient.telefono} onChange={e=>setNewClient(p=>({...p,telefono:e.target.value}))} placeholder="Ej. +525512345678"/>
          </Field>
          <Field label="Objetivo">
            <input value={newClient.objetivo} onChange={e=>setNewClient(p=>({...p,objetivo:e.target.value}))} placeholder="Pérdida de peso, ganancia muscular…"/>
          </Field>
          <div style={{
            background:`color-mix(in srgb, ${C.accentDeep} 19%, transparent)`,
            border:`1px solid color-mix(in srgb, ${C.accent} 15%, transparent)`,
            borderRadius:10, padding:"11px 14px",
            fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6
          }}>
            📧 El cliente recibirá un email de invitación para crear su contraseña.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color={C.muted} onClick={()=>setShowNewClient(false)}>Cancelar</Btn>
            <Btn grad onClick={createClient} disabled={saving}>
              {saving ? "Enviando invitación…" : "Crear y enviar invitación"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}


