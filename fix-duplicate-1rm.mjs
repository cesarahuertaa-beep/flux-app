import fs from 'fs';

let file = 'src/components/cliente/Training.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/  1RM Estimado \(Frmula Epley\) \s*const calcular1RM = \(peso, reps\) => \{\s*const p = parseFloat\(peso\), r = parseFloat\(reps\);\s*if \(\!p \|\| \!r \|\| p <= 0 \|\| r <= 0\) return null;\s*if \(r === 1\) return p;\s*return p \* \(1 \+ r \/ 30\);\s*\};\s*/g;

// Fallback regex to match it loosely
const regexFallback = /\/\/ [\s\S]*?1RM Estimado[\s\S]*?const calcular1RM = \(peso, reps\) => \{[\s\S]*?return p \* \(1 \+ r \/ 30\);\s*\};\s*/;

content = content.replace(regexFallback, "");

fs.writeFileSync(file, content);
