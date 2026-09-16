import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

// I will find the EXACT string that starts with `<div className="flex gap-2 ml-auto">` and ends with `</div>\n  );\n}\n\nexport default function Training`
// Wait, I will just manually fix the file by string slicing.

const splitToken = 'export default function Training';
let parts = content.split(splitToken);

if (parts.length > 1) {
  let topPart = parts[0];
  let bottomPart = parts[1];
  
  // topPart contains imports and TimerCard.
  // I will just replace ALL of topPart with the pristine imports and TimerCard.
  const cleanTopPart = `import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus, Dumbbell, Check, CheckCheck, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ⏱️ Cronómetro inline (exactamente como Figma: tarjeta oscura dentro del scroll) ⏱️
function TimerCard({ brandColor }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  const fmt = s =>
    \`\${String(Math.floor(s / 60)).padStart(2, "0")}:\${String(s % 60).padStart(2, "0")}\`;

  return (
    <div className="bg-[#0B1929] rounded-xl p-4 flex items-center gap-4 mb-3">
      <div>
        <p className="text-[10px] text-[#6B7A8D] font-mono tracking-widest uppercase">Cronómetro</p>
        <p className="text-3xl font-mono font-bold text-white mt-1">{fmt(seconds)}</p>
      </div>
      <div className="flex gap-2 ml-auto">
        <button
          onClick={() => setRunning(r => !r)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors"
          style={{ background: brandColor || "var(--brand-primary)" }}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={() => { setRunning(false); setSeconds(0); }}
          className="w-10 h-10 rounded-full bg-[#1E2D3D] flex items-center justify-center text-[#6B7A8D] hover:text-white transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

`;
  
  let newContent = cleanTopPart + splitToken + bottomPart;
  
  // Now ensure the modal is ONLY at the bottom of bottomPart
  // Let's strip ALL occurrences of the modal from bottomPart first
  const modalRegex = /\s*\{\/\* Modal preview \*\/\}\s*\{previewEx && \([\s\S]*?Cerrar\s*<\/button>\s*<\/div>\s*<\/div>\s*\)\}/g;
  newContent = newContent.replace(modalRegex, '');
  
  // Then append it once
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
      
  newContent = newContent.replace(/(\s*)<\/div>\r?\n\s*\);\r?\n\}/, `$1${modalStr}$1</div>\n  );\n}`);

  fs.writeFileSync('src/components/cliente/Training.jsx', newContent);
  console.log("Ultimate fix applied.");
}

