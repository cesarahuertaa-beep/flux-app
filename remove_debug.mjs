import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

const regex = /if \(!data\.session\) \{\s*setErr\("DEPURACIÓN: La sesión es NULA\. Confirmación de email está encendida en Supabase\."\);\s*setLoading\(false\);\s*return;\s*\}/;

content = content.replace(regex, '');

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Debug block removed from Login.jsx.");
