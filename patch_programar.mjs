import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

const original = `{ciclos.length > 0 && (
        <div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
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
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Ciclos Activos */}
            {ciclos.filter(c => c.activo).map(c => (`;

const replaced = `<div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
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
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ciclos.length === 0 ? "Crear Primer Plan" : "Siguiente Plan"}</span>
              </button>
            </div>
          </div>

          {ciclos.length === 0 ? (
            <div className="text-center py-6 text-[#6B7A8D] text-[13px] border-2 border-dashed border-[#E2E8F0] rounded-xl bg-gray-50/50">
              Aún no hay planes configurados. <button onClick={() => setShowPlanModal(true)} className="text-[var(--brand-primary)] font-semibold hover:underline">Haz clic aquí para crear tu primer plan.</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Ciclos Activos */}
              {ciclos.filter(c => c.activo).map(c => (`;

// Also need to remove the closing brace for \`{ciclos.length > 0 && (\` which is further down.
const originalClosing = `            <div className="mt-3 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
          </div>
        )}
        </div>
      )}`;

const replacedClosing = `            <div className="mt-3 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
          </div>
        )}
        </div>
        )}
      </div>`;

// Since it's tricky to replace exact multiline chunks with exact spacing, I'll use simple string replace but ignoring spaces with regex.
function escapeRegex(string) {
    return string.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
}

function fuzzyReplace(text, search, replacement) {
    const searchRegex = new RegExp(escapeRegex(search).replace(/\\s+/g, '\\\\s+'), 'g');
    return text.replace(searchRegex, replacement);
}

content = fuzzyReplace(content, original, replaced);
content = fuzzyReplace(content, originalClosing, replacedClosing);

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("ProgramarCliente patched!");
