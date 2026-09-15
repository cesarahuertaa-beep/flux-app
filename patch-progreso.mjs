import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

// Add the import at the top
content = content.replace(
  'import { useMemo } from "react";',
  'import { useMemo } from "react";\nimport Model from "react-body-highlighter";'
);

// We need to map our groups to Model's expected format.
// Our groups: hombro, pecho, abdomen, espalda, brazo, pierna
// react-body-highlighter muscles: shoulders, chest, abs, upper-back, lower-back, biceps, triceps, forearm, quadriceps, hamstrings, calves, gluteal
const newLogic = `
  const getBodyData = (groups) => {
    const data = [];
    
    // Función auxiliar para obtener el índice del rango (0 a 5)
    const getFrequency = (val) => {
      if (!val) return 0;
      const idx = RANKS.findIndex(r => val <= r.max);
      return idx === -1 ? 5 : idx;
    };

    if (groups.pecho) data.push({ name: 'Pecho', muscles: ['chest'], frequency: getFrequency(groups.pecho) });
    if (groups.hombro) data.push({ name: 'Hombros', muscles: ['front-deltoids', 'back-deltoids'], frequency: getFrequency(groups.hombro) });
    if (groups.abdomen) data.push({ name: 'Abdomen', muscles: ['abs', 'obliques'], frequency: getFrequency(groups.abdomen) });
    if (groups.espalda) data.push({ name: 'Espalda', muscles: ['upper-back', 'lower-back', 'trapezius'], frequency: getFrequency(groups.espalda) });
    if (groups.brazo) data.push({ name: 'Brazos', muscles: ['biceps', 'triceps', 'forearm'], frequency: getFrequency(groups.brazo) });
    if (groups.pierna) data.push({ name: 'Piernas', muscles: ['quadriceps', 'hamstrings', 'calves', 'gluteal', 'adductor', 'abductors'], frequency: getFrequency(groups.pierna) });

    // Truco: Para forzar que el componente respete nuestra escala exacta de colores (0 a 5),
    // inyectamos un músculo invisible o irrelevante con frecuencia máxima (5) si nadie la tiene.
    const hasMax = data.some(d => d.frequency === 5);
    if (!hasMax && data.length > 0) {
      data.push({ name: 'Anchor', muscles: ['head'], frequency: 5 }); 
    }
    
    return data;
  };
`;

// Inject this logic before the return
content = content.replace(
  'return (',
  newLogic + '\n  return ('
);

// Replace the MuscularSVG rendering
content = content.replace(
  '<MuscularSVG groups={groupAvg} />',
  `<div className="flex gap-4">
                <Model 
                  data={getBodyData(groupAvg)} 
                  style={{ width: '12rem', padding: '1rem' }} 
                  highlightedColors={["#9BA5B0", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
                  type="anterior"
                />
                <Model 
                  data={getBodyData(groupAvg)} 
                  style={{ width: '12rem', padding: '1rem' }} 
                  highlightedColors={["#9BA5B0", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
                  type="posterior"
                />
              </div>`
);

// Wait, the container for MuscularSVG is:
// <div className="w-48 h-72 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
content = content.replace(
  'className="w-48 h-72 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"',
  'className="flex flex-row justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"'
);

// Wait, what about SilhouetteSVG? The user said "el de arriba"
// Let's replace SilhouetteSVG with just a gray model.
content = content.replace(
  '<SilhouetteSVG />',
  `<Model 
                    data={[]} 
                    style={{ width: '100%', height: '100%' }}
                    bodyColor="#CBD5E1"
                  />`
);

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
