import React, { useState, useEffect } from "react";
import { dbGet, dbPost, storageUpload } from "../../lib/supabase";
import { CreditCard, Upload, CheckCircle2, FileText, ShieldCheck, Dumbbell, BarChart2, AlertCircle, Info } from "lucide-react";
import { getRatesForCutoff } from "../../utils/tarifas";

/**
 * MiMembresiaCivil — Pantalla de membresía para usuarios Civil Premium.
 * Reutiliza la estructura visual de MiMembresia.jsx.
 */
export default function MiMembresiaCivil({ clienteData, setMsg }) {
  const [configPago, setConfigPago] = useState({ clabe:"", banco:"", beneficiario:"" });
  const [rawCfg, setRawCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [historial, setHistorial] = useState([]);

  // Cálculos de fecha de vencimiento (Rolling 30 days)
  const { targetCutoff, expirationDate } = React.useMemo(() => {
    const today = new Date();
    
    // Buscamos su último recibo válido
    const lastValid = historial.find(r => r.estado === 'aprobado' || r.estado === 'pendiente');

    if (!lastValid) {
      // Si nunca ha pagado o no hay recibo válido, su "vencimiento" esperado es HOY + 30 días
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return { targetCutoff: d, expirationDate: null };
    }

    // Su membresía vence en la fecha del último recibo válido
    // (cuando pague de nuevo, cubrirá 30 días a partir de esa fecha, o a partir de hoy si ya venció)
    const lastExp = new Date(lastValid.fecha_corte_mes +"T23:59:59");
    
    // Si ya venció y pasaron los días de gracia, el nuevo ciclo empieza hoy
    const blockDate = new Date(lastExp);
    blockDate.setDate(blockDate.getDate() + 2);
    
    if (today > blockDate) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return { targetCutoff: d, expirationDate: lastExp };
    } else {
      // Si está renovando a tiempo, suma 30 días a su fecha original
      const d = new Date(lastExp);
      d.setDate(d.getDate() + 30);
      return { targetCutoff: d, expirationDate: lastExp };
    }
  }, [historial]);

  // Si está en días de gracia renovando un corte vencido, respetamos la tarifa de su fecha de vencimiento
  const TARIFA = React.useMemo(() => {
    const referenceDate = expirationDate && new Date() >= expirationDate ? expirationDate : new Date();
    const rates = getRatesForCutoff(rawCfg, referenceDate);
    return rates.civil_premium;
  }, [rawCfg, expirationDate]);

  const diasRestantesText = React.useMemo(() => {
    if (clienteData?.plan_tipo !== 'premium' || !expirationDate) return null;
    const target = new Date(expirationDate);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((target - today) / (1000 * 60 * 60 * 24));
    
    if (days > 1) return `Expira en ${days} días`;
    if (days === 1) return `Expira mañana`;
    if (days === 0) return `Expira hoy`;
    if (days < 0) return `En días de gracia (venció hace ${Math.abs(days)} días)`;
    return null;
  }, [expirationDate, clienteData?.plan_tipo]);


  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, recibos] = await Promise.all([
        dbGet("configuracion_plataforma?id=eq.1"),
        dbGet(`recibos_pago_civil?cliente_id=eq.${clienteData.id}&order=created_at.desc`)
      ]);
      if (cfg && cfg.length > 0) {
        setRawCfg(cfg[0]);
        setConfigPago({
          clabe: cfg[0].clabe ||"",
          banco: cfg[0].banco ||"",
          beneficiario: cfg[0].beneficiario ||""
        });
      }
      if (recibos) setHistorial(recibos);
    } catch (e) {
      console.error("Error cargando config de pago:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clienteData.id]);

  const handleUploadClick = () => {
    document.getElementById("comprobanteUploadCivil").click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMsg("Subiendo comprobante...");

    try {
      const ext = file.name.split('.').pop();
      const path = `civil_${clienteData.id}_${Date.now()}.${ext}`;
      const url = await storageUpload('comprobantes', path, file);

      const reciboRes = await dbPost('recibos_pago_civil', {
        cliente_id: clienteData.id,
        monto: TARIFA,
        fecha_corte_mes: targetCutoff.toISOString().split('T')[0],
        comprobante_url: url,
        estado: 'pendiente'
      });

      // Notificar superadmins
      try {
        const superadmins = await dbGet("profiles?role=eq.superadmin");
        for (const admin of superadmins) {
          await dbPost("notificaciones", {
            profile_id: admin.id,
            titulo:"Pago de Atleta Independiente",
            mensaje: `El atleta ${clienteData.nombre} ha subido su comprobante.`,
            tipo:"pago",
            link_url:"pagos",
            entidad_id: reciboRes[0]?.id
          }, { headers: { Prefer: "return=minimal" } });
        }
      } catch(e) {}

      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Comprobante subido. Lo revisaremos en menos de 24 horas.</div>);
      loadData();
    } catch (error) {
      console.error(error);
      if (error.message?.includes('relation"recibos_pago_civil" does not exist')) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error: La base de datos aún no está configurada para recibir pagos de atletas independientes. Contacta a soporte.</div>);
      } else {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error al subir: {error.message}</div>);
      }
    } finally {
      setUploading(false);
      e.target.value ="";
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
      <input
        type="file"
        id="comprobanteUploadCivil"
        accept="image/*,.pdf"
        style={{ display:"none" }}
        onChange={handleFileChange}
      />

      {/* Banner de Estado */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1929]">Tu Membresía (Atleta Independiente)</h2>
          <p className="text-[#6B7A8D] mt-1">Sube de nivel para quitar las restricciones del constructor.</p>
        </div>
        {historial.some(r => r.estado === 'pendiente') ? (
          <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200 flex items-center gap-2 font-bold whitespace-nowrap">
            <AlertCircle size={18} />
            Pago en Revisión
          </div>
        ) : clienteData?.plan_tipo === 'estandar' ? (
          <div className="bg-slate-100 text-[#6B7A8D] px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 font-bold whitespace-nowrap">
            <AlertCircle size={18} />
            Plan Estándar
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 flex items-center gap-2 font-bold whitespace-nowrap">
              <CheckCircle2 size={18} />
              Premium Activo
            </div>
            {diasRestantesText && (
              <span className="text-xs font-semibold text-[#6B7A8D]">
                {diasRestantesText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tarjeta de precio y beneficios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Precio */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--brand-primary)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
              <CreditCard size={20} className="text-[var(--brand-primary)]" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1929]">Plan Mensual</h3>
          </div>
          <div className="text-5xl font-extrabold text-[#0B1929] mb-1">
            ${TARIFA}
          </div>
          <div className="text-[#6B7A8D] text-sm mb-6">MXN / mes · Sin contrato</div>
          <ul className="space-y-3">
            {[
              { icon: <Dumbbell size={15} />, text:"Constructor de rutinas ilimitado" },
              { icon: <FileText size={15} />, text:"Planeación nutricional propia" },
              { icon: <BarChart2 size={15} />, text:"Seguimiento de progreso y métricas" },
              { icon: <ShieldCheck size={15} />, text:"Modo Atleta con cronómetro" }
            ].map((b, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-[#0B1929] font-medium">
                <span className="text-[var(--brand-primary)]">{b.icon}</span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Pago por SPEI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
              <Upload size={20} className="text-[var(--brand-primary)]" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1929]">Pago por SPEI</h3>
          </div>

          {loading ? (
            <div className="text-[#6B7A8D] text-sm">Cargando datos de pago...</div>
          ) : (
            <div className="space-y-3 text-sm mb-6">
              <div className="bg-[#F0F4FA] rounded-xl p-3">
                <span className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">Beneficiario</span>
                <p className="font-bold text-[#0B1929] mt-0.5">{configPago.beneficiario || "FLUX Sport S.A."}</p>
              </div>
              <div className="bg-[#F0F4FA] rounded-xl p-3">
                <span className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">Banco</span>
                <p className="font-bold text-[#0B1929] mt-0.5">{configPago.banco || "—"}</p>
              </div>
              <div className="bg-[#F0F4FA] rounded-xl p-3">
                <span className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">CLABE</span>
                <p className="font-bold text-[#0B1929] mt-0.5 font-mono tracking-wider">{configPago.clabe || "—"}</p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Concepto Obligatorio</p>
                <p className="font-black text-base text-amber-700 bg-amber-50 rounded-lg p-2 text-center mt-1 border border-amber-200">
                  FLX-{clienteData?.id ? String(clienteData.id).substring(0,6).toUpperCase() : 'ATLETA'}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                Transfiere <strong>${Number(TARIFA).toFixed(2)} MXN</strong> y sube tu comprobante. Tu acceso se renueva por 30 días desde la confirmación.
              </div>
            </div>
          )}

          <button
            onClick={handleUploadClick}
            disabled={uploading || loading}
            className="w-full bg-[var(--brand-primary)] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? "Subiendo..." : historial.some(r => r.estado === 'pendiente') ? "Subir Nuevo Comprobante" : "Subir Comprobante de Pago"}
          </button>
        </div>
      </div>

      {/* Reglas de Facturación */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-[#0B1929] mb-4 flex items-center gap-2">
          <Info size={18} className="text-[#6B7A8D]" />
          Reglas de Tu Suscripción
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="block text-xs font-bold text-[#6B7A8D] uppercase mb-1">Duración</span>
            <p className="text-sm text-[#0B1929]"><strong>30 días</strong> a partir de tu pago.</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="block text-xs font-bold text-[#6B7A8D] uppercase mb-1">Vencimiento Actual</span>
            <p className="text-sm font-bold text-[var(--brand-primary)]">
              {expirationDate ? expirationDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long' }) : 'Pendiente de pago'}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
            <span className="block text-xs font-bold text-emerald-600 uppercase mb-1">Días de Gracia</span>
            <p className="text-sm text-[#0B1929]"><strong>2 días</strong> tras el vencimiento.</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
            <span className="block text-xs font-bold text-red-500 uppercase mb-1">Bloqueo</span>
            <p className="text-sm text-[#0B1929]">Al <strong>3er día</strong> sin renovar.</p>
          </div>
        </div>
      </div>

      {/* Historial de Pagos */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0]">
        <h3 className="text-lg font-bold text-[#0B1929] mb-4">Historial de Pagos</h3>
        {loading ? (
          <div className="text-sm text-[#6B7A8D]">Cargando historial...</div>
        ) : historial.length === 0 ? (
          <div className="text-sm text-[#6B7A8D] bg-slate-50 p-4 rounded-xl text-center border border-slate-100">No hay pagos registrados aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha de Pago</th>
                  <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Válido Hasta</th>
                  <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                  <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-[#0B1929] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#6B7A8D] whitespace-nowrap">
                      {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#0B1929] text-right whitespace-nowrap">
                      ${Number(r.monto).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 flex justify-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                        r.estado === 'aprobado' ? 'bg-emerald-50 text-emerald-700' :
                        r.estado === 'rechazado' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-slate-100">
              {historial.map(r => (
                <div key={r.id} className="py-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-[#0B1929]">${Number(r.monto).toFixed(2)}</span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                      r.estado === 'aprobado' ? 'bg-emerald-50 text-emerald-700' :
                      r.estado === 'rechazado' ? 'bg-red-50 text-red-600' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {r.estado}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#6B7A8D]">
                    <span>{new Date(r.created_at).toLocaleDateString('es-MX')}</span>
                    <span>Válido: {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
