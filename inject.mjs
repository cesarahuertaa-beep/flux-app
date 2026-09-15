import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

const newLogic = `
  const getBodyData = (groups) => {
    const data = [];
    
    // We have 6 colors. Let's map RANKS (9 levels) to 1-6 frequencies.
    // 0 = none
    const getFrequency = (val) => {
      if (!val || val <= 0) return 0;
      // Use the same getRank logic to get the rank object
      const r = [...RANKS].reverse().find(r => val >= r.min) || RANKS[0];
      const rankIdx = RANKS.indexOf(r);
      // Map 0-8 to 1-6 safely
      let freq = Math.ceil((rankIdx / 8) * 6);
      if (freq < 1) freq = 1;
      if (freq > 6) freq = 6;
      return freq; // 1 to 6 mapped to array index 0 to 5
    };

    if (groups.pecho) data.push({ name: 'Pecho', muscles: ['chest'], frequency: getFrequency(groups.pecho) });
    if (groups.hombro) data.push({ name: 'Hombros', muscles: ['front-deltoids', 'back-deltoids'], frequency: getFrequency(groups.hombro) });
    if (groups.abdomen) data.push({ name: 'Abdomen', muscles: ['abs', 'obliques'], frequency: getFrequency(groups.abdomen) });
    if (groups.espalda) data.push({ name: 'Espalda', muscles: ['upper-back', 'lower-back', 'trapezius'], frequency: getFrequency(groups.espalda) });
    if (groups.brazo) data.push({ name: 'Brazos', muscles: ['biceps', 'triceps', 'forearm'], frequency: getFrequency(groups.brazo) });
    if (groups.pierna) data.push({ name: 'Piernas', muscles: ['quadriceps', 'hamstring', 'calves', 'gluteal', 'adductor', 'abductors'], frequency: getFrequency(groups.pierna) });

    const hasMax = data.some(d => d.frequency === 6);
    if (!hasMax && data.length > 0) {
      data.push({ name: 'Anchor', muscles: ['head'], frequency: 6 }); 
    }
    
    return data;
  };
`;

// Insert it right before COMP_KEYS.filter
const target = '].filter(k => current[k.key] != null && current[k.key] !== ""); // Solo mostrar los que tienen datos';
if (content.includes(target)) {
  content = content.replace(target, target + '\n' + newLogic);
  fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
  console.log("Injected getBodyData successfully!");
} else {
  console.log("Could not find insertion point");
}
