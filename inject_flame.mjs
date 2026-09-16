import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Nutrition.jsx', 'utf8');

const oldLine = /<p className="text-xl sm:text-2xl font-bold text-\[var\(--brand-primary\)\] font-mono leading-none mt-1">\{totalKcal\} <span className="text-xs text-\[var\(--brand-primary\)\]\/70 font-sans tracking-normal hidden sm:inline">kcal<\/span><\/p>/;

const newLine = `<p className="flex items-center justify-center sm:justify-start gap-1 text-xl sm:text-2xl font-bold text-[var(--brand-primary)] font-mono leading-none mt-1">
                    <Flame size={20} className="text-[var(--brand-primary)]" />
                    {totalKcal} <span className="text-xs text-[var(--brand-primary)]/70 font-sans tracking-normal hidden sm:inline">kcal</span>
                  </p>`;

content = content.replace(oldLine, newLine);
fs.writeFileSync('src/components/cliente/Nutrition.jsx', content);
