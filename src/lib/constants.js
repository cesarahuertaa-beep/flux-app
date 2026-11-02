export const PAISES = [
  "México",
  "Estados Unidos",
  "Colombia",
  "Argentina",
  "España",
  "Perú",
  "Chile",
  "Ecuador",
  "Guatemala",
  "Cuba",
  "Bolivia",
  "República Dominicana",
  "Honduras",
  "El Salvador",
  "Paraguay",
  "Nicaragua",
  "Costa Rica",
  "Puerto Rico",
  "Panamá",
  "Uruguay",
  "Otro"
];

export const ESTADOS_MEXICO = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas"
];
  
export const GRUPOS = ["pecho", "abdomen", "oblicuos", "deltoide_anterior", "deltoide_posterior", "trapecio", "dorsal", "lumbar", "biceps", "triceps", "antebrazo", "gluteo", "cuadriceps", "isquiotibial", "pantorrilla", "aductor", "abductor", "soleo", "cuello"];
export const TIPOS = ["fuerza", "hipertrofia", "resistencia", "potencia", "flexibilidad", "cardio"];

export const GRUPO_LABELS = {
  pecho: "Pecho",
  abdomen: "Abdomen",
  oblicuos: "Oblicuos",
  deltoide_anterior: "Deltoide anterior (Hombro)",
  deltoide_posterior: "Deltoide posterior (Hombro)",
  trapecio: "Trapecio",
  dorsal: "Dorsal (Espalda)",
  lumbar: "Lumbar",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazo: "Antebrazo",
  gluteo: "Glúteo",
  cuadriceps: "Cuádriceps",
  isquiotibial: "Isquiotibial",
  pantorrilla: "Pantorrilla",
  aductor: "Aductor",
  abductor: "Abductor",
  soleo: "Sóleo",
  cuello: "Cuello"
};

export const normalizeMuscleGroup = (g) => {
  if (!g) return "";
  return String(g)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s-]+/g, " ")
    .trim();
};

export const matchMuscleGroup = (exerciseGroup, filterGroup) => {
  if (!filterGroup || filterGroup === "Todos" || filterGroup === "todos") return true;
  if (!exerciseGroup) return false;
  
  const eg = normalizeMuscleGroup(exerciseGroup);
  const fg = normalizeMuscleGroup(filterGroup);
  
  if (eg === fg) return true;
  if (eg.includes(fg) || fg.includes(eg)) return true;

  const ALIASES = {
    pecho: ["pecho", "pectoral", "pectorales", "chest"],
    dorsal: ["dorsal", "dorsales", "espalda", "back", "lats"],
    cuadriceps: ["cuadriceps", "cuadricep", "pierna", "piernas", "leg", "legs", "quads"],
    isquiotibial: ["isquiotibial", "isquiotibiales", "isquio", "isquios", "femoral", "femorales", "hamstrings"],
    gluteo: ["gluteo", "gluteos", "glutes", "nalga"],
    deltoide_anterior: ["deltoide anterior", "deltoides anterior", "deltoide", "deltoides", "hombro", "hombros", "shoulder", "shoulders"],
    deltoide_posterior: ["deltoide posterior", "deltoides posterior", "hombro posterior"],
    abdomen: ["abdomen", "abdominal", "abdominales", "core", "abs"],
    oblicuos: ["oblicuo", "oblicuos"],
    pantorrilla: ["pantorrilla", "pantorrillas", "gemelo", "gemelos", "calves", "calf"],
    biceps: ["biceps", "bicep", "brazo", "brazos"],
    triceps: ["triceps", "tricep"],
    antebrazo: ["antebrazo", "antebrazos", "forearm"],
    trapecio: ["trapecio", "trapecios", "traps"],
    lumbar: ["lumbar", "lumbares", "lower back"],
    aductor: ["aductor", "aductores", "adductor"],
    abductor: ["abductor", "abductores", "abductor"],
    soleo: ["soleo", "soleos"],
    cuello: ["cuello", "neck"],
  };

  for (const [key, aliases] of Object.entries(ALIASES)) {
    const keyNorm = normalizeMuscleGroup(key);
    const matchesFilter = fg === keyNorm || aliases.some(a => normalizeMuscleGroup(a) === fg);
    if (matchesFilter) {
      if (aliases.some(a => eg === normalizeMuscleGroup(a) || eg.includes(normalizeMuscleGroup(a)))) {
        return true;
      }
    }
  }

  return false;
};
