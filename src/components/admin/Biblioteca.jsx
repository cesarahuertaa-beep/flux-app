import { useState } from "react";
import { GRUPOS, TIPOS } from "../../styles/theme";
import { dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";
import { Plus, Search, Trash2, Edit2, Image as ImageIcon, Filter, Download, Dumbbell, Play, Video, X } from "lucide-react";

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
      setMsg(<div className='flex gap-2 items-center'><CheckCircle2 className='w-4 h-4 text-green-500'/> Archivo subido</div>);
    } catch(e) { setMsg('❌ ' + e.message); }
    setUploading(false);
  };

  const openNew  = () => { setEditEj(null); setForm({ nombre:"", grupo_muscular:"Pecho", tipo_movimiento:"Empuje", gif_url:"" }); setShowModal(true); };
  const openEdit = (e) => { setEditEj(e); setForm({ nombre:e.nombre, grupo_muscular:e.grupo_muscular, tipo_movimiento:e.tipo_movimiento, gif_url:e.gif_url||"" }); setShowModal(true); };

  const save = async () => {
    if (!form.nombre) { setMsg(<div className='flex gap-2 items-center'><AlertCircle className='w-4 h-4 text-yellow-500'/> Escribe el nombre</div>); return; }
    setSaving(true);
    try {
      if (editEj) await dbPatch(`biblioteca_ejercicios?id=eq.${editEj.id}`, form);
      else        await dbPost("biblioteca_ejercicios", form);
      setShowModal(false); setMsg(<div className='flex gap-2 items-center'><CheckCircle2 className='w-4 h-4 text-green-500'/> Ejercicio guardado</div>); onUpdate();
    } catch(e) { setMsg('❌ ' + e.message); }
    setSaving(false);
  };

  const deleteEj = async (e) => {
    if (!confirm(`¿Eliminar "${e.nombre}"? Esta acción no se puede deshacer.`)) return;
    await dbDel(`biblioteca_ejercicios?id=eq.${e.id}`);
    setMsg(<div className='flex gap-2 items-center'><Trash2 className='w-4 h-4 text-red-500'/> Ejercicio eliminado</div>); onUpdate();
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
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-2xl text-[#0B1929] tracking-wide mb-1 font-['Space_Grotesk',sans-serif]">
            Biblioteca de Ejercicios
          </h2>
          <p className="text-[13px] text-[#6B7A8D]">
            {biblioteca.length} ejercicio{biblioteca.length !== 1 ? "s" : ""} en la colección global
          </p>
        </div>
        {isSuperadmin && (
          <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-colors">
            <Plus size={18} /> Nuevo ejercicio
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2.5 mb-5 flex-wrap p-3.5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A8D]" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="w-full bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-['Inter',sans-serif]"
          />
        </div>
        <select
          value={filtroGrupo}
          onChange={e => setFiltroGrupo(e.target.value)}
          className="bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-['Inter',sans-serif] min-w-[130px]"
        >
          <option>Todos</option>
          {GRUPOS.map(g => <option key={g}>{g}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-['Inter',sans-serif] min-w-[140px]"
        >
          <option>Todos</option>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        {(filtroGrupo !== "Todos" || filtroTipo !== "Todos" || busqueda) && (
          <button
            onClick={() => { setBusqueda(""); setFiltroGrupo("Todos"); setFiltroTipo("Todos"); }}
            className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3 py-2 text-red-500 text-xs cursor-pointer font-semibold font-['Inter',sans-serif] transition-colors flex items-center gap-1"
          >
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Grid ── */}
      {filtrados.length === 0 ? (
        <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
          <Dumbbell size={48} className="mx-auto mb-4 opacity-20" />
          <div className="text-[16px] font-semibold mb-1.5 text-[#0B1929]">
            {biblioteca.length === 0 ? "La biblioteca está vacía" : "No hay ejercicios que coincidan"}
          </div>
          <div className="text-[13px] text-[#6B7A8D]">
            {biblioteca.length === 0 && isSuperadmin ? "Agrega el primer ejercicio con el botón de arriba" : "Intenta con otros filtros"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-[14px]">
          {filtrados.map((e, i) => {
            const accentColor = groupColors[e.grupo_muscular] || "#38bdf8";
            return (
              <div
                key={e.id}
                className="group animate-in bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden relative transition-all hover:shadow-md"
                style={{ animationDelay:`${i * 0.04}s` }}
              >
                {/* Top color accent */}
                <div style={{
                  position:"absolute", top:0, left:0, right:0, height:2,
                  background:`linear-gradient(90deg, transparent, ${accentColor}, transparent)`
                }}/>

                {/* Image area */}
                <div
                  onClick={() => e.gif_url && setPreview(e)}
                  className={`h-[130px] bg-gray-50 flex items-center justify-center relative overflow-hidden ${e.gif_url ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {e.gif_url ? (
                    <>
                      <img
                        src={e.gif_url} alt={e.nombre}
                        className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-[#0B1929]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-[#0B1929] shadow-lg">
                          <Play size={20} className="ml-1" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <Dumbbell size={40} className="text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <div className="font-semibold text-[13px] text-[#0B1929] mb-2 leading-snug font-['Inter',sans-serif]">
                    {e.nombre}
                  </div>
                  <div className="flex gap-1 flex-wrap mb-2.5">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor:`${accentColor}20`, color:accentColor }}>
                      {e.grupo_muscular}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-600">
                      {e.tipo_movimiento}
                    </span>
                  </div>
                  {isSuperadmin && (
                    <div className="flex gap-1.5 mt-1">
                      <button onClick={() => openEdit(e)} className="flex-1 flex justify-center items-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50 bg-white rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors">
                        <Edit2 size={12} /> Editar
                      </button>
                      <button onClick={() => deleteEj(e)} className="flex-1 flex justify-center items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors">
                        <Trash2 size={12} /> Borrar
                      </button>
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
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#0B1929] flex items-center gap-2">
                {editEj ? <><Edit2 size={20} className="text-blue-600"/> Editar ejercicio</> : <><Plus size={20} className="text-blue-600"/> Nuevo ejercicio</>}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">Nombre del ejercicio</label>
                <input value={form.nombre} onChange={e => setForm(p => ({...p,nombre:e.target.value}))} placeholder="Ej. Press de banca inclinado" className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0B1929] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"/>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">Grupo muscular</label>
                  <select value={form.grupo_muscular} onChange={e => setForm(p => ({...p,grupo_muscular:e.target.value}))} className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0B1929] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
                    {GRUPOS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">Tipo de movimiento</label>
                  <select value={form.tipo_movimiento} onChange={e => setForm(p => ({...p,tipo_movimiento:e.target.value}))} className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0B1929] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">GIF / Video del ejercicio</label>
                <div className="border border-dashed border-gray-300 rounded-xl p-5 text-center bg-gray-50">
                  {form.gif_url ? (
                    <div>
                      <img src={form.gif_url} alt="preview" className="max-h-[140px] rounded-lg mx-auto mb-3 shadow-sm"/>
                      <div>
                        <button onClick={() => setForm(p => ({...p,gif_url:""}))} className="text-sm px-3 py-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 bg-white rounded-lg font-semibold transition-colors">
                          Cambiar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Video size={36} className="mx-auto mb-2 text-gray-300" />
                      <div className="text-[13px] text-[#6B7A8D] mb-3">Sube un GIF o video MP4</div>
                      <input
                        id="gif-upload" type="file"
                        accept="image/gif,video/mp4,image/png,image/jpg,image/jpeg"
                        className="hidden"
                        onChange={e => e.target.files[0] && uploadGif(e.target.files[0])}
                      />
                      <label
                        htmlFor="gif-upload"
                        className="inline-block px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg font-semibold text-[12px] cursor-pointer transition-colors shadow-sm"
                      >
                        {uploading ? "Subiendo..." : "Seleccionar archivo"}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#E2E8F0] flex gap-2.5 justify-end bg-gray-50">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[#6B7A8D] rounded-xl font-semibold text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving || uploading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving ? "Guardando..." : "Guardar ejercicio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 bg-[#0B1929]/40 backdrop-blur-sm z-[200] flex items-center justify-center p-5"
        >
          <div
            className="animate-in bg-white rounded-2xl p-6 max-w-[440px] w-full text-center border border-[#E2E8F0] shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20}/></button>
            <img
              src={preview.gif_url} alt={preview.nombre}
              className="w-full rounded-xl mb-4 shadow-sm"
            />
            <div className="font-bold text-[18px] text-[#0B1929] mb-2 font-['Space_Grotesk',sans-serif]">
              {preview.nombre}
            </div>
            <div className="flex gap-1.5 justify-center mb-4">
              <span className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ backgroundColor:`${groupColors[preview.grupo_muscular] || "#38bdf8"}20`, color: groupColors[preview.grupo_muscular] || "#38bdf8" }}>
                {preview.grupo_muscular}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-600">
                {preview.tipo_movimiento}
              </span>
            </div>
            <button
              onClick={() => setPreview(null)}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-[#0B1929] rounded-xl text-[13px] font-semibold font-['Inter',sans-serif] transition-colors border border-gray-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
