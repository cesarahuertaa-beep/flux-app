import fs from 'fs';

let file = 'src/components/admin/ProgramarCliente.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove saveMacros entirely.
content = content.replace(/const saveMacros = async \(\) => \{[\s\S]*?setSaving\(false\);\s*\};\s*/, '');

// 2. Remove Macros diarios container. We replace it with nothing, but we need to match it correctly.
const macrosContainerRegex = /<div className=\{`bg-white rounded-2xl border border-\[\#E2E8F0\] p-4 mb-3\.5 \$\{isReadOnly \? 'opacity-75' : ''\}`\}>[\s\S]*?Guardar macros.*?<\/button>\}[\s\S]*?<\/div>/;

// Replace the container and move PDF button to the next div.
const dListHeaderRegex = /<div className="flex justify-between items-center mb-2\.5">\s*<span className="font-semibold">D.as del plan <span className="text-\[\#6B7A8D\] font-normal">\(\{dias\.length\}\)<\/span><\/span>\s*\{\!isReadOnly && <button className="text-xs flex items-center gap-1 px-3 py-1\.5 rounded-lg bg-\[var\(--brand-primary\)\] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity" onClick=\{openNewDia\}><Plus className="w-3\.5 h-3\.5" \/> D.a<\/button>\}\s*<\/div>/;

const newDListHeader = `<div className="flex justify-between items-center mb-2.5">
              <span className="font-semibold">Días del plan <span className="text-[#6B7A8D] font-normal">({dias.length})</span></span>
              <div className="flex items-center gap-2">
                {dias.length > 0 && (
                  <button
                    onClick={() => generateNutriPDF(selected, nutri, dias, brand)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#0B1929] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] text-xs font-semibold shadow-sm transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Descargar PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                )}
                {!isReadOnly && <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white font-semibold shadow-sm hover:opacity-90 transition-opacity" onClick={openNewDia}><Plus className="w-3.5 h-3.5" /> Día</button>}
              </div>
            </div>`;

content = content.replace(macrosContainerRegex, '');
content = content.replace(dListHeaderRegex, newDListHeader);

// 3. Add dynamic sums to the dia list item
const oldDiaMeta = /<span className="text-xs text-\[\#6B7A8D\] mt-0\.5 shrink-0">\{d\.comidas\.length\} comidas<\/span>/;
const newDiaMeta = `<div className="text-xs text-[#6B7A8D] mt-0.5 shrink-0 flex items-center flex-wrap gap-2">
                                  <span>{d.comidas.length} comidas</span>
                                  {(() => {
                                    const sumKcal = d.comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
                                    const sumProt = d.comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
                                    const sumCarbs = d.comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
                                    const sumGrasas = d.comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);
                                    if (sumKcal || sumProt || sumCarbs || sumGrasas) {
                                      return (
                                        <span className="text-[10px] font-mono bg-[#E8F1FB] text-[var(--brand-primary)] px-1.5 py-0.5 rounded-md font-bold">
                                          🔥{sumKcal} <span className="text-[9px] opacity-70">kcal</span> · 🍗{sumProt}g · 🍞{sumCarbs}g · 🥑{sumGrasas}g
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>`;
content = content.replace(oldDiaMeta, newDiaMeta);

// 4. Add dynamic sums to the Day Edit Modal header
const oldModalHeader = /<div className="flex justify-between items-center p-4 sm:p-5 border-b border-\[\#E2E8F0\]">\s*<h3 className="font-bold text-\[\#0B1929\] text-lg">\s*\{editDia \? "Editar D.a" : "Nuevo D.a"\}\s*<\/h3>\s*<button onClick=\{\(\) => setShowDiaModal\(false\)\} className="text-\[\#6B7A8D\] hover:bg-gray-100 p-1\.5 rounded-lg transition-colors">\s*<X className="w-5 h-5" \/>\s*<\/button>\s*<\/div>/;

const newModalHeader = `<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 sm:p-5 border-b border-[#E2E8F0] gap-3">
            <div className="flex justify-between items-center w-full sm:w-auto">
              <h3 className="font-bold text-[#0B1929] text-lg">
                {editDia ? "Editar Día" : "Nuevo Día"}
              </h3>
              <button onClick={() => setShowDiaModal(false)} className="text-[#6B7A8D] hover:bg-gray-100 p-1.5 rounded-lg transition-colors sm:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-3 bg-[#E8F1FB] px-3 py-1.5 rounded-lg">
              <div className="flex flex-col">
                <span className="text-[9px] text-[#6B7A8D] font-bold uppercase">Calorías</span>
                <span className="text-sm font-bold text-[var(--brand-primary)] font-mono leading-none">{diaForm.comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0)}</span>
              </div>
              <div className="w-px h-6 bg-blue-200"></div>
              <div className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-blue-600 font-bold uppercase">Prot</span>
                  <span className="text-xs font-bold text-blue-800 font-mono">{diaForm.comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0)}g</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-orange-600 font-bold uppercase">Carb</span>
                  <span className="text-xs font-bold text-orange-800 font-mono">{diaForm.comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0)}g</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-yellow-600 font-bold uppercase">Grasa</span>
                  <span className="text-xs font-bold text-yellow-800 font-mono">{diaForm.comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0)}g</span>
                </div>
              </div>
            </div>

            <button onClick={() => setShowDiaModal(false)} className="hidden sm:block text-[#6B7A8D] hover:bg-gray-100 p-1.5 rounded-lg transition-colors ml-auto">
              <X className="w-5 h-5" />
            </button>
          </div>`;
content = content.replace(oldModalHeader, newModalHeader);

fs.writeFileSync(file, content);
