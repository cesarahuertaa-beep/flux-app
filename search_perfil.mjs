import fs from 'fs';
const txt = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');
const lines = txt.split('\n');
lines.forEach((l,i) => {
  if (l.includes('perfil')) console.log(i, l.trim());
});
