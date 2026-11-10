/**
 * smaeData.js
 * Motor Oficial del Sistema Mexicano de Alimentos Equivalentes (SMAE - 5ª Edición) para FLUX.
 * 100% Local-First (0ms de latencia y $0 MXN de costo de IA).
 *
 * Incluye:
 * 1. Subgrupos oficiales SMAE con aporte energético y macronutrimental promedio por 1 equivalente.
 * 2. Catálogo curado de alimentos equivalentes con porción casera y peso neto en gramos/ml.
 * 3. Algoritmo de Auto-Distribución Inteligente de Equivalentes a partir de la meta de Kcal y Macros.
 * 4. Detector y Motor de Intercambio de Equivalentes en tiempo real para el paciente (escalado proporcional).
 */

export const SMAE_GROUPS = [
  {
    id: "verduras",
    nombre: "Verduras",
    corto: "Verduras",
    icono: "🥦",
    color: "emerald",
    kcal: 25,
    proteina: 2,
    carbohidratos: 4,
    grasas: 0,
  },
  {
    id: "frutas",
    nombre: "Frutas",
    corto: "Frutas",
    icono: "🍎",
    color: "rose",
    kcal: 60,
    proteina: 0,
    carbohidratos: 15,
    grasas: 0,
  },
  {
    id: "cereales_sg",
    nombre: "Cereales y Tubérculos (Sin Grasa)",
    corto: "Cereales s/g",
    icono: "🌾",
    color: "amber",
    kcal: 70,
    proteina: 2,
    carbohidratos: 15,
    grasas: 0,
  },
  {
    id: "cereales_cg",
    nombre: "Cereales y Tubérculos (Con Grasa)",
    corto: "Cereales c/g",
    icono: "🥐",
    color: "orange",
    kcal: 115,
    proteina: 2,
    carbohidratos: 15,
    grasas: 5,
  },
  {
    id: "leguminosas",
    nombre: "Leguminosas",
    corto: "Leguminosas",
    icono: "🫘",
    color: "amber",
    kcal: 120,
    proteina: 8,
    carbohidratos: 20,
    grasas: 1,
  },
  {
    id: "aoa_mb",
    nombre: "AOA Muy Bajo Aporte de Grasa",
    corto: "AOA Muy Bajo",
    icono: "🍗",
    color: "blue",
    kcal: 40,
    proteina: 7,
    carbohidratos: 0,
    grasas: 1,
  },
  {
    id: "aoa_b",
    nombre: "AOA Bajo Aporte de Grasa",
    corto: "AOA Bajo",
    icono: "🥩",
    color: "indigo",
    kcal: 55,
    proteina: 7,
    carbohidratos: 0,
    grasas: 3,
  },
  {
    id: "aoa_m",
    nombre: "AOA Moderado Aporte de Grasa",
    corto: "AOA Moderado",
    icono: "🥚",
    color: "purple",
    kcal: 75,
    proteina: 7,
    carbohidratos: 0,
    grasas: 5,
  },
  {
    id: "aoa_a",
    nombre: "AOA Alto Aporte de Grasa",
    corto: "AOA Alto",
    icono: "🧀",
    color: "violet",
    kcal: 100,
    proteina: 7,
    carbohidratos: 0,
    grasas: 8,
  },
  {
    id: "leche_d",
    nombre: "Leche y Yogur Descremados / Light",
    corto: "Leche Descr.",
    icono: "🥛",
    color: "cyan",
    kcal: 95,
    proteina: 9,
    carbohidratos: 12,
    grasas: 2,
  },
  {
    id: "leche_e",
    nombre: "Leche Entera",
    corto: "Leche Entera",
    icono: "🥛",
    color: "sky",
    kcal: 150,
    proteina: 9,
    carbohidratos: 12,
    grasas: 8,
  },
  {
    id: "grasas_sp",
    nombre: "Aceites y Grasas (Sin Proteína)",
    corto: "Grasas s/p",
    icono: "🥑",
    color: "teal",
    kcal: 45,
    proteina: 0,
    carbohidratos: 0,
    grasas: 5,
  },
  {
    id: "grasas_cp",
    nombre: "Aceites y Grasas con Proteína",
    corto: "Grasas c/p",
    icono: "🥜",
    color: "yellow",
    kcal: 70,
    proteina: 3,
    carbohidratos: 3,
    grasas: 5,
  },
  {
    id: "azucares_sg",
    nombre: "Azúcares (Sin Grasa)",
    corto: "Azúcares s/g",
    icono: "🍯",
    color: "pink",
    kcal: 40,
    proteina: 0,
    carbohidratos: 10,
    grasas: 0,
  },
];

