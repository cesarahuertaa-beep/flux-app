const fs = require('fs');
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');
content = content.replace(/<a href="https:\/\/flux-sport\.com\/privacidad"/g, '<Link to="/privacidad"');
content = content.replace(/<\/a> para el tratamiento/g, '</Link> para el tratamiento');
if (!content.includes('import { Link }')) {
    content = content.replace(/import { useState/g, 'import { Link } from "react-router-dom";\nimport { useState');
}
fs.writeFileSync('src/pages/Login.jsx', content, 'utf8');
