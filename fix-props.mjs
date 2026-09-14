import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

content = content.replace(/isLocked = false,?\s*\n\}\) \{/, "isLocked = false,\n  ultimoPeso = null,\n}) {");
fs.writeFileSync('src/components/cliente/Training.jsx', content);
