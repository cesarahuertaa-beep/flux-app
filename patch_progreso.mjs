import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

content = content.replace(
  'export default function Progreso({ cliente })',
  'export default function Progreso({ cliente, isSelfManaged })'
);

content = content.replace(
  /Tu nutri.logo a.n no ha registrado evaluaciones f.sicas\./g,
  '{isSelfManaged ? "Aún no has registrado ninguna evaluación física." : "Tu nutriólogo aún no ha registrado evaluaciones físicas."}'
);

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
console.log('Patched Progreso.jsx');
