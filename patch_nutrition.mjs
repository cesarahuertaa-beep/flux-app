import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Nutrition.jsx', 'utf8');

content = content.replace(
  'export default function Nutrition({ dias, cliente, nutri, semanaActualCiclo = 1 })',
  'export default function Nutrition({ dias, cliente, nutri, semanaActualCiclo = 1, isSelfManaged })'
);

content = content.replace(
  '<h3 className="text-[#0B1929] font-bold text-lg mb-2">Sin plan asignado</h3>',
  '<h3 className="text-[#0B1929] font-bold text-lg mb-2">{isSelfManaged ? "Sin plan creado" : "Sin plan asignado"}</h3>'
);

// We use regex because of special character ó
content = content.replace(
  /Tu nutri.logo a.n no ha asignado tu dieta para este ciclo\./g,
  '{isSelfManaged ? "Aún no has creado tu plan de alimentación para este ciclo." : "Tu nutriólogo aún no ha asignado tu dieta para este ciclo."}'
);

fs.writeFileSync('src/components/cliente/Nutrition.jsx', content);
console.log('Patched Nutrition.jsx');
