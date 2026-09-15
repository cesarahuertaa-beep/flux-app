import fs from 'fs';
let c = fs.readFileSync('src/components/admin/Aprobaciones.jsx', 'utf8');
c = c.replace('dbDelete', 'dbDel');
c = c.replace('dbDelete', 'dbDel');
c = c.replace('dbDelete', 'dbDel');
c = c.replace('dbDelete("solicitudes_profesionales", id)', 'dbDel(`solicitudes_profesionales?id=eq.${id}`)');
c = c.replace("dbPatch(\"solicitudes_profesionales\", sol.id, { estado: 'aprobada' })", "dbPatch(`solicitudes_profesionales?id=eq.${sol.id}`, { estado: 'aprobada' })");
c = c.replace("dbPatch(\"solicitudes_profesionales\", sol.id, { estado: 'rechazada' })", "dbPatch(`solicitudes_profesionales?id=eq.${sol.id}`, { estado: 'rechazada' })");
fs.writeFileSync('src/components/admin/Aprobaciones.jsx', c);
