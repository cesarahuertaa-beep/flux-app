import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { getNutriologos, updateProfile, authInvite } from "../../lib/supabase";

const COLORS = ["#56CCF2","#2D9CDB","#BB86FC","#FF6B6B","#F7DC6F","#2ECC71","#E67E22","#E91E63"];

export function Nutriologos({ setMsg }) {
  const [nutriologos, setNutriologos]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showInvite, setShowInvite]         = useState(false);
  const [showEdit, setShowEdit]             = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [form, setForm] = useState({ nombre:"", email:"", nombre_marca:"", color_primario:"#56CCF2" });
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getNutriologos(); setNutriologos(r); } catch{}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!form.email || !form.nombre) { setMsg("⚠️ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      await authInvite(form.email, {
        role: "nutriologo",
        nombre: form.nombre,
        nombre_marca: form.nombre_marca || form.nombre,
        color_primario: form.color_primario
      });
      setMsg("✅ Invitación enviada — el nutriólogo recibirá un email para crear su contraseña");
      setShowInvite(false);
      setForm({ nombre:"", email:"", nombre_marca:"", color_primario:"#56CCF2" });
      setTimeout(load, 2000); // recargar después de un momento
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateProfile(showEdit.id, editForm);
      setMsg("✅ Perfil actualizado");
      setShowEdit(null);
      await load();
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:24, color:C.text, letterSpacing:"0.5px" }}>
            Nutriólogos
          </h2>
          <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>
            {nutriologos.length} registrado{nutriologos.length !== 1 ? "s" : ""}
          </div>
        </div>
        <Btn grad onClick={() => setShowInvite(true)}>+ Invitar nutriólogo</Btn>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>
          <div style={{ width:36, height:36, borderRadius:"50%", border:`3px solid ${C.border}`, borderTopColor:C.accent, animation:"rotateSlow 0.8s linear infinite", margin:"0 auto 14px" }}/>
          Cargando…
        </div>
      ) : nutriologos.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 0", color:C.muted }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🧑‍⚕️</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Sin nutriólogos aún</div>
          <div style={{ fontSize:13 }}>Invita al primer nutriólogo para comenzar</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {nutriologos.map((n, i) => (
            <div key={n.id} className="card-hover animate-in" style={{
              animationDelay:`${i*0.04}s`,
              background:`linear-gradient(135deg, ${C.card}, ${C.surfaceAlt})`,
              borderRadius:14, border:`1px solid ${C.border}`,
              padding:"16px 20px", display:"flex",
              alignItems:"center", justifyContent:"space-between",
              flexWrap:"wrap", gap:12, position:"relative", overflow:"hidden"
            }}>
              {/* Barra de color de marca */}
              <div style={{
                position:"absolute", left:0, top:0, bottom:0, width:4,
                background: n.color_primario || C.gradBtn,
                borderRadius:"4px 0 0 4px"
              }}/>
              <div style={{ paddingLeft:12 }}>
                <div style={{ fontWeight:700, fontSize:16, color:C.text, marginBottom:4 }}>
                  {n.nombre || "—"}
                  {n.nombre_marca && n.nombre_marca !== n.nombre && (
                    <span style={{ marginLeft:10, fontSize:12, color:C.muted, fontWeight:400 }}>
                      {n.nombre_marca}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:C.muted }}>{n.email || "Sin email"}</div>
                <div style={{ marginTop:6, display:"flex", gap:6, alignItems:"center" }}>
                  <div style={{
                    width:14, height:14, borderRadius:"50%",
                    background: n.color_primario || C.accent,
                    border:`2px solid ${C.border}`, flexShrink:0
                  }}/>
                  <span style={{ fontSize:11, color:C.muted }}>{n.color_primario || "#56CCF2"}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn small outline color={C.accentMid} onClick={() => { setShowEdit(n); setEditForm({ nombre:n.nombre||"", nombre_marca:n.nombre_marca||"", color_primario:n.color_primario||"#56CCF2", email:n.email||"" }); }}>
                  Editar marca
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal invitar */}
      {showInvite && (
        <Modal title="🧑‍⚕️ Invitar nutriólogo" onClose={() => setShowInvite(false)}>
          <Field label="Nombre completo">
            <input value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Dra. Ana García"/>
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="ana@email.com"/>
          </Field>
          <Field label="Nombre de marca (opcional)">
            <input value={form.nombre_marca} onChange={e => setForm(p=>({...p,nombre_marca:e.target.value}))} placeholder="Ej. NutriMax Pro"/>
          </Field>
          <Field label="Color principal de su marca">
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
              {COLORS.map(col => (
                <div key={col} onClick={() => setForm(p=>({...p,color_primario:col}))} style={{
                  width:28, height:28, borderRadius:"50%", background:col, cursor:"pointer",
                  border: form.color_primario===col ? `3px solid white` : `2px solid transparent`,
                  boxShadow: form.color_primario===col ? `0 0 8px ${col}` : "none",
                  transition:"all 0.15s"
                }}/>
              ))}
              <input type="color" value={form.color_primario} onChange={e => setForm(p=>({...p,color_primario:e.target.value}))}
                style={{ width:28, height:28, border:"none", borderRadius:"50%", cursor:"pointer", padding:0, background:"transparent" }}
                title="Color personalizado"/>
            </div>
          </Field>
          <div style={{ background:`${C.accentDeep}30`, border:`1px solid ${C.accent}25`, borderRadius:10, padding:"11px 14px", fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
            📧 El nutriólogo recibirá un email para crear su contraseña. Su panel ya estará configurado con su branding.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowInvite(false)}>Cancelar</Btn>
            <Btn grad onClick={invite} disabled={saving}>{saving ? "Enviando…" : "Invitar"}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal editar branding */}
      {showEdit && (
        <Modal title={`✏️ Editar — ${showEdit.nombre || "Nutriólogo"}`} onClose={() => setShowEdit(null)}>
          <Field label="Nombre completo">
            <input value={editForm.nombre} onChange={e => setEditForm(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          <Field label="Nombre de marca">
            <input value={editForm.nombre_marca} onChange={e => setEditForm(p=>({...p,nombre_marca:e.target.value}))}/>
          </Field>
          <Field label="Color de marca">
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
              {COLORS.map(col => (
                <div key={col} onClick={() => setEditForm(p=>({...p,color_primario:col}))} style={{
                  width:28, height:28, borderRadius:"50%", background:col, cursor:"pointer",
                  border: editForm.color_primario===col ? `3px solid white` : `2px solid transparent`,
                  boxShadow: editForm.color_primario===col ? `0 0 8px ${col}` : "none",
                  transition:"all 0.15s"
                }}/>
              ))}
              <input type="color" value={editForm.color_primario} onChange={e => setEditForm(p=>({...p,color_primario:e.target.value}))}
                style={{ width:28, height:28, border:"none", borderRadius:"50%", cursor:"pointer", padding:0, background:"transparent" }}/>
            </div>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowEdit(null)}>Cancelar</Btn>
            <Btn grad onClick={saveEdit} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
