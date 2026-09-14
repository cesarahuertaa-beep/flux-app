import fs from 'fs';

let file = 'src/pages/Cliente.jsx';
let content = fs.readFileSync(file, 'utf8');

// Reemplazo de currentCycleWeek
const regex1 = /const currentCycleWeek = \(\(\) => \{[\s\S]*?return isNaN\(wk\) \? 1 : Math\.max\(1, wk\);\s*\}\)\(\);/;
const repl1 = `const { currentCycleWeek, isFuture } = (() => {
    const startStr = cicloActivo?.fecha_inicio || cicloActivo?.created_at || (rutinas.length > 0 ? rutinas[0].created_at : null);
    if (!startStr) return { currentCycleWeek: 1, isFuture: false };
    
    let t0;
    if (startStr.includes("T")) {
      t0 = new Date(startStr);
    } else {
      const [y, m, d] = startStr.split("-").map(Number);
      t0 = new Date(y, m - 1, d);
    }
    
    t0.setHours(0,0,0,0);
    
    const now = new Date();
    now.setHours(0,0,0,0);
    
    const diffDays = Math.floor((now.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
    const isFut = diffDays < 0;
    const wk = isFut ? 1 : Math.floor(diffDays / 7) + 1;
    return { currentCycleWeek: isNaN(wk) ? 1 : Math.max(1, wk), isFuture: isFut };
  })();`;

content = content.replace(regex1, repl1);

// Reemplazo en Training
const regex2 = /syncStatus=\{syncStatus\}\s*\/\>/;
const repl2 = `syncStatus={syncStatus}
              isLocked={isFuture}
            />`;

content = content.replace(regex2, repl2);

fs.writeFileSync(file, content);
