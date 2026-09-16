import fs from 'fs';

// 1. Fix Biblioteca.jsx
let biblio = fs.readFileSync('src/components/admin/Biblioteca.jsx', 'utf8');

// Remove setFiltroTipo("Todos");
biblio = biblio.replace(/setFiltroTipo\("Todos"\);\s*/g, '');

// Remove the pill from the preview modal
const modalRegex = /<span className="px-2\.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-600">\s*\{preview\.tipo_movimiento\}\s*<\/span>/g;
biblio = biblio.replace(modalRegex, '');

fs.writeFileSync('src/components/admin/Biblioteca.jsx', biblio);


// 2. Fix ProgramarCliente.jsx
let prog = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

// Remove {e.tipo_movimiento} rendering
prog = prog.replace(/\{e\.grupo_muscular\}\s*\?\s*\{e\.tipo_movimiento\}/g, '{e.grupo_muscular}');
prog = prog.replace(/\{e\.grupo_muscular\}\s*•\s*\{e\.tipo_movimiento\}/g, '{e.grupo_muscular}');
prog = prog.replace(/\{e\.grupo_muscular\}\s*\?\\s*\{e\.tipo_movimiento\}/g, '{e.grupo_muscular}');

// Replace any leftover combination
prog = prog.replace(/<span className="text-\[10px\] text-\[\#6B7A8D\] font-normal">\{e\.grupo_muscular\}(.*?)\{e\.tipo_movimiento\}<\/span>/g, '<span className="text-[10px] text-[#6B7A8D] font-normal">{e.grupo_muscular}</span>');

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', prog);

console.log("Replaced");
