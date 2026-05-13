import { useState, useEffect } from "react";
import { C, css } from "../styles/theme";
import { Btn, Tag, Header, TabBar, StatCard } from "../components/ui";
import { generateNutriPDF, generateProgresoPDF } from "../utils/pdf";
import { dbGet, dbUpsert } from "../lib/supabase";
import { useBrand } from "../components/BrandContext";
import { CitasCliente } from "../components/CitasCliente";

const parseFotos = (fotos) => {
  if (!fotos) return [];
  if (Array.isArray(fotos)) return fotos;
  try { return JSON.parse(fotos); } catch(e) { return typeof fotos === "string" && fotos.startsWith("http") ? [fotos] : []; }
};

export default function ClienteView({ session, onLogout, isAtletaMode=false, onBackToAdmin }) {
  const { data:cliente } = session;
  const brand = useBrand();
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
  const [gifPreview, setGifPreview] = useState(null);
  const [metricas, setMetricas] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const ns = await dbGet(`nutricion?cliente_id=eq.${cliente.id}`);
        if (ns.length) {
          setNutri(ns[0]);
          const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&order=orden.asc`);
          setDias(await Promise.all(ds.map(async d => ({ ...d, comidas:await dbGet(`comidas?dia_id=eq.${d.id}&order=orden.asc`) }))));
        }
        const rs = await dbGet(`rutinas?cliente_id=eq.${cliente.id}&order=orden.asc`);
        const rsFull = await Promise.all(rs.map(async r => ({ ...r, ejercicios:await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`) })));
        setRutinas(rsFull);
        const allIds = rsFull.flatMap(r=>r.ejercicios.map(e=>e.id));
        if (allIds.length) {
          const ps = await dbGet(`progreso?cliente_id=eq.${cliente.id}&ejercicio_id=in.(${allIds.join(",")})`);
          const pm={}; ps.forEach(p=>{pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}`]=p.valor;}); setProgreso(pm);
        }
        const ms = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
        setMetricas(ms);
      } catch(e){ console.error(e); }
      setLoading(false);
    })();
  }, [cliente.id]);

  const commitEdit = async () => {
    if (!editCell) return;
    const [ejId,semana,serie,tipo] = editCell.split("__");
    const key=`${ejId}-${semana}-${serie}-${tipo}`;
    const finalVal = editVal; // capture current state
    
    setProgreso(p=>({...p,[key]:finalVal}));
    setEditCell(null); setEditVal("");
    
    await dbUpsert("progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo", { ejercicio_id:ejId, cliente_id:cliente.id, semana:+semana, serie:+serie, tipo, valor:finalVal, updated_at:new Date().toISOString() });
  };

  const saveAll = async () => {
    if (saving) return;
    // First commit any cell that is still open
    if (editCell) await commitEdit();
    setSaving(true);
    setMsg(null);
    try {
      const rutina = rutinas[rutinaIdx];
      if (!rutina) { setSaving(false); return; }
      const allEjIds = rutina.ejercicios.map(e => e.id);
      const numSemanas = rutina.semanas || 4;
      const upserts = [];
      allEjIds.forEach(ejId => {
        for (let wi = 0; wi < numSemanas; wi++) {
          const numSeries = rutina.ejercicios.find(e => e.id === ejId)?.num_series || 4;
          for (let si = 0; si < numSeries; si++) {
            ["peso", "reps"].forEach(tipo => {
              const val = progreso[`${ejId}-${wi}-${si}-${tipo}`];
              if (val !== undefined && val !== "") {
                upserts.push({ ejercicio_id: ejId, cliente_id: cliente.id, semana: wi, serie: si, tipo, valor: val, updated_at: new Date().toISOString() });
              }
            });
          }
        }
      });
      if (upserts.length > 0) {
        await Promise.all(upserts.map(u => dbUpsert("progreso?on_conflict=ejercicio_id,cliente_id,semana,serie,tipo", u)));
      }
      setMsg({ ok: true, text: "✅ Registros guardados correctamente" });
    } catch(e) {
      setMsg({ ok: false, text: "❌ Error al guardar: " + e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleTabChange = (newTab) => {
    if (editCell) commitEdit();
    setTab(newTab);
  };

  const safeLogout = () => {
    if (editCell) commitEdit();
    onLogout();
  };

  const getSemanasConFecha = (rutina) => {
    if (!rutina) return [];
    const inicio = rutina.fecha_inicio ? new Date(rutina.fecha_inicio + "T12:00:00") : new Date();
    return Array.from({length:rutina.semanas}, (_,i) => {
      const start=new Date(inicio); start.setDate(start.getDate()+i*7);
      const end=new Date(start); end.setDate(end.getDate()+6);
      const fmt=(d)=>`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      return { label:`${fmt(start)}-${fmt(end)}`, idx:i };
    });
  };

  const rutina = rutinas[rutinaIdx];
  const diaActual = dias[diaIdx];
  const semanas = getSemanasConFecha(rutina);

  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      <style>{css}</style>

      <Header
        nombre={cliente.nombre}
        objetivo={cliente.objetivo}
        onLogout={safeLogout}
        extra={dias.length>0 && tab==="nutricion"
          ? <Btn small outline color={C.accentMid} onClick={()=>generateNutriPDF(cliente,nutri,dias,brand)}>📄 PDF</Btn>
          : null}
      />

      <TabBar
        tabs={[
          ["nutricion","🥗","Nutrición"],
          ["deporte","🏋️","Entrenamiento"],
          ["progreso","📊","Progreso"],
          ["citas","📅","Citas"]
        ]}
        active={tab}
        onChange={handleTabChange}
      />

      <div style={{padding:"24px 16px", maxWidth:860, margin:"0 auto"}}>
        {loading ? (
          <div style={{textAlign:"center",padding:"80px 0",color:C.muted}}>
            <div style={{
              width:44, height:44, borderRadius:"50%",
              border:`3px solid ${C.border}`,
              borderTopColor:C.accent,
              animation:"rotateSlow 0.8s linear infinite",
              margin:"0 auto 16px"
            }}/>
            <div>Cargando tu programa…</div>
          </div>
        ) : <>

          {/* ── NUTRICIÓN ── */}
          {tab==="nutricion" && (
            <div className="animate-in">
              {/* Macros */}
              {nutri && (
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(4,1fr)",
                  gap:12, marginBottom:24
                }}>
                  <StatCard icon="🔥" label="Calorías" value={nutri.calorias} unit="kcal" color={C.accent}/>
                  <StatCard icon="🥩" label="Proteína" value={`${nutri.proteina}g`} unit="gramos" color={C.accentMid}/>
                  <StatCard icon="🍚" label="Carbos" value={`${nutri.carbohidratos}g`} unit="gramos" color="#7b8eff"/>
                  <StatCard icon="🫒" label="Grasas" value={`${nutri.grasas}g`} unit="gramos" color="#ffcc44"/>
                </div>
              )}

              {dias.length===0 ? (
                <div style={{
                  textAlign:"center", padding:"70px 0",
                  color:C.muted
                }}>
                  <div style={{fontSize:48,marginBottom:16}}>🥗</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:C.text}}>Plan en preparación</div>
                  <div style={{fontSize:13}}>Tu nutriólogo está preparando tu plan personalizado.</div>
                </div>
              ) : <>
                {/* Selector de días */}
                <div style={{
                  display:"flex", gap:8, marginBottom:20,
                  overflowX:"auto", paddingBottom:4
                }}>
                  {dias.map((d,i) => (
                    <button
                      key={i}
                      onClick={()=>setDiaIdx(i)}
                      className="btn-hover"
                      style={{
                        flexShrink:0, padding:"9px 20px",
                        borderRadius:20,
                        background: diaIdx===i ? C.gradBtn : C.card,
                        color: diaIdx===i ? "#000" : C.muted,
                        fontWeight: diaIdx===i ? 700 : 500,
                        fontSize:13,
                        border:`1px solid ${diaIdx===i ? C.accent : C.border}`,
                        cursor:"pointer",
                        fontFamily:"'Inter',sans-serif",
                        boxShadow: diaIdx===i ? `0 4px 16px color-mix(in srgb, ${C.accentDeep} 38%, transparent)` : "none",
                        transition:"all 0.2s"
                      }}
                    >{d.dia}</button>
                  ))}
                </div>

                {/* Comidas del día */}
                {diaActual && diaActual.comidas.map((c,ci) => {
                  const sel = opcion[`${diaIdx}-${ci}`] || 1;
                  return (
                    <div key={ci} className="animate-in card-hover" style={{
                      background:`linear-gradient(135deg, ${C.card}, ${C.surfaceAlt})`,
                      borderRadius:16,
                      border:`1px solid ${C.border}`,
                      marginBottom:12, overflow:"hidden",
                      animationDelay:`${ci*0.06}s`
                    }}>
                      {/* Encabezado de comida */}
                      <div style={{
                        display:"flex", alignItems:"center",
                        justifyContent:"space-between",
                        padding:"12px 16px",
                        borderBottom:`1px solid ${C.border}`,
                        background:`linear-gradient(90deg, color-mix(in srgb, ${C.accentDeep} 15%, transparent), transparent)`
                      }}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{
                            fontSize:11, color:C.muted,
                            background:C.faint,
                            padding:"3px 10px", borderRadius:20,
                            border:`1px solid ${C.border}`,
                            fontWeight:500
                          }}>{c.hora}</span>
                          <span style={{fontWeight:700,fontSize:15,color:C.text}}>{c.nombre}</span>
                        </div>
                        <div style={{
                          fontSize:14, color:C.accent,
                          fontWeight:800,
                          fontFamily:"'Rajdhani',sans-serif"
                        }}>{c.calorias} kcal</div>
                      </div>

                      {/* Contenido */}
                      <div style={{padding:"14px 16px"}}>
                        {/* Selector opciones */}
                        <div style={{display:"flex",gap:8,marginBottom:12}}>
                          {[1,2].map(n=>(
                            <button
                              key={n}
                              onClick={()=>setOpcion(p=>({...p,[`${diaIdx}-${ci}`]:n}))}
                              className="btn-hover"
                              style={{
                                padding:"5px 16px", borderRadius:20, fontSize:12,
                                background: sel===n ? C.gradBtn : "transparent",
                                color: sel===n ? "#000" : C.muted,
                                border:`1px solid ${sel===n ? C.accent : C.border}`,
                                fontWeight: sel===n ? 700 : 400,
                                cursor:"pointer",
                                fontFamily:"'Inter',sans-serif",
                                transition:"all 0.2s"
                              }}
                            >Opción {n}</button>
                          ))}
                        </div>

                        {/* Descripción */}
                        <div style={{
                          fontSize:13, marginBottom:12,
                          lineHeight:1.7, color:C.text,
                          opacity:0.85
                        }}>
                          {sel===1 ? c.opcion1 : c.opcion2}
                        </div>

                        {/* Macros de la comida */}
                        <div style={{display:"flex",gap:16}}>
                          {[["P",c.proteina,C.accentMid],["C",c.carbohidratos,"#7b8eff"],["G",c.grasas,"#ffcc44"]].map(([l,v,col])=>(
                            <div key={l} style={{
                              display:"flex", alignItems:"center",
                              gap:4, fontSize:12
                            }}>
                              <span style={{
                                fontWeight:700, color:col,
                                fontFamily:"'Rajdhani',sans-serif",
                                fontSize:14
                              }}>{v}g</span>
                              <span style={{color:C.muted}}>{l==="P"?"Prot":l==="C"?"Carbs":"Grasas"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>}
            </div>
          )}

          {/* ── ENTRENAMIENTO ── */}
          {tab==="deporte" && (
            <div className="animate-in">
              {rutinas.length===0 ? (
                <div style={{
                  textAlign:"center", padding:"70px 0", color:C.muted
                }}>
                  <div style={{fontSize:48,marginBottom:16}}>🏋️</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:C.text}}>Rutina en preparación</div>
                  <div style={{fontSize:13}}>Tu nutriólogo está diseñando tu plan de entrenamiento.</div>
                </div>
              ) : <>
                {/* Selector de rutinas */}
                <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
                  {rutinas.map((r,i)=>(
                    <button key={i} onClick={()=>setRutinaIdx(i)} className="btn-hover" style={{
                      flexShrink:0, padding:"9px 20px", borderRadius:20,
                      background:rutinaIdx===i?C.gradBtn:C.card,
                      color:rutinaIdx===i?"#000":C.muted,
                      fontWeight:rutinaIdx===i?700:500, fontSize:13,
                      border:`1px solid ${rutinaIdx===i?C.accent:C.border}`,
                      cursor:"pointer", fontFamily:"'Inter',sans-serif",
                      boxShadow:rutinaIdx===i?`0 4px 16px color-mix(in srgb, ${C.accentDeep} 38%, transparent)`:"none",
                      transition:"all 0.2s"
                    }}>{r.nombre}</button>
                  ))}
                </div>

                {/* Tip + Save Button */}
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  gap:12, marginBottom:16, flexWrap:"wrap"
                }}>
                  <div style={{
                    flex:1,
                    background:`color-mix(in srgb, ${C.accentDeep} 13%, transparent)`,
                    border:`1px solid ${C.border}`,
                    borderRadius:10, padding:"10px 14px",
                    fontSize:12, color:C.muted, lineHeight:1.5
                  }}>
                    💡 Toca el ejercicio para ver la demostración · Toca las celdas para registrar tu progreso
                  </div>
                  <button
                    onClick={saveAll}
                    disabled={saving}
                    className="btn-hover"
                    style={{
                      flexShrink:0,
                      padding:"10px 20px", borderRadius:12,
                      background: saving ? C.card : C.gradBtn,
                      color: saving ? C.muted : "#000",
                      fontWeight:700, fontSize:13,
                      border:`1px solid ${saving ? C.border : C.accent}`,
                      cursor: saving ? "not-allowed" : "pointer",
                      fontFamily:"'Inter',sans-serif",
                      boxShadow: saving ? "none" : `0 4px 16px color-mix(in srgb, ${C.accentDeep} 38%, transparent)`,
                      transition:"all 0.2s"
                    }}
                  >
                    {saving ? "⏳ Guardando…" : "💾 Guardar registros"}
                  </button>
                </div>

                {/* Mensaje de guardado */}
                {msg && (
                  <div style={{
                    padding:"10px 16px", borderRadius:10, marginBottom:12,
                    background: msg.ok
                      ? `color-mix(in srgb, #4ade80 20%, transparent)`
                      : `color-mix(in srgb, #f87171 20%, transparent)`,
                    border: `1px solid ${msg.ok ? "#4ade80" : "#f87171"}`,
                    color: msg.ok ? "#16a34a" : "#dc2626",
                    fontSize:13, fontWeight:600
                  }}>
                    {msg.text}
                  </div>
                )}

                {/* Tabla de progreso */}
                {rutina && (
                  <div style={{overflowX:"auto", borderRadius:14, border:`1px solid ${C.border}`}}>
                    <table style={{
                      borderCollapse:"collapse", fontSize:12,
                      minWidth:"100%", background:C.card
                    }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{
                            background:`linear-gradient(135deg,${C.accentDeep},${C.faint})`,
                            color:C.text, padding:"10px 14px",
                            border:`1px solid ${C.border}`,
                            minWidth:150, textAlign:"left",
                            fontFamily:"'Inter',sans-serif", fontWeight:600,
                            fontSize:11, textTransform:"uppercase", letterSpacing:"0.5px"
                          }}>Ejercicio</th>
                          <th rowSpan={2} style={{
                            background:`linear-gradient(135deg,${C.accentDeep},${C.faint})`,
                            color:C.text, padding:"10px 10px",
                            border:`1px solid ${C.border}`,
                            minWidth:52, textAlign:"center",
                            fontWeight:600, fontSize:11,
                            textTransform:"uppercase", letterSpacing:"0.5px"
                          }}>Serie</th>
                          {semanas.map((s,i)=>(
                            <th key={i} colSpan={2} style={{
                              background:C.faint, color:C.accent,
                              padding:"8px 4px", border:`1px solid ${C.border}`,
                              textAlign:"center", whiteSpace:"nowrap",
                              fontSize:10, fontWeight:700,
                              letterSpacing:"0.3px"
                            }}>{s.label}</th>
                          ))}
                        </tr>
                        <tr>
                          {semanas.map((_,i)=>(
                            <>
                              <th key={`p${i}`} style={{background:C.surfaceAlt,color:C.muted,padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10,minWidth:52,fontWeight:600}}>Peso</th>
                              <th key={`r${i}`} style={{background:C.surfaceAlt,color:C.muted,padding:"6px 4px",border:`1px solid ${C.border}`,textAlign:"center",fontSize:10,minWidth:52,fontWeight:600}}>Reps</th>
                            </>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rutina.ejercicios.map((ej,eji)=>{
                          const numSeries=ej.num_series||4;
                          return Array.from({length:numSeries},(_,si)=>{
                            const isFirst=si===0;
                            const isLast=si===numSeries-1;
                            const rowBg = eji%2===0 ? C.card : C.surfaceAlt;
                            return (
                              <tr key={`${ej.id}-${si}`} style={{background:rowBg}}>
                                {isFirst&&(
                                  <td rowSpan={numSeries}
                                    onClick={()=>ej.gif_url&&setGifPreview(ej)}
                                    style={{
                                      background:rowBg, padding:"10px 14px",
                                      border:`1px solid ${C.border}`,
                                      fontWeight:600, verticalAlign:"middle",
                                      textAlign:"center",
                                      borderBottom:isLast?`2px solid ${C.accentDeep}`:`1px solid ${C.border}`,
                                      cursor:ej.gif_url?"pointer":"default",
                                      transition:"background 0.2s"
                                    }}
                                    onMouseEnter={e=>{if(ej.gif_url)e.currentTarget.style.background=C.faint;}}
                                    onMouseLeave={e=>{e.currentTarget.style.background=rowBg;}}
                                  >
                                    {ej.gif_url&&(
                                      <div style={{
                                        width:44,height:44,borderRadius:8,
                                        overflow:"hidden",margin:"0 auto 6px",
                                        border:`1px solid ${C.border}`
                                      }}>
                                        <img src={ej.gif_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                                      </div>
                                    )}
                                    <div style={{fontSize:12,color:C.text}}>{ej.nombre}</div>
                                    <div style={{fontSize:10,color:C.muted,marginTop:3}}>
                                      {ej.reps_sugeridas} reps
                                    </div>
                                    {ej.gif_url&&(
                                      <div style={{fontSize:10,color:C.accent,marginTop:3}}>▶ Ver</div>
                                    )}
                                  </td>
                                )}
                                <td style={{
                                  padding:"7px 8px",border:`1px solid ${C.border}`,
                                  textAlign:"center",color:C.accent,fontWeight:800,
                                  borderBottom:isLast?`2px solid ${C.accentDeep}`:`1px solid ${C.border}`,
                                  fontFamily:"'Rajdhani',sans-serif", fontSize:14
                                }}>{si+1}</td>
                                {semanas.map((_,wi)=>{
                                  const pKey=`${ej.id}__${wi}__${si}__peso`;
                                  const rKey=`${ej.id}__${wi}__${si}__reps`;
                                  const pVal=progreso[`${ej.id}-${wi}-${si}-peso`]||"";
                                  const rVal=progreso[`${ej.id}-${wi}-${si}-reps`]||"";
                                  const cellBase={
                                    padding:"5px 2px",border:`1px solid ${C.border}`,
                                    textAlign:"center",cursor:"pointer",
                                    borderBottom:isLast?`2px solid ${C.accentDeep}`:`1px solid ${C.border}`,
                                    transition:"background 0.15s"
                                  };
                                  const inputStyle={
                                    width:46,padding:"2px",fontSize:11,
                                    borderRadius:4,border:`1px solid ${C.accent}`,
                                    textAlign:"center",background:C.surface,
                                    color:C.text
                                  };
                                  const renderCell = (keyName, val, isWeight) => {
                                    return (
                                      <td key={keyName}
                                        onClick={()=>{if(editCell!==keyName){if(editCell)commitEdit();setEditCell(keyName);setEditVal(val);}}}
                                        style={{...cellBase,background:val?`color-mix(in srgb, ${isWeight?C.accentDeep:C.accentDeep} ${isWeight?38:25}%, transparent)`:"transparent"}}
                                        onMouseEnter={e=>{if(editCell!==keyName)e.currentTarget.style.background=C.faint;}}
                                        onMouseLeave={e=>{e.currentTarget.style.background=val?`color-mix(in srgb, ${isWeight?C.accentDeep:C.accentDeep} ${isWeight?38:25}%, transparent)`:"transparent";}}
                                      >
                                        {editCell===keyName ? (
                                          <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape"){setEditCell(null);setEditVal("");}}} style={inputStyle}/>
                                        ) : (
                                          <span style={{fontSize:11,color:val?(isWeight?C.accent:C.accentMid):C.dim,fontWeight:val?700:400}}>{val||"—"}</span>
                                        )}
                                      </td>
                                    );
                                  };
                                  return (
                                    <>
                                      {renderCell(pKey, pVal, true)}
                                      {renderCell(rKey, rVal, false)}
                                    </>
                                  );
                                })}
                              </tr>
                            );
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>}
            </div>
          )}

          {/* ── PROGRESO ── */}
          {tab==="progreso"&&(
            <div className="animate-in">
              {metricas.length===0?(
                <div style={{textAlign:"center",padding:"70px 0",color:C.muted}}>
                  <div style={{fontSize:48,marginBottom:16}}>📊</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:C.text}}>Sin evaluaciones aún</div>
                  <div style={{fontSize:13}}>Tu nutriólogo registrará tus métricas en cada consulta.</div>
                </div>
              ):(
                <div>
                  <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
                    <Btn small outline color={C.accent} onClick={() => generateProgresoPDF(cliente, metricas, brand)}>📄 Descargar Reporte de Progreso</Btn>
                  </div>
                  {/* Mini-chart de peso */}
                  {metricas.filter(m=>m.peso).length>=2&&(()=>{
                    const pts=[...metricas].reverse().filter(m=>m.peso);
                    const vals=pts.map(m=>parseFloat(m.peso));
                    const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;
                    const W=320,H=80,PAD=12;
                    const coords=pts.map((m,i)=>({
                      x:PAD+(i/Math.max(pts.length-1,1))*(W-PAD*2),
                      y:PAD+(1-(parseFloat(m.peso)-mn)/rng)*(H-PAD*2),
                      v:m.peso
                    }));
                    const path=coords.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
                    return (
                      <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:16,marginBottom:20}}>
                        <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10}}>Evolución de peso (kg)</div>
                        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
                          <path d={path} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                          {coords.map((p,i)=>(
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r={5} fill={C.accent} stroke={C.card} strokeWidth={2}/>
                              <text x={p.x} y={p.y-8} textAnchor="middle" fontSize={9} fill={C.muted}>{p.v}kg</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    );
                  })()}

                  <div style={{fontSize:13,fontWeight:600,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>Historial de evaluaciones</div>
                  {metricas.map((m,idx)=>{
                    const prev=metricas[idx+1];
                    const fmtD=d=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"});
                    const KEYS=[
                      {key:"peso",            label:"Peso",       unit:"kg",    icon:"⚖️"},
                      {key:"imc",             label:"IMC",        unit:"",      icon:"📐"},
                      {key:"grasa_pct",       label:"Grasa",      unit:"%",     icon:"🔴"},
                      {key:"musculo_pct",     label:"Músculo",    unit:"%",     icon:"💪"},
                      {key:"agua_pct",        label:"Agua",       unit:"%",     icon:"💧"},
                      {key:"cintura",         label:"Cintura",    unit:"cm",    icon:"📏"},
                      {key:"cadera",          label:"Cadera",     unit:"cm",    icon:"📏"},
                      {key:"glucosa",         label:"Glucosa",    unit:"mg/dL", icon:"🩺"},
                      {key:"colesterol",      label:"Colesterol", unit:"mg/dL", icon:"🩺"},
                      {key:"presion_arterial",label:"Presión",    unit:"",      icon:"❤️"},
                    ];
                    return (
                      <div key={m.id} className="animate-in" style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:16,marginBottom:12,animationDelay:`${idx*0.05}s`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                          <span style={{fontWeight:700,color:C.accent}}>📅 {fmtD(m.fecha)}</span>
                          {idx===0&&<span style={{background:C.accentDeep+"50",color:C.accent,fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:600}}>Más reciente</span>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10}}>
                          {KEYS.filter(f=>m[f.key]!==null&&m[f.key]!==undefined&&m[f.key]!=="").map(f=>{
                            const d=prev&&prev[f.key]!=null&&prev[f.key]!==""?parseFloat(m[f.key])-parseFloat(prev[f.key]):null;
                            return (
                              <div key={f.key} style={{background:C.bg,borderRadius:10,padding:"10px 8px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                                <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{f.icon} {f.label}</div>
                                <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:"'Rajdhani',sans-serif"}}>{m[f.key]}{f.unit&&<span style={{fontSize:10,fontWeight:400,color:C.muted}}> {f.unit}</span>}</div>
                                {d!==null&&d!==0&&<div style={{fontSize:10,color:d<0?"#4ade80":"#f87171",marginTop:2,fontWeight:600}}>{d>0?"↑":"↓"} {Math.abs(d).toFixed(1)}{f.unit}</div>}
                              </div>
                            );
                          })}
                        </div>
                        {m.notas&&<div style={{fontSize:12,color:C.muted,marginTop:10,background:C.bg,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`}}>📝 {m.notas}</div>}
                        {parseFotos(m.fotos).length>0&&(
                          <div style={{marginTop:12}}>
                            <div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>📸 Fotos ({parseFotos(m.fotos).length})</div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              {parseFotos(m.fotos).map((url,fi)=>(
                                <img key={fi} src={url} onClick={()=>setLightbox(url)}
                                  style={{width:72,height:72,objectFit:"cover",borderRadius:10,cursor:"zoom-in",border:`2px solid ${C.border}`}}
                                  alt={`foto ${fi+1}`}/>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CITAS ── */}
          {tab==="citas" && (
            <div className="animate-in">
              <CitasCliente
                clienteId={cliente.id}
                nutriologoId={cliente.nutriologo_id}
              />
            </div>
          )}
        </>}
      </div>

      {/* Modal GIF preview */}
      {gifPreview && (
        <div
          onClick={()=>setGifPreview(null)}
          style={{
            position:"fixed",inset:0,
            background:"rgba(0,0,0,0.9)",
            backdropFilter:"blur(10px)",
            zIndex:200,display:"flex",
            alignItems:"center",justifyContent:"center",padding:20
          }}
        >
          <div
            className="animate-in"
            onClick={e=>e.stopPropagation()}
            style={{
              background:`linear-gradient(145deg,${C.card},${C.surface})`,
              borderRadius:20, padding:24,
              maxWidth:400, width:"100%",
              textAlign:"center",
              border:`1px solid ${C.border}`,
              boxShadow:`0 24px 80px color-mix(in srgb, ${C.accentDeep} 50%, transparent)`
            }}
          >
            <img
              src={gifPreview.gif_url}
              alt={gifPreview.nombre}
              style={{
                width:"100%",borderRadius:12,
                marginBottom:14,
                maxHeight:260,objectFit:"contain",
                border:`1px solid ${C.border}`
              }}
            />
            <div style={{
              fontWeight:700,fontSize:18,marginBottom:8,
              fontFamily:"'Rajdhani',sans-serif",
              color:C.text, letterSpacing:"0.5px"
            }}>{gifPreview.nombre}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:14}}>
              <Tag color={C.accent}>{gifPreview.grupo_muscular}</Tag>
              <Tag color={C.accentMid}>{gifPreview.tipo_movimiento}</Tag>
            </div>
            {gifPreview.reps_sugeridas && (
              <div style={{fontSize:13,color:C.muted,marginBottom:16}}>
                Reps sugeridas:{" "}
                <strong style={{color:C.accent,fontFamily:"'Rajdhani',sans-serif",fontSize:16}}>
                  {gifPreview.reps_sugeridas}
                </strong>
              </div>
            )}
            <Btn grad onClick={()=>setGifPreview(null)} style={{width:"100%"}}>Cerrar</Btn>
          </div>
        </div>
      )}

      {/* Lightbox para fotos de progreso */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{
          position:"fixed",top:0,left:0,width:"100%",height:"100%",
          background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",
          justifyContent:"center",zIndex:9999,cursor:"zoom-out"
        }}>
          <img src={lightbox} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:14,objectFit:"contain",boxShadow:"0 24px 80px rgba(0,0,0,0.8)"}} alt=""/>
          <div style={{position:"absolute",top:20,right:24,color:"#fff",fontSize:28,cursor:"pointer",fontWeight:700}} onClick={()=>setLightbox(null)}>✕</div>
        </div>
      )}
      {/* Banner Modo Atleta */}
      {isAtletaMode && (
        <div style={{
          position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
          background:"rgba(10,22,46,0.97)", backdropFilter:"blur(16px)",
          border:"1px solid rgba(46,92,184,0.45)",
          borderRadius:14, padding:"12px 20px",
          display:"flex", alignItems:"center", gap:14,
          zIndex:200, boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
          fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap"
        }}>
          <span style={{fontSize:13,color:"var(--brand-accent,#2e5cb8)",fontWeight:700,letterSpacing:"0.3px"}}>💪 Modo Atleta Activo</span>
          <button
            onClick={onBackToAdmin}
            style={{
              background:"rgba(46,92,184,0.15)", border:"1px solid rgba(46,92,184,0.35)",
              borderRadius:8, padding:"6px 16px",
              color:"var(--brand-accent,#2e5cb8)", fontSize:12, fontWeight:700,
              cursor:"pointer", transition:"all 0.2s"
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(46,92,184,0.28)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(46,92,184,0.15)";}}
          >⚡ Volver al Panel</button>
        </div>
      )}
    </div>
  );
}
