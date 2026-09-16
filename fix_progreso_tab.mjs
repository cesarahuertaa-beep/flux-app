import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// Add import
if (!content.includes('ProgresoCliente')) {
  content = content.replace(
    'import { ProgramarCliente } from "../components/admin/ProgramarCliente";',
    'import { ProgramarCliente } from "../components/admin/ProgramarCliente";\nimport { ProgresoCliente } from "../components/admin/ProgresoCliente";'
  );
}

// Replace tab rendering
content = content.replace(
  /\{tab === "progreso" && \(\s*<Progreso cliente=\{cliente\} \/>\s*\)\}/g,
  `{tab === "progreso" && (
            isCivil 
              ? <ProgresoCliente selected={cliente} setMsg={() => {}} /> 
              : <Progreso cliente={cliente} />
          )}`
);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log("Fixed Cliente.jsx Progreso tab.");
