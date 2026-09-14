import fs from 'fs';

let file = 'src/components/cliente/Training.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Props
content = content.replace(/isLocked = false,\n\}\) \{/, `isLocked = false,
  ultimoPeso = null,
}) {`);

// 2. State
content = content.replace(/const \[unitPrefs,\s*setUnitPrefs\]\s*=\s*useState\(\{\}\);\s*\/\/\s*\{\s*\[exId_variantId\]:\s*'kg'\s*\|\s*'lb'\s*\}/, `const [unitPrefs,       setUnitPrefs]       = useState({}); // { [exId_variantId]: 'kg' | 'lb' }
  const [focusedInput,    setFocusedInput]    = useState(null); // { exId, wi, si }`);

// 3. graficaData
const oldGraficaData = /const primerExObj = ejercicios\[0\] \? getVariantObj\(ejercicios\[0\]\)\.obj : null;\s*const totalSemanas = rutinaActiva\?.semanas \|\| 4;\s*const graficaData = primerExObj[\s\S]*?\: \[\];/;

const newGraficaData = `  const targetExIndex = expandedEx !== null ? expandedEx : 0;
  const targetEx = ejercicios[targetExIndex];
  const targetExObj = targetEx ? getVariantObj(targetEx).obj : null;
  const totalSemanas = rutinaActiva?.semanas || 4;
  const numSeries = targetExObj ? parseInt(targetExObj.num_series) || 4 : 4;

  const calcular1RMForGraph = (peso, reps) => {
    const p = parseFloat(peso), r = parseFloat(reps);
    if (!p || !r || p <= 0 || r <= 0) return null;
    if (r === 1) return p;
    return p * (1 + r / 30);
  };

  const graficaData = targetExObj
    ? Array.from({ length: totalSemanas }, (_, w) => {
        const dataPoint = { week: \`Sem \${w + 1}\` };
        let hasData = false;
        for (let s = 0; s < numSeries; s++) {
          const variantId = activeVariant[targetEx.id] || 'original';
          const p = parseFloat(progreso[\`\${targetEx.id}-\${w}-\${s}-peso-\${variantId}\`]);
          const rVal = progreso[\`\${targetEx.id}-\${w}-\${s}-reps-\${variantId}\`];
          const r = rVal === "Falta" ? 0 : parseFloat(rVal);
          
          if (!isNaN(p) && !isNaN(r) && p > 0 && r > 0) {
            const e1rm = calcular1RMForGraph(p, r);
            if (e1rm) {
              dataPoint[\`serie_\${s}\`] = Math.round(e1rm * 10) / 10;
              hasData = true;
            }
          }
        }
        return hasData ? dataPoint : null;
      }).filter(Boolean)
    : [];`;

content = content.replace(oldGraficaData, newGraficaData);

// Remove the old calcular1RM to avoid duplicate definition

// 4. LineChart
const oldChart = /<LineChart data=\{graficaData\}>[\s\S]*?<\/LineChart>/;
const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
const linesCode = Array.from({ length: 6 }).map((_, i) => 
  `{numSeries > ${i} && (
                  <Line
                    type="monotone"
                    dataKey="serie_${i}"
                    stroke="${colors[i]}"
                    strokeWidth={2}
                    dot={{ fill: "${colors[i]}", r: 3 }}
                    name="Serie ${i + 1}"
                    connectNulls={false}
                  />
                )}`
).join('\n                ');

const newChart = `<LineChart data={graficaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip
                  contentStyle={{
                    fontFamily: "JetBrains Mono",
                    fontSize: 11,
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                  }}
                  formatter={(value, name) => [\`\${value} kg\`, name]}
                />
                ${linesCode}
              </LineChart>`;

