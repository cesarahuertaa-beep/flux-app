import fs from 'fs';

// 1. Fix Login.jsx
let log = fs.readFileSync('src/pages/Login.jsx', 'utf8');
log = log.replace(
  '["superadmin", "nutriologo", "administrativo", "staff"]',
  '["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"]'
);
log = log.replace(
  '["nutriologo", "administrativo", "staff"]',
  '["nutriologo", "nutriologo_estudiante", "administrativo", "staff"]'
);
fs.writeFileSync('src/pages/Login.jsx', log);

// 2. Fix DirectorioSuperadmin.jsx
let dir = fs.readFileSync('src/components/admin/DirectorioSuperadmin.jsx', 'utf8');
dir = dir.replace(
  '["nutriologo", "administrativo", "staff", "superadmin"]',
  '["nutriologo", "nutriologo_estudiante", "administrativo", "staff", "superadmin"]'
);
fs.writeFileSync('src/components/admin/DirectorioSuperadmin.jsx', dir);

// 3. Fix Admin.jsx
let adm = fs.readFileSync('src/pages/Admin.jsx', 'utf8');
adm = adm.replace(
  '["nutriologo", "administrativo", "staff", "superadmin"]',
  '["nutriologo", "nutriologo_estudiante", "administrativo", "staff", "superadmin"]'
);
fs.writeFileSync('src/pages/Admin.jsx', adm);

