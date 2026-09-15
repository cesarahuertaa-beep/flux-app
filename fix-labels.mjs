import fs from 'fs';

// Fix Login.jsx text
let l = fs.readFileSync('src/pages/Login.jsx', 'utf8');
l = l.replace(/'Solicitud Estudiante'/, "'Solicitud Estudiante de Nutrición'");
fs.writeFileSync('src/pages/Login.jsx', l);

// Fix Aprobaciones.jsx text
let a = fs.readFileSync('src/components/admin/Aprobaciones.jsx', 'utf8');
a = a.replace(/s\.tipo === 'nutriologo' \? 'Nutriólogo' : 'Estudiante'/, "s.tipo === 'nutriologo' ? 'Nutriólogo' : 'Estudiante de Nutrición'");
fs.writeFileSync('src/components/admin/Aprobaciones.jsx', a);
