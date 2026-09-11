import React, { useState } from "react";
import { CreditCard, Upload, AlertCircle, BarChart3, CheckCircle2, FileText, Info } from "lucide-react";

export default function MiMembresia({ clientes, profileId, setMsg }) {
  // Lógica dinámica de pacientes
  const activeCount = clientes.filter(c => c.activo).length;
  
  let currentTier = 1;
  let currentRate = 50;
  let nextTierThreshold = 21;

  if (activeCount >= 21 && activeCount <= 50) {
    currentTier = 2;
    currentRate = 45;
    nextTierThreshold = 51;
  } else if (activeCount > 50) {
    currentTier = 3;
    currentRate = 40;
    nextTierThreshold = null; // Max tier
  }

  // Cálculos base 
  const totalAmount = activeCount * currentRate;

  // Fechas mock (luego vendrán de Supabase)
  const fechaCorte = "15 de Noviembre";
  const status = "active"; // active, pending, review

  const handleUploadClick = () => {
    // Aquí integraremos storageUpload de supabase después
    setMsg("✓ Funcionalidad de subida pendiente de integración con base de datos.");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
      
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

              <div className="relative pt-8 pb-4">
                {/* Barra de progreso */}
                <div className="absolute top-1/2 left-0 w-full h-3 bg-gray-100 rounded-full -translate-y-1/2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#1A6FD4] to-blue-400 transition-all duration-1000"
                    style={{ width: `${Math.min((activeCount / 51) * 100, 100)}%` }}
                  />
                </div>

                {/* Puntos (Tiers) */}
                <div className="absolute top-1/2 left-0 w-full flex justify-between -translate-y-1/2 px-1">
                  {[1, 21, 51].map((pts, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full border-4 shadow-sm flex items-center justify-center z-10 transition-colors
                        ${activeCount >= pts ? 'bg-[#1A6FD4] border-white' : 'bg-gray-200 border-white'}
                      `}/>
                      <div className="mt-6 text-center">
                        <span className="block text-xs font-bold text-[#0B1929]">Nivel {i+1}</span>
                        <span className="block text-[10px] text-[#6B7A8D]">{pts === 51 ? '+50' : `${pts}`} pac.</span>
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
                <span className="text-sm font-bold text-[#6B7A8D]">{fechaCorte}</span>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                      <p className="font-bold text-[#0B1929]">Cupos Mensuales Activos</p>
                      <p className="text-sm text-[#6B7A8D]">{activeCount} pacientes en tarifa Nivel {currentTier} (${currentRate})</p>
                    </div>
                    <p className="font-bold text-lg">${totalAmount.toFixed(2)}</p>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                      <p className="font-bold text-[#0B1929] flex items-center gap-1">
                        Ajuste de altas recientes <Info size={14} className="text-gray-400"/>
                      </p>
                      <p className="text-sm text-[#6B7A8D]">Días proporcionales de nuevos pacientes</p>
                    </div>
                    <p className="font-bold text-lg text-gray-400">$0.00</p>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xl font-extrabold text-[#0B1929]">Total Estimado</p>
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
                  <p className="font-bold text-[#0B1929]">BBVA</p>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">CLABE Interbancaria</p>
                  <p className="font-bold text-[#0B1929] tracking-widest">0123 4567 8901 2345 67</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Beneficiario</p>
                  <p className="font-bold text-[#0B1929]">Flux Technologies</p>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Concepto Obligatorio</p>
                  <p className="font-black text-lg text-amber-700 bg-amber-50 rounded-lg p-2 text-center mt-1 border border-amber-200">
                    FLX-{profileId ? profileId.substring(0,6).toUpperCase() : 'USER12'}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <button 
                  onClick={handleUploadClick}
                  className="w-full bg-[#1A6FD4] hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Subir Comprobante
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
