import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field } from "../ui";
import { dbGet, dbPost, dbDel } from "../../lib/supabase";

const METRIC_GROUPS = [
  { label:"Básicas", icon:"⚖️", fields:[
    { key:"peso",           label:"Peso (kg)",        type:"number", step:"0.1" },
    { key:"estatura",       label:"Estatura (cm)",    type:"number" },
    { key:"imc",            label:"IMC",              type:"number", step:"0.01", readOnly:true },
  ]},
  { label:"Composición corporal", icon:"🔬", fields:[
    { key:"grasa_pct",   label:"Grasa (%)",    type:"number", step:"0.1" },
    { key:"musculo_pct", label:"Músculo (%)",  type:"number", step:"0.1" },
    { key:"agua_pct",    label:"Agua (%)",     type:"number", step:"0.1" },
    { key:"grasa_kg",    label:"Grasa (kg)",   type:"number", step:"0.1" },
    { key:"musculo_kg",  label:"Músculo (kg)", type:"number", step:"0.1" },
  ]},
  { label:"Circunferencias (cm)", icon:"📏", fields:[
    { key:"cintura", label:"Cintura", type:"number", step:"0.1" },
    { key:"cadera",  label:"Cadera",  type:"number", step:"0.1" },
    { key:"pecho",   label:"Pecho",   type:"number", step:"0.1" },
    { key:"brazo",   label:"Brazo",   type:"number", step:"0.1" },
    { key:"muslo",   label:"Muslo",   type:"number", step:"0.1" },
  ]},
  { label:"Clínicos", icon:"🩺", fields:[
    { key:"glucosa",          label:"Glucosa (mg/dL)",    type:"number" },
    { key:"colesterol",       label:"Colesterol (mg/dL)", type:"number" },
    { key:"presion_arterial", label:"Presión arterial",   type:"text", placeholder:"120/80" },
  ]},
];

const emptyForm = () => ({
  fecha:new Date().toISOString().split("T")[0],
  peso:"", estatura:"", imc:"",
  grasa_pct:"", musculo_pct:"", agua_pct:"",
  grasa_kg:"", musculo_kg:"",
  cintura:"", cadera:"", pecho:"", brazo:"", muslo:"",
  glucosa:"", colesterol:"", presion_arterial:"", notas:"",
});

const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { year:"numeric", month:"short", day:"numeric" });

export function ProgresoCliente({ selected, setMsg }) {
  const [metricas, setMetricas] = useState([]);
  const [rutinas,  setRutinas]  = useState([]);
  const [progreso, setProgreso] = useState({});
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [showModal,setShowModal]= useState(false);
  const [form,     setForm]     = useState(emptyForm());
  const [sub,      setSub]      = useState("evaluaciones");

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
      if ((key==="peso" || key==="estatura") && next.peso && next.estatura) {
        const h = parseFloat(next.estatura) / 100;
        next.imc = h > 0 ? (parseFloat(next.peso) / (h * h)).toFixed(2) : "";
      }
      return next;
    });
  };

  const saveMetrica = async () => {
    setSaving(true);
    try {
      const data = { cliente_id: selected.id };
      const STRING_KEYS = new Set(["fecha","presion_arterial","notas"]);
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          if (STRING_KEYS.has(k)) {
            data[k] = v;
          } else {
            const n = parseFloat(v);
            data[k] = isNaN(n) ? v : n;
          }
        }
      });
      await dbPost("metricas_progreso", data);
      setShowModal(false); setForm(emptyForm());
      setMsg("✅ Evaluación guardada"); await load();
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const deleteMetrica = async (id) => {
    await dbDel(`metricas_progreso?id=eq.${id}`);
    setMsg("🗑️ Evaluación eliminada"); await load();
  };

  const delta = (curr, prev, key) => {
    if (curr[key]==null || prev[key]==null || curr[key]==="" || prev[key]==="") return null;
    const d = parseFloat(curr[key]) - parseFloat(prev[key]);
    return d === 0 ? null : d;
  };

  const getSemanasConFecha = (rutina) => {
    const inicio = rutina.fecha_inicio ? new Date(rutina.fecha_inicio + "T12:00:00") : new Date();
    return Array.from({ length: rutina.semanas }, (_, i) => {
      const start = new Date(inicio); start.setDate(start.getDate() + i * 7);
      const end   = new Date(start);  end.setDate(end.getDate() + 6);
      const fmt = d => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      return { label:`${fmt(start)}-${fmt(end)}`, idx:i };
    });
  };

  const DISPLAY_KEYS = [
    { key:"peso",            label:"Peso",      unit:"kg",     icon:"⚖️" },
    { key:"imc",             label:"IMC",       unit:"",       icon:"📐" },
    { key:"grasa_pct",       label:"Grasa",     unit:"%",      icon:"🔴" },
    { key:"musculo_pct",     label:"Músculo",   unit:"%",      icon:"💪" },
    { key:"agua_pct",        label:"Agua",      unit:"%",      icon:"💧" },
    { key:"cintura",         label:"Cintura",   unit:"cm",     icon:"📏" },
    { key:"cadera",          label:"Cadera",    unit:"cm",     icon:"📏" },
    { key:"glucosa",         label:"Glucosa",   unit:"mg/dL",  icon:"🩺" },
    { key:"colesterol",      label:"Colesterol",unit:"mg/dL",  icon:"🩺" },
    { key:"presion_arterial",label:"Presión",   unit:"",       icon:"❤️" },
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
            <Btn small grad onClick={()=>{setForm(emptyForm());setShowModal(true);}}>+ Nueva evaluación</Btn>
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
                  <Btn small danger onClick={()=>deleteMetrica(m.id)}>Borrar</Btn>
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
                {m.notas&&<div style={{fontSize:12,color:C.muted,background:C.bg,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`}}>📝 {m.notas}</div>}
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
                            <><th key={`p${i}`} style={{background:C.surfaceAlt,color:C.muted,padding:"4px 6px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10}}>Peso</th>
                              <th key={`r${i}`} style={{background:C.surfaceAlt,color:C.muted,padding:"4px 6px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10}}>Reps</th></>
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
                              return (<>
                                <td key={`p${wi}`} style={{padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",background:pVal?`${C.accentDeep}40`:"transparent"}}>
                                  <span style={{fontSize:11,color:pVal?C.accent:C.dim,fontWeight:pVal?700:400}}>{pVal||"—"}</span>
                                </td>
                                <td key={`r${wi}`} style={{padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",background:rVal?`${C.accentDeep}25`:"transparent"}}>
                                  <span style={{fontSize:11,color:rVal?C.accentMid:C.dim,fontWeight:rVal?700:400}}>{rVal||"—"}</span>
                                </td>
                              </>);
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
        <Modal title="Nueva evaluación corporal" onClose={()=>setShowModal(false)} wide>
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
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn outline color={C.muted} onClick={()=>setShowModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveMetrica} disabled={saving}>{saving?"Guardando…":"Guardar evaluación"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
