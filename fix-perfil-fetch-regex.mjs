import fs from 'fs';
let file = 'src/components/admin/PerfilNutriologo.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Si es superadmin, cargar config de pago\s*if \(role === "superadmin"\) \{/g;
content = content.replace(regex, '// Si es superadmin o staff, cargar config de pago\n      if (role === "superadmin" || role === "administrativo" || role === "staff") {');

fs.writeFileSync(file, content);
