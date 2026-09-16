import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// Ensure dbPostMinimal is imported
if (!content.includes('dbPostMinimal')) {
  content = content.replace(
    'dbPost } from "../lib/supabase";',
    'dbPost, dbPostMinimal } from "../lib/supabase";'
  );
}

// Replace dbPost with dbPostMinimal in the civil profile creation
const regex = /const newClient = await dbPost\("clientes", \{/g;
content = content.replace(regex, 'const newClient = await dbPostMinimal("clientes", {');

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx now uses dbPostMinimal.");
