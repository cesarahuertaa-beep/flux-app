import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "../SortableItem";
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
  const [searchProg, setSearchProg] = useState("");

  // ── Ciclos ──
  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState(null); // ciclo seleccionado para ver/editar

  // ── Datos del ciclo seleccionado ──
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

  const isReadOnly = cicloSel && !cicloSel.activo;

  // ── Cargar ciclos del cliente ──
  const loadCiclos = useCallback(async () => {
    if (!selected) return;
    try {
      const cs = await dbGet(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`);
      setCiclos(cs);
      // Seleccionar el ciclo activo por defecto
      const activo = cs.find(c => c.activo) || cs[0] || null;
      setCicloSel(activo);
    } catch(e) { setMsg("❌ " + e.message); }
  }, [selected]);

  // ── Cargar datos del ciclo seleccionado ──
  const loadData = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      // Filtrar por ciclo si hay uno seleccionado, si no mostrar planes sin ciclo
      const cicloFilter = cicloSel
        ? `ciclo_id=eq.${cicloSel.id}`
        : `ciclo_id=is.null`;

      const ns = await dbGet(`nutricion?cliente_id=eq.${selected.id}&${cicloFilter}`);
      if (ns.length) {
        setNutri(ns[0]);
        setMacros({ calorias:ns[0].calorias||"", proteina:ns[0].proteina||"", carbohidratos:ns[0].carbohidratos||"", grasas:ns[0].grasas||"" });
        const ds = await dbGet(`nutricion_dias?nutricion_id=eq.${ns[0].id}&order=orden.asc`);
        setDias(await Promise.all(ds.map(async d => ({ ...d, comidas:await dbGet(`comidas?dia_id=eq.${d.id}&order=orden.asc`) }))));
      } else { setNutri(null); setMacros({ calorias:"", proteina:"", carbohidratos:"", grasas:"" }); setDias([]); }

      const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&${cicloFilter}&order=orden.asc`);
      setRutinas(await Promise.all(rs.map(async r => ({ ...r, ejercicios:await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`) }))));
    } catch(e) { setMsg("❌ " + e.message); }
    setLoading(false);
  }, [selected, cicloSel]);

  useEffect(() => { loadCiclos(); }, [loadCiclos]);
  useEffect(() => { if (cicloSel !== undefined) loadData(); }, [loadData]);

  // ── (Ciclos se crean ahora desde los modales de Día/Rutina) ──

  // ── Eliminar ciclo (solo si está vacío) ──
  const eliminarCiclo = async (ciclo, e) => {
    e.stopPropagation(); // no seleccionar el ciclo al dar clic en borrar
    try {
      // Verificar si tiene datos
      const nutris = await dbGet(`nutricion?ciclo_id=eq.${ciclo.id}`);
      const ruts   = await dbGet(`rutinas?ciclo_id=eq.${ciclo.id}`);
      if (nutris.length > 0 || ruts.length > 0) {
        setMsg("⚠️ No puedes borrar un ciclo que tiene planes o rutinas. Primero elimina su contenido.");
        return;
      }
      if (!confirm(`¿Eliminar el ciclo "${ciclo.nombre}"? Esta acción no se puede deshacer.`)) return;

      // Si era el activo, reactivar el ciclo anterior (el más reciente entre los archivados)
      if (ciclo.activo) {
        const anteriores = ciclos.filter(c => c.id !== ciclo.id && !c.activo);
        if (anteriores.length > 0) {
          // El primero en la lista es el más reciente (orden desc por created_at)
          await dbPatch(`ciclos?id=eq.${anteriores[0].id}`, { activo: true });
          setMsg(`✅ Ciclo eliminado. Se restauró: "${anteriores[0].nombre}"`);
        } else {
          setMsg("✅ Ciclo eliminado.");
        }
      } else {
        setMsg("✅ Ciclo eliminado.");
      }

      await dbDel(`ciclos?id=eq.${ciclo.id}`);
      await loadCiclos();
    } catch(e) { setMsg("❌ " + e.message); }
  };

  // ── Operaciones de Nutrición ──
  const saveMacros = async () => {
    if (isReadOnly) return;
    setSaving(true);
    try {
      if (nutri) await dbPatch(`nutricion?id=eq.${nutri.id}`, { ...macros, updated_at:new Date().toISOString() });
      else {
        const r = await dbPost("nutricion", {
          cliente_id: selected.id,
          ciclo_id: cicloSel?.id || null,
          ...macros
        });
        setNutri(r[0]);
      }
      setMsg("✅ Macros guardados");
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const openNewDia  = () => { setEditDia(null); setDiaForm({ dia:"", orden:dias.length, comidas:[{ _dndId: Math.random().toString(36).slice(2,9), hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }], crear_ciclo: false, ciclo_nombre: "", ciclo_fecha: new Date().toISOString().split("T")[0] }); setShowDiaModal(true); };
  const openEditDia = (d) => { setEditDia(d); setDiaForm({ dia:d.dia, orden:d.orden, comidas:d.comidas.map(c=>({...c, _dndId: String(c.id || Math.random().toString(36).slice(2,9))})), crear_ciclo: false, ciclo_nombre: "", ciclo_fecha: new Date().toISOString().split("T")[0] }); setShowDiaModal(true); };

  const saveDia = async () => {
    if (!nutri && !diaForm.crear_ciclo) { setMsg("⚠️ Guarda los macros primero"); return; }
    setSaving(true);
    try {
      let currentNutri = nutri;
      if (diaForm.crear_ciclo) {
        if (!diaForm.ciclo_nombre.trim()) { setMsg("⚠️ Escribe el nombre del nuevo ciclo"); setSaving(false); return; }
        if (ciclos.some(c => c.activo)) {
          await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
        }
        const cRes = await dbPost("ciclos", { cliente_id: selected.id, nombre: diaForm.ciclo_nombre.trim(), fecha_inicio: diaForm.ciclo_fecha, activo: true });
        const activeCiclo = cRes[0];
        await loadCiclos();
        setCicloSel(activeCiclo);
        
        const nRes = await dbPost("nutricion", {
          cliente_id: selected.id,
          ciclo_id: activeCiclo.id,
          ...macros
        });
        currentNutri = nRes[0];
        setNutri(currentNutri);
      }

      let diaId;
      if (editDia) { 
        await dbPatch(`nutricion_dias?id=eq.${editDia.id}`, { dia:diaForm.dia, orden:diaForm.orden }); 
        diaId = editDia.id; 
        
        const oldIds = editDia.comidas.map(c => c.id);
        const newIds = diaForm.comidas.filter(c => c.id).map(c => c.id);
        const toDelete = oldIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          await dbDel(`comidas?id=in.(${toDelete.join(",")})`);
        }
      }
      else { 
        const r = await dbPost("nutricion_dias", { nutricion_id:currentNutri.id, dia:diaForm.dia, orden:diaForm.orden }); 
        diaId=r[0].id; 
      }
      
      for (let i=0; i<diaForm.comidas.length; i++) {
        const c = diaForm.comidas[i];
        const data = { ...c, dia_id:diaId, orden:i, calorias:+c.calorias||0, proteina:+c.proteina||0, carbohidratos:+c.carbohidratos||0, grasas:+c.grasas||0 };
        delete data.id;
        
        if (c.id) {
          await dbPatch(`comidas?id=eq.${c.id}`, data);
        } else {
          await dbPost("comidas", data);
        }
      }
      setShowDiaModal(false); setMsg("✅ Día guardado"); await loadData();
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const deleteDia  = async (d) => { if (!confirm(`¿Eliminar "${d.dia}"?`)) return; await dbDel(`nutricion_dias?id=eq.${d.id}`); setMsg("🗑️ Día eliminado"); await loadData(); };
  const addComida  = () => setDiaForm(p => ({ ...p, comidas:[...p.comidas, { _dndId: Math.random().toString(36).slice(2,9), hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }));
  const updComida  = (i,f,v) => setDiaForm(p => { const cs=[...p.comidas]; cs[i]={...cs[i],[f]:v}; return { ...p, comidas:cs }; });
  const remComida  = (i) => setDiaForm(p => ({ ...p, comidas:p.comidas.filter((_,x)=>x!==i) }));

  // ── Operaciones de Rutinas ──
  const openNewRutina  = () => { setEditRutina(null); setRutinaForm({ nombre:"", semanas:8, fecha_inicio:new Date().toISOString().split("T")[0], ejercicios:[], crear_ciclo: false, ciclo_nombre: "", ciclo_fecha: new Date().toISOString().split("T")[0] }); setShowRutinaModal(true); };
  const openEditRutina = (r) => { setEditRutina(r); setRutinaForm({ nombre:r.nombre, semanas:r.semanas, fecha_inicio:r.fecha_inicio||new Date().toISOString().split("T")[0], ejercicios:r.ejercicios.map(e=>({...e, _dndId: String(e.id || Math.random().toString(36).slice(2,9))})), crear_ciclo: false, ciclo_nombre: "", ciclo_fecha: new Date().toISOString().split("T")[0] }); setShowRutinaModal(true); };

  const saveRutina = async () => {
    setSaving(true);
    try {
      let activeCiclo = cicloSel;
      if (rutinaForm.crear_ciclo) {
        if (!rutinaForm.ciclo_nombre.trim()) { setMsg("⚠️ Escribe el nombre del nuevo ciclo"); setSaving(false); return; }
        if (ciclos.some(c => c.activo)) {
          await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
        }
        const cRes = await dbPost("ciclos", { cliente_id: selected.id, nombre: rutinaForm.ciclo_nombre.trim(), fecha_inicio: rutinaForm.ciclo_fecha, activo: true });
        activeCiclo = cRes[0];
        await loadCiclos();
        setCicloSel(activeCiclo);
      }

      let rid;
      if (editRutina) {
        await dbPatch(`rutinas?id=eq.${editRutina.id}`, { nombre:rutinaForm.nombre, semanas:+rutinaForm.semanas, fecha_inicio:rutinaForm.fecha_inicio });
        rid=editRutina.id; 
        
        const oldIds = editRutina.ejercicios.map(e => e.id);
        const newIds = rutinaForm.ejercicios.filter(e => e.id).map(e => e.id);
        const toDelete = oldIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          await dbDel(`ejercicios?id=in.(${toDelete.join(",")})`);
        }
      } else {
        const r = await dbPost("rutinas", {
          cliente_id: selected.id,
          ciclo_id: activeCiclo?.id || null,
          nombre: rutinaForm.nombre,
          semanas: +rutinaForm.semanas,
          fecha_inicio: rutinaForm.fecha_inicio,
          orden: rutinas.length
        });
        rid=r[0].id;
      }
      
      for (let i=0; i<rutinaForm.ejercicios.length; i++) {
        const e = rutinaForm.ejercicios[i];
        const data = { rutina_id:rid, biblioteca_id:e.biblioteca_id||null, nombre:e.nombre, gif_url:e.gif_url||"", grupo_muscular:e.grupo_muscular||"", tipo_movimiento:e.tipo_movimiento||"", num_series:+e.num_series||4, reps_sugeridas:+e.reps_sugeridas||10, orden:i };
        
        if (e.id) {
          await dbPatch(`ejercicios?id=eq.${e.id}`, data);
        } else {
          await dbPost("ejercicios", data);
        }
      }
      setShowRutinaModal(false); setMsg("✅ Rutina guardada"); await loadData();
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const deleteRutina = async (r) => { if (!confirm(`¿Eliminar "${r.nombre}"?`)) return; await dbDel(`rutinas?id=eq.${r.id}`); setMsg("🗑️ Rutina eliminada"); await loadData(); };
  const addEj = (ej) => {
    if (rutinaForm.ejercicios.find(e=>e.biblioteca_id===ej.id)) return;
    setRutinaForm(p => ({ ...p, ejercicios:[...p.ejercicios, { _dndId: Math.random().toString(36).slice(2,9), biblioteca_id:ej.id, nombre:ej.nombre, grupo_muscular:ej.grupo_muscular, tipo_movimiento:ej.tipo_movimiento, gif_url:ej.gif_url||"", num_series:4, reps_sugeridas:10 }] }));
  };
  const updEj = (i,f,v) => setRutinaForm(p => { const es=[...p.ejercicios]; es[i]={...es[i],[f]:v}; return { ...p, ejercicios:es }; });
  const remEj = (i) => setRutinaForm(p => ({ ...p, ejercicios:p.ejercicios.filter((_,x)=>x!==i) }));

  // ── Handlers de Drag & Drop ──
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndDias = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDias((items) => {
        const oldIndex = items.findIndex(d => String(d.id) === active.id);
        const newIndex = items.findIndex(d => String(d.id) === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Patch in background
        newItems.forEach((d, idx) => {
          if (d.orden !== idx) {
            dbPatch(`nutricion_dias?id=eq.${d.id}`, { orden: idx }).catch(e=>console.error(e));
            d.orden = idx;
          }
        });
        return newItems;
      });
    }
  };

  const handleDragEndComidas = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDiaForm((p) => {
        const oldIndex = p.comidas.findIndex(c => String(c._dndId) === active.id);
        const newIndex = p.comidas.findIndex(c => String(c._dndId) === over.id);
        return { ...p, comidas: arrayMove(p.comidas, oldIndex, newIndex) };
      });
    }
  };

  const handleDragEndRutinas = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRutinas((items) => {
        const oldIndex = items.findIndex(r => String(r.id) === active.id);
        const newIndex = items.findIndex(r => String(r.id) === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Patch in background
        newItems.forEach((r, idx) => {
          if (r.orden !== idx) {
            dbPatch(`rutinas?id=eq.${r.id}`, { orden: idx }).catch(e=>console.error(e));
            r.orden = idx;
          }
        });
        return newItems;
      });
    }
  };

  const handleDragEndEjercicios = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRutinaForm((p) => {
        const oldIndex = p.ejercicios.findIndex(e => String(e._dndId) === active.id);
        const newIndex = p.ejercicios.findIndex(e => String(e._dndId) === over.id);
        return { ...p, ejercicios: arrayMove(p.ejercicios, oldIndex, newIndex) };
      });
    }
  };

  const fmtFecha = (f) => f ? new Date(f+"T12:00:00").toLocaleDateString("es-MX",{month:"short",year:"numeric"}) : "";

  // ── Sin cliente seleccionado ──
  if (!selected) {
    const clientesFiltrados = clientes.filter(c =>
      c.nombre?.toLowerCase().includes(searchProg.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchProg.toLowerCase())
    );
    return (
      <div style={{textAlign:"center",padding:60,color:C.muted}}>
        <div style={{fontSize:40,marginBottom:12}}>👆</div>
        <div style={{marginBottom:16}}>Selecciona un cliente para programar su plan</div>
        <input value={searchProg} onChange={e=>setSearchProg(e.target.value)} placeholder="🔍 Buscar cliente…"
          style={{ background:"rgba(7,16,29,0.7)", border:`1px solid rgba(46,92,184,0.20)`, borderRadius:9, padding:"9px 16px", color:"#e2eeff", fontSize:13, fontFamily:"'Inter',sans-serif", outline:"none", width:"100%", maxWidth:320, marginBottom:16, display:"block", margin:"0 auto 16px" }}
        />
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
          {clientesFiltrados.length === 0
            ? <span style={{color:C.muted,fontSize:13}}>Sin resultados</span>
            : clientesFiltrados.map(c=><Btn key={c.id} small outline color={C.accentDark} onClick={()=>setSelected(c)}>{c.nombre}</Btn>)
          }
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom: 100}}>
      {/* ── Cabecera cliente ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{background:C.accentDeep+"50",border:`1px solid color-mix(in srgb, ${C.accent} 25%, transparent)`,borderRadius:10,padding:"8px 16px"}}>
          <span style={{fontWeight:700,color:C.accent}}>{selected.nombre}</span>
          <span style={{fontSize:12,color:C.muted,marginLeft:8}}>{selected.email}</span>
        </div>
        <Btn small outline color={C.muted} onClick={()=>setSelected(null)}>Cambiar</Btn>
      </div>

      {/* ── Selector de Ciclos ── */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>📅 Ciclos / Períodos</span>
        </div>

        {ciclos.length === 0 ? (
          <div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,padding:"20px",textAlign:"center",color:C.muted,fontSize:13}}>
            Sin ciclos aún. Crea el primer ciclo para comenzar a registrar planes con historial.
          </div>
        ) : (
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
            {ciclos.map(c => (
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                <button onClick={()=>setCicloSel(c)}
                  style={{
                    padding:"10px 18px", borderRadius:"20px 0 0 20px",
                    background: cicloSel?.id === c.id
                      ? (c.activo ? C.gradBtn : "rgba(100,116,139,0.3)")
                      : (c.activo ? "rgba(46,92,184,0.12)" : "rgba(100,116,139,0.1)"),
                    color: cicloSel?.id === c.id
                      ? (c.activo ? "#000" : "#e2eeff")
                      : (c.activo ? C.accent : C.muted),
                    fontWeight: cicloSel?.id === c.id ? 700 : 500,
                    fontSize:13, cursor:"pointer",
                    border: cicloSel?.id === c.id
                      ? `1px solid ${c.activo ? C.accent : "#64748b"}`
                      : `1px solid ${c.activo ? "rgba(46,92,184,0.25)" : "rgba(100,116,139,0.2)"}`,
                    borderRight:"none",
                    transition:"all 0.2s", whiteSpace:"nowrap", fontFamily:"'Inter',sans-serif"
                  }}
                >
                  {c.activo ? "🟢 " : "🗂️ "}{c.nombre}
                  {c.fecha_inicio && <span style={{fontSize:10,opacity:0.7,marginLeft:6}}>{fmtFecha(c.fecha_inicio)}</span>}
                </button>
                {/* Botón de borrar — solo visible al seleccionar ese ciclo */}
                {cicloSel?.id === c.id && (
                  <button
                    onClick={(e) => eliminarCiclo(c, e)}
                    title="Eliminar este ciclo"
                    style={{
                      padding:"10px 10px", borderRadius:"0 20px 20px 0",
                      background: cicloSel?.id === c.id
                        ? (c.activo ? C.gradBtn : "rgba(100,116,139,0.3)")
                        : "rgba(239,68,68,0.08)",
                      border: `1px solid ${c.activo ? C.accent : "#64748b"}`,
                      borderLeft: `1px solid ${c.activo ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.1)"}`,
                      color: c.activo ? "rgba(0,0,0,0.5)" : "rgba(248,113,113,0.8)",
                      cursor:"pointer", fontSize:12, transition:"all 0.2s",
                      display:"flex", alignItems:"center"
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.2)";e.currentTarget.style.color="#f87171";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=cicloSel?.id===c.id?(c.activo?C.gradBtn:"rgba(100,116,139,0.3)"):"rgba(239,68,68,0.08)";e.currentTarget.style.color=c.activo?"rgba(0,0,0,0.5)":"rgba(248,113,113,0.8)";}}
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Badge de modo lectura */}
        {isReadOnly && (
          <div style={{marginTop:10,padding:"8px 14px",background:"rgba(100,116,139,0.1)",borderRadius:10,border:"1px solid rgba(100,116,139,0.2)",fontSize:12,color:"#94a3b8",display:"flex",alignItems:"center",gap:8}}>
            🔒 Estás viendo el historial de <strong style={{color:"#e2eeff"}}>{cicloSel.nombre}</strong>. Solo lectura — el ciclo activo es el verde.
          </div>
        )}
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["nutri","🥗","Nutrición"],["deporte","🏋️","Rutinas"],["progreso","📊","Progreso"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setSubtab(k)} style={{padding:"8px 20px",borderRadius:20,background:subtab===k?C.gradBtn:C.card,color:subtab===k?"#000":C.muted,fontWeight:subtab===k?700:400,fontSize:13,border:`1px solid ${subtab===k?C.accent:C.border}`,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
            {ic} {lb}
          </button>
        ))}
      </div>

      {loading ? <div style={{color:C.muted,textAlign:"center",padding:40}}>Cargando…</div> : <>

        {/* ── NUTRICIÓN ── */}
        {subtab==="nutri"&&(
          <div>
            {!cicloSel && (
              <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(245,158,11,0.08)",borderRadius:10,border:"1px solid rgba(245,158,11,0.2)",fontSize:12,color:"#fbbf24"}}>
                ⚠️ Estás viendo planes sin ciclo asignado. Crea un ciclo para organizar el historial.
              </div>
            )}
            <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:16,marginBottom:14,opacity:isReadOnly?0.75:1}}>
              <div style={{fontWeight:600,marginBottom:14,color:C.accent}}>Macros diarios</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["calorias","🔥 Calorías (kcal)"],["proteina","🥩 Proteína (g)"],["carbohidratos","🍚 Carbohidratos (g)"],["grasas","🫒 Grasas (g)"]].map(([k,lb])=>(
                  <Field key={k} label={lb}><input type="number" value={macros[k]} onChange={e=>setMacros(p=>({...p,[k]:e.target.value}))} placeholder="0" disabled={isReadOnly}/></Field>
                ))}
              </div>
              {!isReadOnly && <Btn small grad onClick={saveMacros} disabled={saving}>{saving?"Guardando…":"Guardar macros"}</Btn>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:600}}>Días del plan <span style={{color:C.muted,fontWeight:400}}>({dias.length})</span></span>
              {!isReadOnly && <Btn small grad onClick={openNewDia}>+ Día</Btn>}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndDias}>
              <SortableContext items={dias.map(d => String(d.id))} strategy={verticalListSortingStrategy}>
                {dias.map(d=>(
                  <SortableItem key={d.id} id={d.id}>
                    {({ dragHandle, isDragging }) => (
                      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {!isReadOnly && dragHandle}
                          <div><span style={{fontWeight:600}}>{d.dia}</span><span style={{fontSize:12,color:C.muted,marginLeft:10}}>{d.comidas.length} comidas</span></div>
                        </div>
                        {!isReadOnly && (
                          <div style={{display:"flex",gap:6}}>
                            <Btn small outline color={C.accent} onClick={()=>openEditDia(d)}>Editar</Btn>
                            <Btn small danger onClick={()=>deleteDia(d)}>Borrar</Btn>
                          </div>
                        )}
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* ── RUTINAS ── */}
        {subtab==="deporte"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontWeight:600}}>Rutinas <span style={{color:C.muted,fontWeight:400}}>({rutinas.length})</span></span>
              {!isReadOnly && <Btn small grad onClick={openNewRutina}>+ Rutina</Btn>}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndRutinas}>
              <SortableContext items={rutinas.map(r => String(r.id))} strategy={verticalListSortingStrategy}>
                {rutinas.map(r=>(
                  <SortableItem key={r.id} id={r.id}>
                    {({ dragHandle, isDragging }) => (
                      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 14px",marginBottom:8,opacity:isReadOnly?0.75:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {!isReadOnly && dragHandle}
                            <div><span style={{fontWeight:600}}>{r.nombre}</span><span style={{fontSize:12,color:C.muted,marginLeft:10}}>{r.ejercicios.length} ejercicios · {r.semanas} sem</span></div>
                          </div>
                          {!isReadOnly && (
                            <div style={{display:"flex",gap:6}}>
                              <Btn small outline color={C.accentDark} onClick={()=>openEditRutina(r)}>Editar</Btn>
                              <Btn small danger onClick={()=>deleteRutina(r)}>Borrar</Btn>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            {rutinas.length===0 && !isReadOnly && (
              <div style={{textAlign:"center",padding:"32px 0",color:C.muted,fontSize:13}}>Sin rutinas en este ciclo. ¡Agrega la primera!</div>
            )}
          </div>
        )}

        {subtab==="progreso"&&(
          <ProgresoCliente selected={selected} setMsg={setMsg}/>
        )}
      </>}

      {/* ── Modal Nuevo Ciclo ── */}
      {showNuevoCiclo&&(
        <Modal title="📅 Nuevo Ciclo / Período" onClose={()=>setShowNuevoCiclo(false)}>
          <div style={{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.6,background:`color-mix(in srgb,${C.accentDeep} 20%,transparent)`,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px"}}>
            Al crear un nuevo ciclo, el ciclo activo actual se archivará automáticamente como historial. Podrás consultarlo en cualquier momento.
          </div>
          <Field label="Nombre del ciclo">
            <input value={nuevoCicloNombre} onChange={e=>setNuevoCicloNombre(e.target.value)} placeholder='Ej. "Mayo - Definición", "Mes 1", "Etapa Volumen"'/>
          </Field>
          <Field label="Fecha de inicio">
            <input type="date" value={nuevoCicloFecha} onChange={e=>setNuevoCicloFecha(e.target.value)}/>
          </Field>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
            <Btn outline color={C.muted} onClick={()=>setShowNuevoCiclo(false)}>Cancelar</Btn>
            <Btn grad onClick={crearCiclo} disabled={savingCiclo}>{savingCiclo?"Creando…":"Crear Ciclo"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── Modal Nuevo/Editar Día ── */}
      {showDiaModal&&(
        <Modal title={editDia?`Editar: ${editDia.dia}`:"Nuevo día"} onClose={()=>setShowDiaModal(false)} wide>
          {!editDia && (
            <div style={{marginBottom:16,background:C.card,borderRadius:10,padding:12,border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",gap:16,marginBottom:diaForm.crear_ciclo?12:0}}>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="radio" checked={!diaForm.crear_ciclo} onChange={()=>setDiaForm(p=>({...p,crear_ciclo:false}))}/>
                  Usar ciclo actual {cicloSel ? `(${cicloSel.nombre})` : ""}
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="radio" checked={diaForm.crear_ciclo} onChange={()=>setDiaForm(p=>({...p,crear_ciclo:true}))}/>
                  Crear nuevo ciclo
                </label>
              </div>
              {diaForm.crear_ciclo && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Field label="Nombre del ciclo"><input value={diaForm.ciclo_nombre} onChange={e=>setDiaForm(p=>({...p,ciclo_nombre:e.target.value}))} placeholder="Ej. Mes 2"/></Field>
                  <Field label="Fecha inicio del ciclo"><input type="date" value={diaForm.ciclo_fecha} onChange={e=>setDiaForm(p=>({...p,ciclo_fecha:e.target.value}))}/></Field>
                </div>
              )}
            </div>
          )}
          <Field label="Nombre del día"><input value={diaForm.dia} onChange={e=>setDiaForm(p=>({...p,dia:e.target.value}))} placeholder="Lunes, Día 1…"/></Field>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontWeight:600,fontSize:14}}>Comidas</span>
            <Btn small outline color={C.accent} onClick={addComida}>+ Comida</Btn>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndComidas}>
            <SortableContext items={diaForm.comidas.map(c => String(c._dndId))} strategy={verticalListSortingStrategy}>
              {diaForm.comidas.map((c,i)=>(
                <SortableItem key={c._dndId} id={c._dndId}>
                  {({ dragHandle, isDragging }) => (
                    <div style={{background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,padding:12,marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {dragHandle}
                          <span style={{fontSize:12,color:C.muted}}>Comida {i+1}</span>
                        </div>
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
                  )}
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn outline color={C.muted} onClick={()=>setShowDiaModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveDia} disabled={saving}>{saving?"Guardando…":"Guardar día"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── Modal Nueva/Editar Rutina ── */}
      {showRutinaModal&&(
        <Modal title={editRutina?`Editar: ${editRutina.nombre}`:"Nueva rutina"} onClose={()=>setShowRutinaModal(false)} wide>
          {!editRutina && (
            <div style={{marginBottom:16,background:C.card,borderRadius:10,padding:12,border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",gap:16,marginBottom:rutinaForm.crear_ciclo?12:0}}>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="radio" checked={!rutinaForm.crear_ciclo} onChange={()=>setRutinaForm(p=>({...p,crear_ciclo:false}))}/>
                  Usar ciclo actual {cicloSel ? `(${cicloSel.nombre})` : ""}
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="radio" checked={rutinaForm.crear_ciclo} onChange={()=>setRutinaForm(p=>({...p,crear_ciclo:true}))}/>
                  Crear nuevo ciclo
                </label>
              </div>
              {rutinaForm.crear_ciclo && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Field label="Nombre del ciclo"><input value={rutinaForm.ciclo_nombre} onChange={e=>setRutinaForm(p=>({...p,ciclo_nombre:e.target.value}))} placeholder="Ej. Mes 2"/></Field>
                  <Field label="Fecha inicio del ciclo"><input type="date" value={rutinaForm.ciclo_fecha} onChange={e=>setRutinaForm(p=>({...p,ciclo_fecha:e.target.value}))}/></Field>
                </div>
              )}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
            <Field label="Nombre"><input value={rutinaForm.nombre} onChange={e=>setRutinaForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Upper 1"/></Field>
            <Field label="Semanas"><input type="number" value={rutinaForm.semanas} onChange={e=>setRutinaForm(p=>({...p,semanas:e.target.value}))}/></Field>
            <Field label="Fecha inicio"><input type="date" value={rutinaForm.fecha_inicio} onChange={e=>setRutinaForm(p=>({...p,fecha_inicio:e.target.value}))}/></Field>
          </div>
          <EjercicioSelector biblioteca={biblioteca} onSelect={addEj} selected={rutinaForm.ejercicios}/>
          {rutinaForm.ejercicios.length>0&&(
            <div style={{marginTop:12}}>
              <div style={{display:"grid",gridTemplateColumns:"24px 40px 1fr 80px 80px 32px",gap:6,marginBottom:6,alignItems:"center"}}>
                <span/><span/><span style={{fontSize:11,color:C.muted,fontWeight:600}}>EJERCICIO</span>
                <span style={{fontSize:11,color:C.muted,fontWeight:600,textAlign:"center"}}>SERIES</span>
                <span style={{fontSize:11,color:C.muted,fontWeight:600,textAlign:"center"}}>REPS</span>
                <span/>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndEjercicios}>
                <SortableContext items={rutinaForm.ejercicios.map(e => String(e._dndId))} strategy={verticalListSortingStrategy}>
                  {rutinaForm.ejercicios.map((e,i)=>(
                    <SortableItem key={e._dndId} id={e._dndId}>
                      {({ dragHandle, isDragging }) => (
                        <div style={{display:"grid",gridTemplateColumns:"24px 40px 1fr 80px 80px 32px",gap:6,marginBottom:8,alignItems:"center",background:isDragging?C.card:"transparent",borderRadius:isDragging?8:0}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {dragHandle}
                          </div>
                          <div style={{width:36,height:36,borderRadius:6,overflow:"hidden",background:C.surface,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {e.gif_url?<img src={e.gif_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:18}}>🏋️</span>}
                          </div>
                          <div style={{fontSize:13,fontWeight:500}}>{e.nombre}<br/><span style={{fontSize:10,color:C.muted}}>{e.grupo_muscular} · {e.tipo_movimiento}</span></div>
                          <input type="number" value={e.num_series} onChange={ev=>updEj(i,"num_series",ev.target.value)} placeholder="4" style={{textAlign:"center"}}/>
                          <input type="number" value={e.reps_sugeridas} onChange={ev=>updEj(i,"reps_sugeridas",ev.target.value)} placeholder="10" style={{textAlign:"center"}}/>
                          <button onClick={()=>remEj(i)} style={{background:"#ef444430",color:"#ef4444",borderRadius:6,padding:6,cursor:"pointer",fontSize:14,border:"none"}}>×</button>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:"auto",paddingTop:16}}>
            <Btn outline color={C.muted} onClick={()=>setShowRutinaModal(false)}>Cancelar</Btn>
            <Btn grad onClick={saveRutina} disabled={saving}>{saving?"Guardando…":"Guardar rutina"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── FAB PARA PDF ── */}
      {subtab === "nutri" && dias.length > 0 && (
        <div style={{
          position: "fixed", bottom: 32, right: 24, zIndex: 50,
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <button
            onClick={() => generateNutriPDF(selected, nutri, dias, brand)}
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
            Descargar Plan PDF
          </button>
        </div>
      )}

    </div>
  );
}
