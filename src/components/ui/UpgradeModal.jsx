import React, { useState } from "react";
import { 
  Sparkles, 
  CalendarDays, 
  Dumbbell, 
  LineChart, 
  History, 
  Crown, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  Loader2, 
  X,
  ShieldCheck
} from "lucide-react";
import { isNativePlayApp } from "../../lib/playBilling";
import { useBackButton } from "../../lib/backButtonHandler";

const FEATURE_CONFIGS = {
  ia: {
    badge: "FLUX AI Pro",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200/80",
    iconBg: "bg-purple-50 text-purple-600 border border-purple-200/60",
    Icon: Sparkles,
    title: "Potencia tu plan con Inteligencia Artificial",
    subtitle: "Automatiza análisis clínicos y optimiza tus comidas con algoritmos diseñados para alto rendimiento deportivo.",
    benefits: [
      "Auditoría clínica instantánea de menús y distribución de macronutrientes",
      "Generador inteligente de recetas a partir de tus ingredientes seleccionados",
      "Detección y avisos automáticos de alérgenos y aversiones alimentarias",
    ],
  },
  dias: {
    badge: "Semanas Ilimitadas",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/60",
    Icon: CalendarDays,
    title: "Desbloquea la semana completa de nutrición",
    subtitle: "El plan gratuito incluye hasta 3 días. Con FLUX Pro planifica de Lunes a Domingo y crea múltiples variantes.",
    benefits: [
      "Planifica los 7 días de la semana sin restricciones de calendario",
      "Alternativas múltiples de alimentos (Opción A, B, C...) por comida",
      "Generación de listas de compras automáticas de la semana completa",
    ],
  },
  rutinas: {
    badge: "Entrenamiento Ilimitado",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200/80",
    iconBg: "bg-blue-50 text-blue-600 border border-blue-200/60",
    Icon: Dumbbell,
    title: "Entrena toda tu semana sin límites",
    subtitle: "El plan gratuito incluye hasta 3 rutinas. Diseña esquemas avanzados como Push/Pull/Legs o Torso/Pierna.",
    benefits: [
      "Rutinas ilimitadas para cada día de tu ciclo de entrenamiento",
      "Calculadora de 1RM y registro de series efectivas por ejercicio",
      "Biblioteca de ejercicios y variantes con técnicas de ejecución",
    ],
  },
  metricas: {
    badge: "Métricas Pro",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200/80",
    iconBg: "bg-amber-50 text-amber-600 border border-amber-200/60",
    Icon: LineChart,
    title: "Análisis avanzado de composición corporal",
    subtitle: "Visualiza tu evolución física con gráficas dinámicas de progreso, bioimpedancia y comparador fotográfico.",
    benefits: [
      "Historial visual interactivo de peso, porcentaje graso y masa muscular",
      "Comparador fotográfico antes y después de alta resolución",
      "Proyecciones de progreso y adherencia a tus objetivos fitness",
    ],
  },
  historial: {
    badge: "Historial y Respaldos",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    iconBg: "bg-slate-100 text-slate-600 border border-slate-200",
    Icon: History,
    title: "Accede a todos tus ciclos anteriores",
    subtitle: "Mantén un registro histórico permanente de cada etapa de tu evolución deportiva y nutricional.",
    benefits: [
      "Consulta y reactiva ciclos de entrenamiento y dietas de meses pasados",
      "Exportación de reportes e informes de progreso en formato PDF",
      "Respaldos en la nube sincronizados entre todos tus dispositivos",
    ],
  },
  general: {
    badge: "Membresía FLUX Pro",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200/80",
    iconBg: "bg-amber-50 text-amber-600 border border-amber-200/60",
    Icon: Crown,
    title: "Lleva tu rendimiento al siguiente nivel",
    subtitle: "Desbloquea el ecosistema completo de nutrición, entrenamiento inteligente y métricas corporales.",
    benefits: [
      "Inteligencia Artificial clínica para diseño y auditoría de planes",
      "Semanas completas (Lunes a Domingo) y rutinas ilimitadas",
      "Gráficas de bioimpedancia y comparador de progreso físico",
    ],
  },
};

