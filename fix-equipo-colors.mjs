import fs from 'fs';

let g = fs.readFileSync('src/components/admin/GestionEquipo.jsx', 'utf8');

// Ensure useBrand is imported
if (!g.includes('useBrand')) {
  g = g.replace('import { useState', 'import { useBrand } from "../BrandContext";\nimport { useState');
}

// Ensure brand is instantiated inside the component
if (!g.includes('const brand = useBrand();')) {
  g = g.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n  const brand = useBrand();');
}

// Replace `#3B82F6` (Tailwind blue-500)
g = g.replace(/#3B82F6/g, 'var(--brand-primary)');

// Replace gradients that used #3B82F6 and #8B5CF6
g = g.replace(/bg-gradient-to-r from-\[var\(--brand-primary\)\] to-\[\#8B5CF6\]/g, 'bg-[var(--brand-primary)]');
g = g.replace(/to-\[\#8B5CF6\]/g, ''); // Just in case

// Fix background shades like #EFF6FF (blue-50) to slate-50 to match brand neutrality
g = g.replace(/#EFF6FF/g, '#F8FAFC');

fs.writeFileSync('src/components/admin/GestionEquipo.jsx', g);
