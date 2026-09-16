import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// 1. Remove ProgramarCliente import if present
content = content.replace(/import \{ ProgramarCliente \} from "\.\.\/components\/admin\/ProgramarCliente";\n?/g, '');

// 2. Remove ProgresoCliente import if present
content = content.replace(/import \{ ProgresoCliente \} from "\.\.\/components\/admin\/ProgresoCliente";\n?/g, '');

// 3. Remove MembresiaB2C import if present
content = content.replace(/import \{ MembresiaB2C \} from "\.\.\/components\/cliente\/MembresiaB2C";\n?/g, '');

// 4. Remove isCivil variable declaration
content = content.replace(/\s+const isCivil = cliente\?\.nutriologo_id === null;\n?/g, '\n');

// 5. Remove atletaModeCivil state
content = content.replace(/\s+const \[atletaModeCivil, setAtletaModeCivil\] = useState\(false\);\n?/g, '\n');

// 6. Remove biblioteca state
content = content.replace(/\s+const \[biblioteca, setBiblioteca\] = useState\(\[\]\);\n?/g, '\n');

// 7. Remove civil biblioteca loading block
content = content.replace(/\s+if \(isCivil\) \{\s+try \{\s+const bib = await dbGet\("biblioteca_ejercicios\?order=nombre\.asc"\);\s+setBiblioteca\(bib\);\s+\} catch\(e\) \{\}\s+\}\n?/g, '\n');

// 8. Fix SIDEBAR_ITEMS - remove civil branch, restore original
content = content.replace(
  /const SIDEBAR_ITEMS = isCivil \? \[[\s\S]*?\]\s*:\s*\[/,
  'const SIDEBAR_ITEMS = ['
);

// 9. Remove civil AtletaMode banner
content = content.replace(
  /\s+\{isAtletaMode \|\| atletaModeCivil\}/g,
  '\n      {isAtletaMode'
);
content = content.replace(
  /\{isAtletaMode \|\| atletaModeCivil\}/g,
  '{isAtletaMode'
);

// 10. Remove atletaModeCivil references in onClick
content = content.replace(
  /onClick=\{isAtletaMode \? onBackToAdmin : \(\) => setAtletaModeCivil\(false\)\}/g,
  'onClick={onBackToAdmin}'
);

// 11. Remove civil tab renders (programar, membresia blocks)
content = content.replace(
  /\s+\{tab === "programar" && isCivil && \([\s\S]*?\)\}\s+\n?/g,
  '\n'
);
content = content.replace(
  /\s+\{tab === "membresia" && isCivil && \([\s\S]*?\)\}\s+\n?/g,
  '\n'
);

// 12. Restore simple Progreso tab (remove civil condition)
content = content.replace(
  /\{tab === "progreso" && \(\s+isCivil\s+\? <ProgresoCliente selected=\{cliente\} setMsg=\{.*?\} \/>\s+: <Progreso cliente=\{cliente\} \/>\s+\)\}/,
  '{tab === "progreso" && (\n            <Progreso cliente={cliente} />\n          )}'
);

// 13. Remove ...(isMiPlan ? [] : [...]) pattern in ProgramarCliente subtab
// (This was injected in ProgramarCliente.jsx, not Cliente.jsx)

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log("Cliente.jsx cleaned up successfully.");
