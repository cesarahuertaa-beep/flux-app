import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

// Update function signature to accept onModoAtleta
content = content.replace(
  /export function ProgramarCliente\(\{ clientes, selected, setSelected, setMsg, biblioteca, isMiPlan \}\) \{/,
  'export function ProgramarCliente({ clientes, selected, setSelected, setMsg, biblioteca, isMiPlan, onModoAtleta }) {'
);

// Add the "Entrenar" button right below {/* ── Cabecera cliente ── */}
const headerRegex = /\{\/\*\s*"\?"\?\s*Cabecera cliente\s*"\?"\?\s*\*\/\}\s*\{!isMiPlan && \(/;
// Wait, regex might fail with special characters. Let's just string split.

const splitToken = '{!isMiPlan && (';
let parts = content.split(splitToken);
if (parts.length > 1) {
  let newHeader = `
        {/* Cabecera Civil Premium / Mi Plan */}
        {isMiPlan && onModoAtleta && (
          <div className="flex justify-end mb-4">
            <button 
              onClick={onModoAtleta}
              className="bg-[#10B981] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:opacity-90 flex items-center gap-2 transition-all"
            >
              <Dumbbell size={18} /> Entrenar (Modo Atleta)
            </button>
          </div>
        )}
        
        {!isMiPlan && (`;
  
  content = parts[0] + newHeader + parts.slice(1).join(splitToken);
  fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
  console.log("ProgramarCliente.jsx updated successfully.");
} else {
  console.log("Failed to find token in ProgramarCliente.jsx");
}