export const SMAE_GROUPS_MAP = Object.fromEntries(SMAE_GROUPS.map((g) => [g.id, g]));

/**
 * Etiquetas rápidas de Restricción Alimentaria (1 clic en Paso 2 de Evaluación, estilo Avena).
 */
export const DIET_RESTRICTION_TAGS = [
  {
    id: "sin_lacteos",
    label: "Sin Lácteos / Deslactosado",
    shortLabel: "Sin Lácteos",
    icon: "🥛",
    tagMatch: "lacteos",
    keywords: ["sin lacteos", "sin lácteos", "deslactosado", "intolerancia a la lactosa", "sin lactosa", "alergia a la leche"],
  },
  {
    id: "sin_gluten",
    label: "Sin Gluten / Trigo",
    shortLabel: "Sin Gluten",
    icon: "🌾",
    tagMatch: "gluten",
    keywords: ["sin gluten", "sin trigo", "celiaco", "celíaco", "celiaquia", "celiaquía"],
  },
  {
    id: "sin_mariscos",
    label: "Sin Pescados / Mariscos",
    shortLabel: "Sin Mariscos",
    icon: "🦐",
    tagMatch: "mariscos",
    keywords: ["sin pescados", "sin mariscos", "alergia a mariscos", "alergia al pescado", "sin pescado"],
  },
  {
    id: "sin_carne_roja",
    label: "Sin Carne Roja / Cerdo",
    shortLabel: "Sin Carne Roja",
    icon: "🥩",
    tagMatch: "carne_roja",
    keywords: ["sin carne roja", "sin cerdo", "sin res", "sin puerco"],
  },
  {
    id: "sin_nueces",
    label: "Sin Nueces / Cacahuates",
    shortLabel: "Sin Nueces",
    icon: "🥜",
    tagMatch: "nueces",
    keywords: ["sin nueces", "sin cacahuates", "sin cacahuate", "alergia a nueces", "alergia al cacahuate", "sin frutos secos"],
  },
  {
    id: "vegetariano",
    label: "Vegetariano",
    shortLabel: "Vegetariano",
    icon: "🌱",
    tagMatch: "animal_meat",
    keywords: ["vegetariano", "vegetariana", "vegano", "vegana"],
  },
];

/**
 * Catálogo de alimentos equivalentes por grupo SMAE (1 Equivalente estándar).
 * Cada elemento define:
 * - id: identificador único
 * - nombre: nombre clínico-culinario claro
 * - cantidadBase: número de unidades en 1 equivalente (ej. 1, 0.5, 2, 30)
 * - unidadBase: unidad casera (ej. "pieza", "taza", "rebanada", "cdita", "g")
 * - gramosBase: peso neto aproximado en gramos o ml de 1 equivalente
 * - keywords: palabras clave para detección automática en las recetas del paciente
 */
