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

// We use regex because of special characters like ó, á
content = content.replace(
  /Has completado exitosamente todas las semanas de este ciclo\. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan\./g,
  '{cliente?.nutriologo_id === null ? "Has completado exitosamente todas las semanas de este ciclo. ¡Es momento de ir al editor y diseñar tu próximo plan!" : "Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan."}'
);
// In case it's literal or encoded differently
content = content.replace(
  /Has completado exitosamente todas las semanas de este ciclo\. Contacta a tu nutri.logo para agendar tu pr.xima evaluaci.n y recibir tu nuevo plan\./g,
  '{cliente?.nutriologo_id === null ? "Has completado exitosamente todas las semanas de este ciclo. ¡Es momento de ir al editor y diseñar tu próximo plan!" : "Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan."}'
);


fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Cliente.jsx');
