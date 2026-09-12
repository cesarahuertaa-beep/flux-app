import React, { useState, useEffect, useMemo } from "react";
import { dbGet, dbPatch, dbPost } from "../../lib/supabase";
import { CheckCircle2, XCircle, Eye, Banknote, X, Clock, UserCheck, ChevronDown, ChevronRight, Calendar, Send } from "lucide-react";

export default function ControlPagos({ setMsg }) {
  const [recibos, setRecibos] = useState([]);
  const [nutriologos, setNutriologos] = useState({}); // id -> { nombre, creado_por }
  const [loading, setLoading] = useState(true);
  const [modalImg, setModalImg] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [expandedColab, setExpandedColab] = useState(null);
  const [nominasEstado, setNominasEstado] = useState({}); // "Nombre|YYYY-MM" -> { transferido_por_admin, confirmado_por_colaborador }

  const COMISION_PCT = 0.35;

  const loadData = async () => {
    setLoading(true);
    try {
      const [dataRecibos, profiles, dataNominas] = await Promise.all([
        dbGet("recibos_pago?order=created_at.desc"),
        dbGet("profiles?role=eq.nutriologo&select=id,nombre,creado_por_nombre"),
        dbGet("nomina_colaboradores")
      ]);
      const map = {};
      profiles.forEach(p => { map[p.id] = { nombre: p.nombre, creado_por: p.creado_por_nombre || null }; });
      
      const mapNominas = {};
      if(dataNominas && dataNominas.length > 0) {
        dataNominas.forEach(n => {
          mapNominas[`${n.colaborador_nombre}|${n.mes_facturacion}`] = n;
        });
      }

      setNutriologos(map);
      setNominasEstado(mapNominas);
      setRecibos(dataRecibos);
    } catch (e) {
      console.error(e);
      setMsg("❌ Error cargando pagos: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set();
    recibos.forEach(r => {
      if (r.fecha_corte_mes) {
        setMeses.add(r.fecha_corte_mes.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(setMeses).sort().reverse();
  }, [recibos]);

  useEffect(() => {
    if (mesesDisponibles.length > 0 && filtroMes === "todos") {
      setFiltroMes(mesesDisponibles[0]); // Seleccionar el mes más reciente por defecto
    }
  }, [mesesDisponibles, filtroMes]);

  const filtrados = useMemo(() => {
    return recibos.filter(r => {
      const matchEstado = filtroEstado === "todos" ? true : r.estado === filtroEstado;
      const matchMes = filtroMes === "todos" ? true : (r.fecha_corte_mes && r.fecha_corte_mes.startsWith(filtroMes));
      return matchEstado && matchMes;
    });
  }, [recibos, filtroEstado, filtroMes]);

  // Comisiones agrupadas por colaborador basadas en los recibos filtrados
  const comisiones = useMemo(() => {
    const map = {};
    filtrados.forEach(r => {
      const nutri = nutriologos[r.nutriologo_id];
      if (!nutri || !nutri.creado_por) return;
      const colab = nutri.creado_por;
      if (!map[colab]) map[colab] = { totalGenerado: 0, nutriologos: new Set(), recibosCount: 0 };
      map[colab].totalGenerado += Number(r.monto) || 0;
      map[colab].nutriologos.add(nutri.nombre || "Desconocido");
      map[colab].recibosCount++;
    });
    return Object.entries(map)
      .map(([nombre, data]) => ({
        nombre,
        totalGenerado: data.totalGenerado,
        comision: data.totalGenerado * COMISION_PCT,
        nutriologos: [...data.nutriologos],
        recibosCount: data.recibosCount
      }))
      .sort((a, b) => b.comision - a.comision);
  }, [filtrados, nutriologos]);

  const updateEstado = async (id, nuevoEstado) => {
    try {
      await dbPatch(`recibos_pago?id=eq.${id}`, { estado: nuevoEstado });
      setMsg("✓ Recibo " + nuevoEstado);
      loadData();
    } catch (e) {
      setMsg("❌ Error al actualizar: " + e.message);
    }
  };

  const formatMes = (yyyyMm) => {
    if (yyyyMm === 'todos') return 'Todos los meses';
    const [y, m] = yyyyMm.split('-');
    const date = new Date(y, m - 1);
    return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  };

  const StatusBadge = ({ s }) => {
    if (s === "pendiente") return <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><Clock size={12}/> Pendiente</span>;
    if (s === "aprobado") return <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><CheckCircle2 size={12}/> Aprobado</span>;
    if (s === "rechazado") return <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><XCircle size={12}/> Rechazado</span>;
    return null;
  };

  const handleMarcarTransferido = async (colaboradorNombre, monto) => {
    if (filtroMes === 'todos') {
      setMsg("⚠️ Selecciona un mes específico arriba para poder transferir.");
      return;
    }
    try {
      setMsg("Guardando...");
      // Primero checar si existe la fila
      const key = `${colaboradorNombre}|${filtroMes}`;
      const existing = nominasEstado[key];
      
      if (existing) {
        await dbPatch(`nomina_colaboradores?id=eq.${existing.id}`, { transferido_por_admin: true, monto });
      } else {
        await dbPost("nomina_colaboradores", {
          colaborador_nombre: colaboradorNombre,
          mes_facturacion: filtroMes,
          monto: monto,
          transferido_por_admin: true
        });
      }
      setMsg("✓ Marcado como transferido");
      loadData();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
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
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar size={16} className="text-[#6B7A8D]" />
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="bg-transparent text-sm font-bold text-[#0B1929] focus:outline-none cursor-pointer capitalize"
            >
              <option value="todos">Todos los meses</option>
              {mesesDisponibles.map(m => (
                <option key={m} value={m}>{formatMes(m)}</option>
              ))}
            </select>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
            {['pendiente', 'aprobado', 'rechazado', 'todos'].map(st => (
              <button key={st} onClick={() => setFiltroEstado(st)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all shrink-0 ${filtroEstado === st ? 'bg-white text-[#0B1929] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}>
                {st}
              </button>
            ))}
          </div>
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
                        {nutriologos[r.nutriologo_id]?.nombre || "Desconocido"}
                        {nutriologos[r.nutriologo_id]?.creado_por && (
                          <span className="block text-[11px] text-[#6B7A8D] font-normal">Inv. por: {nutriologos[r.nutriologo_id].creado_por}</span>
                        )}
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

      {/* ── COMISIONES POR COLABORADOR ── */}
      {!loading && comisiones.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
          <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-3">
            <UserCheck className="text-indigo-500" size={22} />
            <div>
              <h3 className="text-lg font-bold text-[#0B1929]">Comisiones de Colaboradores</h3>
              <p className="text-[#6B7A8D] text-sm mt-0.5">35% del total generado por los nutriólogos que cada colaborador invitó · <strong>{filtroMes === 'todos' ? 'Acumulado histórico' : <span className="capitalize">{formatMes(filtroMes)}</span>}</strong></p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {comisiones.map((c, i) => {
              const nom = nominasEstado[`${c.nombre}|${filtroMes}`];
              const isTransferido = nom?.transferido_por_admin;
              const isConfirmado = nom?.confirmado_por_colaborador;

              return (
              <div key={i}>
                <div className="w-full flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors">
                  
                  {/* Info izquierda (Clickable) */}
                  <button 
                    onClick={() => setExpandedColab(expandedColab === c.nombre ? null : c.nombre)}
                    className="flex items-center gap-3 text-left flex-1"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                      <span className="text-indigo-600 font-bold text-sm">{c.nombre.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-bold text-[#0B1929] flex items-center gap-2">
                        {c.nombre}
                        {isConfirmado && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] uppercase tracking-wider font-bold">FIRMADO</span>}
                      </p>
                      <p className="text-xs text-[#6B7A8D]">{c.nutriologos.length} nutriólogo{c.nutriologos.length !== 1 ? 's' : ''} · {c.recibosCount} recibo{c.recibosCount !== 1 ? 's' : ''}</p>
                    </div>
                    {expandedColab === c.nombre ? <ChevronDown size={18} className="text-[#6B7A8D] shrink-0 ml-2" /> : <ChevronRight size={18} className="text-[#6B7A8D] shrink-0 ml-2" />}
                  </button>

                  {/* Acciones derecha */}
                  <div className="flex items-center justify-end gap-6 mt-4 md:mt-0 pl-12 md:pl-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-[#6B7A8D]">Total generado</p>
                      <p className="font-semibold text-[#0B1929] text-sm">${c.totalGenerado.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">Tu pago (35%)</p>
                      <p className="font-black text-indigo-600 text-lg">${c.comision.toFixed(2)}</p>
                    </div>
                    
                    {filtroMes !== 'todos' && (
                      <div className="border-l border-gray-200 pl-4">
                        {isConfirmado ? (
                           <div className="flex flex-col items-center text-green-600">
                             <CheckCircle2 size={20} />
                             <span className="text-[10px] font-bold mt-1">PAGADO</span>
                           </div>
                        ) : isTransferido ? (
                           <div className="flex flex-col items-center text-amber-500">
                             <Clock size={20} />
                             <span className="text-[10px] font-bold mt-1 text-center leading-tight">ESPERANDO<br/>FIRMA</span>
                           </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMarcarTransferido(c.nombre, c.comision); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            <Send size={14} /> Transferir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {expandedColab === c.nombre && (
                  <div className="px-6 pb-4 bg-indigo-50/40 border-t border-indigo-100/50 pt-3">
                    <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Nutriólogos a su cargo:</p>
                    <div className="flex flex-wrap gap-2">
                      {c.nutriologos.map((n, j) => (
                        <span key={j} className="px-3 py-1 bg-white border border-indigo-100 rounded-full text-xs font-semibold text-indigo-700">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-[#E2E8F0] flex justify-between items-center">
            <span className="text-sm font-bold text-[#6B7A8D] uppercase tracking-wider">Total nómina de colaboradores</span>
            <span className="text-xl font-black text-[#0B1929]">
              ${comisiones.reduce((acc, c) => acc + c.comision, 0).toFixed(2)} MXN
            </span>
          </div>
        </div>
      )}

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