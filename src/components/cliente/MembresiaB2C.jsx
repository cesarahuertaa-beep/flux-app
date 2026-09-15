import { useState } from "react";
import { ShoppingBag, Upload, CheckCircle2 } from "lucide-react";

export function MembresiaB2C({ cliente }) {
  return (
    <div className="p-6 max-w-md mx-auto w-full animate-in fade-in pb-32">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight font-['Space_Grotesk',sans-serif]">Mi Membresía</h1>
        <p className="text-[#6B7A8D] mt-1">Suscripción Civil Premium</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--brand-primary)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0B1929]">Plan Premium</h2>
            <p className="text-[#6B7A8D] text-sm">Acceso total a Mi Plan</p>
          </div>
        </div>
        
        <div className="text-4xl font-extrabold text-[#0B1929] mb-4">
          $75.00 <span className="text-lg font-normal text-[#6B7A8D]">MXN / mes</span>
        </div>
        
        <ul className="space-y-3 mb-6">
          {["Constructor de rutinas y nutrición", "Modo atleta desbloqueado", "Registro anatómico avanzado"].map((b, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-[#0B1929] font-medium">
              <CheckCircle2 size={16} className="text-[#10B981]" /> {b}
            </li>
          ))}
        </ul>

        <button className="w-full bg-[var(--brand-primary)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity">
          Subir Comprobante de Pago
        </button>
      </div>
    </div>
  );
}
