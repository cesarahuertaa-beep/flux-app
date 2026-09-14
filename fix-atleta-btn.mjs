import fs from 'fs';
let file = 'src/pages/Admin.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = 'myShadowClient && !isSuperadmin ? (';
const newStr = 'myShadowClient ? (';

content = content.replace(oldStr, newStr);

fs.writeFileSync(file, content);
