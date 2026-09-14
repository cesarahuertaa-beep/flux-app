import fs from 'fs';

let file = 'src/components/cliente/Training.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Añadir isLocked a los props
content = content.replace(/syncStatus = "synced",\s*\}\) \{/, 'syncStatus = "synced",\n  isLocked = false,\n}) {');

// 2. Modificar input reps
content = content.replace(/placeholder=\{prevReps\}\s*value=\{repVal\}\s*onChange=\{\(e\) => onProgressChange\(ex\.id, wi, si, "reps", e\.target\.value, activeVarId\)\}/g, `placeholder={prevReps}
                              value={repVal}
                              disabled={isLocked}
                              onChange={(e) => onProgressChange(ex.id, wi, si, "reps", e.target.value, activeVarId)}`);

// 3. Modificar input peso
content = content.replace(/placeholder=\{displayPrevKg\}\s*value=\{displayKgVal\}\s*onChange=\{\(e\) => \{/g, `placeholder={displayPrevKg}
                              value={displayKgVal}
                              disabled={isLocked}
                              onChange={(e) => {`);

fs.writeFileSync(file, content);
