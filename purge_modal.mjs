import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

// 1. Remove ANY block starting from `{/* Modal preview */}` until `Cerrar\n            </button>\n          </div>\n        </div>\n      )}`
// We will use a regex to match it no matter the whitespace.

const modalRegex = /\s*\{\/\* Modal preview \*\/\}\s*\{previewEx && \([\s\S]*?Cerrar\s*<\/button>\s*<\/div>\s*<\/div>\s*\)\}/g;

content = content.replace(modalRegex, '');

// 2. Now the file has NO modals.
// Let's inject exactly ONE modal at the very end.

const modalStr = `
      {/* Modal preview */}
      {previewEx && (
        <div 
          onClick={() => setPreviewEx(null)} 
          className="fixed inset-0 bg-[#0B1929]/40 backdrop-blur-sm z-[200] flex items-center justify-center p-5"
        >
          <div 
            className="animate-in bg-white rounded-2xl p-6 max-w-[440px] w-full text-center border border-[#E2E8F0] shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setPreviewEx(null)} className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20}/></button>
            {previewEx.gif_url ? (
              <img src={previewEx.gif_url} alt={previewEx.nombre} className="w-full rounded-xl mb-4 shadow-sm bg-[#0B1929] object-contain max-h-[300px]" />
            ) : (
              <div className="w-full h-[200px] bg-[#F0F4FA] rounded-xl mb-4 flex items-center justify-center">
                <Dumbbell size={48} className="text-[#CBD5E1]" />
              </div>
            )}
            <div className="font-bold text-[18px] text-[#0B1929] mb-2 font-['Space_Grotesk',sans-serif]">
              {previewEx.nombre}
            </div>
            <div className="flex gap-1.5 justify-center mb-4">
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600">
                {previewEx.grupo_muscular}
              </span>
            </div>
            <button
              onClick={() => setPreviewEx(null)}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-[#0B1929] rounded-xl text-[13px] font-semibold transition-colors border border-gray-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}`;

content = content.replace(/(\s*)<\/div>\r?\n\s*\);\r?\n\}/, `$1${modalStr}$1</div>\n  );\n}`);

fs.writeFileSync('src/components/cliente/Training.jsx', content);
console.log("Modal purged and re-injected properly.");
