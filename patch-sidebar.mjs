import fs from 'fs';
let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// For Staff
content = content.replace(
  '{ id: "biblioteca", label: "Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> },',
  '{ id: "aprobaciones", label: "Aprobaciones", icon: <UserCheck size={18} strokeWidth={1.5} /> },\n        { id: "biblioteca", label: "Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> },'
);

// For Superadmin
content = content.replace(
  '...(isSuperadmin ? [\n            { id: "biblioteca", label: "Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> }',
  '...(isSuperadmin ? [\n            { id: "aprobaciones", label: "Aprobaciones", icon: <UserCheck size={18} strokeWidth={1.5} /> },\n            { id: "biblioteca", label: "Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> }'
);

fs.writeFileSync('src/pages/Admin.jsx', content);
