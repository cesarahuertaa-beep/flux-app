import fs from 'fs';

let file = 'src/components/admin/ProgramarCliente.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('RefreshCw')) {
  content = content.replace('Trash2,', 'RefreshCw, Trash2,');
}

const oldStr = `<div className="flex items-center gap-2.5 mb-5 flex-wrap">
        <div className="bg-[#0B1929]/5 border border-[#0B1929]/20 rounded-xl px-4 py-2 flex flex-col">
          <span className="font-bold text-[var(--brand-primary)] leading-tight">{selected.nombre}</span>
          <span className="text-xs text-[#6B7A8D] leading-tight mt-0.5">{selected.email}</span>
        </div>
        <button className="text-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#6B7A8D] hover:bg-gray-50 font-medium transition-colors" onClick={() => setSelected(null)}>
          Cambiar
        </button>
      </div>`;

const newStr = `<div className="flex items-stretch mb-5 w-max group">
        <div className="bg-[#0B1929]/5 border border-[#0B1929]/20 rounded-l-xl px-4 py-2 flex flex-col justify-center">
          <span className="font-bold text-[var(--brand-primary)] leading-tight">{selected.nombre}</span>
          <span className="text-xs text-[#6B7A8D] leading-tight mt-0.5">{selected.email}</span>
        </div>
        <button 
          title="Cambiar paciente"
          className="px-3 border border-l-0 border-[#0B1929]/20 rounded-r-xl text-[#6B7A8D] hover:bg-[#0B1929]/10 hover:text-[var(--brand-primary)] transition-colors flex items-center justify-center" 
          onClick={() => setSelected(null)}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>`;

content = content.replace(oldStr, newStr);

fs.writeFileSync(file, content);
