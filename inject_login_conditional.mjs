import fs from 'fs';
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// Update submitProRequest check
const oldSubmit = /if \(!nombre \|\| !email \|\| !cedula\) \{[\s\S]*?return;\n    \}/;
const newSubmit = `if (!nombre || !email || (signupType === 'nutriologo' && !cedula)) {
      setErr("Por favor llena los campos obligatorios");
      return;
    }`;
content = content.replace(oldSubmit, newSubmit);

// Update signup_pro Cédula rendering
const oldCedulaRender = /<div className="mb-6">\s*<div className="text-\[11px\] text-\[\#6B7A8D\] mb-2 font-semibold uppercase tracking-\[1px\]">Número de Cédula Profesional<\/div>[\s\S]*?<\/div>/;
const newCedulaRender = `{signupType === 'nutriologo' && (
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Número de Cédula Profesional</div>
            <div className="relative">
              <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Tu número de cédula" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          )}`;
content = content.replace(oldCedulaRender, newCedulaRender);

fs.writeFileSync('src/pages/Login.jsx', content);
