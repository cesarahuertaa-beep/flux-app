import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

const oldBlock = `<div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#0B1929] mb-6">Composicin corporal</h2>
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                
                <div className="flex flex-col gap-6 text-right order-2 md:order-1">
                  {COMP_KEYS.slice(0, Math.ceil(COMP_KEYS.length/2)).map(k => (
                    <div key={k.key}>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">{k.label}</p>
                      <p className="text-xl font-bold text-[#1A6FD4]">{current[k.key]} <span className="text-xs text-[#9BA5B0]">{k.unit}</span></p>
                    </div>
                  ))}
                </div>

                <div className="w-32 h-56 order-1 md:order-2">
                  <SilhouetteSVG />
                </div>

                <div className="flex flex-col gap-6 text-left order-3 md:order-3">
                  {COMP_KEYS.slice(Math.ceil(COMP_KEYS.length/2)).map(k => (
                    <div key={k.key}>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">{k.label}</p>
                      <p className="text-xl font-bold text-[#1A6FD4]">{current[k.key]} <span className="text-xs text-[#9BA5B0]">{k.unit}</span></p>
                    </div>
                  ))}
                </div>

              </div>
            </div>`;

// Account for potential exact encoding issues, I'll use regex.
const regex = /<div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-\[#E2E8F0\]">\s*<h2 className="text-lg font-bold text-\[#0B1929\] mb-6">Composici[^<]*<\/h2>\s*<div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">[\s\S]*?<\/div>\s*<\/div>/;

const newBlock = `<div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#0B1929] mb-6 md:text-center">Composición corporal</h2>
              <div className="flex flex-row items-center justify-center gap-4 md:gap-16">
                
                <div className="flex flex-col gap-6 text-right flex-1">
                  {current.peso != null && current.peso !== "" && (
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">PESO</p>
                      <p className="text-xl md:text-2xl font-bold text-[#1A6FD4]">{current.peso} <span className="text-[10px] md:text-xs text-[#9BA5B0]">kg</span></p>
                    </div>
                  )}
                </div>

                <div className="w-24 h-48 md:w-32 md:h-56 shrink-0 flex items-center justify-center">
                  <SilhouetteSVG />
                </div>

                <div className="flex flex-col gap-6 text-left flex-1">
                  {current.grasa_pct != null && current.grasa_pct !== "" && (
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">GRASA</p>
                      <p className="text-xl md:text-2xl font-bold text-[#1A6FD4]">{current.grasa_pct} <span className="text-[10px] md:text-xs text-[#9BA5B0]">%</span></p>
                    </div>
                  )}
                  {current.musculo_pct != null && current.musculo_pct !== "" && (
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7A8D] tracking-widest">MÚSCULO</p>
                      <p className="text-xl md:text-2xl font-bold text-[#1A6FD4]">{current.musculo_pct} <span className="text-[10px] md:text-xs text-[#9BA5B0]">%</span></p>
                    </div>
                  )}
                </div>

              </div>
            </div>`;

content = content.replace(regex, newBlock);
fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
