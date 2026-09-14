import fs from 'fs';

let file = 'src/components/admin/ProgramarCliente.jsx';
let content = fs.readFileSync(file, 'utf8');

// Update signature
if (content.includes('ProgramarCliente({ clientes, selected, setSelected, setMsg, biblioteca })')) {
  content = content.replace('ProgramarCliente({ clientes, selected, setSelected, setMsg, biblioteca })', 'ProgramarCliente({ clientes, selected, setSelected, setMsg, biblioteca, isMiPlan })');
}

// Wrap Cabecera
const cabeceraRegex = /\{\/\* ── Cabecera cliente ── \*\/}[\s\S]*?<RefreshCw className="w-4 h-4" \/>\s*<\/button>\s*<\/div>/;
const match = content.match(cabeceraRegex);

if (match && !content.includes('{!isMiPlan && (')) {
  const replacement = `{\/* ── Cabecera cliente ── *\/}
      {!isMiPlan && (
        <div className="flex items-stretch mb-5 w-max group">
          <div className="bg-[#0B1929]/5 border border-[#0B1929]/20 rounded-l-xl px-4 py-2 flex flex-col justify-center">
            <span className="font-bold text-[var(--brand-primary)] leading-tight">{selected.nombre}</span>
            <span className="text-xs text-[#6B7A8D] leading-tight mt-0.5">{selected.email}</span>
          </div>
          <button 
            title="Cambiar paciente"
            className="px-3 bg-[#0B1929]/5 border border-l-0 border-[#0B1929]/20 rounded-r-xl text-[#6B7A8D] hover:bg-[#0B1929]/10 hover:text-[var(--brand-primary)] transition-colors flex items-center justify-center" 
            onClick={() => setSelected(null)}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}`;
  content = content.replace(cabeceraRegex, replacement);
}

fs.writeFileSync(file, content);
