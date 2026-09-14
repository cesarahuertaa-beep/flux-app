import fs from 'fs';

let file = 'src/components/admin/AgendaAdmin.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace `citasFiltradas` definition with just `citas`
const filteredDefRegex = /const citasFiltradas = filtro === "todos"\s*\?\s*citas\s*:\s*citas\.filter\(c => c\.estado === filtro\);/;
content = content.replace(filteredDefRegex, 'const citasFiltradas = citas;');

// 2. Remove the filter buttons
const filtersRegex = /\{\/\* Filtros \*\/\}\s*<div className="flex flex-wrap gap-2 mb-6">[\s\S]*?<\/div>/;
content = content.replace(filtersRegex, '');

// 3. Update the empty state text
const emptyStateRegex = /<div className="text-\[15px\] font-semibold text-\[\#6B7A8D\]">Sin citas \{filtro !== "todos" \? \`en estado "\$\{filtro\}"\` : ""\}<\/div>/;
content = content.replace(emptyStateRegex, '<div className="text-[15px] font-semibold text-[#6B7A8D]">No hay citas agendadas</div>');

fs.writeFileSync(file, content);
