import { useState } from "react";
import {
  UtensilsCrossed,
  Dumbbell,
  Footprints,
  BarChart2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import fluxLogo from "@/imports/dreamina-2026-09-02-9270-Minimalist_standalone_app_icon__only_the....jpeg";
import Nutrition from "@/components/Nutrition";
import Training from "@/components/Training";
import Steps from "@/components/Steps";
import Statistics from "@/components/Statistics";
import Appointments from "@/components/Appointments";

type Section = "nutrition" | "training" | "steps" | "statistics" | "appointments";

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "nutrition",    label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
  { id: "training",     label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
  { id: "steps",        label: "Pasos",           icon: <Footprints size={18} strokeWidth={1.5} /> },
  { id: "statistics",   label: "Estadísticas",    icon: <BarChart2 size={18} strokeWidth={1.5} /> },
  { id: "appointments", label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> },
];

const SECTION_MAP: Record<Section, React.ReactNode> = {
  nutrition:    <Nutrition />,
  training:     <Training />,
  steps:        <Steps />,
  statistics:   <Statistics />,
  appointments: <Appointments />,
};

export default function App() {
  const [active, setActive] = useState<Section>("nutrition");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-full flex bg-[#F7F9FC] overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col h-full bg-[#F0F2F5] border-r border-[#E2E5EA] transition-all duration-300 relative"
        style={{ width: collapsed ? 64 : 220 }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-[#E2E5EA] min-h-[72px] ${collapsed ? "justify-center px-0" : ""}`}>
          <img
            src={fluxLogo}
            alt="Flux"
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
          />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-[17px] font-bold tracking-tight text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                FLUX
              </p>
              <p className="text-[10px] font-semibold tracking-widest text-[#1A6FD4] uppercase">
                Health System
              </p>
            </div>
          )}
        </div>

        {/* Patient pill */}
        {!collapsed && (
          <div className="mx-3 mt-4 mb-1 px-3 py-2.5 rounded-xl bg-white border border-[#E2E5EA] flex items-center gap-2.5 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#60A5FA] to-[#1A6FD4] flex items-center justify-center flex-shrink-0">
              <User size={13} strokeWidth={2} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0B1929] truncate leading-tight">Carlos Mendoza</p>
              <p className="text-[10px] text-[#6B7A8D] leading-tight">Semana 9</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mx-auto mt-4 mb-1 w-8 h-8 rounded-full bg-gradient-to-br from-[#60A5FA] to-[#1A6FD4] flex items-center justify-center">
            <User size={13} strokeWidth={2} className="text-white" />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 pt-3 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[9px] font-semibold tracking-widest text-[#9BA5B0] uppercase px-3 pb-2">Menú</p>
          )}
          {NAV.map(({ id, label, icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                title={collapsed ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-white text-[#1A6FD4] shadow-sm border border-[#E2E5EA]"
                    : "text-[#6B7A8D] hover:bg-white/70 hover:text-[#0B1929]"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-[#1A6FD4]" : ""}`}>{icon}</span>
                {!collapsed && (
                  <span className={`text-sm font-medium truncate ${isActive ? "text-[#1A6FD4] font-semibold" : ""}`}>
                    {label}
                  </span>
                )}
                {!collapsed && isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1A6FD4] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className={`px-2 pb-5 pt-3 border-t border-[#E2E5EA] ${collapsed ? "flex justify-center" : ""}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#6B7A8D] hover:bg-white hover:text-[#1A6FD4] transition-all text-xs font-medium border border-transparent hover:border-[#E2E5EA] w-full"
            style={{ justifyContent: collapsed ? "center" : "flex-start" }}
          >
            {collapsed
              ? <ChevronRight size={16} strokeWidth={1.5} />
              : <><ChevronLeft size={16} strokeWidth={1.5} /><span>Ocultar menú</span></>
            }
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto">
          {SECTION_MAP[active]}
        </div>
      </main>
    </div>
  );
}
