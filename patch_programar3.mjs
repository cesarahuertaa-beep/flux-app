import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

// 1. Remove `{ciclos.length > 0 && (` right after `{/* ── Selector de Ciclos ── */}`
const t1 = `{/* ── Selector de Ciclos ── */}
      {ciclos.length > 0 && (
        <div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">`;

const r1 = `{/* ── Selector de Ciclos ── */}
      <div className="mb-5 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">`;

content = content.replace(t1, r1);
content = content.replace(t1.replace(/\\r\\n/g, '\\n'), r1.replace(/\\r\\n/g, '\\n'));

// 2. Change the Siguiente Plan text
const t2 = `<Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Siguiente Plan</span>`;
const r2 = `<Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ciclos.length === 0 ? "Crear Primer Plan" : "Siguiente Plan"}</span>`;
content = content.replace(t2, r2);

// 3. Inject the empty state right before `<div className="flex flex-wrap gap-2">` (the one for active cycles)
const t3 = `<div className="flex flex-wrap gap-2">
            {/* Ciclos Activos */}`;
const r3 = `{ciclos.length === 0 ? (
          <div className="text-center py-6 text-[#6B7A8D] text-[13px] border-2 border-dashed border-[#E2E8F0] rounded-xl bg-gray-50/50 mb-3">
            Aún no hay planes configurados. <button onClick={() => setShowPlanModal(true)} className="text-[var(--brand-primary)] font-semibold hover:underline">Haz clic aquí para crear tu primer plan.</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Ciclos Activos */}`;

content = content.replace(t3, r3);
content = content.replace(t3.replace(/\\r\\n/g, '\\n'), r3.replace(/\\r\\n/g, '\\n'));

// 4. Change the closing brace
const t4 = `            <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
            </div>
          )}
          </div>
        )}`;
const r4 = `            <Lock className="w-[14px] h-[14px]" /> Estás viendo el historial de <strong className="text-[#0B1929]">{cicloSel.nombre.split("|")[0]}</strong>. Solo lectura — el plan activo es el resaltado.
            </div>
          )}
          </div>
        )}
      </div>`;

content = content.replace(t4, r4);
content = content.replace(t4.replace(/\\r\\n/g, '\\n'), r4.replace(/\\r\\n/g, '\\n'));

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("ProgramarCliente patched correctly!");
