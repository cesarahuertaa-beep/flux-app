import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

const regex = /\{\/\* COMPOSICI"N CORPORAL VISUAL \*\/\}[\s\S]*?(?=\{\/\* DESARROLLO MUSCULAR \*\/\}|<\/div>\s*<div className="bg-white rounded-3xl)/;

// Wait, I need to know exactly what comes after the VISUAL section to use regex.
// Let's first read the file lines to be exact.
