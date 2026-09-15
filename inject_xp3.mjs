import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

const regex = /const getRank = \(pct\) => \{\r?\n  if \(pct == null\) return RANKS\[0\];\r?\n  return \[\.\.\.RANKS\]\.reverse\(\)\.find\(r => pct >= r\.min\) \|\| RANKS\[0\];\r?\n\};\r?\n/;
content = content.replace(regex, '');

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
