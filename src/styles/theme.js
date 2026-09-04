export const GRUPOS = ["Pecho","Espalda","Piernas","Hombros","Bíceps","Tríceps","Core","Cardio"];
export const TIPOS  = ["Empuje","Jale","Sentadilla","Bisagra","Cargada","Aislamiento"];

// Legacy constants mapping to new CSS variables to avoid breaking existing imports 
// while we migrate to pure Tailwind classes.
export const C = {
  bg:          "var(--background)",
  surface:     "var(--card)",
  surfaceAlt:  "var(--muted)",
  card:        "var(--card)",
  cardHover:   "var(--card)",
  faint:       "var(--muted)",
  accent:      "var(--brand-primary)",
  accentMid:   "var(--brand-primary-hover)",
  accentDark:  "var(--brand-primary-hover)",
  accentDeep:  "var(--brand-primary-hover)",
  accentGlow:  "var(--brand-secondary)",
  text:        "var(--foreground)",
  muted:       "var(--muted-foreground)",
  mutedLight:  "var(--muted-foreground)",
  dim:         "var(--muted-foreground)",
  border:      "var(--border)",
  borderMid:   "var(--border)",
  borderGlow:  "var(--border)",
  gradBtn:     "var(--brand-primary)",
  gradCard:    "var(--card)",
  gradBg:      "var(--background)",
  gradAccent:  "var(--brand-primary)",
};

// Legacy css wrapper to avoid crashing Login/Admin/Cliente during transition.
export const css = `
  /* Los estilos globales ahora viven en src/index.css y usan Tailwind v4 */
  
  /* Retenemos algunas animaciones legacy por si algún componente antiguo las sigue usando */
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
  
  .animate-in       { animation: fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
  .animate-in-scale { animation: fadeInScale 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
  .float            { animation: float 6s ease-in-out infinite; }
`;