import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

// Restore the progreso tab that was conditionally hidden with ...(isMiPlan ? [] : [...])
content = content.replace(
  /\.\.\.\(isMiPlan \? \[\] : \[\{ k: "progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"\/>, lb: "Progreso" \}\]\)/,
  `{ k: "progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"/>, lb: "Progreso" }`
);

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("ProgramarCliente.jsx cleaned up.");
