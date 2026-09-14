import fs from 'fs';
let file = 'src/components/admin/PerfilNutriologo.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '// Si es superadmin, cargar config de pago\n      if (role === "superadmin") {',
  '// Si es superadmin o staff, cargar config de pago\n      if (role === "superadmin" || role === "administrativo" || role === "staff") {'
);

fs.writeFileSync(file, content);
