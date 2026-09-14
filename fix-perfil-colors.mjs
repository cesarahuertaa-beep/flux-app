import fs from 'fs';

let p = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

if (!p.includes('useBrand')) {
  p = p.replace('import { useState', 'import { useBrand } from "../BrandContext";\nimport { useState');
}

if (!p.includes('const brand = useBrand();')) {
  p = p.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n  const brand = useBrand();');
}

// Replace `#1A6FD4` in classNames to use `var(--brand-primary)`
p = p.replace(/text-\[\#1A6FD4\]/g, 'text-[var(--brand-primary)]');
p = p.replace(/border-t-\[\#1A6FD4\]/g, 'border-t-[var(--brand-primary)]');
p = p.replace(/border-\[\#1A6FD4\]/g, 'border-[var(--brand-primary)]');
p = p.replace(/focus:border-\[\#1A6FD4\]/g, 'focus:border-[var(--brand-primary)]');
p = p.replace(/focus:ring-\[\#1A6FD4\]/g, 'focus:ring-[var(--brand-primary)]');
p = p.replace(/bg-\[\#1A6FD4\]/g, 'bg-[var(--brand-primary)]');

// Also fix the hardcoded `bg-blue-50`, `border-blue-200`, `text-blue-600` for the patient request box
p = p.replace(/bg-blue-50/g, 'bg-slate-50');
p = p.replace(/border-blue-200/g, 'border-slate-200');
p = p.replace(/border-blue-100/g, 'border-slate-100');
p = p.replace(/text-blue-600/g, 'text-[var(--brand-primary)]');
p = p.replace(/hover:bg-\[\#155ab0\]/g, 'hover:opacity-90');
p = p.replace(/hover:bg-blue-700/g, 'hover:opacity-90');

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', p);
