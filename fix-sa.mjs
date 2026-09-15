import fs from 'fs';
let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// The block for superadmin is:
/*
          ...(isSuperadmin ? [
            { id: "biblioteca", label: "Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> }
          ] : []),
*/
content = content.replace(
  /(\.\.\.\(isSuperadmin \? \[\s*)(?=\{ id: "biblioteca")/,
  '$1{ id: "aprobaciones", label: "Aprobaciones", icon: <UserCheck size={18} strokeWidth={1.5} /> },\n            '
);

fs.writeFileSync('src/pages/Admin.jsx', content);
