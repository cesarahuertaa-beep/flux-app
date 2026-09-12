import React, { useState, useEffect, useMemo } from "react";
import { dbGet, dbPatch } from "../../lib/supabase";
import { Banknote, CheckCircle2, Clock, Calendar, CheckSquare } from "lucide-react";

export default function MisComisiones({ myId, setMsg }) {
  const [myName, setMyName] = useState(null);
  const [recibos, setRecibos] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState("todos");

  const COMISION_PCT = 0.35;

  const loadData = async () => {
    setLoading(true);
    try {
      // Obtener el nombre propio del colaborador
      const me = await dbGet(`profiles?id=eq.${myId}&select=nombre`);
      const nombre = me[0]?.nombre || "";
      setMyName(nombre);
      if (!nombre) { setLoading(false); return; }

      // Obtener los nutriólogos que este colaborador invitó
      const profiles = await dbGet(`profiles?role=eq.nutriologo&creado_por_nombre=eq.${encodeURIComponent(nombre)}&select=id,nombre`);
      
      let dataRecibos = [];
      if (profiles.length > 0) {
        const nutriIds = profiles.map(p => p.id);
        const queryIds = nutriIds.map(id => `nutriologo_id.eq.${id}`).join(',');
        // Solo obtener aprobados porque de ahí sale la nómina real
        dataRecibos = await dbGet(`recibos_pago?or=(${queryIds})&estado=eq.aprobado&order=created_at.desc`);
      }

      // Obtener el estado de nóminas del colaborador
      const dataNominas = await dbGet(`nomina_colaboradores?colaborador_nombre=eq.${encodeURIComponent(nombre)}`);

      setRecibos(dataRecibos);
      setNominas(dataNominas || []);
    } catch (e) {
      console.error(e);
      setMsg("❌ Error cargando comisiones: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [myId]);

  // Meses únicos
  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set();
    recibos.forEach(r => {
      if (r.fecha_corte_mes) setMeses.add(r.fecha_corte_mes.substring(0, 7));
    });
    return Array.from(setMeses).sort().reverse();
  }, [recibos]);

  useEffect(() => {
    if (mesesDisponibles.length > 0 && filtroMes === "todos") {
      setFiltroMes(mesesDisponibles[0]);
    }
  }, [mesesDisponibles, filtroMes]);

  const filtrados = useMemo(() => {
    if (filtroMes === "todos") return recibos;
    return recibos.filter(r => r.fecha_corte_mes && r.fecha_corte_mes.startsWith(filtroMes));
  }, [recibos, filtroMes]);

  // Total acumulado (monto bruto generado por los nutriólogos)
  const totalGenerado = filtrados.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  const miPago = totalGenerado * COMISION_PCT;

  // Buscar si hay registro de nómina para el mes actual
  const nominaActual = nominas.find(n => n.mes_facturacion === filtroMes);

  const formatMes = (yyyyMm) => {
    if (yyyyMm === 'todos') return 'Todos los meses (Histórico)';
    const [y, m] = yyyyMm.split('-');
    const date = new Date(y, m - 1);
    return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  };

  const confirmarRecepcion = async () => {
    if (!nominaActual) return;
    try {
      setMsg("Confirmando...");
      await dbPatch(`nomina_colaboradores?id=eq.${nominaActual.id}`, { 
        confirmado_por_colaborador: true, 
        fecha_confirmacion: new Date().toISOString() 
      });
      setMsg("✓ Pago confirmado exitosamente");
      loadData();
    } catch (e) {
      setMsg("❌ Error al confirmar: " + e.message);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
      
      {/* Encabezado */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
            <Banknote className="text-indigo-500" />
            Mis Comisiones
          </h2>
          <p className="text-[#6B7A8D] mt-1 text-sm">Resumen de ingresos generados por los nutriólogos que invitaste.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 shadow-sm">
          <Calendar size={16} className="text-[#6B7A8D]" />
          <select
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            className="bg-transparent text-sm font-bold text-[#0B1929] focus:outline-none cursor-pointer capitalize"
          >
            <option value="todos">Todos los meses (Histórico)</option>
            {mesesDisponibles.map(m => (
              <option key={m} value={m}>{formatMes(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-10 text-[#6B7A8D]">Cargando información...</div>
      ) : (
        <>
          {/* Tarjeta Principal de Ingresos */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="p-8 bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center text-center">
              <p className="text-sm font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Total a recibir este periodo</p>
              <h1 className="text-5xl font-black text-indigo-600 tracking-tight">${miPago.toFixed(2)}</h1>
              <p className="text-xs text-[#6B7A8D] mt-3">Basado en un acumulado de ${totalGenerado.toFixed(2)} MXN en {filtrados.length} recibos aprobados</p>
            </div>

            {/* Estado del pago del mes (si se filtró un mes) */}
            {filtroMes !== 'todos' && totalGenerado > 0 && (
              <div className="px-6 py-5 border-t border-[#E2E8F0] bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {!nominaActual?.transferido_por_admin ? (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      <Clock size={20} />
                    </div>
                  ) : !nominaActual?.confirmado_por_colaborador ? (
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-500">
                      <Banknote size={20} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <CheckCircle2 size={20} />
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-[#0B1929]">Estado de la transferencia</h3>
                    <p className="text-xs text-[#6B7A8D]">
                      {!nominaActual?.transferido_por_admin 
                        ? "En proceso de cálculo y liberación por el administrador."
                        : !nominaActual?.confirmado_por_colaborador
                        ? "El administrador ha marcado el pago como transferido. Por favor confirma de recibido."
                        : `Recibido y confirmado el ${new Date(nominaActual.fecha_confirmacion).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                {/* Botón de Firma */}
                {nominaActual?.transferido_por_admin && !nominaActual?.confirmado_por_colaborador && (
                  <button 
                    onClick={confirmarRecepcion}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm shrink-0"
                  >
                    <CheckSquare size={18} /> Confirmar Recepción (Firma)
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
