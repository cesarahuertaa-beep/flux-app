import fs from 'fs';
let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

const logicRegex = /const \{ currentCycleWeek, isFuture \} = \(\(\) => \{[\s\S]*?\}\)\(\);/;
const newLogic = `const { currentCycleWeek, isFuture } = (() => {
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
  })();

  const cycleDuration = rutinas.length > 0 ? Math.max(...rutinas.map(r => parseInt(r.semanas) || 4)) : 4;
  const isFinished = !isFuture && currentCycleWeek > cycleDuration;`;

content = content.replace(logicRegex, newLogic);

const jsxRegex = /<>\s*\{tab === "nutricion" && \(\s*<Nutrition[\s\S]*?isLocked=\{isFuture\}\s*ultimoPeso=\{ultimoPeso\}\s*\/>\s*\)\}/;

const newJsx = `<>
          {isFinished && (tab === "nutricion" || tab === "deporte") ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
              <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center shadow-sm mb-4">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="text-[#0B1929] font-bold text-xl mb-2" style={{ fontFamily: "DM Sans" }}>
                ¡Felicidades, terminaste!
              </h3>
              <p className="text-[#6B7A8D] text-sm max-w-[280px]">
                Has completado exitosamente todas las semanas de este ciclo. Contacta a tu nutriólogo para agendar tu próxima evaluación y recibir tu nuevo plan.
              </p>
            </div>
          ) : (
            <>
              {tab === "nutricion" && (
                <Nutrition dias={dias} cliente={cliente} nutri={nutri} semanaActualCiclo={currentCycleWeek} />
              )}

              {tab === "deporte" && (
                <Training 
                  rutinas={rutinas} 
                  progreso={progreso}
                  progresoSemanaAnterior={progreso}
                  clienteNombre={cliente.nombre}
                  onSaveExercise={async () => {}}
                  onProgressChange={handleProgressChange}
                  semanaActualCiclo={currentCycleWeek}
                  syncStatus={syncStatus}
                  isLocked={isFuture}
                  ultimoPeso={ultimoPeso}
                />
              )}
            </>
          )}`;

content = content.replace(jsxRegex, newJsx);

fs.writeFileSync('src/pages/Cliente.jsx', content);
