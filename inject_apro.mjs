import fs from 'fs';
let content = fs.readFileSync('src/components/admin/Aprobaciones.jsx', 'utf8');

// Update handleApprove
const oldApprove = /const handleApprove = async \(sol\) => \{[\s\S]*?catch \(e\) \{/g;
const newApprove = `const handleApprove = async (sol) => {
    if (!window.confirm(\`¿Estás seguro de aprobar a \${sol.nombre} como \${sol.tipo}?\`)) return;
    try {
      await authInvite(sol.email, { role: sol.tipo, nombre: sol.nombre });
      await dbPatch(\`solicitudes_profesionales?id=eq.\${sol.id}\`, { estado: 'aprobada' });
      
      // Intentar migrar los datos al perfil recién creado (esperamos 1 seg por el trigger)
      setTimeout(async () => {
        try {
          const profs = await dbGet(\`profiles?email=eq.\${sol.email}\`);
          if (profs.length > 0) {
            await dbPatch(\`profiles?id=eq.\${profs[0].id}\`, {
               cedula: sol.cedula || "",
               nombre_marca: sol.nombre_marca || "",
               mapa_url: sol.mapa_url || ""
            });
          }
        } catch(e) {}
      }, 1500);

      setMsg("✅ Solicitud aprobada y correo enviado.");
      loadData();
    } catch (e) {`;

content = content.replace(oldApprove, newApprove);

// Replace "Ver Comprobante" with Cedula & Marca rendering
const oldRender = /<div className="bg-\[\#F0F4FA\] p-3 rounded-xl flex items-center gap-3">[\s\S]*?<\/div>/;
const newRender = `<div className="bg-[#F0F4FA] p-3 rounded-xl flex flex-col gap-2">
                <div className="text-sm">
                  <span className="font-bold text-[#6B7A8D]">Cédula:</span> {s.cedula || 'No especificada'}
                </div>
                <div className="text-sm">
                  <span className="font-bold text-[#6B7A8D]">Marca/Consultorio:</span> {s.nombre_marca || 'No especificada'}
                </div>
                {s.mapa_url && (
                  <a href={s.mapa_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1A6FD4] font-medium hover:underline truncate">
                    📍 Ver Ubicación en Maps
                  </a>
                )}
                {s.documentacion_url && (
                  <a href={s.documentacion_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1A6FD4] font-medium hover:underline truncate">
                    📄 Ver Documento Adjunto
                  </a>
                )}
              </div>`;
content = content.replace(oldRender, newRender);

fs.writeFileSync('src/components/admin/Aprobaciones.jsx', content);
