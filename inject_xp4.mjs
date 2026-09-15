import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

content = content.replace(
  '<p className="text-[10px] text-[#6B7A8D]">+{pct.toFixed(1)}%</p>',
  '<p className="text-[10px] text-[#6B7A8D]">{pct} XP</p>'
);

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
