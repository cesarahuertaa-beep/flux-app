import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

// I will find the Miniatura Activa block
const regex = /\{\/\*\s*Miniatura Activa\s*\*\/\}\s*<div\s+className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-\[\#0B1929\] rounded-xl overflow-hidden\s+shadow-sm relative flex items-center justify-center">([\s\S]*?\{activeObj\.gif_url && \([\s\S]*?<\/div>\s*\)\})\s*<\/div>/g;

content = content.replace(regex, `{/* Miniatura Activa */}
                      <button
                        onClick={() => setPreviewEx(activeObj)}
                        className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#0B1929] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer text-left p-0 border-none"
                      >$1
                      </button>`);

fs.writeFileSync('src/components/cliente/Training.jsx', content);
console.log("Button injected!");
