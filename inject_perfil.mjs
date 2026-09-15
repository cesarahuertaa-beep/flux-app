import fs from 'fs';
let content = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

// Add cedula to state initialization
content = content.replace(
  'nombre_marca: p.nombre_marca || "",',
  'nombre_marca: p.nombre_marca || "",\n          cedula: p.cedula || "",'
);

content = content.replace(
  'ubicacion_texto: "",',
  'ubicacion_texto: "",\n    cedula: "",'
);

content = content.replace(
  'nombre_marca: form.nombre_marca,',
  'nombre_marca: form.nombre_marca,\n        cedula: form.cedula,'
);

// Add cedula input in the JSX, right before nombre_marca
const oldInput = /<label className="block text-xs font-bold text-\[\#6B7A8D\] mb-2">Nombre de Marca \(App\)<\/label>/;
const newInput = `<label className="block text-xs font-bold text-[#6B7A8D] mb-2">Número de Cédula</label>
                <input type="text" name="cedula" value={form.cedula} onChange={handleChange} placeholder="Ej. 1234567" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[var(--brand-primary)] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors mb-4" />
                
                <label className="block text-xs font-bold text-[#6B7A8D] mb-2">Nombre de Marca (App)</label>`;

content = content.replace(oldInput, newInput);

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', content);
