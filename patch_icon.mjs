import fs from 'fs';

// Replace in Admin.jsx
let admin = fs.readFileSync('src/pages/Admin.jsx', 'utf8');
admin = admin.replace(
  '{ id: "mi_plan",   label: "Mi Plan",    icon: <Dumbbell size={18} strokeWidth={1.5} /> },',
  '{ id: "mi_plan",   label: "Mi Plan",    icon: <Activity size={18} strokeWidth={1.5} /> },'
);
fs.writeFileSync('src/pages/Admin.jsx', admin);

// Replace in Cliente.jsx
let cliente = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');
cliente = cliente.replace(
  '{ id: "programar", label: "Mi Plan", icon: <Dumbbell size={18} strokeWidth={1.5} /> },',
  '{ id: "programar", label: "Mi Plan", icon: <Activity size={18} strokeWidth={1.5} /> },'
);
fs.writeFileSync('src/pages/Cliente.jsx', cliente);

console.log("Icons patched");
