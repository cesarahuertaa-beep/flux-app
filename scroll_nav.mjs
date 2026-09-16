import fs from 'fs';
let content = fs.readFileSync('src/components/ui/AppLayout.jsx', 'utf8');

// 1. Update the nav container
const navContainerRegex = /<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-\[\#E2E8F0\] flex items-stretch"/g;
content = content.replace(navContainerRegex, '<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E2E8F0] flex items-stretch overflow-x-auto scroll-hide shadow-[0_-2px_10px_rgba(0,0,0,0.02)]"');

// 2. Update the Perfil button classes
const perfilBtnRegex = /className=\{`flex-1 flex flex-col items-center justify-center gap-0\.5 py-2\.5 transition-all \$\{isPerfilActive \? "text-\[var\(--brand-primary\)\]" : "text-\[\#9BA5B0\]"\}`\}/g;
content = content.replace(perfilBtnRegex, 'className={`flex-1 min-w-[72px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${isPerfilActive ? "text-[var(--brand-primary)]" : "text-[#9BA5B0]"}`}');

// 3. Update the Nav Item button classes
const navBtnRegex = /className=\{`flex-1 flex flex-col items-center justify-center gap-0\.5 py-2\.5 transition-all \$\{\r?\n\s*isActive \? "text-\[var\(--brand-primary\)\]" : "text-\[\#9BA5B0\]"\r?\n\s*\}`\}/g;
content = content.replace(navBtnRegex, 'className={`flex-1 min-w-[72px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${isActive ? "text-[var(--brand-primary)]" : "text-[#9BA5B0]"}`}');

fs.writeFileSync('src/components/ui/AppLayout.jsx', content);
