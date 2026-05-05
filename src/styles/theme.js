export const GRUPOS = ["Pecho","Espalda","Piernas","Hombros","Bíceps","Tríceps","Core","Cardio"];
export const TIPOS = ["Empuje","Jale","Sentadilla","Bisagra","Cargada","Aislamiento"];

export const C = {
  // Fondos
  bg:          "#000000",
  surface:     "#040f1c",
  surfaceAlt:  "#060e1a",
  card:        "#071525",
  cardHover:   "#0a1e33",

  // Azules (por defecto, reemplazables vía CSS vars)
  accent:      "var(--brand-accent, #56CCF2)",
  accentMid:   "var(--brand-accent-mid, #2D9CDB)",
  accentDark:  "var(--brand-accent-dark, #1a6fa8)",
  accentDeep:  "var(--brand-accent-deep, #05447A)",
  accentGlow:  "color-mix(in srgb, var(--brand-accent, #56CCF2) 25%, transparent)",

  // Texto
  text:        "#F0F8FF",
  muted:       "#6BA3BF",
  dim:         "#1a3a52",
  faint:       "#0d2137",

  // Bordes
  border:      "#0e2d47",
  borderGlow:  "color-mix(in srgb, var(--brand-accent-mid, #2D9CDB) 25%, transparent)",

  // Gradientes
  grad:        "linear-gradient(135deg, var(--brand-accent, #56CCF2) 0%, var(--brand-accent-mid, #2D9CDB) 50%, var(--brand-accent-deep, #05447A) 100%)",
  gradBtn:     "linear-gradient(135deg, var(--brand-accent, #56CCF2), var(--brand-accent-mid, #2D9CDB))",
  gradCard:    "linear-gradient(145deg, #071525, #040f1c)",
  gradBg:      "radial-gradient(ellipse at 20% 50%, color-mix(in srgb, var(--brand-accent-deep, #05447A) 10%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--brand-accent-mid, #2D9CDB) 6%, transparent) 0%, transparent 50%)",
};

export const css = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

* { box-sizing:border-box; margin:0; padding:0; }

body {
  background:${C.bg};
  color:${C.text};
  font-family:'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.brand-font { font-family:'Rajdhani', sans-serif; }

input, select, textarea {
  background:${C.surface};
  color:${C.text};
  border:1px solid ${C.border};
  border-radius:10px;
  padding:10px 14px;
  font-size:14px;
  width:100%;
  outline:none;
  font-family:'Inter', sans-serif;
  transition: border-color 0.2s, box-shadow 0.2s;
}
input:focus, select:focus, textarea:focus {
  border-color:${C.accentMid};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${C.accentMid} 15%, transparent), 0 0 20px color-mix(in srgb, ${C.accentMid} 6%, transparent);
}
select option { background:${C.card}; }
textarea { resize:vertical; min-height:72px; }

::-webkit-scrollbar { width:4px; height:4px; }
::-webkit-scrollbar-track { background:${C.surface}; }
::-webkit-scrollbar-thumb { background:${C.accentDeep}; border-radius:4px; }
::-webkit-scrollbar-thumb:hover { background:${C.accentMid}; }

@keyframes fadeInUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px color-mix(in srgb, ${C.accentDeep} 38%, transparent); }
  50%       { box-shadow: 0 0 40px color-mix(in srgb, ${C.accentMid} 25%, transparent); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-8px); }
}
@keyframes rotateSlow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.animate-in { animation: fadeInUp 0.4s ease forwards; }
.glow-pulse  { animation: glowPulse 3s ease-in-out infinite; }
.float       { animation: float 4s ease-in-out infinite; }

.card-hover {
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.card-hover:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, ${C.accentMid} 38%, transparent) !important;
  box-shadow: 0 8px 32px color-mix(in srgb, ${C.accentDeep} 25%, transparent) !important;
}

.btn-hover {
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
.btn-hover:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}
.btn-hover:active:not(:disabled) {
  transform: translateY(0);
}

.tab-btn {
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
`;