export const SMAE_FOODS_BY_GROUP = {
  verduras: [
    { id: "v_brocoli", nombre: "Brócoli cocido", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 92, keywords: ["brocoli", "brócoli"] },
    { id: "v_espinaca", nombre: "Espinaca cruda", cantidadBase: 2, unidadBase: "tazas", gramosBase: 120, keywords: ["espinaca", "espinacas"] },
    { id: "v_calabacita", nombre: "Calabacita picada", cantidadBase: 1, unidadBase: "pieza", gramosBase: 110, keywords: ["calabacita", "calabacitas", "calabacin", "calabacín"] },
    { id: "v_nopales", nombre: "Nopales cocidos", cantidadBase: 1, unidadBase: "taza", gramosBase: 149, keywords: ["nopal", "nopales"] },
    { id: "v_espárragos", nombre: "Espárragos", cantidadBase: 6, unidadBase: "piezas", gramosBase: 90, keywords: ["esparrago", "espárragos", "esparragos"] },
    { id: "v_zanahoria", nombre: "Zanahoria picada o rallada", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 64, keywords: ["zanahoria", "zanahorias"] },
    { id: "v_ejotes", nombre: "Ejotes cocidos", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 63, keywords: ["ejote", "ejotes", "judias verdes"] },
    { id: "v_champinones", nombre: "Champiñones rebanados", cantidadBase: 1, unidadBase: "taza", gramosBase: 96, keywords: ["champiñon", "champiñones", "champinones", "setas"] },
    { id: "v_pepino", nombre: "Pepino con cáscara rebanado", cantidadBase: 1, unidadBase: "taza", gramosBase: 104, keywords: ["pepino", "pepinos"] },
    { id: "v_jitomate", nombre: "Jitomate / Tomate bola", cantidadBase: 1, unidadBase: "pieza", gramosBase: 120, keywords: ["jitomate", "tomate rojo"] },
    { id: "v_pimiento", nombre: "Pimiento morrón picado", cantidadBase: 1, unidadBase: "taza", gramosBase: 92, keywords: ["pimiento", "pimientos", "morron", "morrón"] },
    { id: "v_coliflor", nombre: "Coliflor cocida", cantidadBase: 1, unidadBase: "taza", gramosBase: 125, keywords: ["coliflor"] },
  ],
  frutas: [
    { id: "f_manzana", nombre: "Manzana", cantidadBase: 1, unidadBase: "pieza mediana", gramosBase: 138, keywords: ["manzana", "manzanas"] },
    { id: "f_platano", nombre: "Plátano tabasco", cantidadBase: 0.5, unidadBase: "pieza", gramosBase: 54, keywords: ["platano", "plátano", "banana"] },
    { id: "f_fresas", nombre: "Fresas rebanadas", cantidadBase: 1, unidadBase: "taza", gramosBase: 166, keywords: ["fresa", "fresas"] },
    { id: "f_papaya", nombre: "Papaya picada", cantidadBase: 1, unidadBase: "taza", gramosBase: 140, keywords: ["papaya"] },
    { id: "f_melon", nombre: "Melón picado", cantidadBase: 1, unidadBase: "taza", gramosBase: 160, keywords: ["melon", "melón"] },
    { id: "f_sandia", nombre: "Sandía picada", cantidadBase: 1, unidadBase: "taza", gramosBase: 160, keywords: ["sandia", "sandía"] },
    { id: "f_frutos_rojos", nombre: "Frutos rojos / Arándanos / Moras", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 110, keywords: ["frutos rojos", "arandanos", "arándanos", "zarzamoras", "moras", "blueberries"] },
    { id: "f_naranja", nombre: "Naranja", cantidadBase: 2, unidadBase: "piezas chicas", gramosBase: 152, keywords: ["naranja", "naranjas"] },
    { id: "f_pina", nombre: "Piña picada", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 124, keywords: ["piña", "pina"] },
    { id: "f_mango", nombre: "Mango picado", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, keywords: ["mango"] },
    { id: "f_kiwi", nombre: "Kiwi", cantidadBase: 1.5, unidadBase: "piezas", gramosBase: 114, keywords: ["kiwi", "kiwis"] },
    { id: "f_uvas", nombre: "Uvas", cantidadBase: 18, unidadBase: "piezas", gramosBase: 86, keywords: ["uvas"] },
  ],
  cereales_sg: [
    { id: "c_tortilla_maiz", nombre: "Tortilla de maíz", cantidadBase: 1, unidadBase: "pieza", gramosBase: 30, keywords: ["tortilla de maiz", "tortilla de maíz", "tortillas de maiz", "tortillas de maíz", "tortilla"] },
    { id: "c_avena", nombre: "Avena en hojuelas cruda", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 20, keywords: ["avena en hojuelas", "hojuelas de avena", "avena"] },
    { id: "c_arroz_cocido", nombre: "Arroz blanco o integral cocido", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 70, keywords: ["arroz blanco", "arroz integral", "arroz cocido", "arroz al vapor", "arroz"] },
    { id: "c_pan_integral", nombre: "Pan integral o de masa madre", cantidadBase: 1, unidadBase: "rebanada", gramosBase: 27, keywords: ["pan integral", "pan tostado", "pan de caja", "pan de masa madre", "rebanada de pan", "rebanadas de pan"] },
    { id: "c_tostada_horneada", nombre: "Tostadas de maíz horneadas (Saníssimo / Salmas)", cantidadBase: 2, unidadBase: "piezas", gramosBase: 24, keywords: ["tostada horneada", "tostadas horneadas", "salmas", "sanissimo", "saníssimo"] },
    { id: "c_papa", nombre: "Papa cocida o al horno", cantidadBase: 0.5, unidadBase: "pieza mediana", gramosBase: 68, keywords: ["papa cocida", "papa al horno", "papas cambray", "puré de papa", "papa"] },
    { id: "c_camote", nombre: "Camote cocido o horneado", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 55, keywords: ["camote", "batata"] },
    { id: "c_pasta", nombre: "Pasta o espagueti cocido", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 60, keywords: ["pasta integral", "pasta cocida", "espagueti", "fusilli", "penne", "pasta"] },
    { id: "c_quinoa", nombre: "Quinoa cocida", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 60, keywords: ["quinoa", "quinua"] },
    { id: "c_elote", nombre: "Elote amarillo desgranado", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, keywords: ["elote", "granos de elote", "maiz dulce"] },
    { id: "c_tortilla_harina_int", nombre: "Tortilla de harina integral", cantidadBase: 1, unidadBase: "pieza chica", gramosBase: 25, keywords: ["tortilla de harina"] },
  ],
  cereales_cg: [
    { id: "cg_granola", nombre: "Granola estándar", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 21, keywords: ["granola"] },
    { id: "cg_totopos", nombre: "Totopos de maíz", cantidadBase: 6, unidadBase: "piezas", gramosBase: 24, keywords: ["totopos"] },
  ],
  leguminosas: [
    { id: "l_frijol", nombre: "Frijoles negros o bayos cocidos (de la olla)", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 86, keywords: ["frijoles negros", "frijoles bayos", "frijoles de la olla", "frijoles cocidos", "frijoles", "frijol"] },
    { id: "l_lentejas", nombre: "Lentejas cocidas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 99, keywords: ["lentejas", "lenteja"] },
    { id: "l_garbanzos", nombre: "Garbanzos cocidos", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, keywords: ["garbanzos", "garbanzo", "hummus"] },
    { id: "l_habas", nombre: "Habas o Edamames cocidos", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 85, keywords: ["habas", "edamames"] },
  ],
  aoa_mb: [
    { id: "amb_pechuga_pollo", nombre: "Pechuga de pollo sin piel", cantidadBase: 30, unidadBase: "g", gramosBase: 30, keywords: ["pechuga de pollo", "pollo deshebrado", "fajitas de pollo", "filete de pollo"] },
    { id: "amb_pescado_blanco", nombre: "Filete de pescado blanco (Tilapia / Róbalo / Huachinango)", cantidadBase: 40, unidadBase: "g", gramosBase: 40, keywords: ["filete de pescado", "pescado blanco", "tilapia", "robalo", "róbalo", "huachinango", "merluza"] },
    { id: "amb_atun_agua", nombre: "Atún en lata drenado (en agua)", cantidadBase: 30, unidadBase: "g", gramosBase: 30, keywords: ["atun en agua", "atún en agua", "atun en lata", "atún en lata", "atun drenado", "lata de atún", "lata de atun", "atún", "atun"] },
    { id: "amb_claras", nombre: "Claras de huevo", cantidadBase: 2, unidadBase: "piezas", gramosBase: 66, keywords: ["claras de huevo", "claras"] },
    { id: "amb_camarones", nombre: "Camarones limpios", cantidadBase: 35, unidadBase: "g", gramosBase: 35, keywords: ["camarones", "camaron", "camarón"] },
    { id: "amb_pechuga_pavo", nombre: "Pechuga de pavo horneada (baja en sodio)", cantidadBase: 2, unidadBase: "rebanadas", gramosBase: 42, keywords: ["pechuga de pavo", "jamon de pavo", "jamón de pavo"] },
    { id: "amb_queso_cottage", nombre: "Queso cottage bajo en grasa", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 48, keywords: ["queso cottage", "cottage"] },
  ],
  aoa_b: [
    { id: "ab_bistec_res", nombre: "Bistec o carne de res magra (Sirloin / Falda / Filete)", cantidadBase: 30, unidadBase: "g", gramosBase: 30, keywords: ["bistec de res", "carne de res", "res magra", "sirloin", "arrachera magra", "bistec", "carne molida de res"] },
    { id: "ab_queso_panela", nombre: "Queso panela", cantidadBase: 40, unidadBase: "g", gramosBase: 40, keywords: ["queso panela", "panela"] },
    { id: "ab_salmon", nombre: "Salmón fresco", cantidadBase: 30, unidadBase: "g", gramosBase: 30, keywords: ["salmon", "salmón", "filete de salmón"] },
    { id: "ab_lomo_cerdo", nombre: "Lomo de cerdo magro", cantidadBase: 35, unidadBase: "g", gramosBase: 35, keywords: ["lomo de cerdo", "filete de cerdo"] },
    { id: "ab_queso_oaxaca_light", nombre: "Queso Oaxaca / Mozzarella light", cantidadBase: 30, unidadBase: "g", gramosBase: 30, keywords: ["queso oaxaca", "queso mozzarella", "queso hebra"] },
    { id: "ab_tofu", nombre: "Tofu firme", cantidadBase: 60, unidadBase: "g", gramosBase: 60, keywords: ["tofu"] },
  ],
  aoa_m: [
    { id: "am_huevo_entero", nombre: "Huevo entero fresco", cantidadBase: 1, unidadBase: "pieza", gramosBase: 50, keywords: ["huevo entero", "huevos enteros", "huevos revueltos", "huevos estrellados", "huevo", "huevos"] },
    { id: "am_requeson", nombre: "Requesón / Ricotta", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 45, keywords: ["requeson", "requesón", "ricotta"] },
    { id: "am_muslo_pollo", nombre: "Muslo de pollo sin piel", cantidadBase: 35, unidadBase: "g", gramosBase: 35, keywords: ["muslo de pollo"] },
  ],
  aoa_a: [
    { id: "aa_queso_manchego", nombre: "Queso manchego, gouda o cheddar", cantidadBase: 30, unidadBase: "g", gramosBase: 30, keywords: ["queso manchego", "queso gouda", "queso cheddar"] },
  ],
  leche_d: [
    { id: "ld_yogurt_griego", nombre: "Yogurt griego natural sin azúcar", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 150, keywords: ["yogurt griego", "yogur griego", "yogurt natural", "yogur natural"] },
    { id: "ld_leche_light", nombre: "Leche descremada o deslactosada light", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, keywords: ["leche descremada", "leche light", "leche deslactosada light"] },
    { id: "ld_kefir", nombre: "Kéfir / Jocoque bajo en grasa", cantidadBase: 1, unidadBase: "taza", gramosBase: 200, keywords: ["kefir", "kéfir", "jocoque"] },
  ],
  leche_e: [
    { id: "le_leche_entera", nombre: "Leche entera de vaca", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, keywords: ["leche entera"] },
  ],
  grasas_sp: [
    { id: "gsp_aguacate", nombre: "Aguacate Hass", cantidadBase: 0.33, unidadBase: "pieza", gramosBase: 33, keywords: ["aguacate", "guacamole"] },
    { id: "gsp_aceite_oliva", nombre: "Aceite de oliva extra virgen", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, keywords: ["aceite de oliva", "aceite de aguacate", "aceite vegetal"] },
    { id: "gsp_aceitunas", nombre: "Aceitunas", cantidadBase: 8, unidadBase: "piezas", gramosBase: 32, keywords: ["aceitunas"] },
  ],
  grasas_cp: [
    { id: "gcp_almendras", nombre: "Almendras enteras o fileteadas", cantidadBase: 10, unidadBase: "piezas", gramosBase: 12, keywords: ["almendras", "almendra"] },
    { id: "gcp_nueces", nombre: "Nueces de castilla o pecanas (mitades)", cantidadBase: 7, unidadBase: "mitades", gramosBase: 14, keywords: ["nueces", "nuez"] },
    { id: "gcp_crema_cacahuate", nombre: "Crema de cacahuate o almendra sin azúcar", cantidadBase: 2, unidadBase: "cditas", gramosBase: 10, keywords: ["crema de cacahuate", "mantequilla de mani", "mantequilla de maní", "crema de almendra"] },
    { id: "gcp_cacahuates", nombre: "Cacahuates naturales tostados", cantidadBase: 14, unidadBase: "piezas", gramosBase: 12, keywords: ["cacahuates", "cacahuate", "maní"] },
    { id: "gcp_semillas_chia", nombre: "Semillas de chía, linaza o pepitas", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 10, keywords: ["semillas de chia", "semillas de chía", "chia", "chía", "semillas de linaza", "pepitas", "semillas de calabaza"] },
  ],
  azucares_sg: [
    { id: "az_miel", nombre: "Miel pura de abeja o maple", cantidadBase: 2, unidadBase: "cditas", gramosBase: 10, keywords: ["miel de abeja", "miel pura", "miel"] },
    { id: "az_mermelada", nombre: "Mermelada de fruta", cantidadBase: 2.5, unidadBase: "cditas", gramosBase: 15, keywords: ["mermelada"] },
  ],
};

/**
 * Calcula los totales de Kcal, Proteína, Carbohidratos y Grasas aportados por un mapa de equivalentes SMAE.
 * @param {Object} smaeMap - ej. { verduras: 4, frutas: 2, cereales_sg: 6, aoa_mb: 5, grasas_sp: 3 }
 */
export function calculateSmaeTotals(smaeMap = {}) {
  let kcal = 0;
  let proteina = 0;
  let carbohidratos = 0;
  let grasas = 0;
  let totalEquivalentes = 0;

  for (const grp of SMAE_GROUPS) {
    const eq = Number(smaeMap?.[grp.id]) || 0;
    if (eq > 0) {
      kcal += eq * grp.kcal;
      proteina += eq * grp.proteina;
      carbohidratos += eq * grp.carbohidratos;
      grasas += eq * grp.grasas;
      totalEquivalentes += eq;
    }
  }

  return {
    kcal: Math.round(kcal),
    proteina: Math.round(proteina),
    carbohidratos: Math.round(carbohidratos),
    grasas: Math.round(grasas),
    totalEquivalentes: Math.round(totalEquivalentes * 10) / 10,
  };
}

/**
 * Algoritmo de Auto-Distribución Inteligente SMAE a partir de la meta de Kcal y Macros del paciente.
 * Calcula una distribución clínica equilibrada en pasos de 0.5 equivalentes.
 */
export function autoDistributeSmaeFromMacros({ calorias = 2000, proteina = 140, carbohidratos = 200, grasas = 60 } = {}) {
  const targetKcal = Number(calorias) || 1800;
  const targetProt = Number(proteina) || Math.round((targetKcal * 0.28) / 4);
  const targetCarbs = Number(carbohidratos) || Math.round((targetKcal * 0.45) / 4);
  const targetFat = Number(grasas) || Math.round((targetKcal * 0.27) / 9);

  const roundHalf = (val) => Math.max(0, Math.round(val * 2) / 2);

  // 1. Base de micronutrientes y fibra: Verduras, Frutas, Leche descremada y Leguminosas
  const verduras = targetKcal >= 2200 ? 5 : targetKcal >= 1600 ? 4 : 3;
  const frutas = targetCarbs >= 220 ? 3 : targetCarbs >= 130 ? 2 : 1.5;
  const leche_d = targetKcal >= 1500 ? 1 : 0.5;
  const leguminosas = targetCarbs >= 160 ? 1 : 0.5;

  // 2. Carbohidratos restantes → Cereales sin grasa (15g C por eq)
  const carbsUsed = verduras * 4 + frutas * 15 + leche_d * 12 + leguminosas * 20;
  const remCarbs = Math.max(15, targetCarbs - carbsUsed);
  const cereales_sg = roundHalf(remCarbs / 15);

  // 3. Proteína restante → AOA Muy Bajo (65%) + AOA Bajo (20%) + AOA Moderado / Huevo (15%)
  // Primero reservamos Grasas con Proteína (nueces/almendras = 1 a 2 eq)
  const grasas_cp = targetFat >= 55 ? 2 : 1;
  const protUsed =
    verduras * 2 +
    cereales_sg * 2 +
    leguminosas * 8 +
    leche_d * 9 +
    grasas_cp * 3;

  const remProt = Math.max(21, targetProt - protUsed);
  const totalAoaEq = remProt / 7;
  const aoa_m = totalAoaEq >= 4 ? 2 : 1; // 1 a 2 huevos enteros
  const aoa_b = roundHalf(Math.max(1, (totalAoaEq - aoa_m) * 0.3));
  const aoa_mb = roundHalf(Math.max(1, totalAoaEq - aoa_m - aoa_b));

  // 4. Grasas restantes → Aceites y Grasas sin proteína (Aguacate / Aceite de oliva, 5g G por eq)
  const fatUsed =
    leguminosas * 1 +
    aoa_mb * 1 +
    aoa_b * 3 +
    aoa_m * 5 +
    leche_d * 2 +
    grasas_cp * 5;
  const remFat = Math.max(5, targetFat - fatUsed);
  const grasas_sp = roundHalf(remFat / 5);

  return {
    verduras,
    frutas,
    cereales_sg,
    cereales_cg: 0,
    leguminosas,
    aoa_mb,
    aoa_b,
    aoa_m,
    aoa_a: 0,
    leche_d,
    leche_e: 0,
    grasas_sp,
    grasas_cp,
    azucares_sg: 0,
  };
}

/**
 * Serializa y deserializa el mapa de equivalentes SMAE para guardarlo en la metadata del día.
 * Ejemplo: "verduras=4,frutas=2,cereales_sg=6"
 */
export function serializeSmaeMap(smaeMap = {}) {
  if (!smaeMap || typeof smaeMap !== "object") return "";
  return SMAE_GROUPS.map((g) => {
    const v = Number(smaeMap[g.id]);
    return v > 0 ? `${g.id}=${v}` : null;
  })
    .filter(Boolean)
    .join(",");
}

export function parseSmaeString(rawStr = "") {
  if (!rawStr || typeof rawStr !== "string") return {};
  const map = {};
  rawStr.split(",").forEach((pair) => {
    const [k, v] = pair.split("=");
    if (k && v !== undefined) {
      const num = parseFloat(v);
      if (!isNaN(num) && num > 0) {
        map[k.trim()] = num;
      }
    }
  });
  return map;
}

/**
 * Formatea una porción escalada de un alimento SMAE para el número de equivalentes indicado.
 */
export function formatScaledSmaePortion(food, equivalents = 1) {
  if (!food) return "";
  const eq = Math.max(0.5, Math.round(Number(equivalents || 1) * 2) / 2);
  const gramos = Math.round((food.gramosBase || 30) * eq);

  if (food.unidadBase === "g" || food.unidadBase === "ml") {
    return `${gramos} ${food.unidadBase} de ${food.nombre}`;
  }

  const rawCant = (food.cantidadBase || 1) * eq;
  let cantStr = String(Math.round(rawCant * 100) / 100);
  const fracMap = {
    "0.25": "1/4",
    "0.33": "1/3",
    "0.5": "1/2",
    "0.66": "2/3",
    "0.75": "3/4",
    "1.25": "1 1/4",
    "1.33": "1 1/3",
    "1.5": "1 1/2",
    "1.66": "1 2/3",
    "1.75": "1 3/4",
    "2.5": "2 1/2",
  };
  if (fracMap[cantStr]) cantStr = fracMap[cantStr];

  return `${cantStr} ${food.unidadBase} de ${food.nombre} (${gramos} g)`;
}

const normalizeAccents = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Detecta qué ingredientes del texto de una comida pertenecen al catálogo SMAE,
 * estima el número de equivalentes presentes en la receta y devuelve las opciones de intercambio.
 */
export function detectSwappableIngredientsInMeal(mealText = "") {
  if (!mealText || typeof mealText !== "string") return [];
  const normMeal = normalizeAccents(mealText);
  const detected = [];
  const seenGroupIds = new Set();

  for (const grp of SMAE_GROUPS) {
    const foods = SMAE_FOODS_BY_GROUP[grp.id] || [];
    for (const food of foods) {
      // Ordenar keywords de más específica a más corta
      const sortedKws = [...(food.keywords || [])].sort((a, b) => b.length - a.length);
      let matchedKeyword = null;
      for (const kw of sortedKws) {
        const normKw = normalizeAccents(kw);
        const regex = new RegExp(`(^|[^a-z0-9])${normKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
        if (regex.test(normMeal)) {
          matchedKeyword = kw;
          break;
        }
      }

      if (matchedKeyword && !seenGroupIds.has(`${grp.id}_${food.id}`)) {
        seenGroupIds.add(`${grp.id}_${food.id}`);

        // Intentar estimar equivalentes según gramos o piezas cercanas a la palabra clave en el texto
        let estimatedEq = 1;
        const normKw = normalizeAccents(matchedKeyword);
        const idx = normMeal.indexOf(normKw);
        if (idx >= 0) {
          const contextWindow = normMeal.substring(Math.max(0, idx - 25), Math.min(normMeal.length, idx + normKw.length + 25));
          const gramsMatch = contextWindow.match(/(\d{2,3})\s*(?:g|gr|gramos|ml)\b/);
          if (gramsMatch && food.gramosBase > 0) {
            const gramsFound = parseFloat(gramsMatch[1]);
            if (gramsFound > 0) {
              estimatedEq = Math.max(0.5, Math.min(6, Math.round((gramsFound / food.gramosBase) * 2) / 2));
            }
          } else {
            const unitMatch = contextWindow.match(/\b(\d+(?:\.\d+)?)\s*(?:pieza|piezas|pza|pzas|rebanada|rebanadas|taza|tazas)\b/);
            if (unitMatch && food.cantidadBase > 0) {
              const unitsFound = parseFloat(unitMatch[1]);
              if (unitsFound > 0) {
                estimatedEq = Math.max(0.5, Math.min(6, Math.round((unitsFound / food.cantidadBase) * 2) / 2));
              }
            }
          }
        }

        const alternatives = foods
          .filter((f) => f.id !== food.id)
          .map((alt) => ({
            ...alt,
            porcionEscalada: formatScaledSmaePortion(alt, estimatedEq),
          }));

        detected.push({
          groupId: grp.id,
          groupNombre: grp.nombre,
          groupCorto: grp.corto,
          groupIcono: grp.icono,
          groupKcal: Math.round(grp.kcal * estimatedEq),
          food,
          matchedKeyword,
          equivalents: estimatedEq,
          alternatives,
        });
      }
    }
  }

  return detected;
}

/**
 * Calcula cuántos equivalentes de cada grupo SMAE están presentes en el texto de una comida.
 */
export function estimateMealSmaeMap(mealText = "") {
  const detected = detectSwappableIngredientsInMeal(mealText);
  const map = {};
  for (const item of detected) {
    map[item.groupId] = Math.round(((map[item.groupId] || 0) + (Number(item.equivalents) || 0)) * 10) / 10;
  }
  return map;
}

/**
 * Suma los equivalentes SMAE detectados en todas las comidas (opción principal) de un día.
 */
export function estimateDaySmaeUsage(comidas = []) {
  const usedMap = {};
  if (!Array.isArray(comidas)) return usedMap;
  for (const meal of comidas) {
    const firstOpt = String(meal?.opcion1 || "").split(/\n---OPCION---\n/)[0] || "";
    const mealMap = estimateMealSmaeMap(firstOpt);
    for (const [grpId, eq] of Object.entries(mealMap)) {
      usedMap[grpId] = Math.round(((usedMap[grpId] || 0) + eq) * 10) / 10;
    }
  }
  return usedMap;
}

/**
 * Sugiere dinámicamente el reparto de equivalentes SMAE para una comida específica
 * adaptándose al número libre de tiempos de comida que tenga ese día en FLUX (2, 3, 4, 5...).
 */
export function suggestMealSmaeSplit(daySmaeMap = {}, totalMeals = 3, mealIndex = 0) {
  const n = Math.max(1, Number(totalMeals) || 3);
  const idx = Math.max(0, Math.min(n - 1, Number(mealIndex) || 0));

  // Pesos proporcionales según cuántos tiempos de comida tenga el día
  // Ej. 3 comidas: [35%, 40%, 25%] | 4 comidas: [30%, 15%, 35%, 20%] | 5 comidas: [25%, 12%, 33%, 10%, 20%]
  let weights = Array(n).fill(1 / n);
  if (n === 3) weights = [0.33, 0.38, 0.29];
  else if (n === 4) weights = [0.28, 0.14, 0.34, 0.24];
  else if (n === 5) weights = [0.25, 0.12, 0.33, 0.10, 0.20];

  const roundHalf = (v) => Math.max(0, Math.round(v * 2) / 2);
  const w = weights[idx] || 1 / n;
  const split = {};

  for (const grp of SMAE_GROUPS) {
    const totalEq = Number(daySmaeMap?.[grp.id]) || 0;
    if (totalEq <= 0) continue;
    const suggested = roundHalf(totalEq * w);
    if (suggested > 0) {
      split[grp.id] = suggested;
    }
  }
  return split;
}
