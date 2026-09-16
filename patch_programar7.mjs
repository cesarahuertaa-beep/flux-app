import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

const anchor = '{/* ── Selector de Ciclos ── */}';
const targetStart = content.indexOf(anchor);

if (targetStart !== -1) {
    const targetSubstring = content.substring(targetStart, targetStart + 300);
    const replacementSubstring = targetSubstring.replace('{ciclos.length > 0 && (', '');
    content = content.substring(0, targetStart) + replacementSubstring + content.substring(targetStart + 300);
}

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("ProgramarCliente substring patched!");
