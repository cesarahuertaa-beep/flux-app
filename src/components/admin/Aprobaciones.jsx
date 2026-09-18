import { useState, useEffect } from"react";
import { CheckCircle2, XCircle, FileText, UserCheck, AlertCircle, Trash2 } from"lucide-react";
import { dbGet, dbPatch, dbDel, authInvite } from"../../lib/supabase";

export default function Aprobaciones({ setMsg }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await dbGet("solicitudes_profesionales?estado=eq.pendiente&order=created_at.desc");
      setSolicitudes(data || []);
    } catch (e) {
      setMsg("❌ Error al cargar solicitudes.");
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleApprove = async (sol) => {
    if (!window.confirm(`¿Estás seguro de aprobar a ${sol.nombre} como ${sol.tipo}?`)) return;
    try {
      await authInvite(sol.email, { role: sol.tipo, nombre: sol.nombre });
      await dbPatch(`solicitudes_profesionales?id=eq.${sol.id}`, { estado: 'aprobada' });
      
      // Intentar migrar los datos al perfil recién creado (esperamos 1 seg por el trigger)
      setTimeout(async () => {
        try {
          const profs = await dbGet(`profiles?email=eq.${sol.email}`);
          if (profs.length > 0) {
            await dbPatch(`profiles?id=eq.${profs[0].id}`, {
               cedula: sol.cedula ||"",
               nombre_marca: sol.nombre_marca ||"",
               mapa_url: sol.mapa_url ||""
            });
          }
        } catch(e) {}
      }, 1500);

      setMsg("✅ Solicitud aprobada y correo enviado.");
      loadData();
    } catch (e) {
      setMsg("❌ Error al aprobar:" + e.message);
    }
  };

  const handleReject = async (sol) => {
    if (!window.confirm(`¿Estás seguro de rechazar a ${sol.nombre}?`)) return;
    try {
      await dbPatch(`solicitudes_profesionales?id=eq.${sol.id}`, { estado: 'rechazada' });
      setMsg("⚠️ Solicitud rechazada.");
      loadData();
    } catch (e) {
      setMsg("❌ Error al rechazar:" + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`¿Estás seguro de eliminar este registro permanentemente?`)) return;
    try {
      await dbDel("solicitudes_profesionales", id);
      loadData();
    } catch (e) {
      setMsg("❌ Error al eliminar:" + e.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[#6B7A8D]">Cargando solicitudes...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0B1929]">Aprobaciones Pendientes</h2>
        <p className="text-sm text-[#6B7A8D] mt-1">Revisa y autoriza las cuentas de nuevos profesionales.</p>
      </div>

      {solicitudes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-[#E2E8F0] flex flex-col items-center">
          <UserCheck size={48} className="text-[#9BA5B0] mb-4" />
          <h3 className="text-lg font-bold text-[#0B1929]">No hay solicitudes</h3>
          <p className="text-sm text-[#6B7A8D] mt-2">Todas las solicitudes han sido gestionadas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {solicitudes.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0] flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-[#0B1929]">{s.nombre}</h3>
                  <p className="text-sm text-[#6B7A8D]">{s.email}</p>
                </div>
                <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full bg-blue-50 text-blue-600 uppercase">
                  {s.tipo === 'nutriologo' ? 'Nutriólogo' : 'Estudiante de Nutrición'}
                </span>
              </div>
              
              <div className="bg-[#F0F4FA] p-3 rounded-xl flex flex-col gap-2">
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
              </div>

              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => handleApprove(s)} className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> Aprobar
                </button>
                <button onClick={() => handleReject(s)} className="flex-1 bg-white border border-[#E2E8F0] hover:bg-gray-50 text-[#6B7A8D] py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <XCircle size={16} /> Rechazar
                </button>
                <button onClick={() => handleDelete(s.id)} className="w-10 bg-white border border-[#E2E8F0] hover:bg-red-50 hover:border-red-200 text-[#6B7A8D] hover:text-red-500 py-2 rounded-xl flex items-center justify-center transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