export default function UpgradeModal({
  isOpen,
  onClose,
  feature = "general",
  clienteData = null,
  onNavigateMembresia = null,
  onSuccessPurchase = null,
  titleOverride = null,
  subtitleOverride = null,
}) {
  const [buying, setBuying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const isPlayApp = isNativePlayApp();

  useBackButton(isOpen, () => {
    if (!buying && onClose) onClose();
  }, 65);

  if (!isOpen) return null;

  const config = FEATURE_CONFIGS[feature] || FEATURE_CONFIGS.general;
  const { badge, badgeColor, iconBg, Icon, title, subtitle, benefits } = config;

  const handleAction = () => {
    setErrorMsg("");
    if (onClose) onClose();

    if (isPlayApp) {
      return;
    }

    // Web / PWA: Navegar a la pantalla de Membresía (Portal Web FLUX)
    if (typeof onNavigateMembresia === "function") {
      onNavigateMembresia();
    } else {
      window.location.hash = "#membresia";
      window.dispatchEvent(new CustomEvent("flux:navigate-tab", { detail: { tab: "membresia" } }));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-[#0B1929]/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200 select-none"
      onClick={!buying ? onClose : undefined}
    >
      <div 
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-[#E2E8F0] overflow-hidden animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 relative max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Barra superior de arrastre en móvil */}
        <div className="pt-3 pb-1 md:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Botón de Cerrar */}
        <button
          type="button"
          onClick={onClose}
          disabled={buying}
          className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer shrink-0 z-10"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Contenido scrolleable si la pantalla es muy pequeña */}
        <div className="p-6 md:p-7 overflow-y-auto no-scrollbar flex-1">
          {/* Cabecera con Icono y Badge */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${iconBg}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <span className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border mb-1 ${badgeColor}`}>
                {badge}
              </span>
              <h3 className="text-lg md:text-xl font-black text-[#0B1929] leading-tight font-['Rajdhani']">
                {titleOverride || title}
              </h3>
            </div>
          </div>

          {/* Subtítulo explicativo */}
          <p className="text-xs text-[#6B7A8D] leading-relaxed mb-5">
            {subtitleOverride || subtitle}
          </p>

          {/* Lista de Beneficios con Checkmarks Vectoriales */}
          <div className="space-y-2.5 mb-6 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-[#0B1929] font-medium leading-snug">
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {/* Mensaje de error si falla la compra */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-snug">
              {errorMsg}
            </div>
          )}

          {/* Aviso Multiplataforma (Estilo Netflix) en App Nativa vs Botones en Portal Web */}
          {isPlayApp ? (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-[#475569] leading-relaxed">
                <span className="font-bold text-[#0B1929] block mb-0.5">Función exclusiva de FLUX Pro</span>
                En esta aplicación no es posible contratar ni modificar suscripciones. Para activar o administrar tu membresía, inicia sesión con tu cuenta en el portal web de FLUX desde cualquier navegador.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-5 rounded-2xl bg-[#0B1929] hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center cursor-pointer"
              >
                Entendido
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleAction}
                disabled={buying}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[var(--brand-primary)] to-purple-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Ver Planes y Membresía</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={buying}
                className="w-full py-2 text-center text-xs font-semibold text-[#6B7A8D] hover:text-[#0B1929] transition-colors cursor-pointer"
              >
                Quizás más tarde
              </button>
            </div>
          )}

          {/* Nota al pie discreta de seguridad */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10.5px] text-slate-400">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>
              {isPlayApp 
                ? "Acceso sincronizado con tu cuenta multiplataforma FLUX." 
                : "Activación inmediata y soporte directo FLUX Sport."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
