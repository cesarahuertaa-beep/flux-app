import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

content = content.replace(
  /\{ k: "progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"\/>, lb: "Progreso" \}/g,
  `...(isMiPlan ? [] : [{ k: "progreso", ic: <BarChart2 className="w-4 h-4 shrink-0"/>, lb: "Progreso" }])`
);

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("Hid progreso subtab in MiPlan.");
