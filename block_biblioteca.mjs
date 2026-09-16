import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

const oldLib = `{tab === "biblioteca" && <SubComponentWrapper><Biblioteca biblioteca={biblioteca} onUpdate={loadBiblioteca} setMsg={setMsg} isSuperadmin={isSuperadmin || role === "staff"}/></SubComponentWrapper>}`;
const newLib = `{(role === "superadmin" || role === "staff") && tab === "biblioteca" && <SubComponentWrapper><Biblioteca biblioteca={biblioteca} onUpdate={loadBiblioteca} setMsg={setMsg} isSuperadmin={true}/></SubComponentWrapper>}`;

content = content.replace(oldLib, newLib);

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log("Admin.jsx Biblioteca blocked.");
