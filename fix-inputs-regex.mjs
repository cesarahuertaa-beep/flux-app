import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

// I will use regex matching to replace the return block for the inputs
const regex = /return \(\s*<div key=\{si\} className="flex gap-2 mb-2 items-center">\s*<div className="w-8 text-center text-xs font-mono text-\[#0B1929\] font-bold">\s*\{si \+ 1\}\s*<\/div>[\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}/;

const newBlock = `return (
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
                                  {avancePct === 0
                                    ? <Minus size={12} className="text-[#9BA5B0]" />
                                    : avancePct > 0
                                      ? <TrendingUp size={12} className="text-emerald-500" />
                                      : <TrendingDown size={12} className="text-red-400" />
                                  }
                                  {avancePct !== 0 && (
                                    <span className={\`text-[10px] font-bold font-mono \${avancePct > 0 ? 'text-emerald-500' : 'text-red-400'}\`}>
                                      {Math.abs(avancePct).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-[10px] text-[#CBD5E1] font-mono">-</span>}
                            </div>
                          </div>
                          
                          {focusedInput?.exId === ex.id && focusedInput?.wi === wi && focusedInput?.si === si && (
                            <div className="flex gap-2 mt-1 pl-10 pr-14 animate-in fade-in slide-in-from-top-1 duration-200">
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
                        </div>
                      );
                    }`;

content = content.replace(regex, newBlock);
fs.writeFileSync('src/components/cliente/Training.jsx', content);
