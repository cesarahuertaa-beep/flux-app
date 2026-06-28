import { useState, useEffect, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { C } from "../../styles/theme";
import { Btn, Modal, Field } from "../ui";
import { dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { generateProgresoPDF } from "../../utils/pdf";
import { parseFotos, getSemanasConFecha } from "../../utils/helpers";

const METRIC_GROUPS = [
  { label:"Básicas", icon:"⚖️", fields:[
    { key:"peso",      label:"Peso (kg)",     type:"number", step:"0.1" },
    { key:"estatura",  label:"Estatura (cm)", type:"number" },
    { key:"imc",       label:"IMC",           type:"number", step:"0.01", readOnly:true },
  ]},
  { label:"Composición corporal", icon:"🔬", fields:[
    { key:"grasa_pct",   label:"Grasa (%)",   type:"number", step:"0.1" },
    { key:"musculo_pct", label:"Músculo (%)", type:"number", step:"0.1" },
  ]},
  { label:"Circunferencias (cm)", icon:"📏", fields:[
    { key:"cintura", label:"Cintura",  type:"number", step:"0.1" },
    { key:"cadera",  label:"Cadera",   type:"number", step:"0.1" },
    { key:"icc",     label:"ICC",      type:"number", step:"0.001", readOnly:true },
    { key:"pecho",   label:"Pecho",    type:"number", step:"0.1" },
    { key:"brazo",   label:"Brazo",    type:"number", step:"0.1" },
    { key:"muslo",   label:"Muslo",    type:"number", step:"0.1" },
  ]},
  { label:"Clínicos", icon:"🩺", fields:[
    { key:"glucosa",          label:"Glucosa (mg/dL)",  type:"number" },
    { key:"presion_arterial", label:"Presión arterial", type:"text", placeholder:"120/80" },
  ]},
];

const emptyForm = () => ({
  fecha: new Date().toISOString().split("T")[0],
  peso:"", estatura:"", imc:"",
  grasa_pct:"", musculo_pct:"",
  cintura:"", cadera:"", icc:"", pecho:"", brazo:"", muslo:"",
  glucosa:"", presion_arterial:"", notas:"",
});

const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { year:"numeric", month:"short", day:"numeric" });



export function ProgresoCliente({ selected, setMsg }) {
  const [metricas,     setMetricas]     = useState([]);
  const [rutinas,      setRutinas]      = useState([]);
  const [progreso,     setProgreso]     = useState({});
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState(emptyForm());
  const [sub,          setSub]          = useState("evaluaciones");
  const [pendingFotos, setPendingFotos] = useState([]);   // File objects
  const [previewUrls,  setPreviewUrls]  = useState([]);   // object URLs
  const [lightbox,     setLightbox]     = useState(null); // URL shown fullscreen
  const [editingId,    setEditingId]    = useState(null); // null=new, ID=editing
  const [existingFotos,setExistingFotos]= useState([]);   // fotos ya guardadas al editar
  const brand = useBrand();

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const ms = await dbGet(`metricas_progreso?cliente_id=eq.${selected.id}&order=fecha.desc`);
      setMetricas(ms);
      const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&order=orden.asc`);
      const rsFull = await Promise.all(rs.map(async r => ({
        ...r, ejercicios: await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`)
      })));
      setRutinas(rsFull);
      const allIds = rsFull.flatMap(r => r.ejercicios.map(e => e.id));
      if (allIds.length) {
        const ps = await dbGet(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allIds.join(",")})`);
        const pm = {};
        ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}`] = p.valor; });
        setProgreso(pm);
      }
    } catch(e) { setMsg("❌ " + e.message); }
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const updForm = (key, val) => {
    setForm(p => {
      const next = { ...p, [key]: val };
      // Auto-calcular IMC
      if ((key==="peso" || key==="estatura") && next.peso && next.estatura) {
        const h = parseFloat(next.estatura) / 100;
        next.imc = h > 0 ? (parseFloat(next.peso) / (h * h)).toFixed(2) : "";
      }
      // Auto-calcular ICC (cintura ÷ cadera)
      if ((key==="cintura" || key==="cadera") && next.cintura && next.cadera) {
        const icc = parseFloat(next.cintura) / parseFloat(next.cadera);
        next.icc = icc > 0 ? icc.toFixed(2) : "";
      }
      return next;
    });
  };

  const handleFotos = (e) => {
    const files = Array.from(e.target.files);
    setPendingFotos(prev => [...prev, ...files]);
    setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removePendingFoto = (idx) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setPendingFotos(prev => prev.filter((_,i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_,i) => i !== idx));
  };

  const saveMetrica = async () => {
    setSaving(true);
    try {
      const data = {};
      if (!editingId) data.cliente_id = selected.id;
      const STRING_KEYS = new Set(["fecha","presion_arterial","notas"]);
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          if (STRING_KEYS.has(k)) { data[k] = v; }
          else { const n = parseFloat(v); data[k] = isNaN(n) ? v : n; }
        }
      });
      // Upload new photos
      const uploadedUrls = [];
      for (const file of pendingFotos) {
        const path = `${selected.id}/${Date.now()}_${file.name.replace(/\s+/g,"_")}`;
        const url = await storageUpload("progress-photos", path, file);
        uploadedUrls.push(url);
      }
      // Merge existing + new photos
      const allFotos = [...existingFotos, ...uploadedUrls];
      if (allFotos.length) data.fotos = allFotos;

      if (editingId) {
        await dbPatch(`metricas_progreso?id=eq.${editingId}`, data);
        setMsg("✅ Evaluación actualizada");
      } else {
        await dbPost("metricas_progreso", data);
        setMsg("✅ Evaluación guardada");
      }
      closeModal();
      await load();
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const closeModal = () => {
    setShowModal(false); setForm(emptyForm());
    setPendingFotos([]); setPreviewUrls([]);
    setEditingId(null); setExistingFotos([]);
  };

  const startEdit = (m) => {
    const filled = emptyForm();
    Object.keys(filled).forEach(k => {
      if (m[k] !== null && m[k] !== undefined && m[k] !== "") filled[k] = String(m[k]);
    });
    setForm(filled);
    setEditingId(m.id);
    setExistingFotos(parseFotos(m.fotos));
    setPendingFotos([]); setPreviewUrls([]);
    setShowModal(true);
  };

  const deleteFoto = async (metrica, fotoUrl) => {
    const newFotos = parseFotos(metrica.fotos).filter(u => u !== fotoUrl);
    await dbPatch(`metricas_progreso?id=eq.${metrica.id}`, { fotos: newFotos });
    await load();
  };

  const deleteMetrica = async (id) => {
    if (!confirm("¿Eliminar esta evaluación? Esta acción no se puede deshacer.")) return;
    await dbDel(`metricas_progreso?id=eq.${id}`);
    setMsg("🗑️ Evaluación eliminada"); await load();
  };

  const delta = (curr, prev, key) => {
    if (curr[key]==null || prev[key]==null || curr[key]==="" || prev[key]==="") return null;
    const d = parseFloat(curr[key]) - parseFloat(prev[key]);
    return d === 0 ? null : d;
  };



  const DISPLAY_KEYS = [
    { key:"peso",            label:"Peso",      unit:"kg",    icon:"⚖️" },
    { key:"imc",             label:"IMC",        unit:"",      icon:"📐" },
    { key:"grasa_pct",       label:"Grasa",      unit:"%",     icon:"🔴" },
    { key:"musculo_pct",     label:"Músculo",    unit:"%",     icon:"💪" },
    { key:"cintura",         label:"Cintura",    unit:"cm",    icon:"📏" },
    { key:"cadera",          label:"Cadera",     unit:"cm",    icon:"📏" },
    { key:"icc",             label:"ICC",         unit:"",      icon:"⚖️" },
    { key:"pecho",           label:"Pecho",      unit:"cm",    icon:"📏" },
    { key:"brazo",           label:"Brazo",      unit:"cm",    icon:"📏" },
    { key:"muslo",           label:"Muslo",      unit:"cm",    icon:"📏" },
    { key:"glucosa",         label:"Glucosa",    unit:"mg/dL", icon:"🩺" },
    { key:"presion_arterial",label:"Presión",    unit:"",       icon:"❤️" },
  ];

  if (loading) return <div style={{color:C.muted,textAlign:"center",padding:40}}>Cargando…</div>;

  return (
    <div>
      {/* Sub-nav */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["evaluaciones","📊","Evaluaciones"],["rutinas","🏋️","Rutinas del cliente"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setSub(k)} style={{
            padding:"8px 20px",borderRadius:20,
            background:sub===k?C.gradBtn:C.card,
            color:sub===k?"#000":C.muted,
            fontWeight:sub===k?700:400,fontSize:13,
            border:`1px solid ${sub===k?C.accent:C.border}`,cursor:"pointer"
          }}>{ic} {lb}</button>
        ))}
      </div>

      {/* ── EVALUACIONES ── */}
      {sub==="evaluaciones"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontWeight:600}}>Evaluaciones corporales <span style={{color:C.muted,fontWeight:400}}>({metricas.length})</span></span>
            <div style={{display:"flex",gap:8}}>
              <Btn small grad onClick={()=>{setForm(emptyForm());setShowModal(true);}}>+ Nueva evaluación</Btn>
            </div>
          </div>
          {metricas.length===0?(
            <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>📊</div>
              <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:6}}>Sin evaluaciones aún</div>
              <div style={{fontSize:13}}>Registra la primera evaluación corporal del cliente.</div>
            </div>
          ):metricas.map((m,idx)=>{
            const prev = metricas[idx+1];
            return (
              <div key={m.id} style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:16,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div>
                    <span style={{fontWeight:700,color:C.accent,fontSize:15}}>📅 {fmtDate(m.fecha)}</span>
                    {idx===0&&<span style={{marginLeft:8,background:C.accentDeep+"50",color:C.accent,fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:600}}>Más reciente</span>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <Btn small outline color={C.accentMid} onClick={()=>startEdit(m)}>✏️ Editar</Btn>
                    <Btn small danger onClick={()=>deleteMetrica(m.id)}>Borrar</Btn>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:m.notas?12:0}}>
                  {DISPLAY_KEYS.filter(f=>m[f.key]!==null&&m[f.key]!==undefined&&m[f.key]!=="").map(f=>{
                    const d = prev ? delta(m,prev,f.key) : null;
                    return (
                      <div key={f.key} style={{background:C.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{f.icon} {f.label}</div>
                        <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:"'Rajdhani',sans-serif"}}>
                          {m[f.key]}{f.unit&&<span style={{fontSize:11,fontWeight:400,color:C.muted}}> {f.unit}</span>}
                        </div>
                        {d!==null&&(
                          <div style={{fontSize:11,color:d<0?"#4ade80":"#f87171",marginTop:2,fontWeight:600}}>
                            {d>0?"↑":"↓"} {Math.abs(d).toFixed(1)}{f.unit}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {m.notas&&<div style={{fontSize:12,color:C.muted,background:C.bg,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,marginTop:10}}>📝 {m.notas}</div>}
                {/* Fotos de progreso */}
                {parseFotos(m.fotos).length>0&&(
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>📸 Fotos ({parseFotos(m.fotos).length})</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {parseFotos(m.fotos).map((url,fi)=>(
                        <div key={fi} style={{position:"relative",width:80,height:80}}>
                          <img src={url} onClick={()=>setLightbox(url)}
                            style={{width:80,height:80,objectFit:"cover",borderRadius:10,cursor:"zoom-in",border:`2px solid ${C.border}`}}
                            alt={`foto ${fi+1}`}/>
                          <button onClick={()=>deleteFoto(m,url)} style={{
                            position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",
                            borderRadius:"50%",width:18,height:18,fontSize:11,lineHeight:"18px",
                            textAlign:"center",cursor:"pointer",border:"none",fontWeight:700
                          }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── RUTINAS DEL CLIENTE ── */}
      {sub==="rutinas"&&(
        <div>
          {rutinas.length===0?(
            <div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>🏋️</div>
              <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:6}}>Sin rutinas asignadas</div>
            </div>
          ):rutinas.map(r=>{
            const semanas = getSemanasConFecha(r);
            const tieneData = r.ejercicios.some(ej=>semanas.some((_,wi)=>Array.from({length:ej.num_series||4},(_,si)=>progreso[`${ej.id}-${wi}-${si}-peso`]||progreso[`${ej.id}-${wi}-${si}-reps`]).some(Boolean)));
            return (
              <div key={r.id} style={{marginBottom:24}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:10,color:C.accent,display:"flex",alignItems:"center",gap:8}}>
                  🏋️ {r.nombre}
                  {!tieneData&&<span style={{fontSize:11,color:C.muted,fontWeight:400}}>Sin registros aún</span>}
                </div>
                {tieneData&&(
                  <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${C.border}`}}>
                    <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%",background:C.card}}>
                      <thead>
                        <tr>
                          <th style={{background:C.faint,color:C.text,padding:"8px 12px",border:`1px solid ${C.border}`,textAlign:"left",minWidth:120}}>Ejercicio</th>
                          <th style={{background:C.faint,color:C.text,padding:"8px 8px",border:`1px solid ${C.border}`,textAlign:"center",minWidth:40}}>Serie</th>
                          {semanas.map((s,i)=>(
                            <th key={i} colSpan={2} style={{background:C.faint,color:C.accent,padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10,whiteSpace:"nowrap"}}>{s.label}</th>
                          ))}
                        </tr>
                        <tr>
                          <th colSpan={2} style={{background:C.surfaceAlt,border:`1px solid ${C.border}`}}/>
                          {semanas.map((_,i)=>(
                            <Fragment key={`h${i}`}><th key={`p${i}`} style={{background:C.surfaceAlt,color:C.muted,padding:"4px 6px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10}}>Peso</th>
                              <th key={`r${i}`} style={{background:C.surfaceAlt,color:C.muted,padding:"4px 6px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10}}>Reps</th></Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.ejercicios.map((ej,eji)=>Array.from({length:ej.num_series||4},(_,si)=>(
                          <tr key={`${ej.id}-${si}`} style={{background:eji%2===0?C.card:C.surfaceAlt}}>
                            {si===0&&<td rowSpan={ej.num_series||4} style={{padding:"8px 12px",border:`1px solid ${C.border}`,fontWeight:600,verticalAlign:"middle"}}>
                              {ej.nombre}<div style={{fontSize:10,color:C.muted,fontWeight:400,marginTop:2}}>{ej.grupo_muscular}</div>
                            </td>}
                            <td style={{padding:"6px 8px",border:`1px solid ${C.border}`,textAlign:"center",color:C.accent,fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>{si+1}</td>
                            {semanas.map((_,wi)=>{
                              const pVal=progreso[`${ej.id}-${wi}-${si}-peso`]||"";
                              const rVal=progreso[`${ej.id}-${wi}-${si}-reps`]||"";
                              return (<Fragment key={`w${wi}`}>
                                <td key={`p${wi}`} style={{padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",background:pVal?`${C.accentDeep}40`:"transparent"}}>
                                  <span style={{fontSize:11,color:pVal?C.accent:C.dim,fontWeight:pVal?700:400}}>{pVal||"—"}</span>
                                </td>
                                <td key={`r${wi}`} style={{padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",background:rVal?`${C.accentDeep}25`:"transparent"}}>
                                  <span style={{fontSize:11,color:rVal?C.accentMid:C.dim,fontWeight:rVal?700:400}}>{rVal||"—"}</span>
                                </td>
                              </Fragment>);
                            })}
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL NUEVA EVALUACIÓN ── */}
      {showModal&&(
        <Modal title={editingId ? "Editar evaluación" : "Nueva evaluación corporal"} onClose={closeModal} wide>
          <Field label="Fecha de evaluación">
            <input type="date" value={form.fecha} onChange={e=>updForm("fecha",e.target.value)}/>
          </Field>
          {METRIC_GROUPS.map(group=>(
            <div key={group.label} style={{marginBottom:18}}>
              <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>
                {group.icon} {group.label}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                {group.fields.map(f=>(
                  <Field key={f.key} label={f.label}>
                    <input
                      type={f.type} step={f.step||"any"}
                      value={form[f.key]}
                      readOnly={!!f.readOnly}
                      placeholder={f.readOnly?"Auto":(f.placeholder||"")}
                      style={f.readOnly?{opacity:0.6,cursor:"not-allowed"}:{}}
                      onChange={e=>!f.readOnly&&updForm(f.key,e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
          <Field label="Notas">
            <textarea value={form.notas} onChange={e=>updForm("notas",e.target.value)} placeholder="Observaciones del nutriólogo…"/>
          </Field>

          {/* Fotos existentes cuando se edita */}
          {editingId && existingFotos.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>📸 Fotos actuales</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {existingFotos.map((url,i) => (
                  <div key={i} style={{position:"relative",width:72,height:72}}>
                    <img src={url} onClick={()=>setLightbox(url)} style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:`2px solid ${C.border}`,cursor:"zoom-in"}} alt=""/>
                    <button onClick={()=>setExistingFotos(prev=>prev.filter((_,j)=>j!==i))} style={{position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:11,lineHeight:"18px",textAlign:"center",cursor:"pointer",border:"none",fontWeight:700}}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Foto upload */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>📸 {editingId ? "Agregar más fotos" : "Fotos de progreso"}</div>
            <label style={{display:"inline-flex",alignItems:"center",gap:8,background:C.card,border:`1px dashed ${C.accent}`,borderRadius:10,padding:"10px 16px",cursor:"pointer",fontSize:13,color:C.accent,fontWeight:600}}>
              + Agregar fotos
              <input type="file" accept="image/*" multiple onChange={handleFotos} style={{display:"none"}}/>
            </label>
            {previewUrls.length>0&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                {previewUrls.map((url,i)=>(
                  <div key={i} style={{position:"relative",width:72,height:72}}>
                    <img src={url} style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:`2px solid ${C.accent}`}} alt=""/>
                    <button onClick={()=>removePendingFoto(i)} style={{
                      position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",
                      borderRadius:"50%",width:18,height:18,fontSize:11,lineHeight:"18px",
                      textAlign:"center",cursor:"pointer",border:"none",fontWeight:700
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn outline color={C.muted} onClick={closeModal}>Cancelar</Btn>
            <Btn grad onClick={saveMetrica} disabled={saving}>{saving?"Subiendo…":editingId?"Guardar cambios":"Guardar evaluación"}</Btn>
          </div>
        </Modal>
      )}
      {/* Lightbox */}
      {lightbox&&createPortal(
        <div onClick={()=>setLightbox(null)} style={{
          position:"fixed",top:0,left:0,width:"100%",height:"100%",
          background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",
          justifyContent:"center",zIndex:9999,cursor:"zoom-out"
        }}>
          <img src={lightbox} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:14,objectFit:"contain",boxShadow:"0 24px 80px rgba(0,0,0,0.8)"}} alt=""/>
          <div style={{position:"absolute",top:20,right:24,color:"#fff",fontSize:28,cursor:"pointer",fontWeight:700}} onClick={()=>setLightbox(null)}>✕</div>
        </div>,
        document.body
      )}

      {/* ── FAB PARA PDF ── */}
      {sub === "evaluaciones" && metricas.length > 0 && (
        <div style={{
          position: "fixed", bottom: 32, right: 24, zIndex: 50,
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <button
            onClick={() => generateProgresoPDF(selected, metricas, brand)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 22px", borderRadius: 30, border: "none", cursor: "pointer",
              background: C.gradBtn, color: "#000", fontWeight: 700, fontSize: 14,
              boxShadow: "0 8px 24px rgba(46,92,184,0.4)", fontFamily: "'Inter', sans-serif",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(46,92,184,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(46,92,184,0.4)"; }}
          >
            <span style={{ fontSize: 18 }}>📄</span>
            Descargar Reporte PDF
          </button>
        </div>
      )}

    </div>
  );
}
