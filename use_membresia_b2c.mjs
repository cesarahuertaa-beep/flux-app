import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// Add import
if (!content.includes('MembresiaB2C')) {
  content = content.replace(
    'import { ProgramarCliente } from "../components/admin/ProgramarCliente";',
    'import { ProgramarCliente } from "../components/admin/ProgramarCliente";\nimport { MembresiaB2C } from "../components/cliente/MembresiaB2C";'
  );
}

// Replace tab rendering
content = content.replace(
  /\{tab === "membresia" && isCivil && \([\s\S]*?<\/div>\s*\)\}/,
  `{tab === "membresia" && isCivil && (
                 <MembresiaB2C cliente={cliente} />
              )}`
);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log("Fixed Cliente.jsx Membresia tab.");
