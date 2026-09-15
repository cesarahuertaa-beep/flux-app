import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

const regex = /<div className="flex gap-4">\s*<Model[\s\S]*?type="anterior"\s*\/>\s*<Model[\s\S]*?type="posterior"\s*\/>\s*<\/div>/;

const newBlock = `<div className="flex justify-center gap-2 md:gap-4 w-full max-w-[400px] mx-auto">
                  <div className="w-1/2 flex justify-center">
                    <Model 
                      data={getBodyData(groupAvg)} 
                      style={{ width: '100%', maxWidth: '12rem', padding: '0.5rem' }} 
                      highlightedColors={["#9BA5B0", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
                      type="anterior"
                    />
                  </div>
                  <div className="w-1/2 flex justify-center">
                    <Model 
                      data={getBodyData(groupAvg)} 
                      style={{ width: '100%', maxWidth: '12rem', padding: '0.5rem' }} 
                      highlightedColors={["#9BA5B0", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
                      type="posterior"
                    />
                  </div>
                </div>`;

content = content.replace(regex, newBlock);

// Also replace the wrapper drop-shadow div to make sure it doesn't force a width
content = content.replace(
  '<div className="flex flex-row justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">',
  '<div className="flex flex-row justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] w-full">'
);

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
