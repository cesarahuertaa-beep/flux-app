import fs from 'fs';
let content = fs.readFileSync('src/components/admin/Biblioteca.jsx', 'utf8');
content = content.replace('filtroGrupo !== "Todos" || filtroTipo !== "Todos" || busqueda', 'filtroGrupo !== "Todos" || busqueda');
fs.writeFileSync('src/components/admin/Biblioteca.jsx', content);
