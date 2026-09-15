import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

// 1. Add Model import
content = content.replace(
  'import { useState, useEffect, useCallback } from "react";',
  'import { useState, useEffect, useCallback } from "react";\nimport Model from "react-body-highlighter";'
);

// 2. Add the getBodyData helper right before 'return (' inside the component
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
content = content.replace(
  '  return (\n    <div className="flex-1',
  newLogic + '\n  return (\n    <div className="flex-1'
);

// 3. Replace MuscularSVG render block
const muscularRegex = /<div className="w-48 h-72 drop-shadow-\[0_0_15px_rgba\(59,130,246,0\.3\)\]">\s*<MuscularSVG groups=\{groupAvg\}\s*\/>\s*<\/div>/;
const newMuscular = `<div className="flex flex-row justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <div className="flex gap-4">
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
              </div>
            </div>`;
content = content.replace(muscularRegex, newMuscular);

// 4. Replace SilhouetteSVG render block
const silhouetteRegex = /<SilhouetteSVG \/>/;
const newSilhouette = `<Model 
                    data={[]} 
                    style={{ width: '100%', height: '100%' }}
                    bodyColor="#CBD5E1"
                  />`;
content = content.replace(silhouetteRegex, newSilhouette);

// 5. Safely delete the function definitions using explicit replace
const definitionsRegex = /\/\/ ── SVGs de Figuras ──[\s\S]*?const MuscularSVG = \(\{ groups \}\) => \{[\s\S]*?<\/svg>\n  \);\n};/g;
content = content.replace(definitionsRegex, '// ── SVGs Eliminados ──');

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
