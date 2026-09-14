import fs from 'fs';

let file = 'src/pages/Landing.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Hide APK download buttons
// Navbar APK buttons
content = content.replace(
  /<a\s*href=\{\`https:\/\/github\.com\/cesarahuertaa-beep\/flux-app\/releases\/download\/v\$\{version\}\/FLUX\.Setup\.\$\{version\}\.exe\`\}\s*download\s*className="flex items-center gap-1\.5 px-3 py-2 text-sm text-\[\#6B7A8D\] hover:text-\[\#0B1929\] font-medium transition-colors"\s*>/g,
  '<a href={`https://github.com/cesarahuertaa-beep/flux-app/releases/download/v${version}/FLUX.Setup.${version}.exe`} download className="hidden items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-medium transition-colors">'
);

content = content.replace(
  /<a\s*href="\/FLUX\.apk"\s*download\s*className="flex items-center gap-1\.5 px-3 py-2 text-sm text-\[\#6B7A8D\] hover:text-\[\#0B1929\] font-medium transition-colors"\s*>/g,
  '<a href="/FLUX.apk" download className="hidden items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-medium transition-colors">'
);

// Hero APK buttons
content = content.replace(
  /<a\s*href="\/FLUX\.apk"\s*download\s*className="flex items-center gap-2 px-5 py-2\.5 rounded-xl bg-\[\#1A6FD4\]\/10 border border-\[\#1A6FD4\]\/20 text-\[\#1A6FD4\] text-sm font-semibold hover:bg-\[\#1A6FD4\]\/20 transition-all"\s*>/g,
  '<a href="/FLUX.apk" download className="hidden items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A6FD4]/10 border border-[#1A6FD4]/20 text-[#1A6FD4] text-sm font-semibold hover:bg-[#1A6FD4]/20 transition-all">'
);

content = content.replace(
  /<a\s*href=\{\`https:\/\/github\.com\/cesarahuertaa-beep\/flux-app\/releases\/download\/v\$\{version\}\/FLUX\.Setup\.\$\{version\}\.exe\`\}\s*download\s*className="flex items-center gap-2 px-5 py-2\.5 rounded-xl bg-gray-100 border border-\[\#E2E5EA\] text-\[\#0B1929\] text-sm font-semibold hover:bg-gray-200 transition-all"\s*>/g,
  '<a href={`https://github.com/cesarahuertaa-beep/flux-app/releases/download/v${version}/FLUX.Setup.${version}.exe`} download className="hidden items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 border border-[#E2E5EA] text-[#0B1929] text-sm font-semibold hover:bg-gray-200 transition-all">'
);

content = content.replace(
  /<p className="text-xs text-\[\#9BA5B0\] w-full font-medium uppercase tracking-widest">Descarga la app:<\/p>/g,
  '<p className="hidden text-xs text-[#9BA5B0] w-full font-medium uppercase tracking-widest">Descarga la app:</p>'
);

// 2. Remove fallbacks to MOCK_SUPPLEMENTS and MOCK_APPAREL
content = content.replace(
  /const activeSupplements = dbSupplements\.length > 0 \? dbSupplements : MOCK_SUPPLEMENTS;/g,
  'const activeSupplements = dbSupplements;'
);

content = content.replace(
  /const activeApparel = dbApparel\.length > 0 \? dbApparel : MOCK_APPAREL;/g,
  'const activeApparel = dbApparel;'
);

// 3. Add Empty States in SupplementsSection
content = content.replace(
  /<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">\s*\{safeSupplements\.map/g,
  `{safeSupplements.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[#F7F9FC] rounded-3xl border border-[#E2E5EA] text-center w-full">
            <h3 className="text-2xl font-bold text-[#0B1929] mb-2">Próximamente</h3>
            <p className="text-[#6B7A8D] max-w-md">Nuestra tienda de suplementos FLUX está en construcción. ¡Mantente atento a las novedades!</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {safeSupplements.map`
);

// Add closing parentheses for the ternary operator inside SupplementsSection
// Let's match the closing div of the grid.
const suppsGridClose = /<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}\)}\s*<\/div>\s*<\/div>\s*<\/section>/;
content = content.replace(suppsGridClose, 
`</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </section>`);

// 4. Add Empty States in ApparelSection
content = content.replace(
  /<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">\s*\{safeApparel\.map/g,
  `{safeApparel.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-[#E2E5EA] text-center w-full">
            <h3 className="text-2xl font-bold text-[#0B1929] mb-2">Próximamente</h3>
            <p className="text-[#6B7A8D] max-w-md">La nueva colección de ropa deportiva FLUX está por llegar. ¡Prepárate para entrenar con estilo!</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {safeApparel.map`
);

const apparelGridClose = /<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}\)}\s*<\/div>\s*<\/div>\s*<\/section>/;
content = content.replace(apparelGridClose,
`</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </section>`);

fs.writeFileSync(file, content);
