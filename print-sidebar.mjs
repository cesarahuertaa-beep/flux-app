import fs from 'fs';
const content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');
const idx = content.indexOf('const SIDEBAR_ITEMS');
console.log(content.substring(idx, idx + 2500));
