import React, { useState, useEffect } from "react";
import { dbGet, dbPatch } from "../../lib/supabase";
import { CheckCircle2, XCircle, Eye, Banknote, X, Clock } from "lucide-react";

export default function ControlPagos({ setMsg }) {
  const [recibos, setRecibos] = useState([]);
  const [nutriologos, setNutriologos] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalImg, setModalImg] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");

  const loadData = async () => {
    setLoading(true);
    try {
      const dataRecibos = await dbGet("recibos_pago?order=created_at.desc");
      const profiles = await dbGet("profiles?role=eq.nutriologo&select=id,nombre");
      const map = {};
      profiles.forEach(p => { map[p.id] = p.nombre; });
      setNutriologos(map);
      setRecibos(dataRecibos);
    } catch (e) {
      console.error(e);
      setMsg("❌ Error cargando pagos: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const updateEstado = async (id, nuevoEstado) => {
    try {
      await dbPatch(`recibos_pago?id=eq.${id}`, { estado: nuevoEstado });
      setMsg("✓ Recibo " + nuevoEstado);
      loadData();
    } catch (e) {
      setMsg("❌ Error al actualizar: " + e.message);
    }
  };

  const filtrados = recibos.filter(r => filtroEstado === "todos" ? true : r.estado === filtroEstado);

  const StatusBadge = ({ s }) => {
    if (s === "pendiente") return <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><Clock size={12}/> Pendiente</span>;
    if (s === "aprobado") return <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><CheckCircle2 size={12}/> Aprobado</span>;
    if (s === "rechazado") return <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><XCircle size={12}/> Rechazado</span>;
    return null;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
            <Banknote className="text-green-500" />
            Auditoría de Pagos
          </h2>
          <p className="text-[#6B7A8D] mt-1 text-sm">Revisa y valida las transferencias mensuales de los nutriólogos.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {['pendiente', 'aprobado', 'rechazado', 'todos'].map(st => (
            <button key={st} onClick={() => setFiltroEstado(st)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all shrink-0 ${filtroEstado === st ? 'bg-white text-[#0B1929] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}>
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#6B7A8D]">Cargando recibos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha / Hora</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Nutriólogo</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Mes Facturado</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[#6B7A8D]">No hay recibos en esta categoría.</td>
                  </tr>
                ) : (
                  filtrados.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-6 text-sm text-[#0B1929]">
                        {new Date(r.created_at).toLocaleDateString('es-MX')}
                        <span className="block text-xs text-[#6B7A8D]">{new Date(r.created_at).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="py-3 px-6 font-semibold text-[#0B1929]">
                        {nutriologos[r.nutriologo_id] || "Desconocido"}
                      </td>
                      <td className="py-3 px-6 text-sm text-center text-[#6B7A8D]">
                        {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', {month:'long', year:'numeric'}) : 'N/A'}
                      </td>
                      <td className="py-3 px-6 font-bold text-green-600 text-right">
                        ${Number(r.monto).toFixed(2)}
                      </td>
                      <td className="py-3 px-6 flex justify-center">
                        <StatusBadge s={r.estado} />
                      </td>
                      <td className="py-3 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setModalImg(r.comprobante_url)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver foto"><Eye size={18} /></button>
                          {r.estado === "pendiente" && (
                            <>
                              <button onClick={() => updateEstado(r.id, "aprobado")} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Aprobar"><CheckCircle2 size={18} /></button>
                              <button onClick={() => updateEstado(r.id, "rechazado")} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Rechazar"><XCircle size={18} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalImg && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-[#0B1929]">Comprobante de Pago</h3>
              <button onClick={() => setModalImg(null)} className="text-[#6B7A8D] hover:bg-gray-200 p-1 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex justify-center items-center">
              <img src={modalImg} alt="Comprobante" className="max-w-full max-h-full rounded-lg shadow-sm border border-gray-200 object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}