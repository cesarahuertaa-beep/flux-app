import React from "react";
import { Lock } from "lucide-react";

export default function BloqueadoPaciente({ onLogout }) {
  return (
    <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-[#E2E8F0] max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#0B1929] to-[#1A2D45] p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center mb-4">
            <Lock size={36} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Servicio No Disponible</h1>
          <p className="text-white/60 text-sm mt-2">FLUX · Acceso Temporal Suspendido</p>
        </div>

        {/* Body */}
        <div className="p-8 text-center space-y-5">
          <p className="text-[#0B1929] font-semibold text-base leading-relaxed">
            Por el momento no puedes acceder a tu plan de alimentación y entrenamiento.
          </p>
          <p className="text-[#6B7A8D] text-sm leading-relaxed">
            El servicio ha sido suspendido temporalmente. Por favor comunícate con tu nutriólogo para que pueda reactivar tu acceso a la brevedad.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-700 text-sm font-semibold">
              💬 Tu historial y planes están seguros. Solo están pausados hasta que se restablezca el servicio.
            </p>
          </div>
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
