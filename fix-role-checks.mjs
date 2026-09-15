import fs from 'fs';

// 1. Fix UserProfile.jsx
let up = fs.readFileSync('src/components/UserProfile.jsx', 'utf8');
up = up.replace(
  '{r.role === "cliente" ? "Paciente" : (r.role === "nutriologo" ? "Nutriólogo" : "Staff Administrativo")}',
  '{r.role === "cliente" ? "Paciente" : (r.role === "nutriologo" ? "Nutriólogo" : (r.role === "nutriologo_estudiante" ? "Estudiante" : "Staff Administrativo"))}'
);
fs.writeFileSync('src/components/UserProfile.jsx', up);

// 2. Fix BrandContext.jsx
let bc = fs.readFileSync('src/components/BrandContext.jsx', 'utf8');
bc = bc.replace(
  '} else if (session.role === "nutriologo") {',
  '} else if (session.role === "nutriologo" || session.role === "nutriologo_estudiante") {'
);
fs.writeFileSync('src/components/BrandContext.jsx', bc);

// 3. Fix PerfilNutriologo.jsx
let pn = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');
pn = pn.replace(
  'const rolesToShow = (role === "nutriologo" || role === "superadmin")',
  'const rolesToShow = (role === "nutriologo" || role === "nutriologo_estudiante" || role === "superadmin")'
);
pn = pn.replace(
  '{r.role === "cliente" ? "Paciente" : (r.role === "nutriologo" ? "Nutriólogo" : "Staff Administrativo")}',
  '{r.role === "cliente" ? "Paciente" : (r.role === "nutriologo" ? "Nutriólogo" : (r.role === "nutriologo_estudiante" ? "Estudiante" : "Staff Administrativo"))}'
);
fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', pn);

// 4. Also check Admin.jsx for checkPago
let ad = fs.readFileSync('src/pages/Admin.jsx', 'utf8');
ad = ad.replace(
  'if (role !== "nutriologo") return;',
  'if (role !== "nutriologo" && role !== "nutriologo_estudiante") return;'
);
fs.writeFileSync('src/pages/Admin.jsx', ad);

