import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

// Find the second declaration of getRank and remove it
const oldGetRankRegex = /const getRank = \(pct\) => \{[\s\S]*?return idx === -1 \? RANKS\[RANKS\.length - 1\] : RANKS\[idx\];\n\};/;

content = content.replace(oldGetRankRegex, '');

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
