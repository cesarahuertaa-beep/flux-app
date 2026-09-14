import fs from 'fs';
let file = 'src/pages/Login.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('Eye, EyeOff')) {
  content = content.replace('import { Mail, Lock', 'import { Mail, Lock, Eye, EyeOff');
}
fs.writeFileSync(file, content);
