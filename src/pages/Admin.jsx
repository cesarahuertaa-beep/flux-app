import { useState, useEffect, useCallback } from "react";
import { C, css } from "../styles/theme";
import { Btn, Modal, Field, Tag, Header, TabBar } from "../components/ui";
import { Biblioteca } from "../components/admin/Biblioteca";
import { ProgramarCliente } from "../components/admin/ProgramarCliente";
import { Nutriologos } from "../components/admin/Nutriologos";
import { authInvite, dbGet, dbPost, dbPatch, getProfileId } from "../lib/supabase";

export default function Admin({ onLogout, isSuperadmin, profileId }) {
  const [tab, setTab]                       = useState("clientes");
  const [clientes, setClientes]             = useState([]);
  const [selected, setSelected]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showNewClient, setShowNewClient]   = useState(false);
  const [newClient, setNewClient]           = useState({ nombre:"", email:"", objetivo:"" });
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState("");
  const [biblioteca, setBiblioteca]         = useState([]);

  // Filtro por nutriologo_id — superadmin ve todo, nutriólogo ve los suyos
  const myId = profileId || getProfileId();
  const clientesFilter = isSuperadmin
    ? "clientes?order=created_at.asc"
    : `clientes?nutriologo_id=eq.${myId}&order=created_at.asc`;
  const bibliotecaFilter = isSuperadmin
    ? "biblioteca_ejercicios?order=nombre.asc"
    : `biblioteca_ejercicios?nutriologo_id=eq.${myId}&order=nombre.asc`;

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try { const r = await dbGet(clientesFilter); setClientes(r); } catch{}
    setLoading(false);
  }, [clientesFilter]);

  const loadBiblioteca = useCallback(async () => {
    try { const r = await dbGet(bibliotecaFilter); setBiblioteca(r); } catch{}
  }, [bibliotecaFilter]);

  useEffect(() => { loadClientes(); loadBiblioteca(); }, [loadClientes, loadBiblioteca]);

  const createClient = async () => {
    if (!newClient.email||!newClient.nombre) { setMsg("⚠️ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      const authUser = await authInvite(newClient.email);
      await dbPost("clientes", {
        nombre: newClient.nombre,
        objetivo: newClient.objetivo,
        email: newClient.email,
        auth_id: authUser.id,
        activo: true,
        nutriologo_id: myId   // ← asignar al nutriólogo que lo crea
      });
      setShowNewClient(false); setNewClient({ nombre:"", email:"", objetivo:"" });
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

  const activeCount = clientes.filter(c=>c.activo).length;

  // Tabs: nutriólogo normal tiene 3, superadmin tiene 4
  const tabs = [
    ["clientes","👥","Clientes"],
    ["biblioteca","📚","Biblioteca"],
    ["programar","📋","Programar"],
    ...(isSuperadmin ? [["nutriologos","🌐","Nutriólogos"]] : [])
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <style>{css}</style>

      <Header role={isSuperadmin ? "superadmin" : "admin"} onLogout={onLogout}/>

      <TabBar tabs={tabs} active={tab} onChange={setTab}/>

      <div style={{ padding:"24px 20px", maxWidth:960, margin:"0 auto" }}>

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
              alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12
            }}>
              <div>
                <h2 style={{
                  fontFamily:"'Rajdhani',sans-serif",
                  fontWeight:700, fontSize:24,
                  color:C.text, letterSpacing:"0.5px"
                }}>Clientes</h2>
                <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                  {activeCount} activos · {clientes.length - activeCount} inactivos
                </div>
              </div>
              <Btn grad onClick={()=>setShowNewClient(true)}>+ Nuevo cliente</Btn>
            </div>

            {loading ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:C.muted, fontSize:14 }}>
                <div style={{
                  width:40, height:40, borderRadius:"50%",
                  border:`3px solid ${C.border}`,
                  borderTopColor:C.accent,
                  animation:"rotateSlow 0.8s linear infinite",
                  margin:"0 auto 16px"
                }}/>
                Cargando clientes…
              </div>
            ) : clientes.length===0 ? (
              <div style={{ textAlign:"center", padding:"80px 0", color:C.muted }}>
                <div style={{fontSize:48, marginBottom:16}}>👥</div>
                <div style={{fontSize:16, fontWeight:600, marginBottom:8}}>Sin clientes aún</div>
                <div style={{fontSize:13}}>Crea el primer cliente para comenzar</div>
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:8}}>
                {clientes.map((c, i) => (
                  <div
                    key={c.id}
                    className="card-hover animate-in"
                    style={{
                      background:`linear-gradient(135deg, ${C.card}, ${C.surfaceAlt})`,
                      borderRadius:14,
                      border:`1px solid ${C.border}`,
                      padding:"14px 18px",
                      display:"flex", alignItems:"center",
                      justifyContent:"space-between",
                      flexWrap:"wrap", gap:12,
                      animationDelay:`${i*0.04}s`,
                      position:"relative", overflow:"hidden"
                    }}
                  >
                    <div style={{
                      position:"absolute", left:0, top:"20%", bottom:"20%",
                      width:3, borderRadius:"0 2px 2px 0",
                      background:c.activo ? C.gradBtn : "#ef444460"
                    }}/>
                    <div style={{paddingLeft:8}}>
                      <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:3 }}>
                        {c.nombre}{" "}
                        <span style={{fontSize:12,color:C.muted,fontWeight:400}}>{c.email}</span>
                      </div>
                      <div style={{fontSize:12,color:C.muted}}>
                        {c.objetivo||"Sin objetivo definido"}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <Tag color={c.activo?C.accent:"#f87171"} size="md">
                        {c.activo?"● Activo":"○ Inactivo"}
                      </Tag>
                      <Btn small outline color={C.accentMid} onClick={()=>{setSelected(c);setTab("programar");}}>
                        Programar
                      </Btn>
                      <Btn small outline color={c.activo?"#ef4444":C.accent} onClick={()=>toggleActivo(c)}>
                        {c.activo?"Desactivar":"Activar"}
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
            <Biblioteca biblioteca={biblioteca} onUpdate={loadBiblioteca} setMsg={setMsg} nutriologoId={myId}/>
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
