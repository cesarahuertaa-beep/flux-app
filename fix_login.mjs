import fs from 'fs';
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// 1. Fix the top tabs condition
content = content.replace(
  '{(mode === "login" || mode === "signup") && (',
  '{(mode === "login" || mode.startsWith("signup")) && ('
);

// 2. Fix the active state for the "Crear Cuenta" button
content = content.replace(
  '${mode === "signup" ? \'bg-white shadow-sm text-[var(--brand-primary)]\'',
  '${mode.startsWith("signup") ? \'bg-white shadow-sm text-[var(--brand-primary)]\''
);

// 3. Fix the onClick to go to signup_type
content = content.replace(
  'onClick={() => { setMode("signup"); setErr(""); setInfo(""); }}',
  'onClick={() => { setMode("signup_type"); setErr(""); setInfo(""); }}'
);

fs.writeFileSync('src/pages/Login.jsx', content);
