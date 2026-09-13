import fs from 'fs';
// We can just read the Training.jsx file to see how it writes logs
const code = fs.readFileSync('src/components/cliente/Training.jsx', 'utf-8');
const match = code.match(/saveLog\s*=\s*(async\s*\([^)]*\)\s*=>\s*\{[^}]+\})/s);
if (match) console.log(match[0]);
