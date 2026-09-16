import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

content = content.replace(/\\{\\/\\* ── Selector de Ciclos ── \\*\\/\\}\\s*\\{ciclos\\.length > 0 && \\(\\s*<div className="mb-5 bg-white rounded-xl/g, '{/* ── Selector de Ciclos ── */}\\n      <div className="mb-5 bg-white rounded-xl');

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("ProgramarCliente flexible regex patched!");
