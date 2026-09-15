import fs from 'fs';
let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// Find the lucide-react import
const lucideImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']/);

if (lucideImportMatch) {
  const currentImports = lucideImportMatch[1];
  if (!currentImports.includes('UserCheck')) {
    const newImports = currentImports + ', UserCheck';
    content = content.replace(lucideImportMatch[0], `import {${newImports}} from "lucide-react"`);
    fs.writeFileSync('src/pages/Admin.jsx', content);
    console.log('Fixed UserCheck import');
  } else {
    console.log('UserCheck already imported');
  }
} else {
  console.log('Could not find lucide-react import');
}
