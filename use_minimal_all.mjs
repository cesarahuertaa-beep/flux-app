import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

const regex2 = /await dbPost\("clientes", \{/g;
content = content.replace(regex2, 'await dbPostMinimal("clientes", {');

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx ALL clientes now use dbPostMinimal.");
