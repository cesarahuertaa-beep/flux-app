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
import { Trash2, Calendar, Activity, CheckCircle2, AlertCircle, Save, Edit2, Plus, Search, FileText, Download, Lock, X, Utensils, Dumbbell, BarChart2 } from "lucide-react";
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
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ fecha_inicio: new Date().toISOString().split("T")[0], semanas: 4 });
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [editDia, setEditDia] = useState(null);
  const [diaForm, setDiaForm] = useState({ dia:"", orden:0, comidas:[] });
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editRutina, setEditRutina] = useState(null);
  const [rutinaForm, setRutinaForm] = useState({ nombre:"", ejercicios:[] });

  const ORDINALES = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"];

  const isReadOnly = cicloSel && !cicloSel.activo;

  // ── Historial para Plantillas ──
  const [historialRutinas, setHistorialRutinas] = useState([]);
  const [historialDias, setHistorialDias] = useState([]);
  
  const getClientName = (id) => clientes?.find(c => c.id === id)?.nombre || "Desconocido";

  const loadHistorial = useCallback(async () => {
    if (!clientes || clientes.length === 0) return;
    try {
      // Revertimos al uso de in.(ids) porque RLS podría requerir el cliente_id
      // o la tabla podría no tener created_at
      const ids = clientes.map(c => c.id).join(",");
      const hr = await dbGet(`rutinas?cliente_id=in.(${ids})`);
      setHistorialRutinas(hr);
      
      const hn = await dbGet(`nutricion?cliente_id=in.(${ids})`);
      if (hn.length > 0) {
        const nids = hn.map(n => n.id).join(",");
        const hd = await dbGet(`nutricion_dias?nutricion_id=in.(${nids})`);
        const hdMapped = hd.map(d => {
          const nut = hn.find(n => n.id === d.nutricion_id);
          return { ...d, cliente_id: nut?.cliente_id };
        });
        setHistorialDias(hdMapped);
      }
    } catch(e) { setMsg("❌ Error cargando historial: " + e.message); }
  }, [clientes]);

  useEffect(() => { loadHistorial(); }, [loadHistorial]);

  const onSelectHistorialRutina = async (e) => {
    const rid = e.target.value;
    if (!rid) return;
    e.target.value = ""; // reset select
    const r = historialRutinas.find(x => String(x.id) === rid);
    if (!r) return;
    setLoading(true);
    try {
      const ejs = await dbGet(`ejercicios?rutina_id=eq.${rid}&order=orden.asc`);
      setRutinaForm(p => ({
        ...p,
        nombre: r.nombre + " (Copia)",
        semanas: r.semanas,
        ejercicios: ejs.map(x => {
           const copy = {...x, _dndId: Math.random().toString(36).slice(2,9)};
           delete copy.id;
           delete copy.rutina_id;
           return copy;
        })
      }));
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Rutina cargada del historial</div>);
    } catch(err) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error cargando rutina</div>); }
    setLoading(false);
  };

  const onSelectHistorialDia = async (e) => {
    const did = e.target.value;
    if (!did) return;
    e.target.value = ""; // reset select
    const d = historialDias.find(x => String(x.id) === did);
    if (!d) return;
    setLoading(true);
    try {
      const coms = await dbGet(`comidas?dia_id=eq.${did}&order=orden.asc`);
      setDiaForm(p => ({
        ...p,
        dia: d.dia + " (Copia)",
        comidas: coms.map(x => {
           const copy = {...x, _dndId: Math.random().toString(36).slice(2,9)};
           delete copy.id;
           delete copy.dia_id;
           return copy;
        })
      }));
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Día cargado del historial</div>);
    } catch(err) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error cargando día</div>); }
    setLoading(false);
  };

  // ── Cargar ciclos del cliente ──
  const loadCiclos = useCallback(async () => {
    if (!selected) return;
    try {
      const cs = await dbGet(`ciclos?cliente_id=eq.${selected.id}&order=created_at.desc`);
      setCiclos(cs);
      // Seleccionar el ciclo activo por defecto
      const activo = cs.find(c => c.activo) || cs[0] || null;
      setCicloSel(activo);
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); }
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
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); }
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
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-yellow-500" /> No puedes borrar un ciclo que tiene planes o rutinas. Primero elimina su contenido.</div>);
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
          setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ciclo eliminado.</div>);
        }
      } else {
        setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ciclo eliminado.</div>);
      }

      await dbDel(`ciclos?id=eq.${ciclo.id}`);
      await loadCiclos();
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); }
  };

  // ── Operaciones de Planes (Ciclos) ──
  const getCycleWeeks = (c) => c?.nombre.includes("|") ? parseInt(c.nombre.split("|")[1]) : 4;

  const savePlan = async () => {
    setSaving(true);
    try {
      const start = new Date(planForm.fecha_inicio + "T12:00:00");
      const end = new Date(start);
      end.setDate(end.getDate() + (parseInt(planForm.semanas) * 7) - 1);
      const options = { day: 'numeric', month: 'short' };
      const rangeStr = `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
      
      const idx = ciclos.length;
      const ordinal = ORDINALES[idx] || `${idx + 1}º`;
      const finalName = `${ordinal} Plan (${rangeStr})|${planForm.semanas}`;

      if (ciclos.some(c => c.activo)) {
        await dbPatch(`ciclos?cliente_id=eq.${selected.id}&activo=eq.true`, { activo: false });
      }
      const cRes = await dbPost("ciclos", { cliente_id: selected.id, nombre: finalName, fecha_inicio: planForm.fecha_inicio, activo: true });
      await loadCiclos();
      setCicloSel(cRes[0]);
      setShowPlanModal(false);
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Plan creado exitosamente</div>);
    } catch(e) { 
      setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); 
    }
    setSaving(false);
  };

  const interceptNoPlan = () => {
    if (!cicloSel) {
      setShowPlanModal(true);
      return true;
    }
    return false;
  };

  const saveMacros = async () => {
    if (isReadOnly) return;
    if (interceptNoPlan()) return;
    setSaving(true);
    try {
      if (nutri) await dbPatch(`nutricion?id=eq.${nutri.id}`, { ...macros, updated_at:new Date().toISOString() });
      else {
        const r = await dbPost("nutricion", {
          cliente_id: selected.id,
          ciclo_id: cicloSel.id,
          ...macros
        });
        setNutri(r[0]);
      }
      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Macros guardados</div>);
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); }
    setSaving(false);
  };

  const openNewDia  = () => { if (interceptNoPlan()) return; setEditDia(null); setDiaForm({ dia:"", diasSeleccionados:[], tituloPersonalizado:"", orden:dias.length, comidas:[{ _dndId: Math.random().toString(36).slice(2,9), hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }); setShowDiaModal(true); };
  const openEditDia = (d) => { setEditDia(d); setDiaForm({ dia:d.dia, orden:d.orden, comidas:d.comidas.map(c=>({...c, _dndId: String(c.id || Math.random().toString(36).slice(2,9))})) }); setShowDiaModal(true); };

  const saveDia = async () => {
    if (!nutri) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-yellow-500" /> Guarda los macros primero</div>); return; }
    setSaving(true);
    try {
      let currentNutri = nutri;

      if (editDia) { 
        await dbPatch(`nutricion_dias?id=eq.${editDia.id}`, { dia:diaForm.dia, orden:diaForm.orden }); 
        const diaId = editDia.id; 
        
        const oldIds = editDia.comidas.map(c => c.id);
        const newIds = diaForm.comidas.filter(c => c.id).map(c => c.id);
        const toDelete = oldIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          await dbDel(`comidas?id=in.(${toDelete.join(",")})`);
        }

        for (let i=0; i<diaForm.comidas.length; i++) {
          const c = diaForm.comidas[i];
          const data = { ...c, dia_id:diaId, orden:i, calorias:+c.calorias||0, proteina:+c.proteina||0, carbohidratos:+c.carbohidratos||0, grasas:+c.grasas||0 };
          delete data.id;
          delete data._dndId;
          
          if (c.id) {
            await dbPatch(`comidas?id=eq.${c.id}`, data);
          } else {
            await dbPost("comidas", data);
          }
        }
      } else { 
        // Creación masiva (Múltiples días) o normal
        const dSeleccionados = diaForm.diasSeleccionados || [];
        const creationDays = dSeleccionados.length > 0 ? dSeleccionados : [diaForm.dia || `Día ${dias.length + 1}`];
        let orderCounter = diaForm.orden;

        for (const dayCode of creationDays) {
          let finalName = dayCode;
          if (dSeleccionados.length > 0 && diaForm.tituloPersonalizado) {
            finalName = `${dayCode} - ${diaForm.tituloPersonalizado}`;
          }

          const r = await dbPost("nutricion_dias", { nutricion_id:currentNutri.id, dia:finalName, orden:orderCounter }); 
          const newDiaId = r[0].id; 
          
          for (let i=0; i<diaForm.comidas.length; i++) {
            const c = diaForm.comidas[i];
            const data = { ...c, dia_id:newDiaId, orden:i, calorias:+c.calorias||0, proteina:+c.proteina||0, carbohidratos:+c.carbohidratos||0, grasas:+c.grasas||0 };
            delete data.id;
            delete data._dndId;
            await dbPost("comidas", data);
          }
          orderCounter++;
        }
      }
      setShowDiaModal(false); setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Día guardado</div>); await loadData();
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); }
    setSaving(false);
  };

  const deleteDia  = async (d) => { if (!confirm(`¿Eliminar "${d.dia}"?`)) return; await dbDel(`nutricion_dias?id=eq.${d.id}`); setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Día eliminado</div>); await loadData(); };
  const addComida  = () => setDiaForm(p => ({ ...p, comidas:[...p.comidas, { _dndId: Math.random().toString(36).slice(2,9), hora:"", nombre:"", opcion1:"", opcion2:"", calorias:"", proteina:"", carbohidratos:"", grasas:"" }] }));
  const updComida  = (i,f,v) => setDiaForm(p => { const cs=[...p.comidas]; cs[i]={...cs[i],[f]:v}; return { ...p, comidas:cs }; });
  const remComida  = (i) => setDiaForm(p => ({ ...p, comidas:p.comidas.filter((_,x)=>x!==i) }));

  // ── Operaciones de Rutinas ──
  const openNewRutina  = () => { if (interceptNoPlan()) return; setEditRutina(null); setRutinaForm({ nombre:"", ejercicios:[] }); setShowRutinaModal(true); };
  const openEditRutina = (r) => { setEditRutina(r); setRutinaForm({ nombre:r.nombre, ejercicios:r.ejercicios.map(e=>({...e, _dndId: String(e.id || Math.random().toString(36).slice(2,9))})) }); setShowRutinaModal(true); };

  const saveRutina = async () => {
    setSaving(true);
    try {
      let activeCiclo = cicloSel;

      let rid;
      if (editRutina) {
        await dbPatch(`rutinas?id=eq.${editRutina.id}`, { nombre:rutinaForm.nombre });
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
      setShowRutinaModal(false); setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Rutina guardada</div>); await loadData();
    } catch(e) { setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> { e.message }</div>); }
    setSaving(false);
  };

  const deleteRutina = async (r) => { if (!confirm(`¿Eliminar "${r.nombre}"?`)) return; await dbDel(`rutinas?id=eq.${r.id}`); setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Rutina eliminada</div>); await loadData(); };
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
  if (!selected) return null;

  return (
    <div className="pb-[100px]">
      {/* ── Cabecera cliente ── */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        <div className="bg-[#0B1929]/5 border border-[#0B1929]/20 rounded-xl px-4 py-2">
          <span className="font-bold text-[var(--brand-primary)]">{selected.nombre}</span>
          <span className="text-xs text-[#6B7A8D] ml-2">{selected.email}</span>
        </div>
        <button className="text-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors" onClick={() => setSelected(null)}>
          Cambiar
        </button>
      </div>

      {/* ── Selector de Ciclos ── */}
      {ciclos.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-bold text-[#6B7A8D] uppercase tracking-[0.8px]">Planes del Paciente</span>
            <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors font-medium" onClick={() => setShowPlanModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Siguiente Plan
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {ciclos.map(c => (
              <div key={c.id} className="flex items-center flex-shrink-0 group">
                <button 
                  onClick={() => setCicloSel(c)}
                  className={`px-4 py-2 text-[13px] transition-colors border ${
                    cicloSel?.id === c.id 
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold" 
                      : c.activo 
                        ? "bg-blue-50/50 border-blue-200 text-[var(--brand-primary)] hover:bg-blue-50 font-medium" 
                        : "bg-white border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium"
                  } ${cicloSel?.id === c.id ? "rounded-l-xl border-r-0" : "rounded-xl"}`}
                >
                  {c.nombre.split("|")[0]}
                </button>
                {cicloSel?.id === c.id && (
                  <button
                    onClick={(e) => eliminarCiclo(c, e)}
                    title="Eliminar este plan"
                    className="px-3 py-2 bg-[var(--brand-primary)] text-white/80 hover:text-white border-y border-r border-[var(--brand-primary)] rounded-r-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
        {cicloSel && !cicloSel.activo && (
          <div className="mt-2.5 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
          </div>
        )}

      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 mb-4 bg-[#F0F4FA] rounded-xl p-1 inline-flex w-max">
        {[
          { k: "nutri", ic: <Utensils className="w-4 h-4"/>, lb: "Nutrición" },
          { k: "deporte", ic: <Dumbbell className="w-4 h-4"/>, lb: "Rutinas" },
          { k: "progreso", ic: <BarChart2 className="w-4 h-4"/>, lb: "Progreso" }
        ].map(({ k, ic, lb }) => (
          <button 
            key={k} 
            onClick={() => setSubtab(k)} 
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] transition-all ${
              subtab === k 
                ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold border border-transparent" 
                : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"
            }`}
          >
            {ic} {lb}
          </button>
        ))}
      </div>

      {loading ? <div className="text-[#6B7A8D] text-center p-10">Cargando…</div> : <>

        {/* ── NUTRICIÓN ── */}
        {subtab === "nutri" && (
          <div>
            {!cicloSel && (
              <div className="mb-3 px-3.5 py-2.5 bg-yellow-50 rounded-xl border border-yellow-200 text-xs text-yellow-600 flex items-center gap-2">
                <AlertCircle className="w-[14px] h-[14px]" /> Estás viendo planes sin ciclo asignado. Crea un ciclo para organizar el historial.
              </div>
            )}
            <div className={`bg-white rounded-2xl border border-[#E2E8F0] p-4 mb-3.5 ${isReadOnly ? 'opacity-75' : ''}`}>
              <div className="flex justify-between items-center mb-3.5">
                <div className="font-semibold text-[var(--brand-primary)]">Macros diarios</div>
                {dias.length > 0 && (
                  <button
                    onClick={() => generateNutriPDF(selected, nutri, dias, brand)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#0B1929] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar PDF
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[["calorias", "Calorías (kcal)"], ["proteina", "Proteína (g)"], ["carbohidratos", "Carbohidratos (g)"], ["grasas", "Grasas (g)"]].map(([k, lb]) => (
                  <div key={k} className="mb-3">
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">{lb}</label>
                    <input type="number" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] disabled:opacity-50" value={macros[k]} onChange={e => setMacros(p => ({ ...p, [k]: e.target.value }))} placeholder="0" disabled={isReadOnly} />
                  </div>
                ))}
              </div>
              {!isReadOnly && <button className="text-xs px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50" onClick={saveMacros} disabled={saving}>{saving ? "Guardando…" : "Guardar macros"}</button>}
            </div>
            <div className="flex justify-between items-center mb-2.5">
              <span className="font-semibold">Días del plan <span className="text-[#6B7A8D] font-normal">({dias.length})</span></span>
              {!isReadOnly && <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity" onClick={openNewDia}><Plus className="w-3.5 h-3.5" /> Día</button>}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndDias}>
              <SortableContext items={dias.map(d => String(d.id))} strategy={verticalListSortingStrategy}>
                {dias.map(d => (
                  <SortableItem key={d.id} id={d.id}>
                    {({ dragHandle, isDragging }) => (
                      <div className="bg-white rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 mb-2 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {!isReadOnly && dragHandle}
                          <div><span className="font-semibold">{d.dia}</span><span className="text-xs text-[#6B7A8D] ml-2.5">{d.comidas.length} comidas</span></div>
                        </div>
                        {!isReadOnly && (
                          <div className="flex gap-1.5">
                            <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors font-medium" onClick={() => openEditDia(d)}><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                            <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium" onClick={() => deleteDia(d)}><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
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
        {subtab === "deporte" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold">Rutinas <span className="text-[#6B7A8D] font-normal">({rutinas.length})</span></span>
              {!isReadOnly && <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity" onClick={openNewRutina}><Plus className="w-3.5 h-3.5" /> Rutina</button>}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndRutinas}>
              <SortableContext items={rutinas.map(r => String(r.id))} strategy={verticalListSortingStrategy}>
                {rutinas.map(r => (
                  <SortableItem key={r.id} id={r.id}>
                    {({ dragHandle, isDragging }) => (
                      <div className={`bg-white rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 mb-2 ${isReadOnly ? 'opacity-75' : ''}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {!isReadOnly && dragHandle}
                            <div><span className="font-semibold">{r.nombre}</span><span className="text-xs text-[#6B7A8D] ml-2.5">{r.ejercicios.length} ejercicios · {r.semanas} sem</span></div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex gap-1.5">
                              <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors font-medium" onClick={() => openEditRutina(r)}><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                              <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium" onClick={() => deleteRutina(r)}><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            {rutinas.length === 0 && !isReadOnly && (
              <div className="text-center py-8 text-[#6B7A8D] text-[13px]">Sin rutinas en este ciclo. ¡Agrega la primera!</div>
            )}
          </div>
        )}

        {subtab === "progreso" && (
          <ProgresoCliente selected={selected} setMsg={setMsg}/>
        )}
      </>}

      {/* ── Modal Nuevo Plan ── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0B1929]">Configuración del Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#6B7A8D] mb-5">
                Al iniciar un nuevo plan, se establecerá el rango de tiempo durante el cual la dieta y las rutinas estarán activas.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Fecha de inicio</label>
                  <input type="date" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={planForm.fecha_inicio} onChange={e=>setPlanForm(p=>({...p,fecha_inicio:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Duración (Semanas)</label>
                  <input type="number" min="1" max="52" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={planForm.semanas} onChange={e=>setPlanForm(p=>({...p,semanas:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[#E2E8F0] flex justify-end gap-2.5">
              <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors text-[14px]">Cancelar</button>
              <button onClick={savePlan} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white font-medium hover:opacity-90 transition-opacity text-[14px] shadow-sm disabled:opacity-50">
                {saving ? "Creando..." : "Iniciar Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nuevo/Editar Día ── */}
      {showDiaModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0B1929]">{editDia ? `Editar: ${editDia.dia}` : "Nuevo día"}</h3>
              <button onClick={() => setShowDiaModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!editDia && (
                <div className="mb-4 bg-white rounded-xl p-3 border border-[#E2E8F0]">
                  {historialDias.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-[#E2E8F0]">
                      <div className="text-xs font-semibold text-[#6B7A8D] mb-1.5 uppercase tracking-wider">IMPORTAR DESDE HISTORIAL</div>
                      <select onChange={onSelectHistorialDia} className="w-full px-2.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[14px]">
                        <option value="">-- Seleccionar día preexistente --</option>
                        {historialDias.map(hd => (
                          <option key={hd.id} value={hd.id}>{hd.dia} (de {getClientName(hd.cliente_id)})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
                {!editDia ? (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Días de la semana</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].map(d => (
                        <button
                          key={d}
                          onClick={() => {
                            setDiaForm(p => ({
                              ...p,
                              diasSeleccionados: p.diasSeleccionados?.includes(d) 
                                ? p.diasSeleccionados.filter(x => x !== d) 
                                : [...(p.diasSeleccionados || []), d]
                            }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${diaForm.diasSeleccionados?.includes(d) ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm' : 'bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Título Adicional / Nota (Opcional)</label>
                    <input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" value={diaForm.tituloPersonalizado || ""} onChange={e=>setDiaForm(p=>({...p,tituloPersonalizado:e.target.value}))} placeholder="Ej. Fase de Volumen" />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre del día</label>
                    <input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" value={diaForm.dia} onChange={e=>setDiaForm(p=>({...p,dia:e.target.value}))} placeholder="Lunes, Día 1…" />
                  </div>
                )}
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-semibold text-[14px]">Comidas</span>
                <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-blue-50 transition-colors font-medium" onClick={addComida}><Plus className="w-3.5 h-3.5" /> Comida</button>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndComidas}>
                <SortableContext items={diaForm.comidas.map(c => String(c._dndId))} strategy={verticalListSortingStrategy}>
                  {diaForm.comidas.map((c, i) => (
                    <SortableItem key={c._dndId} id={c._dndId}>
                      {({ dragHandle, isDragging }) => (
                        <div className="bg-gray-50 rounded-xl border border-[#E2E8F0] p-3 mb-2.5">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              {dragHandle}
                              <span className="text-xs text-[#6B7A8D] font-medium">Comida {i + 1}</span>
                            </div>
                            <button onClick={() => remComida(i)} className="text-red-400 hover:text-red-600 transition-colors border-none bg-transparent">
                              <Trash2 className="w-[18px] h-[18px]" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Hora</label><input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={c.hora} onChange={e=>updComida(i,"hora",e.target.value)} placeholder="7:00 am" /></div>
                            <div><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre</label><input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={c.nombre} onChange={e=>updComida(i,"nombre",e.target.value)} placeholder="Desayuno" /></div>
                          </div>
                          <div className="mb-2"><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Opción 1</label><textarea className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] min-h-[60px]" value={c.opcion1} onChange={e=>updComida(i,"opcion1",e.target.value)} placeholder="Descripción…" /></div>
                          <div className="mb-2"><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Opción 2</label><textarea className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px] min-h-[60px]" value={c.opcion2} onChange={e=>updComida(i,"opcion2",e.target.value)} placeholder="Descripción…" /></div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[["calorias", "Kcal"], ["proteina", "Prot g"], ["carbohidratos", "Carbs g"], ["grasas", "Grasas g"]].map(([f, lb]) => (
                              <div key={f}><label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">{lb}</label><input type="number" className="w-full px-2 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={c[f]} onChange={e=>updComida(i,f,e.target.value)} placeholder="0" /></div>
                            ))}
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#E2E8F0]">
                <button className="text-sm px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors" onClick={() => setShowDiaModal(false)}>Cancelar</button>
                <button className="text-sm px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50" onClick={saveDia} disabled={saving}>{saving ? "Guardando…" : "Guardar día"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nueva/Editar Rutina ── */}
      {showRutinaModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0B1929]">{editRutina ? `Editar: ${editRutina.nombre}` : "Nueva rutina"}</h3>
              <button onClick={() => setShowRutinaModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!editRutina && (
                <div className="mb-4 bg-white rounded-xl p-3 border border-[#E2E8F0]">
                  {historialRutinas.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-[#E2E8F0]">
                      <div className="text-xs font-semibold text-[#6B7A8D] mb-1.5 uppercase tracking-wider">IMPORTAR DESDE HISTORIAL</div>
                      <select onChange={onSelectHistorialRutina} className="w-full px-2.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[14px]">
                        <option value="">-- Seleccionar rutina preexistente --</option>
                        {historialRutinas.map(hr => (
                          <option key={hr.id} value={hr.id}>{hr.nombre} (de {getClientName(hr.cliente_id)})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  </div>
                )}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre de la Rutina</label>
                  <input className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[14px]" value={rutinaForm.nombre} onChange={e=>setRutinaForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Upper 1, Pierna, etc." />
                </div>
              <EjercicioSelector biblioteca={biblioteca} onSelect={addEj} selected={rutinaForm.ejercicios}/>
              {rutinaForm.ejercicios.length > 0 && (
                <div className="mt-3">
                  <div className="grid grid-cols-[24px_40px_1fr_80px_80px_32px] gap-1.5 mb-1.5 items-center">
                    <span/><span/><span className="text-[11px] text-[#6B7A8D] font-semibold">EJERCICIO</span>
                    <span className="text-[11px] text-[#6B7A8D] font-semibold text-center">SERIES</span>
                    <span className="text-[11px] text-[#6B7A8D] font-semibold text-center">REPS</span>
                    <span/>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndEjercicios}>
                    <SortableContext items={rutinaForm.ejercicios.map(e => String(e._dndId))} strategy={verticalListSortingStrategy}>
                      {rutinaForm.ejercicios.map((e, i) => (
                        <SortableItem key={e._dndId} id={e._dndId}>
                          {({ dragHandle, isDragging }) => (
                            <div className={`grid grid-cols-[24px_40px_1fr_80px_80px_32px] gap-1.5 mb-2 items-center ${isDragging ? 'bg-white rounded-lg shadow-sm border border-[#E2E8F0]' : 'bg-transparent'}`}>
                              <div className="flex items-center justify-center">{dragHandle}</div>
                              <div className="w-9 h-9 rounded-md overflow-hidden bg-gray-50 border border-[#E2E8F0] flex items-center justify-center">
                                {e.gif_url ? <img src={e.gif_url} alt="" className="w-full h-full object-cover"/> : <Dumbbell className="w-[18px] h-[18px] text-[#6B7A8D]" />}
                              </div>
                              <div className="text-[13px] font-medium leading-tight">{e.nombre}<br/><span className="text-[10px] text-[#6B7A8D] font-normal">{e.grupo_muscular} · {e.tipo_movimiento}</span></div>
                              <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={e.num_series} onChange={ev=>updEj(i,"num_series",ev.target.value)} placeholder="4" />
                              <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-center" value={e.reps_sugeridas} onChange={ev=>updEj(i,"reps_sugeridas",ev.target.value)} placeholder="10" />
                              <button onClick={() => remEj(i)} className="bg-red-50 text-red-500 rounded-md p-1.5 hover:bg-red-100 flex items-center justify-center transition-colors border-none">
                                <Trash2 className="w-[14px] h-[14px]" />
                              </button>
                            </div>
                          )}
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
              <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#E2E8F0]">
                <button className="text-sm px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors" onClick={() => setShowRutinaModal(false)}>Cancelar</button>
                <button className="text-sm px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50" onClick={saveRutina} disabled={saving}>{saving ? "Guardando…" : "Guardar rutina"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Se removió el FAB para PDF y se integró en la cabecera ── */}
    </div>
  );
}
