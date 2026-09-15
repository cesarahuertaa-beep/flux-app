import fs from 'fs';
let content = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

const oldCode = /<label className="block text-xs font-bold text-\[\#6B7A8D\] mb-2">N.mero de C.dula<\/label>[\s\S]*?mb-4" \/>/g;
const newCode = `{role === 'nutriologo' && (
                  <>
                    <label className="block text-xs font-bold text-[#6B7A8D] mb-2">Número de Cédula</label>
                    <input type="text" name="cedula" value={form.cedula} onChange={handleChange} placeholder="Ej. 1234567" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[var(--brand-primary)] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors mb-4" />
                  </>
                )}`;
content = content.replace(oldCode, newCode);

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', content);
