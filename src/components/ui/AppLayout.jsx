import React, { useState } from "react";
import { ChevronLeft, ChevronRight, User, LogOut } from "lucide-react";
import { useBrand } from "../BrandContext";

/**
 * AppLayout — Mobile-First
 *
 * Mobile  (< md): Barra de navegación en la PARTE INFERIOR. Sin sidebar.
 *                 El contenido ocupa toda la pantalla menos la barra inferior.
 * Desktop (≥ md): Sidebar colapsable a la izquierda, igual que Figma.
 *
 * @param {Array}    nav      - Array de objetos { id, label, icon }
 * @param {string}   active   - Tab actual activa
 * @param {Function} setActive - Función para cambiar tab
 * @param {Object}   session  - Objeto de sesión (para nombre/rol)
 * @param {Function} onLogout - Función para cerrar sesión
 */
export function AppLayout({ children, nav, active, setActive, session, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const brand = useBrand();

  const userName = session?.data?.nombre || session?.nombre || "Usuario";
  const subtitle  = session?.role === "client" ? "Vista Atleta" : "Panel Admin";

  return (
    <div className="flex bg-[#F7F9FC] overflow-hidden" style={{ height: "100dvh", width: "100vw" }}>

      {/* ══════════════════════════════════════════════
          SIDEBAR — sólo visible en pantallas ≥ md
      ══════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex flex-shrink-0 flex-col h-full bg-[#F0F2F5] border-r border-[#E2E5EA] transition-all duration-300"
        style={{ width: collapsed ? 64 : 220 }}
      >
        {/* Logo de Marca Dinámico */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-[#E2E5EA] min-h-[72px] ${collapsed ? "justify-center" : ""}`}>
          <img
            src={brand.logo_url}
            alt="Logo"
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0 bg-white"
          />
          {!collapsed && (
            <div className="leading-tight truncate pr-2">
              <p className="text-[16px] font-bold tracking-tight text-[#0B1929] truncate" style={{ fontFamily: "DM Sans, sans-serif" }}>
                {brand.nombre_marca}
              </p>
              <p className="text-[10px] font-semibold tracking-widest text-[var(--brand-primary)] uppercase truncate">
                Health System
              </p>
            </div>
          )}
        </div>

        {/* User Pill */}
        {!collapsed ? (
          <button onClick={() => setActive("perfil")} className={`mx-3 mt-4 mb-1 px-3 py-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-left ${active === "perfil" ? "bg-white border-[var(--brand-primary)] shadow-sm" : "bg-white border-[#E2E5EA] shadow-sm hover:border-[var(--brand-primary)]"}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-primary)" }}>
              <User size={13} strokeWidth={2} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0B1929] truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-[#6B7A8D] leading-tight truncate">{subtitle}</p>
            </div>
          </button>
        ) : (
          <button onClick={() => setActive("perfil")} className={`mx-auto mt-4 mb-1 w-8 h-8 rounded-full flex items-center justify-center transition-all ${active === "perfil" ? "ring-2 ring-offset-2 ring-[var(--brand-primary)]" : "hover:scale-105"}`} style={{ background: "var(--brand-primary)" }}>
            <User size={13} strokeWidth={2} className="text-white" />
          </button>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-2 pt-3 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[9px] font-semibold tracking-widest text-[#9BA5B0] uppercase px-3 pb-2">Menú</p>
          )}
          {nav.map(({ id, label, icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                title={collapsed ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-white text-[var(--brand-primary)] shadow-sm border border-[#E2E5EA]"
                    : "text-[#6B7A8D] hover:bg-white/70 hover:text-[#0B1929]"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-[var(--brand-primary)]" : ""}`}>{icon}</span>
                {!collapsed && (
                  <span className={`text-sm font-medium truncate ${isActive ? "text-[var(--brand-primary)] font-semibold" : ""}`}>
                    {label}
                  </span>
                )}
                {!collapsed && isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: colapsar */}
        <div className={`px-2 pb-5 pt-3 border-t border-[#E2E5EA] flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#6B7A8D] hover:bg-white hover:text-[var(--brand-primary)] transition-all text-xs font-medium border border-transparent hover:border-[#E2E5EA] w-full mt-1"
            style={{ justifyContent: collapsed ? "center" : "flex-start" }}
          >
            {collapsed
              ? <ChevronRight size={16} strokeWidth={1.5} />
              : <><ChevronLeft size={16} strokeWidth={1.5} /><span>Ocultar menú</span></>
            }
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT
          - Mobile:   ocupa todo el ancho, deja padding-bottom para la bottom nav
          - Desktop:  flex-1 al lado del sidebar
      ══════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0 overflow-hidden bg-white flex flex-col">
        {/* Área de contenido que hace scroll */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 flex flex-col">
          {children}
        </div>
      </main>

      {/* ══════════════════════════════════════════════
          BOTTOM NAV BAR — sólo visible en mobile (< md)
          Fija en la parte inferior de la pantalla.
      ══════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E2E8F0] flex items-stretch"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {nav.map(({ id, label, icon }, index) => {
          const isActive = active === id;
          const isMid = index === Math.ceil(nav.length / 2);
          const isPerfilActive = active === "perfil";
          
          return (
            <React.Fragment key={id}>
              {isMid && (
                <button
                  onClick={() => setActive("perfil")}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${isPerfilActive ? "text-[var(--brand-primary)]" : "text-[#9BA5B0]"}`}
                >
                  <span className="block h-0.5 w-5 rounded-full mb-1 transition-all" style={{ background: isPerfilActive ? "var(--brand-primary)" : "transparent" }} />
                  <span className={`transition-transform ${isPerfilActive ? "scale-110" : "scale-100"}`}>
                    <User size={18} strokeWidth={1.5} />
                  </span>
                  <span className={`text-[10px] font-medium leading-none mt-0.5 ${isPerfilActive ? "font-semibold" : ""}`}>
                    Perfil
                  </span>
                </button>
              )}
              <button
                onClick={() => setActive(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all ${
                  isActive ? "text-[var(--brand-primary)]" : "text-[#9BA5B0]"
                }`}
              >
                {/* Indicador activo encima del ícono */}
                <span
                  className="block h-0.5 w-5 rounded-full mb-1 transition-all"
                  style={{ background: isActive ? "var(--brand-primary)" : "transparent" }}
                />
                <span className={`transition-transform ${isActive ? "scale-110" : "scale-100"}`}>
                  {icon}
                </span>
                <span className={`text-[10px] font-medium leading-none mt-0.5 ${isActive ? "font-semibold" : ""}`}>
                  {label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

    </div>
  );
}
