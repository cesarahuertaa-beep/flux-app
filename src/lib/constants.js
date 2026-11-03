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
  
export const GRUPOS_MUSCULARES = [
  { id: "pecho",              nombre: "Pecho" },
  { id: "dorsal",             nombre: "Dorsal (Espalda)" },
  { id: "deltoide_anterior",  nombre: "Deltoide anterior (Hombro)" },
  { id: "deltoide_posterior", nombre: "Deltoide posterior (Hombro)" },
  { id: "biceps",             nombre: "Bíceps" },
  { id: "triceps",            nombre: "Tríceps" },
  { id: "antebrazo",          nombre: "Antebrazo" },
  { id: "cuadriceps",         nombre: "Cuádriceps" },
  { id: "isquiotibial",       nombre: "Isquiotibial" },
  { id: "gluteo",             nombre: "Glúteo" },
  { id: "pantorrilla",        nombre: "Pantorrilla" },
  { id: "soleo",              nombre: "Sóleo" },
  { id: "aductor",            nombre: "Aductor" },
  { id: "abductor",           nombre: "Abductor" },
  { id: "trapecio",           nombre: "Trapecio" },
  { id: "lumbar",             nombre: "Lumbar" },
  { id: "abdomen",            nombre: "Abdomen" },
  { id: "oblicuos",           nombre: "Oblicuos" },
  { id: "cuello",             nombre: "Cuello" }
];

export const GRUPOS = GRUPOS_MUSCULARES.map(g => g.id);
export const TIPOS = ["fuerza", "hipertrofia", "resistencia", "potencia", "flexibilidad", "cardio"];

export const GRUPO_LABELS = Object.fromEntries(
  GRUPOS_MUSCULARES.map(g => [g.id, g.nombre])
);

export const normalizeMuscleGroup = (g) => {
  if (!g) return "";
  return String(g)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s-]+/g, "_")
    .trim();
};

export const getCanonicalMuscleGroup = (input) => {
  if (!input) return null;
  const norm = normalizeMuscleGroup(input);
  if (!norm) return null;
  const found = GRUPOS_MUSCULARES.find(
    g => g.id === norm || normalizeMuscleGroup(g.nombre) === norm
  );
  return found ? found.id : null;
};

export const matchMuscleGroup = (exerciseGroup, filterGroup) => {
  if (!filterGroup || filterGroup === "Todos" || filterGroup === "todos") return true;
  if (!exerciseGroup) return false;
  return normalizeMuscleGroup(exerciseGroup) === normalizeMuscleGroup(filterGroup);
};
