import React from "react";
import { Lock, Mail } from "lucide-react";

export default function BloqueadoNutriologo({ onLogout }) {
  return (
    <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-[#E2E8F0] max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0B1929] to-[#1A2D45] p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-400/40 flex items-center justify-center mb-4">
            <Lock size={36} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Suscripción Vencida</h1>
          <p className="text-white/60 text-sm mt-2">FLUX · Acceso Bloqueado</p>
        </div>

        {/* Body */}
        <div className="p-8 text-center space-y-5">
          <p className="text-[#0B1929] font-semibold text-base leading-relaxed">
            No encontramos un pago registrado y aprobado para el período de facturación actual.
          </p>
          <p className="text-[#6B7A8D] text-sm leading-relaxed">
            Para restablecer el acceso a tu panel y el de tus pacientes, por favor realiza tu transferencia SPEI y sube el comprobante en la sección <strong>Mi Membresía</strong>, o contáctanos directamente.
          </p>

          {/* Contacto */}
          <div className="bg-[#F7F9FC] rounded-xl p-4 flex items-center gap-3 text-left border border-[#E2E8F0]">
            <div className="w-10 h-10 rounded-full bg-[#1A6FD4]/10 flex items-center justify-center shrink-0">
              <Mail size={18} className="text-[#1A6FD4]" />
            </div>
            <div>
              <p className="text-xs text-[#6B7A8D] font-bold uppercase tracking-wider">Contacto FLUX</p>
              <a href="mailto:soporte@flux-sport.com" className="text-[#1A6FD4] font-bold text-sm hover:underline">
                soporte@flux-sport.com
              </a>
            </div>
          </div>

          {/* Acceso limitado: Solo pueden ir a Membresía */}
          <p className="text-xs text-[#6B7A8D]">
            Puedes acceder a <strong>Mi Membresía</strong> para subir tu comprobante de pago.
          </p>
        </div>

        <div className="px-8 pb-8">
          <button
            onClick={onLogout}
            className="w-full py-3 text-sm text-[#6B7A8D] hover:text-[#0B1929] font-semibold border border-[#E2E8F0] rounded-xl transition-colors hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
