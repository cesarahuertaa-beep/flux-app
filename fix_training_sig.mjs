import fs from 'fs';
let txt = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

const oldSig = `  isLocked = false,
  ultimoPeso = null,\\n  isSelfManaged = false,
}) {`;

const newSig = `  isLocked = false,
  ultimoPeso = null,
  isSelfManaged = false,
}) {`;

txt = txt.replace(oldSig, newSig);

// Also try fallback
const oldSig2 = 'ultimoPeso = null,\\n  isSelfManaged = false,';
const newSig2 = 'ultimoPeso = null,\n  isSelfManaged = false,';
txt = txt.replace(oldSig2, newSig2);

fs.writeFileSync('src/components/cliente/Training.jsx', txt);
