import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

const oldSpan1 = '<span className="font-bold text-[#065F46] text-sm md:text-base flex items-center gap-2">';
const newSpan1 = '<span className="font-bold text-[#065F46] text-sm md:text-base flex items-center gap-2">';

content = content.replace(
  /<Dumbbell size=\{16\} \/> Estás en Modo Atleta/g,
  `{isCivil ? <><Dumbbell size={16} /> Entrenando</> : <><Dumbbell size={16} /> Estás en Modo Atleta</>}`
);

content = content.replace(
  /Previsualiza tu app exactamente como lo verían tus pacientes\./g,
  `{isCivil ? "Modo de ejecución de rutina." : "Previsualiza tu app exactamente como lo verían tus pacientes."}`
);

content = content.replace(
  /Volver al Panel/g,
  `{isCivil ? "Volver al Editor" : "Volver al Panel"}`
);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log("Banner text adjusted for Civil.");
