import fs from 'fs';

let m = fs.readFileSync('src/components/admin/MiMembresia.jsx', 'utf8');
if (!m.includes('useBrand')) {
  m = m.replace('import { CreditCard', 'import { useBrand } from "../BrandContext";\nimport { CreditCard');
}
if (!m.includes('const brand = useBrand();')) {
  m = m.replace('const [uploading, setUploading] = useState(false);', 'const [uploading, setUploading] = useState(false);\n  const brand = useBrand();');
}
m = m.replace(/text-\[\#1A6FD4\]/g, 'text-[var(--brand-primary)]');
m = m.replace(/bg-gradient-to-r from-\[\#1A6FD4\] to-blue-400/g, 'bg-[var(--brand-primary)]');
m = m.replace(/bg-\[\#1A6FD4\]/g, 'bg-[var(--brand-primary)]');
m = m.replace(/text-blue-600/g, 'text-[var(--brand-primary)]');
m = m.replace(/hover:bg-blue-700/g, 'hover:opacity-90');

fs.writeFileSync('src/components/admin/MiMembresia.jsx', m);

let a = fs.readFileSync('src/components/admin/AgendaAdmin.jsx', 'utf8');
if (!a.includes('useBrand')) {
  a = a.replace('import {\n  Clock', 'import { useBrand } from "../BrandContext";\nimport {\n  Clock');
}
if (!a.includes('const brand = useBrand();')) {
  a = a.replace('const [saving, setSaving]                 = useState(false);', 'const [saving, setSaving]                 = useState(false);\n  const brand = useBrand();');
}
a = a.replace(/completada:\s*{[^}]+}/, 'completada: { bg: "bg-slate-50",    border: "border-slate-200",    text: "text-[var(--brand-primary)]", bar: "bg-[var(--brand-primary)]", label: "Completada", Icon: CheckCircle2 }');
a = a.replace(/text-blue-600/g, 'text-[var(--brand-primary)]');
a = a.replace(/border-t-blue-600/g, 'border-t-[var(--brand-primary)]');
a = a.replace(/bg-blue-50/g, 'bg-slate-50');
a = a.replace(/border-blue-200/g, 'border-slate-200');
a = a.replace(/text-blue-700/g, 'text-[var(--brand-primary)]');
a = a.replace(/hover:bg-blue-100/g, 'hover:bg-slate-100');
a = a.replace(/focus:ring-blue-500/g, 'focus:ring-[var(--brand-primary)]');
a = a.replace(/hover:text-blue-600/g, 'hover:text-[var(--brand-primary)]');

fs.writeFileSync('src/components/admin/AgendaAdmin.jsx', a);

let g = fs.readFileSync('src/components/admin/GestionEquipo.jsx', 'utf8');
g = g.replace(/hover:border-\[\#3B82F6\]/g, 'hover:border-[var(--brand-primary)]');
g = g.replace(/hover:bg-blue-50/g, 'hover:bg-[var(--brand-primary)]\\/5');

fs.writeFileSync('src/components/admin/GestionEquipo.jsx', g);
