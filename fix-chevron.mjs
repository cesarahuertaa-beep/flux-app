import fs from 'fs';

let file = 'src/components/admin/ProgramarCliente.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldHeaderRegex = /<div className="flex items-center justify-between gap-2 mb-3">[\s\S]*?<Plus className="w-3\.5 h-3\.5" \/> <span className="hidden sm:inline">Siguiente Plan<\/span>\s*<\/button>\s*<\/div>/;

const newHeaderBlock = `<div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-bold text-[#0B1929] uppercase tracking-[0.8px]">Planes del Paciente</span>
            <div className="flex items-center gap-2">
              {ciclos.filter(c => !c.activo).length > 0 && (
                <button
                  onClick={() => setShowPastCycles(p => !p)}
                  className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 border border-[#E2E8F0] rounded-lg text-[#6B7A8D] hover:bg-gray-50 transition-colors"
                  title="Ver planes anteriores"
                >
                  <ChevronDown className={\`w-4 h-4 transition-transform \${showPastCycles ? "rotate-180" : ""}\`} />
                </button>
              )}
              <button className="text-xs flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors font-medium" onClick={() => setShowPlanModal(true)}>
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Siguiente Plan</span>
              </button>
            </div>
          </div>`;

content = content.replace(oldHeaderRegex, newHeaderBlock);

const oldChevronRegex = /\{ciclos\.filter\(c => !c\.activo\)\.length > 0 && \(\s*<>\s*<button[\s\S]*?<ChevronDown className=\{\`w-4 h-4 transition-transform \$\{showPastCycles \? "rotate-180" : ""\}\`} \/>\s*<\/button>/;

const newChevronBlock = `{ciclos.filter(c => !c.activo).length > 0 && (
              <>`;

content = content.replace(oldChevronRegex, newChevronBlock);

fs.writeFileSync(file, content);
