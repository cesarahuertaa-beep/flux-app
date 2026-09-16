import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

// 1. Import X
content = content.replace(
  /import \{ Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus, Dumbbell, Check, CheckCheck \} from "lucide-react";/,
  'import { Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus, Dumbbell, Check, CheckCheck, X } from "lucide-react";'
);

// 2. Add previewEx state
content = content.replace(
  /const \[activeVariant, setActiveVariant\] = useState\(\{\}\);/,
  'const [activeVariant, setActiveVariant] = useState({});\n  const [previewEx, setPreviewEx] = useState(null);'
);

// 3. Precise replace
const oldThumbnailStr = `<div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#0B1929] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center">
                        {activeObj.gif_url ? (
                          <img src={activeObj.gif_url} alt={activeObj.nombre} className="w-full h-full object-contain" />
                        ) : (
                          <Dumbbell size={28} className="text-[#3D5A80]" />
                        )}
                        {activeObj.gif_url && (
                          <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
                            <span className="text-[8px] font-mono text-white tracking-widest uppercase">GIF</span>
                          </div>
                        )}
                      </div>`;

const newThumbnailStr = `<button 
                        onClick={() => setPreviewEx(activeObj)}
                        className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#0B1929] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer text-left p-0 border-none"
                      >
                        {activeObj.gif_url ? (
                          <img src={activeObj.gif_url} alt={activeObj.nombre} className="w-full h-full object-contain" />
                        ) : (
                          <Dumbbell size={28} className="text-[#3D5A80]" />
                        )}
                        {activeObj.gif_url && (
                          <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
                            <span className="text-[8px] font-mono text-white tracking-widest uppercase">GIF</span>
                          </div>
                        )}
                      </button>`;

if (content.includes(oldThumbnailStr)) {
  content = content.replace(oldThumbnailStr, newThumbnailStr);
} else {
  // Try CRLF
  content = content.replace(oldThumbnailStr.replace(/\n/g, '\r\n'), newThumbnailStr);
}

const modalJSX = `
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
      )}
`;

content = content.replace(/(\s*)<\/div>\r?\n\s*\);\r?\n\}/, `$1${modalJSX}$1</div>\n  );\n}`);

fs.writeFileSync('src/components/cliente/Training.jsx', content);
