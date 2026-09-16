import fs from 'fs';

const lines = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8').split('\\n');

const newLines = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('{/* ── Selector de Ciclos ── */}')) {
        newLines.push(lines[i]);
        i++;
        
        // Next line is {ciclos.length > 0 && (
        if (lines[i].includes('{ciclos.length > 0 && (')) {
            i++; // skip it
        }
        
        // Now we are at <div className="mb-5...
        while (i < lines.length) {
            let line = lines[i];
            
            // Fix the button text
            if (line.includes('<Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Siguiente Plan</span>')) {
                line = line.replace('Siguiente Plan', '{ciclos.length === 0 ? "Crear Primer Plan" : "Siguiente Plan"}');
            }
            
            // Insert empty state
            if (line.includes('<div className="flex flex-wrap gap-2">')) {
                newLines.push(`          {ciclos.length === 0 ? (
            <div className="text-center py-6 text-[#6B7A8D] text-[13px] border-2 border-dashed border-[#E2E8F0] rounded-xl bg-gray-50/50">
              Aún no hay planes configurados. <button onClick={() => setShowPlanModal(true)} className="text-[var(--brand-primary)] font-semibold hover:underline">Haz clic aquí para crear tu primer plan.</button>
            </div>
          ) : (`);
                newLines.push(line);
                i++;
                continue;
            }
            
            // Find the closing of the block to add the closing brace for the ternary
            if (line.includes('</div>') && lines[i-1] && lines[i-1].includes(')}')) {
                // We are at the end of the ciclos selector block.
                // Original ended with:
                //         )}
                //         </div>
                //       )}
                if (lines[i+1] && lines[i+1].includes(')}')) {
                    newLines.push(line); // </div>
                    newLines.push(`        )}`);
                    newLines.push(`      </div>`);
                    i += 2; // skip the old )}
                    continue;
                }
            }
            
            newLines.push(line);
            i++;
        }
    } else {
        newLines.push(lines[i]);
        i++;
    }
}

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', newLines.join('\\n'));
console.log("ProgramarCliente patched!");