content = content.replace(oldChart, newChart);
content = content.replace(/Progresin de Carga ?" \{primerExObj\?\.nombre\}/, "Progresión de 1RM - {targetExObj?.nombre}");
content = content.replace(/Progresión de Carga - \{primerExObj\?\.nombre\}/, "Progresión de 1RM - {targetExObj?.nombre}");

// 5. Inputs (onFocus, onBlur, Context Buttons)
const oldInputRow = /return \(\s*<div key=\{si\} className="flex gap-2 mb-2 items-center">[\s\S]*?\{\/\* "?"? Status Icon "?"? \*\/\}/;

const newInputRow = `return (
                        <div key={si} className="flex flex-col mb-3">
                          <div className="flex gap-2 items-center">
                            <div className="w-8 text-center text-xs font-mono text-[#0B1929] font-bold">
                              {si + 1}
                            </div>

                            <div className="flex-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder={prevReps}
                                value={repVal}
                                disabled={isLocked}
                                onFocus={() => setFocusedInput({ exId: ex.id, wi, si })}
                                onBlur={() => setTimeout(() => setFocusedInput(null), 150)}
                                onChange={(e) => onProgressChange(ex.id, wi, si, "reps", e.target.value, activeVarId)}
                                className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                              />
                            </div>

                            <div className="flex-1 relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={displayPrevKg}
                                value={displayKgVal}
                                disabled={isLocked}
                                onFocus={() => setFocusedInput({ exId: ex.id, wi, si })}
                                onBlur={() => setTimeout(() => setFocusedInput(null), 150)}
                                onChange={(e) => {
                                  const dbVal = parseDBWeight(e.target.value, prefUnit);
                                  onProgressChange(ex.id, wi, si, "peso", dbVal, activeVarId);
                                }}
                                className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 pr-6 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                              />
                              <button 
                                onClick={() => setUnitPrefs(s => ({ ...s, [\`\${ex.id}_\${activeVarId}\`]: prefUnit === 'kg' ? 'lb' : 'kg' }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[var(--brand-primary)]"
                              >
                                {prefUnit}
                              </button>
                            </div>

                            <div className="w-12 flex justify-center items-center">
                              {avancePct !== null ? (
                                <div className="flex items-center gap-0.5">
                                  {avancePct > 0 ? <TrendingUp size={12} className="text-[#10B981]" /> :
                                   avancePct < 0 ? <TrendingDown size={12} className="text-[#EF4444]" /> :
                                   <Minus size={12} className="text-[#6B7A8D]" />}
                                  <span className={\`text-[10px] font-bold font-mono \${avancePct > 0 ? 'text-[#10B981]' : avancePct < 0 ? 'text-[#EF4444]' : 'text-[#6B7A8D]'}\`}>
                                    {Math.abs(avancePct).toFixed(0)}%
                                  </span>
                                </div>
                              ) : <span className="text-[10px] text-[#CBD5E1] font-mono">-</span>}
                            </div>
                          </div>
                          
                          {focusedInput?.exId === ex.id && focusedInput?.wi === wi && focusedInput?.si === si && (
                            <div className="flex gap-2 mt-1 pl-10 pr-12 animate-in fade-in slide-in-from-top-1 duration-200">
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  onProgressChange(ex.id, wi, si, "reps", "Falta", activeVarId);
                                  onProgressChange(ex.id, wi, si, "peso", "0", activeVarId);
                                  setFocusedInput(null);
                                }}
                                className="flex-1 bg-[#FEE2E2] text-[#EF4444] text-[10px] font-bold py-1.5 rounded-md hover:bg-[#FCA5A5] transition-colors"
                              >
                                Falté
                              </button>
                              {ultimoPeso && (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    onProgressChange(ex.id, wi, si, "peso", ultimoPeso.toString(), activeVarId);
                                    setFocusedInput(null);
                                  }}
                                  className="flex-1 bg-[#E0E7FF] text-[#4F46E5] text-[10px] font-bold py-1.5 rounded-md hover:bg-[#C7D2FE] transition-colors"
                                >
                                  Corporal ({ultimoPeso}kg)
                                </button>
                              )}
                            </div>
                          )}
                          {/* 🏋️ Status Icon 🏋️ */}`;

content = content.replace(oldInputRow, newInputRow);

fs.writeFileSync(file, content);
