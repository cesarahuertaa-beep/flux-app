import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

content = content.replace(
  'export default function Training({ rutinas, progreso, progresoSemanaAnterior, clienteNombre, onSaveExercise, onProgressChange, semanaActualCiclo = 1, syncStatus, isLocked, ultimoPeso })',
  'export default function Training({ rutinas, progreso, progresoSemanaAnterior, clienteNombre, onSaveExercise, onProgressChange, semanaActualCiclo = 1, syncStatus, isLocked, ultimoPeso, isSelfManaged })'
);

content = content.replace(
  /Tu nutri.logo est. dise.ando tu plan de entrenamiento\./g,
  '{isSelfManaged ? "Aún no has diseñado tu plan de entrenamiento." : "Tu nutriólogo está diseñando tu plan de entrenamiento."}'
);

fs.writeFileSync('src/components/cliente/Training.jsx', content);
console.log('Patched Training.jsx');
