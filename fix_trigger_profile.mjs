import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// Replace the strict condition with a broader one
content = content.replace(
  /if \(profiles\.length === 0\) \{/g,
  `if (profiles.length === 0 || !["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(profiles[0].role)) {`
);

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx fixed to handle trigger-created profiles.");
