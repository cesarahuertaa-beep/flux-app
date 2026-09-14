import fs from 'fs';
let content = fs.readFileSync('src/App.jsx', 'utf8');
content = content.replace('role:"client"', 'role:"cliente"');
fs.writeFileSync('src/App.jsx', content);
