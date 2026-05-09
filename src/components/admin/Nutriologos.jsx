import { useState, useEffect, useCallback, useRef } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { getNutriologos, updateProfile, authInvite } from "../../lib/supabase";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const COLORS = ["#56CCF2","#2D9CDB","#BB86FC","#FF6B6B","#F7DC6F","#2ECC71","#E67E22","#E91E63"];

const uploadLogo = async (file) => {
  const ext  = file.name.split(".").pop();
  const fname = `${Date.now()}.${ext}`;
  const res = await fetch(`${SUPA_URL}/storage/v1/object/logos/${fname}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": file.type },
    body: file
  });
  if (!res.ok) throw new Error("Error al subir logo");
  return `${SUPA_URL}/storage/v1/object/public/logos/${fname}`;
};

const LogoPicker = ({ value, onChange, uploading }) => {
  const ref = useRef();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, marginTop:4 }}>
      {/* Preview */}
      <div
        onClick={() => ref.current?.click()}
        style={{
          width:64, height:64, borderRadius:12, border:`2px dashed ${value ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.2)"}`,
          background:"rgba(10,20,40,0.6)", display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", overflow:"hidden", flexShrink:0, transition:"border-color 0.2s"
        }}
        title="Haz clic para seleccionar imagen"
      >
        {value
          ? <img src={value} alt="logo" style={{ width:"100%", height:"100%", objectFit:"contain" }}/>
          : <span style={{ fontSize:24, opacity:0.4 }}>🖼️</span>
        }
      </div>
      <div>
        <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={onChange}/>
        <Btn small outline color={C.accent} onClick={() => ref.current?.click()} disabled={uploading}>
          {uploading ? "Subiendo…" : value ? "Cambiar logo" : "Subir logo"}
        </Btn>
        {value && (
          <div style={{ fontSize:11, color:C.muted, marginTop:5 }}>Logo cargado ✓</div>
        )}
        <div style={{ fontSize:11, color:C.dim, marginTop:value ? 2 : 5 }}>PNG, JPG o SVG recomendado</div>
      </div>
    </div>
  );
};

export function Nutriologos({ setMsg }) {
  const [nutriologos, setNutriologos]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showInvite, setShowInvite]         = useState(false);
  const [showEdit, setShowEdit]             = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [searchNutris, setSearchNutris]     = useState("");
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [form, setForm] = useState({ nombre:"", email:"", nombre_marca:"", color_primario:"#56CCF2", logo_url:"" });
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getNutriologos(); setNutriologos(r); } catch{}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Upload handlers ──
  const handleLogoChange = async (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setter(p => ({ ...p, logo_url: url }));
      setMsg("✅ Logo cargado");
    } catch(err) { setMsg("❌ " + err.message); }
    setUploadingLogo(false);
  };

  const invite = async () => {
    if (!form.email || !form.nombre) { setMsg("⚠️ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      await authInvite(form.email, {
        role: "nutriologo",
        nombre: form.nombre,
        nombre_marca: form.nombre_marca || form.nombre,
        color_primario: form.color_primario,
        logo_url: form.logo_url || ""
      });
      setMsg("✅ Invitación enviada — el nutriólogo recibirá un email para crear su contraseña");
      setShowInvite(false);
      setForm({ nombre:"", email:"", nombre_marca:"", color_primario:"#56CCF2", logo_url:"" });
      setTimeout(load, 2000);
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

  const toggleActivo = async (n) => {
    try {
      const newState = n.activo === false ? true : false;
      await updateProfile(n.id, { activo: newState });
      setMsg(`✅ Nutriólogo ${newState ? "activado" : "suspendido"}`);
      await load();
    } catch(e) { setMsg("❌ Error: " + e.message); }
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
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input
            value={searchNutris}
            onChange={e=>setSearchNutris(e.target.value)}
            placeholder="🔍 Buscar nutriólogo…"
            style={{
              background:"rgba(7,16,29,0.7)",
              border:`1px solid ${C.border}`,
              borderRadius:9, padding:"8px 14px",
              color:C.text, fontSize:13,
              fontFamily:"'Inter',sans-serif",
              outline:"none", width:200
            }}
          />
          <Btn grad onClick={() => setShowInvite(true)}>+ Invitar nutriólogo</Btn>
        </div>
      </div>

      {/* Lista */}
      {(() => {
        const filteredNutriologos = nutriologos.filter(n =>
          n.nombre?.toLowerCase().includes(searchNutris.toLowerCase()) ||
          n.email?.toLowerCase().includes(searchNutris.toLowerCase())
        );

        if (loading) return (
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
        );

        if (filteredNutriologos.length === 0 && searchNutris) return (
          <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>🔍</div>
            <div style={{ fontSize:15, fontWeight:600, color:C.muted }}>Sin resultados para "{searchNutris}"</div>
          </div>
        );

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filteredNutriologos.map((n, i) => (
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
              <div style={{ paddingLeft:12, display:"flex", alignItems:"center", gap:14 }}>
                {/* Logo thumbnail */}
                <div style={{
                  width:44, height:44, borderRadius:10, overflow:"hidden",
                  background:"rgba(10,20,40,0.7)", border:`1px solid ${C.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
                }}>
                  {n.logo_url
                    ? <img src={n.logo_url} alt="logo" style={{ width:"100%", height:"100%", objectFit:"contain" }}/>
                    : <span style={{ fontSize:20, opacity:0.35 }}>🖼️</span>
                  }
                </div>
                <div>
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
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <Tag color={n.activo !== false ? C.accent : "#f87171"} size="md">
                  {n.activo !== false ? "● Activo" : "○ Suspendido"}
                </Tag>
                <Btn small outline color={C.accentMid} onClick={() => {
                  setShowEdit(n);
                  setEditForm({ nombre:n.nombre||"", nombre_marca:n.nombre_marca||"", color_primario:n.color_primario||"#56CCF2", email:n.email||"", logo_url:n.logo_url||"" });
                }}>
                  Editar marca
                </Btn>
                <Btn small outline color={n.activo !== false ? "#ef4444" : C.accent} onClick={() => toggleActivo(n)}>
                  {n.activo !== false ? "Suspender" : "Activar"}
                </Btn>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Modal Invitar */}
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
          <Field label="Logo de marca (opcional)" hint="Aparecerá en el panel del nutriólogo y en el panel de sus clientes">
            <LogoPicker
              value={form.logo_url}
              onChange={e => handleLogoChange(e, setForm)}
              uploading={uploadingLogo}
            />
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
          <div style={{ background:`color-mix(in srgb, ${C.accentDeep} 19%, transparent)`, border:`1px solid color-mix(in srgb, ${C.accent} 15%, transparent)`, borderRadius:10, padding:"11px 14px", fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
            📧 El nutriólogo recibirá un email para crear su contraseña. Su panel ya estará configurado con su branding.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowInvite(false)}>Cancelar</Btn>
            <Btn grad onClick={invite} disabled={saving || uploadingLogo}>{saving ? "Enviando…" : "Invitar"}</Btn>
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
          <Field label="Logo de marca" hint="Aparecerá en el panel del nutriólogo y en el panel de sus clientes">
            <LogoPicker
              value={editForm.logo_url}
              onChange={e => handleLogoChange(e, setEditForm)}
              uploading={uploadingLogo}
            />
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
            <Btn grad onClick={saveEdit} disabled={saving || uploadingLogo}>{saving ? "Guardando…" : "Guardar cambios"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
