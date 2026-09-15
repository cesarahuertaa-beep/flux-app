import fs from 'fs';
const content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');
const idx = content.lastIndexOf('MiMembresia');
console.log(content.substring(idx - 500, idx + 500));
