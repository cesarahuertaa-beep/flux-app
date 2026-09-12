import React, { useState, useEffect, useMemo } from "react";
import { dbGet, dbPost, storageUpload } from "../../lib/supabase";
import { CreditCard, Upload, AlertCircle, BarChart3, CheckCircle2, FileText, Info } from "lucide-react";

export default function MiMembresia({ clientes, profileId, setMsg }) {
  const [perfil, setPerfil] = useState(null);
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!profileId) return;
      try {
        const [data, cfg] = await Promise.all([
          dbGet(`profiles?id=eq.${profileId}`),
          dbGet("configuracion_plataforma?id=eq.1")
        ]);
        if (data && data.length > 0) setPerfil(data[0]);
        if (cfg && cfg.length > 0) setConfigPago({
          clabe: cfg[0].clabe || "",
          banco: cfg[0].banco || "",
          beneficiario: cfg[0].beneficiario || ""
        });
      } catch (e) {
        console.error("Error cargando perfil:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profileId]);

  // Cálculos de fechas y periodos
  const { desglose, activeCount, currentTier, currentRate, nextTierThreshold, totalAmount, fechaCorteText, nextCutoff } = useMemo(() => {
    const today = new Date();
    const diaCorte = perfil?.dia_corte || 1; // Si no hay en DB, usa día 1

    let nextCutoff = new Date(today.getFullYear(), today.getMonth(), diaCorte);
    if (today.getDate() > diaCorte) {
      nextCutoff = new Date(today.getFullYear(), today.getMonth() + 1, diaCorte);
    }
    const lastCutoff = new Date(nextCutoff.getFullYear(), nextCutoff.getMonth() - 1, diaCorte);
    
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
  }, [clientes, perfil]);

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
                <BarChart3 size={20} className="text-[#1A6FD4]"/>
                Nivel de Suscripción Actual
              </h2>

              <div className="relative pt-6 pb-6 mt-4">
                {/* Barra de progreso */}
                <div className="absolute top-[60px] left-0 w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#1A6FD4] to-blue-400 transition-all duration-1000"
                    style={{ width: `${Math.min((activeCount / 51) * 100, 100)}%` }}
                  />
                </div>

                {/* Markers */}
                <div className="relative flex justify-between px-2">
                  {[1, 21, 51].map((pts, i) => (
                    <div key={i} className="flex flex-col items-center w-20">
                      {/* Textos ARRIBA */}
                      <div className="mb-2 text-center h-12 flex flex-col justify-end">
                        <span className="block text-xs font-bold text-[#0B1929]">Nivel {i+1}</span>
                        <span className="block text-[10px] text-[#6B7A8D]">{pts === 51 ? '+50' : `${pts}`} pac.</span>
                      </div>
                      
                      {/* El Punto */}
                      <div className={`w-5 h-5 rounded-full border-4 shadow-sm flex items-center justify-center z-10 transition-colors
                        ${activeCount >= pts ? 'bg-[#1A6FD4] border-white' : 'bg-gray-200 border-white'}
                      `}/>
                      
                      {/* Precio ABAJO */}
                      <div className="mt-2 text-center">
                        <span className="block text-xs font-bold text-emerald-600">${i===0?50:i===1?45:40}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm text-[#0B1929]">
                  Actualmente tienes <strong>{activeCount} pacientes activos</strong>. 
                  Tu tarifa actual es de <strong className="text-[#1A6FD4]">${currentRate}.00 MXN</strong> por paciente.
                  {nextTierThreshold && (
                    <span className="block text-blue-600 mt-1">
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
                  <FileText size={20} className="text-[#1A6FD4]"/>
                  Desglose para Próximo Corte
                </h2>
                <span className="text-sm font-bold text-[#6B7A8D]">{fechaCorteText}</span>
              </div>
              
              {/* Tabla de Pacientes */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
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
                          <td className="py-3 px-6 font-bold text-[#1A6FD4] text-right">${c.costoPaciente.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
                    <p className="text-2xl font-black text-[#1A6FD4]">${totalAmount.toFixed(2)} MXN</p>
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
                    <p className="font-bold text-[#0B1929] tracking-widest font-mono">
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
                <button disabled={uploading} 
                  onClick={handleUploadClick}
                  className="w-full bg-[#1A6FD4] hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  {uploading ? 'Subiendo...' : 'Subir Comprobante'}
                </button>
                <p className="text-xs text-center text-[#6B7A8D] mt-3 flex items-center justify-center gap-1">
                  <AlertCircle size={12}/> Validado manualmente en menos de 2h
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
