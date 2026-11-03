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

export const getCanonicalMuscleGroup = (input) => {
  if (!input) return null;
  const norm = normalizeMuscleGroup(input);
  if (!norm) return null;

  // 1. Coincidencia directa con claves estándar de GRUPOS o con sus etiquetas legibles
  for (const g of GRUPOS) {
    if (norm === normalizeMuscleGroup(g)) return g;
    if (norm === normalizeMuscleGroup(GRUPO_LABELS[g])) return g;
  }

  // 2. Evaluaciones específicas ordenadas estratégicamente para evitar falsos positivos

  // Deltoide Posterior (debe evaluarse ANTES de cualquier deltoide o hombro genérico)
  if (norm.includes("posterior") && (norm.includes("deltoid") || norm.includes("hombro"))) {
    return "deltoide_posterior";
  }
  if (norm === "deltoide posterior" || norm === "deltoides posterior" || norm === "hombro posterior") {
    return "deltoide_posterior";
  }

  // Deltoide Anterior / Frontal / Lateral / Medio
  if ((norm.includes("anterior") || norm.includes("frontal") || norm.includes("lateral") || norm.includes("medio")) && 
      (norm.includes("deltoid") || norm.includes("hombro"))) {
    return "deltoide_anterior";
  }
  if (norm === "deltoide anterior" || norm === "deltoides anterior" || norm === "hombro anterior") {
    return "deltoide_anterior";
  }

  // Hombro / Deltoides genérico (por defecto al no ser posterior)
  if (norm.includes("deltoid") || norm === "hombro" || norm === "hombros" || norm === "shoulder" || norm === "shoulders") {
    return norm.includes("posterior") ? "deltoide_posterior" : "deltoide_anterior";
  }

  // Antebrazo (debe evaluarse ANTES de bíceps para evitar que "brazo" capture "antebrazo")
  if (norm.includes("antebrazo") || norm.includes("forearm")) {
    return "antebrazo";
  }

  // Bíceps
  if (norm.includes("bicep") || norm === "brazo" || norm === "brazos") {
    return "biceps";
  }

  // Tríceps
  if (norm.includes("tricep")) {
    return "triceps";
  }

  // Lumbar / Espalda baja (debe evaluarse ANTES de dorsal para que "espalda baja" no sea dorsal)
  if (norm.includes("lumbar") || norm.includes("lower back") || norm.includes("espalda baja")) {
    return "lumbar";
  }

  // Dorsal / Espalda
  if (norm.includes("dorsal") || norm.includes("espalda") || norm.includes("lat") || norm.includes("back")) {
    return "dorsal";
  }

  // Oblicuos (debe evaluarse ANTES de abdomen)
  if (norm.includes("oblicu")) {
    return "oblicuos";
  }

  // Abdomen / Core
  if (norm.includes("abdomen") || norm.includes("abdomin") || norm.includes("core") || norm === "abs") {
    return "abdomen";
  }

  // Aductor vs Abductor (evitar colisiones de prefijo)
  if (norm.includes("adductor") || norm.includes("aductor")) {
    return "aductor";
  }
  if (norm.includes("abductor") || norm.includes("abduct")) {
    return "abductor";
  }

  // Isquiotibial / Femoral
  if (norm.includes("isquio") || norm.includes("femoral") || norm.includes("hamstring")) {
    return "isquiotibial";
  }

  // Cuádriceps / Pierna
  if (norm.includes("cuadricep") || norm.includes("quad") || norm.includes("pierna") || norm.includes("leg")) {
    return "cuadriceps";
  }

  // Glúteo
  if (norm.includes("glute") || norm.includes("nalga")) {
    return "gluteo";
  }

  // Sóleo (debe evaluarse ANTES de pantorrilla)
  if (norm.includes("soleo")) {
    return "soleo";
  }

  // Pantorrilla / Gemelos
  if (norm.includes("pantorrill") || norm.includes("gemel") || norm.includes("calf") || norm.includes("calves")) {
    return "pantorrilla";
  }

  // Trapecio
  if (norm.includes("trapeci") || norm.includes("trap")) {
    return "trapecio";
  }

  // Pecho
  if (norm.includes("pecho") || norm.includes("pectoral") || norm.includes("chest")) {
    return "pecho";
  }

  // Cuello
  if (norm.includes("cuello") || norm.includes("neck")) {
    return "cuello";
  }

  return null;
};

export const matchMuscleGroup = (exerciseGroup, filterGroup) => {
  if (!filterGroup || filterGroup === "Todos" || filterGroup === "todos") return true;
  if (!exerciseGroup) return false;

  const egCanonical = getCanonicalMuscleGroup(exerciseGroup);
  const fgCanonical = getCanonicalMuscleGroup(filterGroup);

  if (egCanonical && fgCanonical) {
    return egCanonical === fgCanonical;
  }

  const eg = normalizeMuscleGroup(exerciseGroup);
  const fg = normalizeMuscleGroup(filterGroup);

  return eg === fg;
};
