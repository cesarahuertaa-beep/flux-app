import fs from 'fs';
let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

const regex = /<div className="text-xs text-\[#6B7A8D\] mt-0\.5 shrink-0 flex items-center flex-wrap gap-2">\s*<span>\{d\.comidas\.length\} comidas<\/span>[\s\S]*?\}\)\(\)\}\s*<\/div>/;

const replacement = `<div className="text-xs text-[#6B7A8D] mt-0.5 shrink-0 flex items-center flex-wrap gap-2">
                                  <span>{d.comidas.length} comidas</span>
                                </div>`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
