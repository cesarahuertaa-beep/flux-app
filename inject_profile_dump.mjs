import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

content = content.replace(
  /setErr\("ERR_DIAG_1: No se encontro tu cuenta activa\."\);/g,
  'setErr("ERR_DIAG_1: Perfil intruso detectado: " + JSON.stringify(profiles[0]));'
);

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx updated to dump profiles[0] on ERR_DIAG_1.");
