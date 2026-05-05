export const GRUPOS = ["Pecho","Espalda","Piernas","Hombros","Bíceps","Tríceps","Core","Cardio"];
export const TIPOS  = ["Empuje","Jale","Sentadilla","Bisagra","Cargada","Aislamiento"];

export const C = {
  // ── Fondos
  bg:          "#03050a",
  surface:     "#070d18",
  surfaceAlt:  "#080f1c",
  card:        "#0a1428",
  cardHover:   "#0d1a32",

  // ── Acento principal (dynamic via CSS vars)
  accent:      "var(--brand-accent, #38bdf8)",
  accentMid:   "var(--brand-accent-mid, #0ea5e9)",
  accentDark:  "var(--brand-accent-dark, #0369a1)",
  accentDeep:  "var(--brand-accent-deep, #082f49)",
  accentGlow:  "color-mix(in srgb, var(--brand-accent, #38bdf8) 22%, transparent)",

  // ── Color secundario (violet para profundidad)
  violet:      "#818cf8",
  violetDeep:  "#1e1b4b",
  violetGlow:  "rgba(129,140,248,0.15)",

  // ── Texto
  text:        "#e2eeff",
  muted:       "#64748b",
  mutedLight:  "#94a3b8",
  dim:         "#1e293b",

  // ── Bordes
  border:      "rgba(56,189,248,0.08)",
  borderMid:   "rgba(56,189,248,0.15)",
  borderGlow:  "rgba(56,189,248,0.25)",

  // ── Gradientes
  gradBtn:     "linear-gradient(135deg, var(--brand-accent, #38bdf8) 0%, var(--brand-accent-mid, #0ea5e9) 100%)",
  gradCard:    "linear-gradient(145deg, rgba(10,20,40,0.9), rgba(7,13,24,0.95))",
  gradBg:      "radial-gradient(ellipse at 20% 50%, rgba(8,47,73,0.5) 0%, transparent 60%), radial-gradient(ellipse at 80% 10%, rgba(30,27,75,0.4) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(8,47,73,0.3) 0%, transparent 55%)",
  gradAccent:  "linear-gradient(135deg, var(--brand-accent, #38bdf8), #818cf8)",
};

export const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --brand-accent:      #38bdf8;
  --brand-accent-mid:  #0ea5e9;
  --brand-accent-dark: #0369a1;
  --brand-accent-deep: #082f49;
}

html { scroll-behavior: smooth; }

body {
  background: ${C.bg};
  color: ${C.text};
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.6;
}

.brand-font { font-family: 'Space Grotesk', sans-serif; }

/* ── Inputs premium ── */
input, select, textarea {
  background: rgba(7,13,24,0.8);
  color: ${C.text};
  border: 1px solid ${C.border};
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  width: 100%;
  outline: none;
  font-family: 'Inter', sans-serif;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
  backdrop-filter: blur(8px);
}
input:focus, select:focus, textarea:focus {
  border-color: var(--brand-accent, #38bdf8);
  background: rgba(10,20,40,0.9);
  box-shadow:
    0 0 0 3px rgba(56,189,248,0.12),
    0 0 24px rgba(56,189,248,0.08),
    inset 0 1px 0 rgba(56,189,248,0.05);
}
input::placeholder { color: ${C.muted}; }
select option { background: ${C.card}; }
textarea { resize: vertical; min-height: 80px; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: ${C.surface}; }
::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(56,189,248,0.4); }

/* ── Animaciones ── */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33%       { transform: translateY(-12px) rotate(1deg); }
  66%       { transform: translateY(-6px) rotate(-1deg); }
}
@keyframes orb-drift {
  0%   { transform: translate(0px, 0px) scale(1); }
  25%  { transform: translate(30px, -20px) scale(1.05); }
  50%  { transform: translate(-10px, 30px) scale(0.97); }
  75%  { transform: translate(-30px, -10px) scale(1.03); }
  100% { transform: translate(0px, 0px) scale(1); }
}
@keyframes orb-drift-reverse {
  0%   { transform: translate(0px, 0px) scale(1); }
  25%  { transform: translate(-25px, 15px) scale(1.04); }
  50%  { transform: translate(15px, -25px) scale(0.98); }
  75%  { transform: translate(20px, 10px) scale(1.02); }
  100% { transform: translate(0px, 0px) scale(1); }
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes rotateSlow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes spinRing {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes borderGlow {
  0%, 100% { border-color: rgba(56,189,248,0.1); box-shadow: 0 0 0 rgba(56,189,248,0); }
  50%       { border-color: rgba(56,189,248,0.3); box-shadow: 0 0 30px rgba(56,189,248,0.08); }
}
@keyframes tabSlide {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes ping {
  75%, 100% { transform: scale(2); opacity: 0; }
}

/* ── Utility classes ── */
.animate-in       { animation: fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
.animate-in-scale { animation: fadeInScale 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
.float            { animation: float 6s ease-in-out infinite; }
.glow-pulse       { animation: glowPulse 3s ease-in-out infinite; }
.border-glow      { animation: borderGlow 4s ease-in-out infinite; }

/* ── Card hover premium ── */
.card-hover {
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s ease, box-shadow 0.3s ease;
  will-change: transform;
}
.card-hover:hover {
  transform: translateY(-4px);
  border-color: rgba(56,189,248,0.25) !important;
  box-shadow:
    0 16px 48px rgba(0,0,0,0.4),
    0 0 0 1px rgba(56,189,248,0.1),
    0 0 40px rgba(56,189,248,0.06) !important;
}

/* ── Button hover premium ── */
.btn-hover {
  transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease, filter 0.2s ease;
  will-change: transform;
}
.btn-hover:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.12);
}
.btn-hover:active:not(:disabled) {
  transform: translateY(0px) scale(0.98);
}

/* ── Tab button ── */
.tab-btn {
  transition: color 0.25s ease, background 0.25s ease;
  position: relative;
}
.tab-btn::after {
  content: '';
  position: absolute;
  bottom: 0; left: 50%; right: 50%;
  height: 2px;
  background: linear-gradient(90deg, var(--brand-accent,#38bdf8), #818cf8);
  border-radius: 2px 2px 0 0;
  transition: left 0.3s cubic-bezier(0.16,1,0.3,1), right 0.3s cubic-bezier(0.16,1,0.3,1);
}
.tab-btn.active::after {
  left: 16%;
  right: 16%;
}

/* ── Glass surface ── */
.glass {
  background: rgba(10,20,40,0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(56,189,248,0.08);
}

/* ── Exercise card ── */
.ex-card {
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease;
  will-change: transform;
}
.ex-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow:
    0 24px 60px rgba(0,0,0,0.5),
    0 0 0 1px rgba(56,189,248,0.15),
    0 0 50px rgba(56,189,248,0.08) !important;
}
.ex-card:hover .ex-img-overlay {
  opacity: 1 !important;
}
`;
