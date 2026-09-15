import fs from 'fs';
let c = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');
c = c.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/>/g, '</div>\n            </div>\n          </>');
fs.writeFileSync('src/components/cliente/Progreso.jsx', c);
