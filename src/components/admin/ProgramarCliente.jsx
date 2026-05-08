import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field } from "../ui";
import { EjercicioSelector } from "./EjercicioSelector";
import { generateNutriPDF } from "../../utils/pdf";
import { dbGet, dbPost, dbPatch, dbDel } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { ProgresoCliente } from "./ProgresoCliente";

export function ProgramarCliente({ clientes, selected, setSelected, setMsg, biblioteca }) {
  const brand = useBrand();
  const [subtab, setSubtab] = useState("nutri");
  const [nutri, setNutri] = useState(null);
  const [dias, setDias] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [macros, setMacros] = useState({ calorias:"", proteina:"", carbohidratos:"", grasas:"" });
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [editDia, setEditDia] = useState(null);
  const [diaForm, setDiaForm] = useState({ dia:"", orden:0, comidas:[] });
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editRutina, setEditRutina] = useState(null);
  const [rutinaForm, setRutinaForm] = useState({ nombre:"", semanas:8, fecha_inicio:new Date().toISOString().split("T")[0], ejercicios:[] });

  const loadData = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const ns = await dbGet(`nutricion?cliente_id=eq.${selected.id}`);
      if (ns.length) {
        setNutri(ns[0]); setMacros({ calorias:ns[0].calorias||"", proteina:ns[0].proteina||"", carbohidratos:ns[0].carbohidratos||"", grasas:ns[0].grasas||"" });
        const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&order=orden.asc`);
        setDias(await Promise.all(ds.map(async d => ({ ...d, comidas:await dbGet(`comidas?dia_id=eq.${d.id}&order=orden.asc`) }))));
      } else { setNutri(null); setMacros({ calorias:"", proteina:"", carbohidratos:"", grasas:"" }); setDias([]); }
      const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&order=orden.asc`);
      setRutinas(await Promise.all(rs.map(async r => ({ ...r, ejercicios:await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`) }))));
    } catch(e) { setMsg("❌ "+e.message); }
    setLoading(false);
  }, [selected]);
  useEffect(() => { loadData(); }, [loadData]);

  const saveMacros = async () => {
    setSaving(true);
    try {
      if (nutri) await dbPatch(`nutricion?id=eq.${nutri.id}`, { ...macros, updated_at:new Date().toISOString() });
      else { const r = await dbPost("nutricion", { cliente_id:selected.id, ...macros }); setNutri(r[0]); }
      setMsg("✅ Macros guardados");
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const openNewDia  = () => { setEditDia(null); setDiaForm({ dia:"", orden:dias.length, comidas:[{ hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }); setShowDiaModal(true); };
  const openEditDia = (d) => { setEditDia(d); setDiaForm({ dia:d.dia, orden:d.orden, comidas:d.comidas.map(c=>({...c})) }); setShowDiaModal(true); };

  const saveDia = async () => {
    if (!nutri) { setMsg("⚠️ Guarda los macros primero"); return; }
    setSaving(true);
    try {
      let diaId;
      if (editDia) { await dbPatch(`nutricion_dias?id=eq.${editDia.id}`, { dia:diaForm.dia, orden:diaForm.orden }); diaId=editDia.id; await dbDel(`comidas?dia_id=eq.${diaId}`); }
      else { const r = await dbPost("nutricion_dias", { nutricion_id:nutri.id, dia:diaForm.dia, orden:diaForm.orden }); diaId=r[0].id; }
      for (let i=0; i<diaForm.comidas.length; i++) {
        const c = diaForm.comidas[i];
        await dbPost("comidas", { ...c, dia_id:diaId, orden:i, calorias:+c.calorias||0, proteina:+c.proteina||0, carbohidratos:+c.carbohidratos||0, grasas:+c.grasas||0 });
      }
      setShowDiaModal(false); setMsg("✅ Día guardado"); await loadData();
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const deleteDia  = async (d) => { await dbDel(`nutricion_dias?id=eq.${d.id}`); setMsg("🗑️ Día eliminado"); await loadData(); };
  const addComida  = () => setDiaForm(p => ({ ...p, comidas:[...p.comidas, { hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }));
  const updComida  = (i,f,v) => setDiaForm(p => { const cs=[...p.comidas]; cs[i]={...cs[i],[f]:v}; return { ...p, comidas:cs }; });
  const remComida  = (i) => setDiaForm(p => ({ ...p, comidas:p.comidas.filter((_,x)=>x!==i) }));

  const openNewRutina  = () => { setEditRutina(null); setRutinaForm({ nombre:"", semanas:8, fecha_inicio:new Date().toISOString().split("T")[0], ejercicios:[] }); setShowRutinaModal(true); };
  const openEditRutina = (r) => { setEditRutina(r); setRutinaForm({ nombre:r.nombre, semanas:r.semanas, fecha_inicio:r.fecha_inicio||new Date().toISOString().split("T")[0], ejercicios:r.ejercicios.map(e=>({...e})) }); setShowRutinaModal(true); };

  const saveRutina = async () => {
    setSaving(true);
    try {
      let rid;
      if (editRutina) { await dbPatch(`rutinas?id=eq.${editRutina.id}`, { nombre:rutinaForm.nombre, semanas:+rutinaForm.semanas, fecha_inicio:rutinaForm.fecha_inicio }); rid=editRutina.id; await dbDel(`ejercicios?rutina_id=eq.${rid}`); }
      else { const r = await dbPost("rutinas", { cliente_id:selected.id, nombre:rutinaForm.nombre, semanas:+rutinaForm.semanas, fecha_inicio:rutinaForm.fecha_inicio, orden:rutinas.length }); rid=r[0].id; }
      for (let i=0; i<rutinaForm.ejercicios.length; i++) {
        const e = rutinaForm.ejercicios[i];
        await dbPost("ejercicios", { rutina_id:rid, biblioteca_id:e.biblioteca_id||null, nombre:e.nombre, gif_url:e.gif_url||"", grupo_muscular:e.grupo_muscular||"", tipo_movimiento:e.tipo_movimiento||"", num_series:+e.num_series||4, reps_sugeridas:+e.reps_sugeridas||10, orden:i });
      }
      setShowRutinaModal(false); setMsg("✅ Rutina guardada"); await loadData();
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const deleteRutina = async (r) => { await dbDel(`rutinas?id=eq.${r.id}`); setMsg("🗑️ Rutina eliminada"); await loadData(); };
  const addEj = (ej) => {
    if (rutinaForm.ejercicios.find(e=>e.biblioteca_id===ej.id)) return;
    setRutinaForm(p => ({ ...p, ejercicios:[...p.ejercicios, { biblioteca_id:ej.id, nombre:ej.nombre, grupo_muscular:ej.grupo_muscular, tipo_movimiento:ej.tipo_movimiento, gif_url:ej.gif_url||"", num_series:4, reps_sugeridas:10 }] }));
  };
  const updEj = (i,f,v) => setRutinaForm(p => { const es=[...p.ejercicios]; es[i]={...es[i],[f]:v}; return { ...p, ejercicios:es }; });
  const remEj = (i) => setRutinaForm(p => ({ ...p, ejercicios:p.ejercicios.filter((_,x)=>x!==i) }));

  if (!selected) return (
    <div style={{textAlign:"center",padding:60,color:C.muted}}>
      <div style={{fontSize:40,marginBottom:12}}>👆</div>
      <div style={{marginBottom:16}}>Selecciona un cliente para programar su plan</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
        {clientes.map(c=><Btn key={c.id} small outline color={C.accentDark} onClick={()=>setSelected(c)}>{c.nombre}</Btn>)}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{background:C.accentDeep+"50",border:`1px solid color-mix(in srgb, ${C.accent} 25%, transparent)`,borderRadius:10,padding:"8px 16px"}}>
          <span style={{fontWeight:700,color:C.accent}}>{selected.nombre}</span>
          <span style={{fontSize:12,color:C.muted,marginLeft:8}}>{selected.email}</span>
        </div>
        <Btn small outline color={C.muted} onClick={()=>setSelected(null)}>Cambiar</Btn>
        {dias.length>0&&<Btn small outline color={C.accentDark} onClick={()=>generateNutriPDF(selected,nutri,dias,brand)}>📄 PDF Nutrición</Btn>}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["nutri","🥗","Nutrición"],["deporte","🏋️","Rutinas"],["progreso","📊","Progreso"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setSubtab(k)} style={{padding:"8px 20px",borderRadius:20,background:subtab===k?C.gradBtn:C.card,color:subtab===k?"#000":C.muted,fontWeight:subtab===k?700:400,fontSize:13,border:`1px solid ${subtab===k?C.accent:C.border}`,cursor:"pointer"}}>
            {ic} {lb}
          </button>
        ))}
      </div>

      {loading?<div style={{color:C.muted,textAlign:"center",padding:40}}>Cargando…</div>:<>
        {subtab==="nutri"&&(
          <div>
            <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:16,marginBottom:14}}>
              <div style={{fontWeight:600,marginBottom:14,color:C.accent}}>Macros diarios</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["calorias","🔥 Calorías (kcal)"],["proteina","🥩 Proteína (g)"],["carbohidratos","🍚 Carbohidratos (g)"],["grasas","🫒 Grasas (g)"]].map(([k,lb])=>(
                  <Field key={k} label={lb}><input type="number" value={macros[k]} onChange={e=>setMacros(p=>({...p,[k]:e.target.value}))} placeholder="0"/></Field>
                ))}
              </div>
              <Btn small grad onClick={saveMacros} disabled={saving}>{saving?"Guardando…":"Guardar macros"}</Btn>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:600}}>Días del plan <span style={{color:C.muted,fontWeight:400}}>({dias.length})</span></span>
              <Btn small grad onClick={openNewDia}>+ Día</Btn>
            </div>
            {dias.map(d=>(
              <div key={d.id} style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><span style={{fontWeight:600}}>{d.dia}</span><span style={{fontSize:12,color:C.muted,marginLeft:10}}>{d.comidas.length} comidas</span></div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small outline color={C.accent} onClick={()=>openEditDia(d)}>Editar</Btn>
                  <Btn small danger onClick={()=>deleteDia(d)}>Borrar</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        {subtab==="deporte"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontWeight:600}}>Rutinas <span style={{color:C.muted,fontWeight:400}}>({rutinas.length})</span></span>
              <Btn small grad onClick={openNewRutina}>+ Rutina</Btn>
            </div>
            {rutinas.map(r=>(
              <div key={r.id} style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><span style={{fontWeight:600}}>{r.nombre}</span><span style={{fontSize:12,color:C.muted,marginLeft:10}}>{r.ejercicios.length} ejercicios · {r.semanas} sem</span></div>
                  <div style={{display:"flex",gap:6}}>
                    <Btn small outline color={C.accentDark} onClick={()=>openEditRutina(r)}>Editar</Btn>
                    <Btn small danger onClick={()=>deleteRutina(r)}>Borrar</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {subtab==="progreso"&&(
          <ProgresoCliente selected={selected} setMsg={setMsg}/>
        )}
      </>}

      {showDiaModal&&(
        <Modal title={editDia?`Editar: ${editDia.dia}`:"Nuevo día"} onClose={()=>setShowDiaModal(false)} wide>
          <Field label="Nombre del día"><input value={diaForm.dia} onChange={e=>setDiaForm(p=>({...p,dia:e.target.value}))} placeholder="Lunes, Día 1…"/></Field>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontWeight:600,fontSize:14}}>Comidas</span>
            <Btn small outline color={C.accent} onClick={addComida}>+ Comida</Btn>
          </div>
          {diaForm.comidas.map((c,i)=>(
            <div key={i} style={{background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,padding:12,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:12,color:C.muted}}>Comida {i+1}</span>
                <button onClick={()=>remComida(i)} style={{background:"none",color:"#f87171",fontSize:18,cursor:"pointer",border:"none"}}>×</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Field label="Hora"><input value={c.hora} onChange={e=>updComida(i,"hora",e.target.value)} placeholder="7:00 am"/></Field>
                <Field label="Nombre"><input value={c.nombre} onChange={e=>updComida(i,"nombre",e.target.value)} placeholder="Desayuno"/></Field>
              </div>
              <Field label="Opción 1"><textarea value={c.opcion1} onChange={e=>updComida(i,"opcion1",e.target.value)} placeholder="Descripción…"/></Field>
              <Field label="Opción 2"><textarea value={c.opcion2} onChange={e=>updComida(i,"opcion2",e.target.value)} placeholder="Descripción…"/></Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                {[["calorias","Kcal"],["proteina","Prot g"],["carbohidratos","Carbs g"],["grasas","Grasas g"]].map(([f,lb])=>(
                  <Field key={f} label={lb}><input type="number" value={c[f]} onChange={e=>updComida(i,f,e.target.value)} placeholder="0"/></Field>
                ))}
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn outline color={C.muted} onClick={()=>setShowDiaModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveDia} disabled={saving}>{saving?"Guardando…":"Guardar día"}</Btn>
          </div>
        </Modal>
      )}

      {showRutinaModal&&(
        <Modal title={editRutina?`Editar: ${editRutina.nombre}`:"Nueva rutina"} onClose={()=>setShowRutinaModal(false)} wide>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
            <Field label="Nombre"><input value={rutinaForm.nombre} onChange={e=>setRutinaForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Upper 1"/></Field>
            <Field label="Semanas"><input type="number" value={rutinaForm.semanas} onChange={e=>setRutinaForm(p=>({...p,semanas:e.target.value}))}/></Field>
            <Field label="Fecha inicio"><input type="date" value={rutinaForm.fecha_inicio} onChange={e=>setRutinaForm(p=>({...p,fecha_inicio:e.target.value}))}/></Field>
          </div>
          <EjercicioSelector biblioteca={biblioteca} onSelect={addEj} selected={rutinaForm.ejercicios}/>
          {rutinaForm.ejercicios.length>0&&(
            <div style={{marginTop:12}}>
              <div style={{display:"grid",gridTemplateColumns:"40px 1fr 80px 80px 32px",gap:6,marginBottom:6,alignItems:"center"}}>
                <span/><span style={{fontSize:11,color:C.muted,fontWeight:600}}>EJERCICIO</span>
                <span style={{fontSize:11,color:C.muted,fontWeight:600,textAlign:"center"}}>SERIES</span>
                <span style={{fontSize:11,color:C.muted,fontWeight:600,textAlign:"center"}}>REPS</span>
                <span/>
              </div>
              {rutinaForm.ejercicios.map((e,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"40px 1fr 80px 80px 32px",gap:6,marginBottom:8,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:6,overflow:"hidden",background:C.surface,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {e.gif_url?<img src={e.gif_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:18}}>🏋️</span>}
                  </div>
                  <div style={{fontSize:13,fontWeight:500}}>{e.nombre}<br/><span style={{fontSize:10,color:C.muted}}>{e.grupo_muscular} · {e.tipo_movimiento}</span></div>
                  <input type="number" value={e.num_series} onChange={ev=>updEj(i,"num_series",ev.target.value)} placeholder="4" style={{textAlign:"center"}}/>
                  <input type="number" value={e.reps_sugeridas} onChange={ev=>updEj(i,"reps_sugeridas",ev.target.value)} placeholder="10" style={{textAlign:"center"}}/>
                  <button onClick={()=>remEj(i)} style={{background:"#ef444430",color:"#ef4444",borderRadius:6,padding:6,cursor:"pointer",fontSize:14,border:"none"}}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:"auto",paddingTop:16}}>
            <Btn outline color={C.muted} onClick={()=>setShowRutinaModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveRutina} disabled={saving}>{saving?"Guardando…":"Guardar rutina"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
