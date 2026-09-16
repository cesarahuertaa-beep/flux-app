import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

content = content.replace(/setErr\(e\.message\);/g, 'setErr("ERR_CATCH: " + e.message);');

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx catch errors modified.");
