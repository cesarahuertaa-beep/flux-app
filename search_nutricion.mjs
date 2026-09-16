import fs from 'fs';
const txt = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');
const lines = txt.split('\n');
let found = false;
lines.forEach((l,i) => {
  if (l.includes('tab === "nutricion"')) {
    console.log(lines.slice(i-5, i+25).join('\n'));
    found = true;
  }
});
