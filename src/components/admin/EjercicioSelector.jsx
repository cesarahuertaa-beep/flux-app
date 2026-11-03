import { useState, useMemo } from "react";
import { GRUPOS_MUSCULARES, GRUPO_LABELS, matchMuscleGroup, normalizeMuscleGroup } from "../../lib/constants";
import { Search, Image as ImageIcon } from "lucide-react";
import { CustomSelect } from "../ui/CustomSelect";

export function EjercicioSelector({ biblioteca = [], onSelect, selected = [] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");

  // Opciones de grupos musculares basadas en el catálogo único oficial
  const opcionesGrupos = useMemo(() => [
    { value: "Todos", label: "Todos los grupos" },
    ...GRUPOS_MUSCULARES.map(g => ({ value: g.id, label: g.nombre }))
  ], []);

  // Verificar si un ejercicio ya forma parte del plan (como principal o alternativa)
  const isAlreadyInPlan = (e) => {
    if (!selected || !Array.isArray(selected) || selected.length === 0) return false;
    const targetId = String(e.id || e.biblioteca_id || "");
    const targetName = (e.nombre || "").trim().toLowerCase();

    return selected.some(s => {
      const sId = String(s.biblioteca_id || s.id || "");
      const sName = (s.nombre || "").trim().toLowerCase();
      if (targetId && sId && sId === targetId) return true;
      if (targetName && sName && sName === targetName) return true;

      if (Array.isArray(s.alternativas)) {
        return s.alternativas.some(alt => {
          const altId = String(alt.biblioteca_id || alt.id || "");
          const altName = (alt.nombre || "").trim().toLowerCase();
          if (targetId && altId && altId === targetId) return true;
          if (targetName && altName && altName === targetName) return true;
          return false;
        });
      }
      return false;
    });
  };

  const normSearch = normalizeMuscleGroup(busqueda);

  const filtrados = (biblioteca || []).filter(e => {
    // 1. Descartar si ya forma parte de la sesión (como ejercicio principal o alternativa)
    if (isAlreadyInPlan(e)) return false;

    // 2. Filtro por grupo muscular (con soporte insensible a mayúsculas/minúsculas y acentos)
    const matchG = matchMuscleGroup(e.grupo_muscular, filtroGrupo);

    // 3. Filtro por nombre de búsqueda (insensible a acentos y mayúsculas)
    const matchB = !normSearch || normalizeMuscleGroup(e.nombre).includes(normSearch);

    return matchG && matchB;
  });

  return (
    <div className="bg-[#F7F9FC] rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] -mx-3.5 px-3.5 py-3.5 md:mx-0 md:p-4 mb-4 shadow-none md:shadow-sm">
      <div className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-3">
        Agregar de la Biblioteca
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
          <input 
            value={busqueda} 
            onChange={e => setBusqueda(e.target.value)} 
            placeholder="Buscar..." 
            className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-4 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>
        <div className="min-w-[170px]">
          <CustomSelect 
            value={filtroGrupo} 
            onChange={setFiltroGrupo} 
            options={opcionesGrupos}
          />
        </div>
      </div>

      {biblioteca.length === 0 ? (
        <div className="text-center text-[#6B7A8D] text-sm py-4 bg-white rounded-xl border border-dashed border-[#CBD5E1]">
          La biblioteca está vacía. Agrega ejercicios primero.
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-[#6B7A8D] text-sm py-4 bg-white rounded-xl border border-dashed border-[#CBD5E1]">
          No hay ejercicios que coincidan.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
          {filtrados.map(e => (
            <button 
              key={e.id} 
              onClick={() => onSelect(e)} 
              className="flex items-center gap-3 px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left flex-1 min-w-[200px]"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F0F4FA] flex-shrink-0 flex items-center justify-center border border-[#E2E8F0]">
                {e.gif_url ? (
                  <img src={e.gif_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-[#9BA5B0]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#0B1929] truncate">{e.nombre}</div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--brand-primary)] uppercase truncate">
                  {GRUPO_LABELS[normalizeMuscleGroup(e.grupo_muscular)] || e.grupo_muscular}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}