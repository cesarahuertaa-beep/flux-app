import fs from 'fs';
let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// Use regex for multiline replacement to handle \r\n vs \n
content = content.replace(/\s*\{isCivil && tab === "progreso" && \(\s*<SubComponentWrapper title="Progreso">\s*<ProgresoCliente selected=\{clienteData\} setMsg=\{setMsg\} \/>\s*<\/SubComponentWrapper>\s*\)\}/g, '');

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log("Progreso block regex replaced.");
