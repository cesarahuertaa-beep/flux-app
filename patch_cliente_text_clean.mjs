import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

content = content.replace(
  '<Nutrition dias={dias} cliente={cliente} nutri={nutri} semanaActualCiclo={currentCycleWeek} />',
  '<Nutrition dias={dias} cliente={cliente} nutri={nutri} semanaActualCiclo={currentCycleWeek} isSelfManaged={cliente?.nutriologo_id === null} />'
);

content = content.replace(
  'ultimoPeso={ultimoPeso}',
  'ultimoPeso={ultimoPeso}\\n                  isSelfManaged={cliente?.nutriologo_id === null}'
);

content = content.replace(
  '<Progreso cliente={cliente} />',
  '<Progreso cliente={cliente} isSelfManaged={cliente?.nutriologo_id === null} />'
);

const oldText = 'Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan.';
const newText = '{cliente?.nutriologo_id === null ? "Has completado exitosamente todas las semanas de este ciclo. ¡Es momento de ir al editor y diseñar tu próximo plan!" : "Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan."}';

content = content.replace(oldText, newText);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Cliente.jsx cleanly');
