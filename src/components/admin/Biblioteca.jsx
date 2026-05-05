import { useState } from "react";
import { C, GRUPOS, TIPOS } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { dbGet, dbPost, dbPatch, dbDel } from "../../lib/supabase";

export function Biblioteca({ biblioteca, onUpdate, setMsg }) {
  const [showModal, setShowModal] = useState(false);
  const [editEj, setEditEj] = useState(null);
  const [form, setForm] = useState({ nombre:"", grupo_muscular:"Pecho", tipo_movimiento:"Empuje", gif_url:"" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [preview, setPreview] = useState(null);

  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const openNew = () => { setEditEj(null); setForm({ nombre:"", grupo_muscular:"Pecho", tipo_movimiento:"Empuje", gif_url:"" }); setShowModal(true); };
  const openEdit = (e) => { setEditEj(e); setForm({ nombre:e.nombre, grupo_muscular:e.grupo_muscular, tipo_movimiento:e.tipo_movimiento, gif_url:e.gif_url||"" }); setShowModal(true); };

  const uploadGif = async (file) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `${Date.now()}.${ext}`;
      const res = await fetch(`${SUPA_URL}/storage/v1/object/ejercicios/${fname}`, {
        method:"POST", headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":file.type }, body:file
      });
      if (!res.ok) throw new Error("Error al subir archivo");
      setForm(p => ({ ...p, gif_url:`${SUPA_URL}/storage/v1/object/public/ejercicios/${fname}` }));
      setMsg("✅ Archivo subido");
    } catch(e) { setMsg("❌ "+e.message); }
    setUploading(false);
  };

  const save = async () => {
    if (!form.nombre) { setMsg("⚠️ Escribe el nombre"); return; }
    setSaving(true);
    try {
      if (editEj) await dbPatch(`biblioteca_ejercicios?id=eq.${editEj.id}`, form);
      else await dbPost("biblioteca_ejercicios", form);
      setShowModal(false); setMsg("✅ Ejercicio guardado"); onUpdate();
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const deleteEj = async (e) => { await dbDel(`biblioteca_ejercicios?id=eq.${e.id}`); setMsg("🗑️ Ejercicio eliminado"); onUpdate(); };

  const filtrados = biblioteca.filter(e => {
    const matchG = filtroGrupo==="Todos" || e.grupo_muscular===filtroGrupo;
    const matchT = filtroTipo==="Todos" || e.tipo_movimiento===filtroTipo;
    const matchB = e.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchG && matchT && matchB;
  });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontWeight:700,fontSize:18}}>Biblioteca <span style={{fontSize:13,color:C.muted,fontWeight:400}}>({biblioteca.length} ejercicios)</span></span>
        <Btn small grad onClick={openNew}>+ Nuevo ejercicio</Btn>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍 Buscar ejercicio…" style={{maxWidth:200,padding:"7px 12px"}}/>
        <select value={filtroGrupo} onChange={e=>setFiltroGrupo(e.target.value)} style={{maxWidth:150}}>
          <option>Todos</option>{GRUPOS.map(g=><option key={g}>{g}</option>)}
        </select>
        <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={{maxWidth:160}}>
          <option>Todos</option>{TIPOS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {filtrados.length===0
        ?<div style={{color:C.muted,textAlign:"center",padding:40}}>No hay ejercicios que coincidan.</div>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {filtrados.map(e=>(
            <div key={e.id} style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}>
              <div onClick={()=>e.gif_url&&setPreview(e)} style={{height:120,background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",cursor:e.gif_url?"pointer":"default",overflow:"hidden"}}>
                {e.gif_url?<img src={e.gif_url} alt={e.nombre} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:32}}>🏋️</span>}
              </div>
              <div style={{padding:"10px 12px"}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{e.nombre}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                  <Tag color={C.accent}>{e.grupo_muscular}</Tag>
                  <Tag color={C.accentDark}>{e.tipo_movimiento}</Tag>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small outline color={C.accent} onClick={()=>openEdit(e)}>Editar</Btn>
                  <Btn small danger onClick={()=>deleteEj(e)}>Borrar</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>}

      {showModal&&(
        <Modal title={editEj?"Editar ejercicio":"Nuevo ejercicio"} onClose={()=>setShowModal(false)}>
          <Field label="Nombre del ejercicio"><input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Press de banca inclinado"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Grupo muscular">
              <select value={form.grupo_muscular} onChange={e=>setForm(p=>({...p,grupo_muscular:e.target.value}))}>
                {GRUPOS.map(g=><option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Tipo de movimiento">
              <select value={form.tipo_movimiento} onChange={e=>setForm(p=>({...p,tipo_movimiento:e.target.value}))}>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="GIF / Video del ejercicio">
            <div style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:16,textAlign:"center"}}>
              {form.gif_url
                ?<div>
                  <img src={form.gif_url} alt="preview" style={{maxHeight:140,borderRadius:8,marginBottom:8}}/>
                  <div><Btn small outline color={C.muted} onClick={()=>setForm(p=>({...p,gif_url:""}))}>Cambiar</Btn></div>
                </div>
                :<div>
                  <div style={{fontSize:32,marginBottom:8}}>🎬</div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:10}}>Sube un GIF o video MP4</div>
                  <input id="gif-upload" type="file" accept="image/gif,video/mp4,image/png,image/jpg,image/jpeg" style={{display:"none"}} onChange={e=>e.target.files[0]&&uploadGif(e.target.files[0])}/>
                  <label htmlFor="gif-upload" style={{display:"inline-block",padding:"6px 14px",background:C.gradBtn,borderRadius:8,fontWeight:700,fontSize:12,color:"#000",cursor:"pointer"}}>
                    {uploading?"Subiendo…":"Seleccionar archivo"}
                  </label>
                </div>}
            </div>
          </Field>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn outline color={C.muted} onClick={()=>setShowModal(false)}>Cancelar</Btn>
            <Btn grad onClick={save} disabled={saving||uploading}>{saving?"Guardando…":"Guardar"}</Btn>
          </div>
        </Modal>
      )}

      {preview&&(
        <div onClick={()=>setPreview(null)} style={{position:"fixed",inset:0,background:"#000d",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:16,padding:20,maxWidth:400,width:"90%",textAlign:"center"}}>
            <img src={preview.gif_url} alt={preview.nombre} style={{width:"100%",borderRadius:10,marginBottom:12}}/>
            <div style={{fontWeight:700,fontSize:16}}>{preview.nombre}</div>
            <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:8}}>
              <Tag color={C.accent}>{preview.grupo_muscular}</Tag>
              <Tag color={C.accentDark}>{preview.tipo_movimiento}</Tag>
            </div>
            <div style={{marginTop:14,fontSize:12,color:C.muted}}>Toca para cerrar</div>
          </div>
        </div>
      )}
    </div>
  );
}
