import fs from 'fs';
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// 1. Add State
content = content.replace(
  'const [docUrl, setDocUrl] = useState("");',
  'const [nombreMarca, setNombreMarca] = useState("");\n  const [mapaUrl, setMapaUrl] = useState("");\n  const [cedula, setCedula] = useState("");'
);

// 2. Update submitProRequest
const oldSubmit = /const submitProRequest = async \(\) => \{[\s\S]*?setLoading\(false\);\n  \};/;
const newSubmit = `const submitProRequest = async () => {
    if (!nombre || !email || !cedula) {
      setErr("Nombre, Email y Cédula son obligatorios");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      await dbPost("solicitudes_profesionales", {
        nombre: nombre.trim(),
        email: email.trim(),
        tipo: signupType,
        cedula: cedula.trim(),
        nombre_marca: nombreMarca.trim(),
        mapa_url: mapaUrl.trim(),
        estado: 'pendiente'
      });
      setInfo("Solicitud enviada con éxito. Nuestro equipo la revisará pronto.");
      setMode("login");
    } catch (e) {
      setErr("Error al enviar solicitud: " + e.message);
    }
    setLoading(false);
  };`;
content = content.replace(oldSubmit, newSubmit);

// 3. Update JSX for signup_pro
const oldJsx = /<div className="mb-6">\s*<div className="text-\[11px\] text-\[\#6B7A8D\] mb-2 font-semibold uppercase tracking-\[1px\]">URL de Cédula o Credencial<\/div>[\s\S]*?<\/p>\s*<\/div>/;

const newJsx = `<div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre de Consultorio/Marca</div>
            <div className="relative">
              <input value={nombreMarca} onChange={e => setNombreMarca(e.target.value)} placeholder="Ej. NutriFit" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Ubicación (Google Maps) (Opcional)</div>
            <div className="relative">
              <input value={mapaUrl} onChange={e => setMapaUrl(e.target.value)} placeholder="Enlace de Maps" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Número de Cédula Profesional</div>
            <div className="relative">
              <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Tu número de cédula" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>`;
content = content.replace(oldJsx, newJsx);

fs.writeFileSync('src/pages/Login.jsx', content);
