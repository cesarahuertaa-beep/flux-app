import fs from 'fs';

let content = fs.readFileSync('src/components/admin/EjercicioSelector.jsx', 'utf8');

content = content.replace('import { C, GRUPOS, TIPOS }', 'import { C, GRUPOS }');
content = content.replace('const [filtroTipo, setFiltroTipo] = useState("Todos");\n', '');
content = content.replace('const matchT = filtroTipo==="Todos" || e.tipo_movimiento===filtroTipo;\n', '');
content = content.replace('return matchG && matchT && matchB;', 'return matchG && matchB;');

const selectRegex = /<select value=\{filtroTipo\}[\s\S]*?<\/select>/;
content = content.replace(selectRegex, '');

fs.writeFileSync('src/components/admin/EjercicioSelector.jsx', content);
