import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

// 1. Replace RANKS definition
const oldRanksRegex = /const RANKS = \[[\s\S]*?\];/;
const newRanks = `const RANKS = [
  { name: "Clase G", min: 0, color: "#64748B", level: 1 }, 
  { name: "Clase F", min: 100, color: "#9BA5B0", level: 1 }, 
  { name: "Clase E", min: 300, color: "#10B981", level: 2 }, 
  { name: "Clase D", min: 600, color: "#10B981", level: 2 }, 
  { name: "Clase C", min: 1000, color: "#3B82F6", level: 3 }, 
  { name: "Clase B", min: 1500, color: "#3B82F6", level: 3 }, 
  { name: "Clase A", min: 2100, color: "#8B5CF6", level: 4 }, 
  { name: "Clase S", min: 2800, color: "#F59E0B", level: 5 }, 
  { name: "Clase SS", min: 3600, color: "#F59E0B", level: 5 },
  { name: "Clase SSS", min: 4500, color: "#EF4444", level: 6 }
];

const getRank = (xp) => {
  return [...RANKS].reverse().find(r => xp >= r.min) || RANKS[0];
};`;
content = content.replace(oldRanksRegex, newRanks);

// 2. Replace the data processing logic in loadData
const loadDataRegex = /const muscleAdvances = \{\};[\s\S]*?setGroupAvg\(avg\);/;
const newLoadData = `      const muscleXP = {}; EXACT_GROUPS.forEach(g => muscleXP[g] = 0);

      const allWeeks = new Set();
      for (const ejId in byEj) {
         Object.keys(byEj[ejId]).forEach(w => allWeeks.add(Number(w)));
      }
      const sortedWeeks = Array.from(allWeeks).sort((a,b)=>a-b);
      const minWeek = sortedWeeks[0] || 1;
      const maxWeek = sortedWeeks[sortedWeeks.length - 1] || 1;

      const muscleStarted = {}; EXACT_GROUPS.forEach(g => muscleStarted[g] = false);
      const last1RM = {}; 

      for (let w = minWeek; w <= maxWeek; w++) {
         const musclesTrainedThisWeek = new Set();
         
         for (const ejId in byEj) {
            const g = normalizeGroup(ejMap[ejId]);
            if (!muscleXP.hasOwnProperty(g)) continue;

            const weekData = byEj[ejId][w];
            if (weekData) {
               muscleStarted[g] = true;
               musclesTrainedThisWeek.add(g);
               
               const s1 = weekData[1]; // serie 1
               if (s1 && s1.peso && s1.reps) {
                  const current1RM = calcular1RM(s1.peso, s1.reps);
                  if (current1RM) {
                     if (last1RM[ejId]) {
                        const pctGrowth = ((current1RM - last1RM[ejId]) / last1RM[ejId]) * 100;
                        muscleXP[g] += Math.round(pctGrowth);
                     }
                     last1RM[ejId] = current1RM;
                  }
               }
            }
         }

         // Puntos por consistencia
         for (const g of EXACT_GROUPS) {
            if (!muscleStarted[g]) continue;
            if (musclesTrainedThisWeek.has(g)) {
               muscleXP[g] += 10;
            } else {
               muscleXP[g] -= 15;
            }
            if (muscleXP[g] < 0) muscleXP[g] = 0;
         }
      }

      setGroupAvg(muscleXP);`;
content = content.replace(loadDataRegex, newLoadData);

// 3. Update getFrequency logic
const freqRegex = /const getFrequency = \(val\) => \{[\s\S]*?return freq;\n    \};/;
const newFreq = `const getFrequency = (val) => {
      if (!val || val <= 0) return 0;
      const r = getRank(val);
      return r.level;
    };`;
content = content.replace(freqRegex, newFreq);

// 4. Update the text label formatting in RANGOS ALCANZADOS
// It used to print `+${pct.toFixed(1)}%`. Now we should print `${pct} XP`.
content = content.replace('"+", pct.toFixed(1), "%"', 'pct, " XP"');

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
