import fs from 'fs';

let file = 'src/pages/Landing.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
if (!content.includes('MessageCircle')) {
  content = content.replace('import { Search, MapPin,', 'import { Search, MapPin, MessageCircle, Mail,');
}
if (!content.includes('Mail,') && content.includes('import { Search')) {
  // Just in case MessageCircle was there but Mail wasn't
  content = content.replace('import { Search,', 'import { Search, Mail,');
}

// 2. Fetch logic update
const fetchRegex = /const nutris = await dbGet\('profiles\?activo=eq\.true&role=in\.\(nutriologo,superadmin,admin\)&select=id,nombre,nombre_marca,especialidad,ubicacion_texto,mapa_url,verificado,logo_url'\);/;
const fetchReplacement = `const nutris = await dbGet('profiles?activo=eq.true&role=in.(nutriologo,superadmin,admin)&select=id,nombre,nombre_marca,especialidad,ubicacion_texto,mapa_url,verificado,logo_url,telefono,email');
        const allRatings = await dbGet('citas_ratings?select=nutriologo_id,puntuacion') || [];
        
        const ratingsMap = {};
        allRatings.forEach(r => {
          if (!ratingsMap[r.nutriologo_id]) ratingsMap[r.nutriologo_id] = { sum: 0, count: 0 };
          ratingsMap[r.nutriologo_id].sum += r.puntuacion;
          ratingsMap[r.nutriologo_id].count += 1;
        });`;

content = content.replace(fetchRegex, fetchReplacement);

// 3. Mapping logic update
const mapRegex = /rating: n\.rating \|\| 5\.0,\s*patients: 0,\s*available: true,\s*img: n\.logo_url \|\| 'photo-1559839734-2b71ea197ec2',\s*verified: n\.verificado \|\| false,\s*mapa_url: n\.mapa_url \|\| ''/;

const mapReplacement = `rating: ratingsMap[n.id] ? (ratingsMap[n.id].sum / ratingsMap[n.id].count) : 0,
            reviewCount: ratingsMap[n.id] ? ratingsMap[n.id].count : 0,
            patients: 0,
            available: true,
            img: n.logo_url || 'photo-1559839734-2b71ea197ec2',
            verified: n.verificado || false,
            mapa_url: n.mapa_url || '',
            telefono: n.telefono || '',
            email: n.email || ''`;

content = content.replace(mapRegex, mapReplacement);

// 4. UI logic update
const uiOldRegex = /<div className="flex items-center gap-1">\s*<Star size=\{12\} className="fill-\[\#1A6FD4\] text-\[\#1A6FD4\]" \/> \{n\.rating \|\| 5\.0\}\s*<\/div>\s*<\/div>\s*\{n\.mapa_url \? \(\s*<a href=\{n\.mapa_url\} target="_blank" rel="noopener noreferrer" className="w-full mt-4 bg-white border border-\[\#E2E5EA\] text-\[\#0B1929\] hover:border-\[\#1A6FD4\] hover:text-\[\#1A6FD4\] h-10 rounded-xl text-sm font-semibold transition-all flex items-center justify-center">\s*Ver ubicacin en Google Maps\s*<\/a>\s*\) : \(\s*<button className="w-full mt-4 bg-white border border-\[\#E2E5EA\] text-\[\#0B1929\] hover:border-\[\#1A6FD4\] hover:text-\[\#1A6FD4\] h-10 rounded-xl text-sm font-semibold transition-all">\s*Contacto \(Prximamente\)\s*<\/button>\s*\)\}/;

const uiNew = `{n.reviewCount > 0 ? (
                  <div className="flex items-center gap-1">
                    <Star size={12} className="fill-[#1A6FD4] text-[#1A6FD4]" /> {n.rating.toFixed(1)} ({n.reviewCount} reseñas)
                  </div>
                ) : (
                  <div className="flex items-center gap-1 italic text-xs text-[#9BA5B0]">
                    Sin calificaciones
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 mt-4">
                {n.mapa_url && (
                  <a href={n.mapa_url} target="_blank" rel="noopener noreferrer" className="w-full bg-white border border-[#E2E5EA] text-[#0B1929] hover:border-[#1A6FD4] hover:text-[#1A6FD4] h-10 rounded-xl text-sm font-semibold transition-all flex items-center justify-center">
                    Ver en mapa
                  </a>
                )}
                {n.telefono && (
                  <a href={\`https://wa.me/\${n.telefono.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="w-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 h-10 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
                {!n.telefono && n.email && (
                  <a href={\`mailto:\${n.email}\`} className="w-full bg-white border border-[#E2E5EA] text-[#0B1929] hover:border-[#1A6FD4] hover:text-[#1A6FD4] h-10 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                    <Mail size={16} /> Enviar correo
                  </a>
                )}
              </div>`;

content = content.replace(uiOldRegex, uiNew);

// If UI regex fails due to special characters like ''
if (!content.includes('Sin calificaciones')) {
  // Let's use string manipulation instead of regex for the UI part
  const idxStart = content.indexOf('<div className="flex items-center gap-1">');
  const strToFindEnd = 'Contacto (Prximamente)';
  const idxEnd = content.indexOf('</button>', content.indexOf(strToFindEnd)) + '</button>'.length;
  
  if (idxStart !== -1 && idxEnd !== -1) {
    // wait, we need to match from `<div className="flex items-center gap-1">`
    // but there might be other instances.
    const startStr = `<div className="flex items-center gap-1">
                  <Star size={12} className="fill-[#1A6FD4] text-[#1A6FD4]" /> {n.rating || 5.0}
                </div>
              </div>`;
    const searchPart1 = content.indexOf(startStr);
    if (searchPart1 !== -1) {
      const searchPart2 = content.indexOf(')}', searchPart1 + startStr.length);
      const toReplace = content.substring(searchPart1, searchPart2 + 2);
      content = content.replace(toReplace, uiNew);
    }
  }
}

fs.writeFileSync(file, content);
