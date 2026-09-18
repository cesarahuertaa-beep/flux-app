import { useState } from"react";
import { GRUPOS } from"../../lib/constants";
import { Search, Image as ImageIcon } from"lucide-react";

export function EjercicioSelector({ biblioteca, onSelect, selected }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");
  
  const filtrados = biblioteca.filter(e => {
    const yaEsta = selected.find(s => s.biblioteca_id === e.id);
    if (yaEsta) return false;
    const matchG = filtroGrupo ==="Todos" || e.grupo_muscular === filtroGrupo;
    const matchB = e.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchG && matchB;
  });

  return (
    <div className="bg-[#F7F9FC] rounded-2xl border border-[#E2E8F0] p-4 mb-4 shadow-sm">
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
        <select 
          value={filtroGrupo} 
          onChange={e => setFiltroGrupo(e.target.value)} 
          className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          <option>Todos</option>
          {GRUPOS.map(g => <option key={g}>{g}</option>)}
        </select>
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
                  {e.grupo_muscular}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}