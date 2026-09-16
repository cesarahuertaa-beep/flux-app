import fs from 'fs';
let content = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

const regex = /\{\s*isSuperadmin\s*&&\s*\(\s*<button\s*onClick=\{handleSaveConfig\}[\s\S]*?Guardar datos de cobro\s*<\/button>\s*\)\s*\}/g;
content = content.replace(regex, '');

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', content);
