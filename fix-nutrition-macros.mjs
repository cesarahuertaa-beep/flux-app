import fs from 'fs';

let file = 'src/components/cliente/Nutrition.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldVars = /const caloriasMeta = nutri\?\.calorias_meta \|\| 0;\s*const totalKcal  = comidas\.reduce\(\(s, m\) => s \+ \(Number\(m\.calorias\) \|\| 0\), 0\) \|\| caloriasMeta;/;

const newVars = `const caloriasMeta = nutri?.calorias || nutri?.calorias_meta || 0; // fallback to legacy
  const sumKcal = comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
  const totalKcal = sumKcal > 0 ? sumKcal : caloriasMeta;
  const totalProt = comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
  const totalCarbs = comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
  const totalGrasas = comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);`;

content = content.replace(oldVars, newVars);

const oldHeaderBlock = /<div className="text-right bg-\[\#E8F1FB\] rounded-xl px-4 py-2 flex-shrink-0">\s*<p className="text-\[10px\] text-\[\#6B7A8D\] font-mono">TOTAL D.A<\/p>\s*<p className="text-2xl font-bold text-\[var\(--brand-primary\)\] font-mono leading-none mt-1">\s*\{totalKcal\}\s*<\/p>\s*<\/div>/;

const newHeaderBlock = `<div className="bg-[#E8F1FB] rounded-xl px-4 py-2 flex-shrink-0 flex items-center gap-4">
              <div className="text-center sm:text-left">
                <p className="text-[10px] text-[#6B7A8D] font-mono font-semibold uppercase tracking-wider">Total Día</p>
                <p className="text-xl sm:text-2xl font-bold text-[var(--brand-primary)] font-mono leading-none mt-1">{totalKcal} <span className="text-xs text-[var(--brand-primary)]/70 font-sans tracking-normal hidden sm:inline">kcal</span></p>
              </div>
              {(totalProt > 0 || totalCarbs > 0 || totalGrasas > 0) && (
                <div className="flex items-center gap-2.5 sm:gap-4 border-l border-blue-200/60 pl-2.5 sm:pl-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-blue-600/80 font-bold uppercase tracking-wider">Prot</span>
                    <span className="text-sm sm:text-base font-bold text-blue-800 font-mono">{totalProt}g</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-orange-600/80 font-bold uppercase tracking-wider">Carb</span>
                    <span className="text-sm sm:text-base font-bold text-orange-800 font-mono">{totalCarbs}g</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-yellow-600/80 font-bold uppercase tracking-wider">Grasa</span>
                    <span className="text-sm sm:text-base font-bold text-yellow-800 font-mono">{totalGrasas}g</span>
                  </div>
                </div>
              )}
            </div>`;

content = content.replace(oldHeaderBlock, newHeaderBlock);

fs.writeFileSync(file, content);
