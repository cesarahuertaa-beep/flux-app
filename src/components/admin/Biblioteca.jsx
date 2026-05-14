import { useState } from "react";
import { C, GRUPOS, TIPOS } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";

export function Biblioteca({ biblioteca, onUpdate, setMsg, isSuperadmin }) {
  const [showModal, setShowModal] = useState(false);
  const [editEj, setEditEj]       = useState(null);
  const [form, setForm]           = useState({ nombre:"", grupo_muscular:"Pecho", tipo_movimiento:"Empuje", gif_url:"" });
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");
  const [filtroTipo, setFiltroTipo]   = useState("Todos");
  const [busqueda, setBusqueda]   = useState("");
  const [preview, setPreview]     = useState(null);

  const uploadGif = async (file) => {
    setUploading(true);
    try {
      const ext   = file.name.split(".").pop();
      const fname = `${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file);
      setForm(p => ({ ...p, gif_url: url }));
      setMsg("✅ Archivo subido");
    } catch(e) { setMsg("❌ "+e.message); }
    setUploading(false);
  };

  const openNew  = () => { setEditEj(null); setForm({ nombre:"", grupo_muscular:"Pecho", tipo_movimiento:"Empuje", gif_url:"" }); setShowModal(true); };
  const openEdit = (e) => { setEditEj(e); setForm({ nombre:e.nombre, grupo_muscular:e.grupo_muscular, tipo_movimiento:e.tipo_movimiento, gif_url:e.gif_url||"" }); setShowModal(true); };

  const save = async () => {
    if (!form.nombre) { setMsg("⚠️ Escribe el nombre"); return; }
    setSaving(true);
    try {
      if (editEj) await dbPatch(`biblioteca_ejercicios?id=eq.${editEj.id}`, form);
      else        await dbPost("biblioteca_ejercicios", form);
      setShowModal(false); setMsg("✅ Ejercicio guardado"); onUpdate();
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const deleteEj = async (e) => {
    if (!confirm(`¿Eliminar "${e.nombre}"? Esta acción no se puede deshacer.`)) return;
    await dbDel(`biblioteca_ejercicios?id=eq.${e.id}`);
    setMsg("🗑️ Ejercicio eliminado"); onUpdate();
  };

  const filtrados = biblioteca.filter(e => {
    const matchG = filtroGrupo==="Todos" || e.grupo_muscular===filtroGrupo;
    const matchT = filtroTipo==="Todos"  || e.tipo_movimiento===filtroTipo;
    const matchB = e.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchG && matchT && matchB;
  });

  // Group accent colors by muscle group
  const groupColors = {
    Pecho:"#38bdf8", Espalda:"#818cf8", Piernas:"#34d399",
    Hombros:"#f472b6", "Bíceps":"#fb923c", "Tríceps":"#a78bfa",
    Core:"#fbbf24", Cardio:"#ef4444"
  };

  return (
    <div>
      {/* ── Header row ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:700, fontSize:24, color:"#e2eeff",
            letterSpacing:"0.3px", marginBottom:4
          }}>Biblioteca de Ejercicios</h2>
          <p style={{ fontSize:13, color:"#64748b" }}>
            {biblioteca.length} ejercicio{biblioteca.length !== 1 ? "s" : ""} en la colección global
          </p>
        </div>
        {isSuperadmin && (
          <Btn grad onClick={openNew} style={{ padding:"10px 20px" }}>
            + Nuevo ejercicio
          </Btn>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{
        display:"flex", gap:10, marginBottom:20, flexWrap:"wrap",
        padding:"14px 16px",
        background:"rgba(7,13,24,0.6)",
        borderRadius:14, border:"1px solid rgba(56,189,248,0.07)",
        backdropFilter:"blur(12px)"
      }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar ejercicio…"
          style={{
            flex:1, minWidth:160, maxWidth:220,
            background:"rgba(3,5,10,0.7)",
            color:"#e2eeff",
            border:"1px solid rgba(56,189,248,0.1)",
            borderRadius:10, padding:"8px 14px",
            fontSize:13, outline:"none",
            fontFamily:"'Inter',sans-serif"
          }}
        />
        <select
          value={filtroGrupo}
          onChange={e => setFiltroGrupo(e.target.value)}
          style={{
            background:"rgba(3,5,10,0.7)", color:"#e2eeff",
            border:"1px solid rgba(56,189,248,0.1)",
            borderRadius:10, padding:"8px 14px",
            fontSize:13, outline:"none",
            fontFamily:"'Inter',sans-serif", minWidth:130
          }}
        >
          <option>Todos</option>
          {GRUPOS.map(g => <option key={g}>{g}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          style={{
            background:"rgba(3,5,10,0.7)", color:"#e2eeff",
            border:"1px solid rgba(56,189,248,0.1)",
            borderRadius:10, padding:"8px 14px",
            fontSize:13, outline:"none",
            fontFamily:"'Inter',sans-serif", minWidth:140
          }}
        >
          <option>Todos</option>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        {(filtroGrupo !== "Todos" || filtroTipo !== "Todos" || busqueda) && (
          <button
            onClick={() => { setBusqueda(""); setFiltroGrupo("Todos"); setFiltroTipo("Todos"); }}
            style={{
              background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:10, padding:"8px 14px",
              color:"#f87171", fontSize:12, cursor:"pointer",
              fontFamily:"'Inter',sans-serif", fontWeight:600
            }}
          >✕ Limpiar</button>
        )}
      </div>

      {/* ── Grid ── */}
      {filtrados.length === 0 ? (
        <div style={{
          textAlign:"center", padding:"80px 0", color:"#475569",
          background:"rgba(7,13,24,0.4)", borderRadius:16,
          border:"1px solid rgba(56,189,248,0.05)"
        }}>
          <div style={{ fontSize:48, marginBottom:16, opacity:0.4 }}>🏋️</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:6, color:"#64748b" }}>
            {biblioteca.length === 0 ? "La biblioteca está vacía" : "No hay ejercicios que coincidan"}
          </div>
          <div style={{ fontSize:13, color:"#475569" }}>
            {biblioteca.length === 0 && isSuperadmin ? "Agrega el primer ejercicio con el botón de arriba" : "Intenta con otros filtros"}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:14 }}>
          {filtrados.map((e, i) => {
            const accentColor = groupColors[e.grupo_muscular] || "#38bdf8";
            return (
              <div
                key={e.id}
                className="ex-card animate-in"
                style={{
                  background:"linear-gradient(160deg, rgba(10,20,40,0.85), rgba(7,13,24,0.95))",
                  borderRadius:16,
                  border:`1px solid rgba(56,189,248,0.08)`,
                  overflow:"hidden",
                  position:"relative",
                  backdropFilter:"blur(12px)",
                  boxShadow:"0 4px 24px rgba(0,0,0,0.3)",
                  animationDelay:`${i * 0.04}s`
                }}
              >
                {/* Top color accent */}
                <div style={{
                  position:"absolute", top:0, left:0, right:0, height:2,
                  background:`linear-gradient(90deg, transparent, ${accentColor}80, transparent)`
                }}/>

                {/* Image area */}
                <div
                  onClick={() => e.gif_url && setPreview(e)}
                  style={{
                    height:130,
                    background:`linear-gradient(135deg, rgba(3,5,10,0.9), rgba(7,13,24,0.8))`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    cursor: e.gif_url ? "pointer" : "default",
                    overflow:"hidden", position:"relative"
                  }}
                >
                  {e.gif_url ? (
                    <>
                      <img
                        src={e.gif_url} alt={e.nombre}
                        style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.4s ease" }}
                        onMouseEnter={ev => ev.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={ev => ev.currentTarget.style.transform = "scale(1)"}
                      />
                      {/* Play overlay */}
                      <div
                        className="ex-img-overlay"
                        style={{
                          position:"absolute", inset:0,
                          background:"rgba(3,5,10,0.4)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          opacity:0, transition:"opacity 0.3s ease"
                        }}
                      >
                        <div style={{
                          width:40, height:40, borderRadius:"50%",
                          background:"rgba(56,189,248,0.9)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:16, color:"#030a14",
                          boxShadow:"0 0 20px rgba(56,189,248,0.5)"
                        }}>▶</div>
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize:40, opacity:0.2 }}>🏋️</span>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding:"12px 14px 14px" }}>
                  <div style={{
                    fontWeight:600, fontSize:13, color:"#e2eeff",
                    marginBottom:8, lineHeight:1.4,
                    fontFamily:"'Inter',sans-serif"
                  }}>{e.nombre}</div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom: isSuperadmin ? 10 : 0 }}>
                    <Tag color={accentColor}>{e.grupo_muscular}</Tag>
                    <Tag color="#818cf8">{e.tipo_movimiento}</Tag>
                  </div>
                  {isSuperadmin && (
                    <div style={{ display:"flex", gap:6, marginTop:2 }}>
                      <Btn small outline color="rgba(56,189,248,0.7)" onClick={() => openEdit(e)} style={{ flex:1 }}>
                        Editar
                      </Btn>
                      <Btn small danger onClick={() => deleteEj(e)} style={{ flex:1 }}>
                        Borrar
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <Modal title={editEj ? "✏️ Editar ejercicio" : "➕ Nuevo ejercicio"} onClose={() => setShowModal(false)}>
          <Field label="Nombre del ejercicio">
            <input value={form.nombre} onChange={e => setForm(p => ({...p,nombre:e.target.value}))} placeholder="Ej. Press de banca inclinado"/>
          </Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Grupo muscular">
              <select value={form.grupo_muscular} onChange={e => setForm(p => ({...p,grupo_muscular:e.target.value}))}>
                {GRUPOS.map(g => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Tipo de movimiento">
              <select value={form.tipo_movimiento} onChange={e => setForm(p => ({...p,tipo_movimiento:e.target.value}))}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="GIF / Video del ejercicio">
            <div style={{
              border:"1px dashed rgba(56,189,248,0.2)", borderRadius:12,
              padding:20, textAlign:"center",
              background:"rgba(7,13,24,0.6)"
            }}>
              {form.gif_url ? (
                <div>
                  <img src={form.gif_url} alt="preview" style={{ maxHeight:140, borderRadius:10, marginBottom:10 }}/>
                  <div><Btn small outline color="rgba(56,189,248,0.5)" onClick={() => setForm(p => ({...p,gif_url:""}))}>Cambiar</Btn></div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:36, marginBottom:8, opacity:0.4 }}>🎬</div>
                  <div style={{ fontSize:13, color:"#64748b", marginBottom:12 }}>Sube un GIF o video MP4</div>
                  <input
                    id="gif-upload" type="file"
                    accept="image/gif,video/mp4,image/png,image/jpg,image/jpeg"
                    style={{ display:"none" }}
                    onChange={e => e.target.files[0] && uploadGif(e.target.files[0])}
                  />
                  <label
                    htmlFor="gif-upload"
                    style={{
                      display:"inline-block", padding:"8px 18px",
                      background:"linear-gradient(135deg, #38bdf8, #0ea5e9)",
                      borderRadius:10, fontWeight:700, fontSize:12,
                      color:"#030a14", cursor:"pointer",
                      boxShadow:"0 4px 16px rgba(56,189,248,0.3)"
                    }}
                  >
                    {uploading ? "Subiendo…" : "Seleccionar archivo"}
                  </label>
                </div>
              )}
            </div>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
            <Btn outline color="rgba(100,116,139,0.7)" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn grad onClick={save} disabled={saving || uploading}>
              {saving ? "Guardando…" : "Guardar ejercicio"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* ── Preview Modal ── */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position:"fixed", inset:0,
            background:"rgba(3,5,10,0.92)",
            backdropFilter:"blur(20px)",
            zIndex:200, display:"flex",
            alignItems:"center", justifyContent:"center",
            padding:20
          }}
        >
          <div
            className="animate-in-scale"
            style={{
              background:"linear-gradient(145deg, rgba(10,20,40,0.95), rgba(7,13,24,0.98))",
              borderRadius:20, padding:24,
              maxWidth:440, width:"100%",
              textAlign:"center",
              border:"1px solid rgba(56,189,248,0.12)",
              boxShadow:"0 32px 100px rgba(0,0,0,0.7), 0 0 80px rgba(8,47,73,0.4)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={preview.gif_url} alt={preview.nombre}
              style={{ width:"100%", borderRadius:14, marginBottom:16, boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}
            />
            <div style={{ fontWeight:700, fontSize:18, color:"#e2eeff", marginBottom:8, fontFamily:"'Space Grotesk',sans-serif" }}>
              {preview.nombre}
            </div>
            <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:16 }}>
              <Tag color={groupColors[preview.grupo_muscular] || "#38bdf8"}>{preview.grupo_muscular}</Tag>
              <Tag color="#818cf8">{preview.tipo_movimiento}</Tag>
            </div>
            <button
              onClick={() => setPreview(null)}
              style={{
                background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.2)",
                borderRadius:10, padding:"8px 20px", color:"#38bdf8",
                fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontWeight:600
              }}
            >Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
