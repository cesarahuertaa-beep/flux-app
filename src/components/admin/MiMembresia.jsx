import React, { useState, useEffect, useMemo } from "react";
import { dbGet, dbPost, storageUpload } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import { CreditCard, Upload, AlertCircle, BarChart3, CheckCircle2, FileText, Info } from "lucide-react";

export default function MiMembresia({ clientes, profileId, setMsg, onPaymentUploaded }) {
  const [perfil, setPerfil] = useState(null);
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const brand = useBrand();

  const loadData = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const [data, cfg, recibos] = await Promise.all([
        dbGet(`profiles?id=eq.${profileId}`),
        dbGet("configuracion_plataforma?id=eq.1"),
        dbGet(`recibos_pago?nutriologo_id=eq.${profileId}&order=created_at.desc`)
      ]);
      if (data && data.length > 0) setPerfil(data[0]);
      if (cfg && cfg.length > 0) setConfigPago({
        clabe: cfg[0].clabe || "",
        banco: cfg[0].banco || "",
        beneficiario: cfg[0].beneficiario || ""
      });
      if (recibos) setHistorial(recibos);
    } catch (e) {
      console.error("Error cargando perfil:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profileId]);

  // Cálculos de fechas y periodos
  const { desglose, activeCount, currentTier, currentRate, nextTierThreshold, totalAmount, fechaCorteText, nextCutoff } = useMemo(() => {
    const today = new Date();
    const diaCorte = 10; // Fijo global

    // 1. Determinar el último corte que YA PASÓ (o es hoy)
    let lastPassedCutoff = new Date(today.getFullYear(), today.getMonth(), diaCorte);
    if (today.getDate() < diaCorte) {
      lastPassedCutoff = new Date(today.getFullYear(), today.getMonth() - 1, diaCorte);
    }

    // 2. Revisar si ese último corte ya fue pagado
    const lastPassedCutoffStr = lastPassedCutoff.toISOString().split('T')[0];
    let yaPagado = historial.some(r => 
      r.fecha_corte_mes === lastPassedCutoffStr && 
      (r.estado === 'aprobado' || r.estado === 'pendiente')
    );

    // Si no tiene pacientes o el primero entró después del último corte, no debe nada de ese corte
    // PERO si aún estamos cargando, no asumimos que tiene 0 pacientes para evitar un bug visual/cálculo
    const myClients = clientes ? clientes.filter(c => c.nutriologo_id === profileId) : [];
    let firstClientDate = null;
    if (myClients.length > 0) {
      firstClientDate = new Date(myClients[0].created_at);
    }

    if (!loading && (!firstClientDate || firstClientDate > lastPassedCutoff)) {
      yaPagado = true;
    }

    // 3. Definir la ventana de facturación actual
    let nextCutoff, lastCutoff;
    if (!yaPagado && today >= lastPassedCutoff) {
      // Estamos cobrando el recibo vencido / del día de hoy
      nextCutoff = lastPassedCutoff;
      lastCutoff = new Date(nextCutoff.getFullYear(), nextCutoff.getMonth() - 1, diaCorte);
    } else {
      // Ya pagaron el recibo anterior (o son nuevos). El cobro vigente es el próximo.
      nextCutoff = new Date(lastPassedCutoff.getFullYear(), lastPassedCutoff.getMonth() + 1, diaCorte);
      lastCutoff = lastPassedCutoff;
    }
    
    // Contadores
    let activePatientsCount = 0;
    
    // Generar desglose
    const dataList = clientes.map(c => {
      const isActivo = c.activo;
      const createdAt = new Date(c.created_at || today);
      const deactivatedAt = c.deactivated_at ? new Date(c.deactivated_at) : null;
      
      let diasCobrar = 0;
      let fechaInicioCobro = lastCutoff;
      let fechaFinCobro = nextCutoff;
      
      if (isActivo) {
        activePatientsCount++;
        if (createdAt < lastCutoff) {
          diasCobrar = 30; // Cliente de ciclos anteriores
        } else {
          // Cliente nuevo en este ciclo, cobramos los días hasta el corte
          const diffTime = Math.abs(nextCutoff - createdAt);
          diasCobrar = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diasCobrar > 30) diasCobrar = 30;
          fechaInicioCobro = createdAt;
        }
      } else if (deactivatedAt && deactivatedAt > lastCutoff) {
        // Regla de 20 días: si el paciente estuvo menos de 20 días activo en este ciclo → mes completo.
        // Si estuvo 20 días o más → proporcional al día de baja.
        const start = createdAt > lastCutoff ? createdAt : lastCutoff;
        const diffTime = Math.abs(deactivatedAt - start);
        const diasActivo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diasActivo < 20) {
          // Mes forzoso: cobra 30 días completos aunque el paciente se fue antes
          diasCobrar = 30;
          fechaFinCobro = nextCutoff; // Periodo hasta el corte completo
        } else {
          // Proporcional: solo los días que estuvo activo
          diasCobrar = Math.min(diasActivo, 30);
          fechaInicioCobro = start;
          fechaFinCobro = deactivatedAt;
        }
      }
      
      const periodoStr = `${fechaInicioCobro.toLocaleDateString('es-MX', {day:'2-digit', month:'short'})} al ${fechaFinCobro.toLocaleDateString('es-MX', {day:'2-digit', month:'short'})}`;
      
      return { ...c, diasCobrar, periodoStr };
    }).filter(c => c.diasCobrar > 0);

    // Calcular tarifa
    let tier = 1;
    let rate = 50;
    let threshold = 21;
    if (activePatientsCount >= 21 && activePatientsCount <= 50) {
      tier = 2; rate = 45; threshold = 51;
    } else if (activePatientsCount > 50) {
      tier = 3; rate = 40; threshold = null;
    }

    // Calcular costos
    let total = 0;
    dataList.forEach(c => {
      c.costoPaciente = (rate / 30) * c.diasCobrar;
      total += c.costoPaciente;
    });

    const strCorte = nextCutoff.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

    return { 
      desglose: dataList, 
      activeCount: activePatientsCount, 
      currentTier: tier, 
      currentRate: rate, 
      nextTierThreshold: threshold, 
      totalAmount: total, 
      fechaCorteText: strCorte,
      nextCutoff
    };
  }, [clientes, perfil, loading]);

  // Estado del componente
  const status = "active"; // active, pending, review

  const handleUploadClick = () => {
    document.getElementById("comprobanteUpload").click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMsg("Subiendo comprobante...");

    try {
      // 1. Subir a Storage
      const ext = file.name.split('.').pop();
      const path = `${profileId}_${Date.now()}.${ext}`;
      const url = await storageUpload('comprobantes', path, file);

      // 2. Insertar en DB
      await dbPost('recibos_pago', {
        nutriologo_id: profileId,
        monto: totalAmount,
        fecha_corte_mes: nextCutoff.toISOString().split('T')[0],
        comprobante_url: url,
        estado: 'pendiente'
      });

      setMsg("✓ Comprobante subido y en revisión.");
      if (onPaymentUploaded) onPaymentUploaded();
      loadData();
    } catch (error) {
      console.error(error);
      setMsg("❌ Error al subir: " + error.message);
    } finally {
      setUploading(false);
      e.target.value = ""; // Limpiar input
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
      <input 
        type="file" 
        id="comprobanteUpload" 
        accept="image/*,.pdf" 
        style={{ display: "none" }} 
        onChange={handleFileChange} 
      />
      
      {/* Banner de Estado */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1929]">Resumen de tu cuenta</h2>
          <p className="text-[#6B7A8D] mt-1">Controla tu suscripción, revisa tu nivel de cobro y sube tus comprobantes.</p>
        </div>
        
        {status === "active" && (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 flex items-center gap-2 font-bold">
            <CheckCircle2 size={18} />
            Servicio Activo
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Columna Izquierda: Termómetro y Gráfica */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Termómetro de Nivel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#0B1929] flex items-center gap-2 mb-6">
                <BarChart3 size={20} className="text-[var(--brand-primary)]"/>
                Nivel de Suscripción Actual
              </h2>

              {/* Termómetro: textos arriba, barra en el medio, precios abajo */}
              <div className="mt-4 px-2">
                {/* Fila de etiquetas superiores */}
                <div className="flex justify-between mb-2">
                  {[{label: 'Nivel 1', sub: '1 pac.'}, {label: 'Nivel 2', sub: '21 pac.'}, {label: 'Nivel 3', sub: '+50 pac.'}].map((t, i) => (
                    <div key={i} className="text-center w-20">
                      <span className="block text-xs font-bold text-[#0B1929]">{t.label}</span>
                      <span className="block text-[10px] text-[#6B7A8D]">{t.sub}</span>
                    </div>
                  ))}
                </div>

                {/* Barra con puntos superpuestos */}
                <div className="relative h-3 bg-gray-100 rounded-full overflow-visible mx-4">
                  <div
                    className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((activeCount / 51) * 100, 100)}%` }}
                  />
                  {/* Puntos */}
                  {[0, 0.39, 1].map((pct, i) => (
                    <div
                      key={i}
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-4 shadow-sm z-10 transition-colors ${activeCount >= [1,21,51][i] ? 'bg-[var(--brand-primary)] border-white' : 'bg-gray-200 border-white'}`}
                      style={{ left: `calc(${pct * 100}% - 10px)` }}
                    />
                  ))}
                </div>

                {/* Fila de precios inferiores */}
                <div className="flex justify-between mt-3">
                  {['$50 /pac', '$45 /pac', '$40 /pac'].map((p, i) => (
                    <div key={i} className="text-center w-20">
                      <span className="block text-xs font-bold text-emerald-600">{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm text-[#0B1929]">
                  Actualmente tienes <strong>{activeCount} pacientes activos</strong>. 
                  Tu tarifa actual es de <strong className="text-[var(--brand-primary)]">${currentRate}.00 MXN</strong> por paciente.
                  {nextTierThreshold && (
                    <span className="block text-[var(--brand-primary)] mt-1">
                      ¡Agrega {nextTierThreshold - activeCount} pacientes más para desbloquear la tarifa de ${currentTier === 1 ? 45 : 40}!
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Estado de Cuenta */}
            <div className="bg-white p-0 rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
              <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-center">
                <h2 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                  <FileText size={20} className="text-[var(--brand-primary)]"/>
                  Desglose para Próximo Corte
                </h2>
                <span className="text-sm font-bold text-[#6B7A8D]">{fechaCorteText}</span>
              </div>
              
              {/* Tabla de Pacientes */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse hidden md:table">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Paciente</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Alta</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Periodo Facturado</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Días Facturados</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {desglose.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-[#6B7A8D]">No tienes pacientes a facturar en este ciclo.</td>
                      </tr>
                    ) : (
                      desglose.map((c, i) => (
                        <tr key={c.id || i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-6 font-semibold text-[#0B1929]">{c.nombre}</td>
                          <td className="py-3 px-6 text-sm text-[#6B7A8D] text-center">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX', {day: '2-digit', month: 'short'}) : 'Reciente'}
                          </td>
                          <td className="py-3 px-6 text-xs text-[#6B7A8D] text-center font-medium">
                            {c.periodoStr}
                          </td>
                          <td className="py-3 px-6 text-sm font-medium text-center text-[#0B1929]">
                            {c.diasCobrar} <span className="text-gray-400 font-normal">/ 30</span>
                          </td>
                          <td className="py-3 px-6 font-bold text-[var(--brand-primary)] text-right">${c.costoPaciente.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                
                {/* Mobile View */}
                <div className="md:hidden divide-y divide-gray-100">
                  {desglose.length === 0 ? (
                    <div className="py-8 text-center text-[#6B7A8D]">No tienes pacientes a facturar en este ciclo.</div>
                  ) : (
                    desglose.map((c, i) => (
                      <div key={c.id || i} className="p-4 bg-white space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-[#0B1929]">{c.nombre}</span>
                          <span className="font-bold text-[var(--brand-primary)]">${c.costoPaciente.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-[#6B7A8D]">
                          <span>Alta: {c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX', {day: '2-digit', month: 'short'}) : 'Reciente'}</span>
                          <span>Días: {c.diasCobrar}/30</span>
                        </div>
                        <div className="text-xs text-[#6B7A8D] bg-gray-50 p-2 rounded text-center">
                          {c.periodoStr}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-6 bg-gray-50/50 border-t border-[#E2E8F0]">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-[#6B7A8D]">Subtotal por volumen ({activeCount} pac. a ${currentRate})</p>
                    <p className="font-bold text-[#0B1929]">${totalAmount.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <p className="text-sm font-bold text-[#6B7A8D] flex items-center gap-1">
                      Ajuste por mes forzoso pendiente <Info size={14} className="text-gray-400"/>
                    </p>
                    <p className="font-bold text-gray-400">$0.00</p>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xl font-extrabold text-[#0B1929]">Total a Pagar</p>
                    <p className="text-2xl font-black text-[var(--brand-primary)]">${totalAmount.toFixed(2)} MXN</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Pagos */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#0B1929] mb-4">Datos de Transferencia</h2>
              
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Banco</p>
                    <p className="font-bold text-[#0B1929]">{configPago.banco || <span className="text-gray-400 italic text-sm font-normal">Sin configurar aún</span>}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">CLABE Interbancaria</p>
                    <p className="font-bold text-[#0B1929] tracking-widest font-mono break-all sm:break-normal">
                      {configPago.clabe 
                        ? configPago.clabe.replace(/(.{4})/g, '$1 ').trim()
                        : <span className="text-gray-400 italic text-sm font-normal">Sin configurar aún</span>
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Beneficiario</p>
                    <p className="font-bold text-[#0B1929]">{configPago.beneficiario || <span className="text-gray-400 italic text-sm font-normal">Sin configurar aún</span>}</p>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Concepto Obligatorio</p>
                  <p className="font-black text-lg text-amber-700 bg-amber-50 rounded-lg p-2 text-center mt-1 border border-amber-200">
                    FLX-{profileId ? profileId.substring(0,6).toUpperCase() : 'USER12'}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <button disabled={uploading || loading} 
                  onClick={handleUploadClick}
                  className="w-full bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  {loading ? 'Calculando corte...' : uploading ? 'Subiendo...' : 'Subir Comprobante'}
                </button>
                <p className="text-xs text-center text-[#6B7A8D] mt-3 flex items-center justify-center gap-1">
                  <AlertCircle size={12}/> Validado manualmente en menos de 2h
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reglas de Facturación */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#0B1929] mb-4 flex items-center gap-2">
            <Info size={18} className="text-[#6B7A8D]" />
            Reglas y Fechas de Facturación
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-xs font-bold text-[#6B7A8D] uppercase mb-1">Ciclo de Cobro</span>
              <p className="text-sm text-[#0B1929]">Del <strong>10 al 10</strong> de cada mes.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-xs font-bold text-[#6B7A8D] uppercase mb-1">Límite de Pago</span>
              <p className="text-sm text-[#0B1929]">Hasta el <strong>día 10</strong> del mes.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
              <span className="block text-xs font-bold text-emerald-600 uppercase mb-1">Días de Gracia</span>
              <p className="text-sm text-[#0B1929]">Días <strong>11 y 12</strong> (cuenta activa).</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
              <span className="block text-xs font-bold text-red-500 uppercase mb-1">Bloqueo</span>
              <p className="text-sm text-[#0B1929]">Día <strong>13</strong> (si no hay validación).</p>
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
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha</th>
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Mes Facturado</th>
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
                        {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : '—'}
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
                      <span>Mes: {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : '—'}</span>
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
