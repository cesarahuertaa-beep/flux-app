import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

// 1. Replace EXACT_GROUPS and normalizeGroup
const exactGroupsString = `const EXACT_GROUPS = [
  "pecho", "abdomen", "oblicuos", "deltoide_anterior", "deltoide_posterior",
  "trapecio", "dorsal", "lumbar", "biceps", "triceps", "antebrazo",
  "gluteo", "cuadriceps", "isquiotibial", "pantorrilla", "aductor",
  "abductor", "soleo", "cuello"
];

const normalizeGroup = (g) => {
  if (!g) return "otro";
  const str = g.toLowerCase();
  if (EXACT_GROUPS.includes(str)) return str; 

  if (str.includes("pecho") || str.includes("pectoral")) return "pecho";
  if (str.includes("abdomen") || str.includes("core")) return "abdomen";
  if (str.includes("dorsal") || str.includes("espalda")) return "dorsal";
  if (str.includes("lumbar")) return "lumbar";
  if (str.includes("hombro") || str.includes("deltoide")) return "deltoide_anterior"; 
  if (str.includes("triceps") || str.includes("trceps")) return "triceps";
  if (str.includes("biceps") || str.includes("bceps") || str.includes("brazo")) return "biceps";
  if (str.includes("gluteo") || str.includes("glǧteo")) return "gluteo";
  if (str.includes("cuadriceps") || str.includes("cuǭdriceps") || str.includes("pierna")) return "cuadriceps";
  if (str.includes("isquio")) return "isquiotibial";
  if (str.includes("pantorrilla")) return "pantorrilla";
  
  return "otro";
};`;

const normalizeRegex = /const normalizeGroup = \(g\) => \{[\s\S]*?return "otro";\n\};/;
content = content.replace(normalizeRegex, exactGroupsString);

// 2. Replace muscleAdvances initialization
const muscleAdvancesRegex = /const muscleAdvances = \{ pecho: \[\], espalda: \[\], pierna: \[\], brazo: \[\], hombro: \[\], abdomen: \[\] \};/;
content = content.replace(muscleAdvancesRegex, `const muscleAdvances = {}; EXACT_GROUPS.forEach(g => muscleAdvances[g] = []);`);

// 3. Replace getBodyData
const getBodyDataRegex = /const getBodyData = \(groups\) => \{[\s\S]*?return data;\n  \};/;
const newGetBodyData = `const getBodyData = (groups) => {
    const data = [];
    
    const getFrequency = (val) => {
      if (!val || val <= 0) return 0;
      const r = [...RANKS].reverse().find(r => val >= r.min) || RANKS[0];
      const rankIdx = RANKS.indexOf(r);
      let freq = Math.ceil((rankIdx / 8) * 6);
      if (freq < 1) freq = 1;
      if (freq > 6) freq = 6;
      return freq;
    };

    if (groups.pecho) data.push({ name: 'Pecho', muscles: ['chest'], frequency: getFrequency(groups.pecho) });
    if (groups.abdomen) data.push({ name: 'Abdomen', muscles: ['abs'], frequency: getFrequency(groups.abdomen) });
    if (groups.oblicuos) data.push({ name: 'Oblicuos', muscles: ['obliques'], frequency: getFrequency(groups.oblicuos) });
    if (groups.deltoide_anterior) data.push({ name: 'Deltoide Ant.', muscles: ['front-deltoids'], frequency: getFrequency(groups.deltoide_anterior) });
    if (groups.deltoide_posterior) data.push({ name: 'Deltoide Post.', muscles: ['back-deltoids'], frequency: getFrequency(groups.deltoide_posterior) });
    if (groups.trapecio) data.push({ name: 'Trapecio', muscles: ['trapezius'], frequency: getFrequency(groups.trapecio) });
    if (groups.dorsal) data.push({ name: 'Dorsal', muscles: ['upper-back'], frequency: getFrequency(groups.dorsal) });
    if (groups.lumbar) data.push({ name: 'Lumbar', muscles: ['lower-back'], frequency: getFrequency(groups.lumbar) });
    if (groups.biceps) data.push({ name: 'Bíceps', muscles: ['biceps'], frequency: getFrequency(groups.biceps) });
    if (groups.triceps) data.push({ name: 'Tríceps', muscles: ['triceps'], frequency: getFrequency(groups.triceps) });
    if (groups.antebrazo) data.push({ name: 'Antebrazo', muscles: ['forearm'], frequency: getFrequency(groups.antebrazo) });
    if (groups.gluteo) data.push({ name: 'Glúteo', muscles: ['gluteal'], frequency: getFrequency(groups.gluteo) });
    if (groups.cuadriceps) data.push({ name: 'Cuádriceps', muscles: ['quadriceps'], frequency: getFrequency(groups.cuadriceps) });
    if (groups.isquiotibial) data.push({ name: 'Isquiotibial', muscles: ['hamstring'], frequency: getFrequency(groups.isquiotibial) });
    if (groups.pantorrilla) data.push({ name: 'Pantorrilla', muscles: ['calves'], frequency: getFrequency(groups.pantorrilla) });
    if (groups.aductor) data.push({ name: 'Aductor', muscles: ['adductor'], frequency: getFrequency(groups.aductor) });
    if (groups.abductor) data.push({ name: 'Abductor', muscles: ['abductors'], frequency: getFrequency(groups.abductor) });
    if (groups.soleo) data.push({ name: 'Sóleo', muscles: ['left-soleus', 'right-soleus'], frequency: getFrequency(groups.soleo) });
    if (groups.cuello) data.push({ name: 'Cuello', muscles: ['neck'], frequency: getFrequency(groups.cuello) });

    const hasMax = data.some(d => d.frequency === 6);
    if (!hasMax && data.length > 0) {
      data.push({ name: 'Anchor', muscles: ['head'], frequency: 6 }); 
    }
    
    return data;
  };`;
content = content.replace(getBodyDataRegex, newGetBodyData);

// 4. Update the label rendering to handle underscores
// Find: <span className="text-sm font-semibold text-white capitalize">{g}</span>
content = content.replace(
  '<span className="text-sm font-semibold text-white capitalize">{g}</span>',
  '<span className="text-sm font-semibold text-white capitalize">{g.replace(/_/g, " ")}</span>'
);

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
