import { useState, useEffect, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { generateProgresoPDF } from "../../utils/pdf";
import { parseFotos, getSemanasConFecha } from "../../utils/helpers";
import { 
  Scale, Microscope, Ruler, Stethoscope, BarChart2, Dumbbell, 
  Calendar, Edit2, Camera, FileText, Activity, BicepsFlexed, Plus, Trash2, Heart, ArrowUp, ArrowDown, X
} from "lucide-react";

const METRIC_GROUPS = [
  { label:"Básicas", icon:<Scale className="w-4 h-4" />, fields:[
    { key:"peso",      label:"Peso (kg)",     type:"number", step:"0.1" },
    { key:"estatura",  label:"Estatura (cm)", type:"number" },
    { key:"imc",       label:"IMC",           type:"number", step:"0.01", readOnly:true },
  ]},
  { label:"Composición corporal", icon:<Microscope className="w-4 h-4" />, fields:[
    { key:"grasa_pct",   label:"Grasa (%)",   type:"number", step:"0.1" },
    { key:"musculo_pct", label:"Músculo (%)", type:"number", step:"0.1" },
  ]},
  { label:"Circunferencias (cm)", icon:<Ruler className="w-4 h-4" />, fields:[
    { key:"cintura", label:"Cintura",  type:"number", step:"0.1" },
    { key:"cadera",  label:"Cadera",   type:"number", step:"0.1" },
    { key:"icc",     label:"ICC",      type:"number", step:"0.001", readOnly:true },
    { key:"pecho",   label:"Pecho",    type:"number", step:"0.1" },
    { key:"brazo",   label:"Brazo",    type:"number", step:"0.1" },
    { key:"muslo",   label:"Muslo",    type:"number", step:"0.1" },
  ]},
  { label:"Clínicos", icon:<Stethoscope className="w-4 h-4" />, fields:[
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
  const [ciclos,       setCiclos]       = useState([]);
  const [cicloSel,     setCicloSel]     = useState(null); // ciclo activo por defecto
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

      // Load cycles and select the active one by default
      const cs = await dbGet(`ciclos?cliente_id=eq.${selected.id}&order=fecha_inicio.desc`);
      setCiclos(cs);
      const activeCiclo = cs.find(c => c.activo) || cs[0] || null;
      setCicloSel(prev => prev ?? activeCiclo); // Only set on first load

      // Load routines of the active cycle only
      const cicloFiltro = activeCiclo ? `ciclo_id=eq.${activeCiclo.id}` : `ciclo_id=is.null`;
      const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&${cicloFiltro}&order=orden.asc`);
      const rsFull = await Promise.all(rs.map(async r => ({
        ...r, ejercicios: await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`)
      })));
      setRutinas(rsFull);
      const allIds = rsFull.flatMap(r => r.ejercicios.map(e => e.id));
      if (allIds.length) {
        const ps = await dbGet(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allIds.join(",")})`);
        const pm = {};
        ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
        setProgreso(pm);
      } else {
        setProgreso({});
      }
    } catch(e) { setMsg("❌ " + e.message); }
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  // Load routines for any selected cycle (used when the user clicks a cycle pill)
  const loadRutinas = useCallback(async (ciclo) => {
    if (!selected || !ciclo) return;
    setLoading(true);
    try {
      const filtro = ciclo ? `ciclo_id=eq.${ciclo.id}` : `ciclo_id=is.null`;
      const rs = await dbGet(`rutinas?cliente_id=eq.${selected.id}&${filtro}&order=orden.asc`);
      const rsFull = await Promise.all(rs.map(async r => ({
        ...r, ejercicios: await dbGet(`ejercicios?rutina_id=eq.${r.id}&order=orden.asc`)
      })));
      setRutinas(rsFull);
      const allIds = rsFull.flatMap(r => r.ejercicios.map(e => e.id));
      if (allIds.length) {
        const ps = await dbGet(`progreso?cliente_id=eq.${selected.id}&ejercicio_id=in.(${allIds.join(",")})`);
        const pm = {};
        ps.forEach(p => { pm[`${p.ejercicio_id}-${p.semana}-${p.serie}-${p.tipo}-${p.variante_id || 'original'}`] = p.valor; });
        setProgreso(pm);
      } else {
        setProgreso({});
      }
    } catch(e) { setMsg("❌ " + e.message); }
    setLoading(false);
  }, [selected]);

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
    { key:"peso",            label:"Peso",      unit:"kg",    icon:<Scale className="w-3.5 h-3.5" /> },
    { key:"imc",             label:"IMC",        unit:"",      icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"grasa_pct",       label:"Grasa",      unit:"%",     icon:<Activity className="w-3.5 h-3.5" /> },
    { key:"musculo_pct",     label:"Músculo",    unit:"%",     icon:<BicepsFlexed className="w-3.5 h-3.5" /> },
    { key:"cintura",         label:"Cintura",    unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"cadera",          label:"Cadera",     unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"icc",             label:"ICC",         unit:"",      icon:<Scale className="w-3.5 h-3.5" /> },
    { key:"pecho",           label:"Pecho",      unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"brazo",           label:"Brazo",      unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"muslo",           label:"Muslo",      unit:"cm",    icon:<Ruler className="w-3.5 h-3.5" /> },
    { key:"glucosa",         label:"Glucosa",    unit:"mg/dL", icon:<Stethoscope className="w-3.5 h-3.5" /> },
    { key:"presion_arterial",label:"Presión",    unit:"",       icon:<Heart className="w-3.5 h-3.5" /> },
  ];

  if (loading) return <div className="text-[#6B7A8D] text-center p-10">Cargando…</div>;

  return (
    <div className="pb-24">
      {/* Sub-nav */}
      <div className="bg-[#F0F4FA] rounded-xl p-1 inline-flex gap-1 mb-5">
        <button onClick={()=>setSub("evaluaciones")} className={`flex items-center gap-2 px-5 py-2 rounded-[10px] text-[13px] transition-colors ${sub==="evaluaciones" ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold" : "text-[#6B7A8D] font-normal hover:text-[#0B1929]"}`}>
          <BarChart2 className="w-4 h-4" /> Evaluaciones
        </button>
        <button onClick={()=>setSub("rutinas")} className={`flex items-center gap-2 px-5 py-2 rounded-[10px] text-[13px] transition-colors ${sub==="rutinas" ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold" : "text-[#6B7A8D] font-normal hover:text-[#0B1929]"}`}>
          <Dumbbell className="w-4 h-4" /> Rutinas del cliente
        </button>
      </div>

      {/* ── EVALUACIONES ── */}
      {sub==="evaluaciones"&&(
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-[#0B1929]">Evaluaciones corporales <span className="text-[#6B7A8D] font-normal">({metricas.length})</span></span>
            <div className="flex gap-2">
              {metricas.length > 0 && (
                <button onClick={() => generateProgresoPDF(selected, metricas, brand)} className="border border-[#E2E8F0] text-[#0B1929] px-3 py-1.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              )}
              <button onClick={()=>{setForm(emptyForm());setShowModal(true);}} className="bg-[var(--brand-primary)] text-white px-3 py-1.5 rounded-xl text-sm font-bold hover:opacity-90 transition-colors flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Nueva evaluación
              </button>
            </div>
          </div>
          {metricas.length===0?(
            <div className="text-center py-16 text-[#6B7A8D]">
              <div className="flex justify-center mb-3 text-[#E2E8F0]"><BarChart2 className="w-12 h-12" /></div>
              <div className="text-[15px] font-bold text-[#0B1929] mb-1.5">Sin evaluaciones aún</div>
              <div className="text-[13px]">Registra la primera evaluación corporal del cliente.</div>
            </div>
          ):metricas.map((m,idx)=>{
            const prev = metricas[idx+1];
            return (
              <div key={m.id} className="bg-white rounded-[14px] border border-[#E2E8F0] p-4 mb-3 shadow-sm">
                <div className="flex justify-between items-center mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--brand-primary)] text-[15px] flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {fmtDate(m.fecha)}</span>
                    {idx===0&&<span className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[11px] px-2.5 py-0.5 rounded-full font-bold">Más reciente</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>startEdit(m)} className="border border-[#E2E8F0] text-[#6B7A8D] px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-1">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={()=>deleteMetrica(m.id)} className="bg-red-50 text-red-600 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Borrar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5 mb-0" style={{marginBottom:m.notas?12:0}}>
                  {DISPLAY_KEYS.filter(f=>m[f.key]!==null&&m[f.key]!==undefined&&m[f.key]!=="").map(f=>{
                    const d = prev ? delta(m,prev,f.key) : null;
                    return (
                      <div key={f.key} className="bg-gray-50 rounded-[10px] p-2.5 border border-[#E2E8F0] text-center">
                        <div className="text-[11px] text-[#6B7A8D] mb-1 flex items-center justify-center gap-1">{f.icon} {f.label}</div>
                        <div className="text-lg font-bold text-[#0B1929] font-['Rajdhani']">
                          {m[f.key]}{f.unit&&<span className="text-[11px] font-normal text-[#6B7A8D]"> {f.unit}</span>}
                        </div>
                        {d!==null&&(
                          <div className={`text-[11px] mt-0.5 font-bold flex items-center justify-center gap-0.5 ${d<0?"text-green-500":"text-red-500"}`}>
                            {d>0?<ArrowUp className="w-3 h-3" />:<ArrowDown className="w-3 h-3" />} {Math.abs(d).toFixed(1)}{f.unit}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {m.notas&&<div className="text-xs text-[#6B7A8D] bg-gray-50 p-2.5 rounded-lg border border-[#E2E8F0] mt-2.5 flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {m.notas}
                </div>}
                {/* Fotos de progreso */}
                {parseFotos(m.fotos).length>0&&(
                  <div className="mt-3">
                    <div className="text-[11px] text-[#6B7A8D] font-bold mb-2 uppercase tracking-[0.5px] flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" /> Fotos ({parseFotos(m.fotos).length})
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {parseFotos(m.fotos).map((url,fi)=>(
                        <div key={fi} className="relative w-20 h-20">
                          <img src={url} onClick={()=>setLightbox(url)}
                            className="w-20 h-20 object-cover rounded-[10px] cursor-zoom-in border-2 border-[#E2E8F0]"
                            alt={`foto ${fi+1}`}/>
                          <button onClick={()=>deleteFoto(m,url)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-[18px] h-[18px] text-[11px] leading-[18px] text-center cursor-pointer border-none font-bold">×</button>
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
          {/* Cycle selector */}
          {ciclos.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-[#6B7A8D] font-bold uppercase tracking-[0.8px] mb-2">Ciclo</div>
              <div className="flex gap-1.5 flex-wrap">
                {ciclos.map(c => (
                  <button key={c.id} onClick={async () => { setCicloSel(c); await loadRutinas(c); }} className={`px-3 py-1.5 rounded-lg text-[13px] border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    cicloSel?.id===c.id 
                      ? (c.activo ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold shadow-md" : "bg-gray-100 text-[#0B1929] border-gray-300 font-bold") 
                      : "bg-transparent text-[#6B7A8D] border-[#E2E8F0] font-medium hover:bg-gray-50"
                  }`}>
                    {c.nombre.split("|")[0]}
                    {c.activo && <span className={`inline-block w-1.5 h-1.5 rounded-full ${cicloSel?.id===c.id ? "bg-white" : "bg-green-400"}`}/>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {rutinas.length===0?(
            <div className="text-center py-16 text-[#6B7A8D]">
              <div className="flex justify-center mb-3 text-[#E2E8F0]"><Dumbbell className="w-12 h-12" /></div>
              <div className="text-[15px] font-bold text-[#0B1929] mb-1.5">Sin rutinas asignadas</div>
            </div>
          ):rutinas.map(r=>{
            const semanas = getSemanasConFecha(r);
            const tieneData = r.ejercicios.some(ej=>semanas.some((_,wi)=>Array.from({length:ej.num_series||4},(_,si)=>progreso[`${ej.id}-${wi}-${si}-peso`]||progreso[`${ej.id}-${wi}-${si}-reps`]).some(Boolean)));
            return (
              <div key={r.id} className="mb-6">
                <div className="font-bold text-[15px] mb-2.5 text-[var(--brand-primary)] flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" /> {r.nombre}
                  {!tieneData&&<span className="text-[11px] text-[#6B7A8D] font-normal">Sin registros aún</span>}
                </div>
                {tieneData&&(
                  <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] shadow-sm">
                    <table className="border-collapse text-[11px] min-w-full bg-white">
                      <thead>
                        <tr>
                          <th className="bg-gray-50 text-[#0B1929] px-3 py-2 border border-[#E2E8F0] text-left min-w-[120px]">Ejercicio</th>
                          <th className="bg-gray-50 text-[#0B1929] px-2 py-2 border border-[#E2E8F0] text-center min-w-[40px]">Serie</th>
                          {semanas.map((s,i)=>(
                            <th key={i} colSpan={2} className="bg-gray-50 text-[var(--brand-primary)] px-1 py-1.5 border border-[#E2E8F0] text-center text-[10px] whitespace-nowrap">{s.label}</th>
                          ))}
                        </tr>
                        <tr>
                          <th colSpan={2} className="bg-gray-50/50 border border-[#E2E8F0]"/>
                          {semanas.map((_,i)=>(
                            <Fragment key={`h${i}`}>
                              <th key={`p${i}`} className="bg-gray-50/50 text-[#6B7A8D] px-1.5 py-1 border border-[#E2E8F0] text-center text-[10px]">Peso</th>
                              <th key={`r${i}`} className="bg-gray-50/50 text-[#6B7A8D] px-1.5 py-1 border border-[#E2E8F0] text-center text-[10px]">Reps</th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.ejercicios.map((ej, eji) => {
                          const variantsWithData = new Set(["original"]);
                          for (const key in progreso) {
                            if (key.startsWith(`${ej.id}-`)) {
                              const parts = key.split("-");
                              if (parts.length >= 5) variantsWithData.add(parts.slice(4).join("-"));
                            }
                          }
                          const activeVariants = Array.from(variantsWithData).sort();

                          return activeVariants.map((vid, vidIdx) => {
                            const isOriginal = vid === "original";
                            const altIdx = isOriginal ? -1 : parseInt(vid.replace("alt_", ""));
                            const exObj = isOriginal ? ej : (ej.alternativas || [])[altIdx] || ej;
                            
                            const rowBg = eji % 2 === 0 ? "bg-white" : "bg-gray-50/30";
                            const highlight = !isOriginal ? "bg-[var(--brand-primary)]/5" : rowBg;

                            return Array.from({length: exObj.num_series || ej.num_series || 4}, (_, si) => (
                              <tr key={`${ej.id}-${vid}-${si}`} className={highlight}>
                                {si === 0 && (
                                  <td rowSpan={exObj.num_series || ej.num_series || 4} className="px-3 py-2 border border-[#E2E8F0] font-bold align-middle">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[#0B1929]">{exObj.nombre}</span>
                                      {!isOriginal && <span className="text-[9px] bg-[var(--brand-primary)] text-white px-1 py-0.5 rounded font-bold">ALT</span>}
                                    </div>
                                    <div className="text-[10px] text-[#6B7A8D] font-normal mt-0.5">{exObj.grupo_muscular || ej.grupo_muscular}</div>
                                  </td>
                                )}
                                <td className="px-2 py-1.5 border border-[#E2E8F0] text-center text-[var(--brand-primary)] font-bold font-['Rajdhani']">{si+1}</td>
                                {semanas.map((_, wi) => {
                                  const pVal = progreso[`${ej.id}-${wi}-${si}-peso-${vid}`] || "";
                                  const rVal = progreso[`${ej.id}-${wi}-${si}-reps-${vid}`] || "";
                                  
                                  let emptyText = "—";
                                  let emptyColorClass = "text-[#CBD5E1]";
                                  let emptyWeightClass = "font-normal";
                                  
                                  if (!pVal && !rVal) {
                                    const otherVariantHasData = activeVariants.some(otherVid => 
                                      otherVid !== vid && (progreso[`${ej.id}-${wi}-${si}-peso-${otherVid}`] || progreso[`${ej.id}-${wi}-${si}-reps-${otherVid}`])
                                    );
                                    if (otherVariantHasData) {
                                      emptyText = isOriginal ? "ALT" : "ORG";
                                      emptyColorClass = "text-[#6B7A8D]";
                                      emptyWeightClass = "font-bold";
                                    }
                                  }

                                  return (
                                    <Fragment key={`w${wi}`}>
                                      <td key={`p${wi}`} className={`px-1 py-1.5 border border-[#E2E8F0] text-center ${pVal ? "bg-[var(--brand-primary)]/10" : ""}`}>
                                        <span className={`text-[11px] ${pVal ? "text-[var(--brand-primary)] font-bold" : `${emptyColorClass} ${emptyWeightClass}`}`}>{pVal||emptyText}</span>
                                      </td>
                                      <td key={`r${wi}`} className={`px-1 py-1.5 border border-[#E2E8F0] text-center ${rVal ? "bg-[var(--brand-primary)]/5" : ""}`}>
                                        <span className={`text-[11px] ${rVal ? "text-[#3B82F6] font-bold" : `${emptyColorClass} ${emptyWeightClass}`}`}>{rVal||emptyText}</span>
                                      </td>
                                    </Fragment>
                                  );
                                })}
                              </tr>
                            ));
                          });
                        })}
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
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#0B1929]">{editingId ? "Editar evaluación" : "Nueva evaluación corporal"}</h2>
              <button onClick={closeModal} className="text-[#6B7A8D] hover:text-[#0B1929]"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-sm font-bold text-[#0B1929]">Fecha de evaluación</label>
              <input type="date" value={form.fecha} onChange={e=>updForm("fecha",e.target.value)} className="bg-gray-50 border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20" />
            </div>

            {METRIC_GROUPS.map(group=>(
              <div key={group.label} className="mb-6">
                <div className="text-xs text-[#6B7A8D] font-bold mb-3 uppercase tracking-[0.5px] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2">
                  {group.icon} {group.label}
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                  {group.fields.map(f=>(
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-[#0B1929]">{f.label}</label>
                      <input
                        type={f.type} step={f.step||"any"}
                        value={form[f.key]}
                        readOnly={!!f.readOnly}
                        placeholder={f.readOnly?"Auto":(f.placeholder||"")}
                        className={`bg-gray-50 border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 ${f.readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                        onChange={e=>!f.readOnly&&updForm(f.key,e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-sm font-bold text-[#0B1929]">Notas</label>
              <textarea value={form.notas} onChange={e=>updForm("notas",e.target.value)} placeholder="Observaciones del nutriólogo…" className="bg-gray-50 border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 min-h-[100px]" />
            </div>

            {/* Fotos existentes cuando se edita */}
            {editingId && existingFotos.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-[#6B7A8D] font-bold mb-2 uppercase tracking-[0.5px] flex items-center gap-1.5"><Camera className="w-4 h-4"/> Fotos actuales</div>
                <div className="flex gap-2 flex-wrap">
                  {existingFotos.map((url,i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={url} onClick={()=>setLightbox(url)} className="w-20 h-20 object-cover rounded-[10px] border-2 border-[#E2E8F0] cursor-zoom-in" alt=""/>
                      <button onClick={()=>setExistingFotos(prev=>prev.filter((_,j)=>j!==i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-[18px] h-[18px] text-[11px] leading-[18px] text-center cursor-pointer border-none font-bold">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Foto upload */}
            <div className="mb-6">
              <div className="text-xs text-[#6B7A8D] font-bold mb-2 uppercase tracking-[0.5px] flex items-center gap-1.5"><Camera className="w-4 h-4"/> {editingId ? "Agregar más fotos" : "Fotos de progreso"}</div>
              <label className="inline-flex items-center gap-2 bg-white border border-dashed border-[var(--brand-primary)] rounded-xl px-4 py-2.5 cursor-pointer text-[13px] text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)]/5 transition-colors">
                <Plus className="w-4 h-4" /> Agregar fotos
                <input type="file" accept="image/*" multiple onChange={handleFotos} className="hidden"/>
              </label>
              {previewUrls.length>0&&(
                <div className="flex gap-2 flex-wrap mt-3">
                  {previewUrls.map((url,i)=>(
                    <div key={i} className="relative w-20 h-20">
                      <img src={url} className="w-20 h-20 object-cover rounded-[10px] border-2 border-[var(--brand-primary)]" alt=""/>
                      <button onClick={()=>removePendingFoto(i)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-[18px] h-[18px] text-[11px] leading-[18px] text-center cursor-pointer border-none font-bold">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-8 border-t border-[#E2E8F0] pt-4">
              <button onClick={closeModal} className="border border-[#E2E8F0] text-[#6B7A8D] px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={saveMetrica} disabled={saving} className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving?"Subiendo…":editingId?"Guardar cambios":"Guardar evaluación"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Lightbox */}
      {lightbox&&createPortal(
        <div onClick={()=>setLightbox(null)} className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] cursor-zoom-out">
          <img src={lightbox} className="max-w-[90vw] max-h-[90vh] rounded-[14px] object-contain shadow-2xl" alt=""/>
          <div className="absolute top-5 right-6 text-white text-3xl cursor-pointer font-bold" onClick={()=>setLightbox(null)}>✕</div>
        </div>,
        document.body
      )}

    </div>
  );
}
