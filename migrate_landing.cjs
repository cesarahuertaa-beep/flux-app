const fs = require('fs');
let code = fs.readFileSync('LANDINGPAGE/src/LandingPage.tsx', 'utf-8');

// Remove fluxLogo import
code = code.replace(/import fluxLogo from.*?;\n/, '');

// Replace fluxLogo variable with string
code = code.replace(/src={fluxLogo}/g, 'src="/flux_logo.jpeg"');

// Add react-router-dom Link import
code = code.replace(/import { useState } from "react";\n/, 'import { useState } from "react";\nimport { Link } from "react-router-dom";\n');

// For "Abrir app" button in Navbar
code = code.replace(
  /<button\s+className="flex items-center gap-1\.5 px-4 py-2 bg-\[#1A6FD4\] text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-200"\s*>\s*<Globe size={14} strokeWidth={2} \/> Abrir app\s*<\/button>/g,
  '<Link to={session ? "/app" : "/login"} className="flex items-center gap-1.5 px-4 py-2 bg-[#1A6FD4] text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-200"><Globe size={14} strokeWidth={2} /> Abrir app</Link>'
);

// For "Iniciar sesión"
code = code.replace(
  /<button className="flex items-center gap-1\.5 px-3 py-2 text-sm text-\[#6B7A8D\] hover:text-\[#1A6FD4\] font-medium transition-colors">\s*<LogIn size={15} strokeWidth={1\.5} \/> Iniciar sesión\s*<\/button>/,
  '{!session ? (<Link to="/login" className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#1A6FD4] font-medium transition-colors"><LogIn size={15} strokeWidth={1.5} /> Iniciar sesión</Link>) : (<Link to="/app" className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6B7A8D] hover:text-[#1A6FD4] font-medium transition-colors"><Globe size={15} strokeWidth={1.5} /> Mi Panel</Link>)}'
);

// We need to pass session to Navbar.
code = code.replace(/function Navbar\(\) {/g, 'function Navbar({ session }) {');
code = code.replace(/<Navbar \/>/g, '<Navbar session={session} />');

// Change export default function LandingPage() to accept { session }
code = code.replace(/export default function LandingPage\(\) {/g, 'export default function Landing({ session }) {');

// Convert TS type annotations if any (e.g. { n }: { n: number })
code = code.replace(/function Stars\({ n }: { n: number }\) {/g, 'function Stars({ n }) {');

fs.writeFileSync('src/pages/Landing.jsx', code, 'utf-8');
console.log('Landing.jsx generated successfully.');
