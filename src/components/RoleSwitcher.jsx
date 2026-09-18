import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, User, Loader2 } from 'lucide-react';

export default function RoleSwitcher({ currentRole, currentData, multiRoles, onChangeRole, activeNutriologo }) {
  const [switchingTo, setSwitchingTo] = useState(null);

  const rolesToShow = (currentRole === 'nutriologo' || currentRole === 'nutriologo_estudiante' || currentRole === 'superadmin')
    ? (multiRoles || []).filter(r => r.role !== 'cliente')
    : (multiRoles || []);

  if (!rolesToShow || rolesToShow.length <= 1) return null;

  const handleSwitch = (r) => {
    if (!onChangeRole) {
       console.error('onChangeRole no esta definido en RoleSwitcher');
       return;
    }
    setSwitchingTo(r);
    setTimeout(() => {
        try {
          onChangeRole(r);
        } catch (error) {
          console.error('Error switching role:', error);
          alert('Error al cambiar de perfil: ' + error.message);
          setSwitchingTo(null);
        }
    }, 50);
  };

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-[#0B1929] mb-4 flex items-center gap-2">
        <RefreshCw size={16} className="text-[#6B7A8D]" /> Cambiar Perfil
      </h3>
      <div className="flex flex-col gap-2">
        {rolesToShow.map((r, i) => {
          const isCivilRole = r.role === 'cliente' && !r.data?.nutriologo_id;
          const roleIdentifier = isCivilRole ? 'civil' : r.role;
          
          let isActive = false;
          if (currentRole === roleIdentifier) {
            // Si hay currentData, hacemos match exacto por ID para evitar conflictos entre múltiples pacientes
            if (currentData?.id && r.data?.id) {
               isActive = currentData.id === r.data.id;
            } else {
               isActive = true;
            }
          }

          let label = 'Administrativo';
          let subtitle = r.data?.nombre_clinica || r.data?.nombre || 'Usuario';

          if (r.role === 'cliente') {
             if (r.data?.nutriologo_id) {
               // If this is the active client profile, we can use the live fetched data to bypass cache
               const isCurrentActiveClient = isActive && activeNutriologo;
               
               let clinic, nutName;
               if (isCurrentActiveClient) {
                 clinic = activeNutriologo.nombre_marca || 'Consultorio';
                 nutName = activeNutriologo.nombre || 'Especialista';
               } else {
                 const isOldFormat = !r.data.nutriologo_nombre;
                 clinic = isOldFormat ? 'Consultorio' : (r.data.nombre_clinica || 'Consultorio');
                 nutName = isOldFormat ? (r.data.nombre_clinica || 'Especialista') : r.data.nutriologo_nombre;
               }
               
               label = `Paciente de ${clinic}`;
               subtitle = `Nutriólogo: ${nutName}`;
             } else {
               label = 'Atleta Independiente';
               subtitle = r.data?.nombre || 'Usuario';
             }
          } else if (r.role === 'nutriologo') {
             label = 'Nutriólogo';
             subtitle = r.data?.nombre_marca || r.data?.nombre || 'Usuario';
          } else if (r.role === 'nutriologo_estudiante') {
             label = 'Estudiante';
             subtitle = r.data?.nombre_marca || r.data?.nombre || 'Usuario';
          } else if (r.role === 'staff') {
             label = 'Staff';
             subtitle = r.data?.nombre || 'Usuario';
          } else if (r.role === 'superadmin') {
             label = 'Superadmin';
             subtitle = r.data?.nombre || 'Usuario';
          }

          const isSwitching = switchingTo === r;

          return (
            <button
              key={i}
              disabled={isActive || isSwitching}
              onClick={() => handleSwitch(r)}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isActive ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}
            >
              <div className="text-left min-w-0 flex-1 pr-4">
                <p className={`font-bold text-sm truncate ${isActive ? 'text-[var(--brand-primary)]' : 'text-[#0B1929]'}`}>
                  {label}
                </p>
                <p className={`text-xs mt-0.5 opacity-80 truncate ${isActive ? 'text-[var(--brand-primary)]' : 'text-[#6B7A8D]'}`}>
                  {subtitle}
                </p>
              </div>
              <div className="shrink-0 flex items-center justify-center w-6 h-6">
                {isSwitching ? (
                  <Loader2 size={18} className="animate-spin text-[var(--brand-primary)]" />
                ) : isActive ? (
                  <CheckCircle2 size={20} className="text-[var(--brand-primary)]" />
                ) : (
                  <User size={18} className="text-[#94A3B8]" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
