import fs from 'fs';
let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

const targetStr = '<SubComponentWrapper title="Mi Membresía"><MiMembresia clientes={clientes} profileId={myId} setMsg={setMsg} /></SubComponentWrapper>';
// Note: PowerShell output showed "Mi Membresa", so I will use regex to be safe.

const regex = /\{\s*tab === "membresia"[\s\S]*?MiMembresia[\s\S]*?\}/;

content = content.replace(regex, (match) => {
  return `{tab === "aprobaciones" && (isSuperadmin || role === "staff") && (
          <SubComponentWrapper title="Aprobaciones"><Aprobaciones setMsg={setMsg} /></SubComponentWrapper>
        )}\n        ${match}`;
});

fs.writeFileSync('src/pages/Admin.jsx', content);
