import fs from 'fs';
let file = 'src/pages/Landing.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('MessageCircle,')) {
  content = content.replace('Menu,', 'Menu, MessageCircle,');
}

fs.writeFileSync(file, content);
