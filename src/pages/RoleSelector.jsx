import React from "react";
import { User, Briefcase, Activity } from "lucide-react";

export default function RoleSelector({ roles, onSelect, onLogout }) {
  const getIcon = (roleName) => {
    if (roleName === "client") return <Activity size={32} className="text-white" />;
    return <Briefcase size={32} className="text-white" />;
  };

  const getTitle = (roleObj) => {
    if (roleObj.role === "client") return "Paciente";
    const nameMap = {
      "nutriologo": "Nutriólogo",
      "superadmin": "Flux Sports (Admin)",
      "administrativo": "Soporte Administrativo",
      "staff": "Staff",
      "admin": "Administrador"
    };
    return nameMap[roleObj.role] || "Staff";
  };

  const getSubtitle = (roleObj) => {
    if (roleObj.role === "client") {
      return roleObj.data.nombre || "Tu perfil de entrenamiento";
    }
    return roleObj.data.nombre_clinica || roleObj.data.nombre || "Panel Administrativo";
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col">
      <div className="flex items-center justify-between p-6">
        <img src="/flux_logo.jpeg" alt="FLUX Logo" className="h-10 w-auto rounded-lg shadow-sm" />
        <button onClick={onLogout} className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors">
          Cerrar Sesión
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0B1929] mb-8 text-center">
          ¿Cómo deseas ingresar hoy?
        </h1>

        <div className="flex flex-wrap justify-center gap-6 max-w-4xl w-full">
          {roles.map((roleObj, i) => (
            <button
              key={i}
              onClick={() => onSelect(roleObj)}
              className="flex flex-col items-center gap-4 group p-6 w-48 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] hover:shadow-md hover:border-[var(--brand-primary)] hover:-translate-y-1 transition-all"
            >
              <div className="w-20 h-20 bg-[#0B1929] rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform group-hover:bg-[var(--brand-primary)]">
                {getIcon(roleObj.role)}
              </div>
              <div className="text-center">
                <p className="font-bold text-[#0B1929] mb-1">{getTitle(roleObj)}</p>
                <p className="text-xs text-[#6B7A8D] px-2">{getSubtitle(roleObj)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
