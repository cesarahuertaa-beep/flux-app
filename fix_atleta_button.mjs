import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

content = content.replace(
  /\{isAtletaMode && \(/g,
  `{(isAtletaMode || atletaModeCivil) && (`
);

content = content.replace(
  /onClick=\{onBackToAdmin\}/g,
  `onClick={isAtletaMode ? onBackToAdmin : () => setAtletaModeCivil(false)}`
);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log("Fixed Cliente.jsx Modo Atleta back button.");
