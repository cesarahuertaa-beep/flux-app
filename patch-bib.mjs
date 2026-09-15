import fs from 'fs';

let content = fs.readFileSync('src/components/admin/Biblioteca.jsx', 'utf8');

// 1. Remove TIPOS from import
content = content.replace('import { GRUPOS, TIPOS }', 'import { GRUPOS }');

// 2. Remove tipo_movimiento and filtroTipo from state
content = content.replace('const [filtroTipo, setFiltroTipo]   = useState("Todos");\n', '');
// 3. Remove matchT
content = content.replace('const matchT = filtroTipo==="Todos"  || e.tipo_movimiento===filtroTipo;\n', '');
content = content.replace('return matchG && matchT && matchB;', 'return matchG && matchB;');

// 4. Remove tipo_movimiento from initial forms
content = content.replace(/tipo_movimiento:"Empuje", /g, '');
content = content.replace(/tipo_movimiento:e\.tipo_movimiento, /g, '');

// 5. Remove the filtroTipo select entirely
const selectRegex = /<select\s+value=\{filtroTipo\}[\s\S]*?<\/select>/;
content = content.replace(selectRegex, '');

// 6. Remove the tipo_movimiento tag from the cards
const tagRegex = /<span className="px-2 py-0\.5 rounded-md text-\[11px\] font-medium bg-indigo-50 text-indigo-600">\s*\{e\.tipo_movimiento\}\s*<\/span>/;
content = content.replace(tagRegex, '');

// 7. Remove the tipo_movimiento field from the form modal
const formFieldRegex = /<div>\s*<label className="block text-sm font-semibold text-\[\#0B1929\] mb-1\.5">Tipo de movimiento<\/label>[\s\S]*?<\/select>\s*<\/div>/;
content = content.replace(formFieldRegex, '');

fs.writeFileSync('src/components/admin/Biblioteca.jsx', content);
