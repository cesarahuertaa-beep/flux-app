import fs from 'fs';

let file = 'src/components/admin/ProgramarCliente.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add ChevronDown to imports
if (!content.includes('ChevronDown')) {
  content = content.replace('RefreshCw,', 'RefreshCw, ChevronDown,');
}

// Add state and effect
if (!content.includes('const [showPastCycles')) {
  content = content.replace('const [cicloSel, setCicloSel] = useState(null);', `const [cicloSel, setCicloSel] = useState(null);\n  const [showPastCycles, setShowPastCycles] = useState(false);\n  useEffect(() => { if (cicloSel && !cicloSel.activo) setShowPastCycles(true); }, [cicloSel]);`);
}

const oldRegex = /\{ciclos\.length > 0 && \(\s*<div className="mb-5 bg-white rounded-xl border border-\[\#E2E8F0\] p-4 shadow-sm">[\s\S]*?\{cicloSel && !cicloSel\.activo && \([\s\S]*?<\/div>\s*\)\}\s*<\/div>\s*\)\}/;

const newBlock = `{ciclos.length > 0 && (
        <div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-bold text-[#0B1929] uppercase tracking-[0.8px]">Planes del Paciente</span>
            <button className="text-xs flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors font-medium" onClick={() => setShowPlanModal(true)}>
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Siguiente Plan</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Ciclos Activos */}
            {ciclos.filter(c => c.activo).map(c => (
              <div key={c.id} className="flex items-stretch flex-shrink-0 group">
                <button 
                  onClick={() => { setCicloSel(c); setShowPastCycles(false); }}
                  className={\`flex items-center gap-1.5 px-4 py-2 text-[13px] transition-colors border \${
                    cicloSel?.id === c.id 
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold" 
                      : "bg-[#0B1929]/5 border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[#0B1929]/10 font-medium" 
                  } \${cicloSel?.id === c.id ? "rounded-l-xl border-r-0" : "rounded-xl"}\`}
                >
                  {c.nombre.split("|")[0]}
                  <span className={\`inline-block w-1.5 h-1.5 rounded-full \${cicloSel?.id===c.id ? "bg-white" : "bg-green-400"}\`}/>
                </button>
                {cicloSel?.id === c.id && (
                  <button
                    onClick={(e) => eliminarCiclo(c, e)}
                    title="Eliminar este plan"
                    className="flex items-center justify-center px-3 bg-[var(--brand-primary)] text-white/80 hover:text-white border-y border-r border-[var(--brand-primary)] rounded-r-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Ciclos Pasados (Acordeón) */}
            {ciclos.filter(c => !c.activo).length > 0 && (
              <>
                <button
                  onClick={() => setShowPastCycles(p => !p)}
                  className="flex items-center justify-center px-3 py-2 border border-[#E2E8F0] rounded-xl text-[#6B7A8D] hover:bg-gray-50 transition-colors"
                  title="Ver planes anteriores"
                >
                  <ChevronDown className={\`w-4 h-4 transition-transform \${showPastCycles ? "rotate-180" : ""}\`} />
                </button>

                {showPastCycles && ciclos.filter(c => !c.activo).map(c => (
                  <div key={c.id} className="flex items-stretch flex-shrink-0 group animate-in fade-in slide-in-from-left-2">
                    <button 
                      onClick={() => setCicloSel(c)}
                      className={\`flex items-center px-4 py-2 text-[13px] transition-colors border \${
                        cicloSel?.id === c.id 
                          ? "bg-[#6B7A8D] text-white border-[#6B7A8D] font-bold" 
                          : "bg-transparent text-[#6B7A8D] border-[#E2E8F0] font-medium hover:bg-gray-50"
                      } \${cicloSel?.id === c.id ? "rounded-l-xl border-r-0" : "rounded-xl"}\`}
                    >
                      {c.nombre.split("|")[0]}
                    </button>
                    {cicloSel?.id === c.id && (
                      <button
                        onClick={(e) => eliminarCiclo(c, e)}
                        title="Eliminar este plan"
                        className="flex items-center justify-center px-3 bg-[#6B7A8D] text-white/80 hover:text-white border-y border-r border-[#6B7A8D] rounded-r-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        {cicloSel && !cicloSel.activo && (
          <div className="mt-3 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
          </div>
        )}
        </div>
      )}`;

content = content.replace(oldRegex, newBlock);

fs.writeFileSync(file, content);
