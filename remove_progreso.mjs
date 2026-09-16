import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// 1. Remove from civilTabs array
content = content.replace(
  `const civilTabs = ["mi_plan","progreso","membresia","perfil"];`,
  `const civilTabs = ["mi_plan","membresia","perfil"];`
);

// 2. Remove from SIDEBAR_ITEMS
content = content.replace(
  `{ id: "progreso",  label: "Progreso",   icon: <BarChart2 size={18} strokeWidth={1.5} /> },`,
  ``
);

// 3. Remove tab block
content = content.replace(
  `      {isCivil && tab === "progreso" && (
        <SubComponentWrapper title="Progreso">
          <ProgresoCliente selected={clienteData} setMsg={setMsg} />
        </SubComponentWrapper>
      )}`,
  ``
);

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log("Progreso tab removed for Civil users.");
