/**
 * foodPhotoCatalog.js
 * Catálogo inteligente y banco de platillos de FLUX.
 * Provee una base de datos curada de platillos completos con receta detallada, gramajes,
 * macros de referencia y fotografías profesionales de alta calidad.
 */
import { dbGet, dbPost } from "./supabase";

export const CATEGORIAS_PLATILLOS = [
  { id: "todos", nombre: "Todos", icono: "🍽️" },
  { id: "desayuno", nombre: "Desayunos", icono: "🍳" },
  { id: "comida", nombre: "Comidas", icono: "🍲" },
  { id: "cena", nombre: "Cenas", icono: "🌙" },
  { id: "colacion", nombre: "Snacks", icono: "🍎" }
];

export const CATALOGO_PLATILLOS_BASE = [
  // --- DESAYUNOS ---
  {
    id: "cat_huevo_pan",
    nombre: "Huevos revueltos con jamón de pavo y pan tostado",
    keywords: ["huevo", "huevos", "salchicha", "jamon", "pan", "tostada", "desayuno"],
    categoria: "desayuno",
    calorias: 380,
    proteina: 28,
    carbohidratos: 30,
    grasas: 16,
    foto_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
    texto: "Huevos revueltos con jamón de pavo y pan tostado\n\nPreparar 2 huevos enteros revueltos con 2 rebanadas (40g) de jamón de pavo picado en cubos en sartén con 1 cucharadita de aceite de oliva, sazonando con una pizca de sal y pimienta. Acompañar con 2 rebanadas de pan integral tostado."
  },
  {
    id: "cat_omelette_esp",
    nombre: "Omelette de claras con espinacas y queso panela",
    keywords: ["omelette", "tortilla", "claras", "clara", "espinaca", "espinacas", "panela", "queso"],
    categoria: "desayuno",
    calorias: 290,
    proteina: 32,
    carbohidratos: 12,
    grasas: 11,
    foto_url: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=600&auto=format&fit=crop&q=80",
    texto: "Omelette de claras con espinacas y queso panela\n\nBatir 4 claras de huevo (130g) y verter en sartén caliente con 1 cucharadita de aceite de oliva. Rellenar con 1 taza de espinacas salteadas (60g) y 50g de queso panela en cubos, doblando a la mitad hasta dorar suavemente."
  },
  {
    id: "cat_avena_frutos",
    nombre: "Avena cocida con frutos rojos, plátano y proteína",
    keywords: ["avena", "frutos rojos", "berries", "platano", "crema de cacahuate", "proteina", "scoop", "leche"],
    categoria: "desayuno",
    calorias: 420,
    proteina: 34,
    carbohidratos: 56,
    grasas: 8,
    foto_url: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=600&auto=format&fit=crop&q=80",
    texto: "Avena cocida con frutos rojos, plátano y proteína\n\nCocer 50g de avena en hojuelas con 1 taza (240ml) de leche descremada o de almendras y canela en polvo. Al retirar del fuego integrar 1 scoop (30g) de proteína Whey, decorando con 1/2 plátano en rodajas (60g) y 50g de frutos rojos frescos."
  },
  {
    id: "cat_pancakes_avena",
    nombre: "Hot cakes saludables de avena y plátano con miel",
    keywords: ["hot cakes", "hotcakes", "pancakes", "panqueques", "avena", "miel", "platano"],
    categoria: "desayuno",
    calorias: 390,
    proteina: 22,
    carbohidratos: 60,
    grasas: 7,
    foto_url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&auto=format&fit=crop&q=80",
    texto: "Hot cakes saludables de avena y plátano con miel\n\nLicuar 50g de avena en hojuelas con 1 plátano maduro (100g), 2 claras de huevo y un toque de canela y vainilla. Cocinar en sartén antiadherente a fuego medio formando 3 hot cakes y bañar con 1 cucharada (15g) de miel de abeja pura."
  },
  {
    id: "cat_chilaquiles_fit",
    nombre: "Chilaquiles fit con pollo deshebrado y queso panela",
    keywords: ["chilaquiles", "totopos", "salsa verde", "salsa roja", "pollo", "deshebrado", "panela"],
    categoria: "desayuno",
    calorias: 440,
    proteina: 38,
    carbohidratos: 46,
    grasas: 12,
    foto_url: "https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80",
    texto: "Chilaquiles fit con pollo deshebrado y queso panela\n\nCortar y hornear 3 tortillas de maíz (90g) en triángulos hasta que queden crujientes. Bañar con 1 taza de salsa verde o roja hervida sin grasa, montar 120g de pechuga de pollo deshebrada, 40g de queso panela desmoronado y 1 cucharada de cebolla morada picada."
  },
  {
    id: "cat_tostadas_aguacate",
    nombre: "Tostadas de aguacate con huevo estrellado",
    keywords: ["avocado", "aguacate", "toast", "tostada", "huevo pochado", "pan masa madre"],
    categoria: "desayuno",
    calorias: 360,
    proteina: 18,
    carbohidratos: 32,
    grasas: 18,
    foto_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
    texto: "Tostadas de aguacate con huevo estrellado\n\nTostar 2 rebanadas de pan integral o masa madre (60g). Untar 60g de aguacate maduro machacado con unas gotas de limón y sal, coronando con 2 huevos estrellados a la plancha con una pizca de pimienta negra y hojuelas de chile."
  },

  // --- COMIDAS ---
  {
    id: "cat_pollo_arroz",
    nombre: "Pechuga de pollo a la plancha con arroz blanco y brócoli",
    keywords: ["pollo", "pechuga", "arroz", "arroz blanco", "arroz integral", "brocoli", "ensalada", "verduras"],
    categoria: "comida",
    calorias: 480,
    proteina: 44,
    carbohidratos: 52,
    grasas: 10,
    foto_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    texto: "Pechuga de pollo a la plancha con arroz blanco y brócoli\n\nCocinar 150g de pechuga de pollo sazonada con ajo, sal, pimienta y limón en sartén con 1 cucharadita de aceite de oliva. Servir acompañada de 1 taza (150g) de arroz blanco al vapor y 1 taza (100g) de arbolitos de brócoli al dente."
  },
  {
    id: "cat_picadillo_res",
    nombre: "Picadillo clásico de res con arroz blanco y verduras",
    keywords: ["picadillo", "res", "carne molida", "arroz", "zanahoria", "chile", "guisado"],
    categoria: "comida",
    calorias: 510,
    proteina: 38,
    carbohidratos: 54,
    grasas: 14,
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80",
    texto: "Picadillo clásico de res con arroz blanco y verduras\n\nDorar 150g de carne de res molida magra con 50g de zanahoria en cubos y 1 diente de ajo picado. Agregar 120g de jitomate licuado con cebolla para formar el recaudo y dejar reducir. Servir sobre 1 taza (150g) de arroz blanco cocido."
  },
  {
    id: "cat_carne_papas",
    nombre: "Bistec de res con papas asadas y ensalada fresca",
    keywords: ["carne", "res", "bistec", "filete", "papa", "papas", "camote", "asada", "verduras"],
    categoria: "comida",
    calorias: 490,
    proteina: 42,
    carbohidratos: 45,
    grasas: 15,
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80",
    texto: "Bistec de res con papas asadas y ensalada fresca\n\nAsar 150g de bistec de res sazonado con sal marina y pimienta. Acompañar con 1 papa mediana (150g) horneada o salteada en cubos con páprika y orégano, junto a una ensalada fresca de lechuga, pepino y jitomate con limón."
  },
  {
    id: "cat_salmon_quinoa",
    nombre: "Salmón a la plancha con quinoa y espárragos",
    keywords: ["salmon", "salmón", "pescado", "esparragos", "espárragos", "quinoa", "limon"],
    categoria: "comida",
    calorias: 520,
    proteina: 38,
    carbohidratos: 40,
    grasas: 22,
    foto_url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80",
    texto: "Salmón a la plancha con quinoa y espárragos\n\nSellar 150g de filete de salmón fresco en sartén caliente con sal, pimienta y limón. Servir sobre 3/4 de taza (120g) de quinoa cocida y acompañar con 8 espárragos frescos (100g) asados a la plancha con 1 cucharadita de aceite de oliva."
  },
  {
    id: "cat_pescado_blanco",
    nombre: "Filete de pescado a la veracruzana con arroz blanco",
    keywords: ["pescado", "tilapia", "merluza", "blanco", "ensalada", "arroz", "aguacate", "tomate"],
    categoria: "comida",
    calorias: 430,
    proteina: 36,
    carbohidratos: 48,
    grasas: 9,
    foto_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    texto: "Filete de pescado a la veracruzana con arroz blanco\n\nCocinar 160g de filete de tilapia o pescado blanco en salsa ligera de jitomate guisado con cebolla, pimiento y orégano. Servir acompañado de 1 taza (150g) de arroz blanco caliente y ensalada de hojas verdes con limón."
  },
  {
    id: "cat_tacos_pollo",
    nombre: "Tacos de pollo con pico de gallo y aguacate",
    keywords: ["tacos", "taco", "tortilla", "tortillas", "pico de gallo", "salsa", "pollo deshebrado"],
    categoria: "comida",
    calorias: 460,
    proteina: 38,
    carbohidratos: 44,
    grasas: 13,
    foto_url: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80",
    texto: "Tacos de pollo con pico de gallo y aguacate\n\nCalentar 3 tortillas de maíz (90g). Rellenar con 140g de pechuga de pollo deshebrada sazonada con ajo y comino. Coronar con pico de gallo fresco (jitomate, cebolla, cilantro y limón) y 50g de aguacate en rebanadas con salsa al gusto."
  },
  {
    id: "cat_fajitas_pollo",
    nombre: "Fajitas de pollo con pimientos y tortillas de maíz",
    keywords: ["fajitas", "pollo", "pimientos", "cebolla", "tortillas", "mexicano"],
    categoria: "comida",
    calorias: 470,
    proteina: 40,
    carbohidratos: 45,
    grasas: 12,
    foto_url: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80",
    texto: "Fajitas de pollo con pimientos y tortillas de maíz\n\nSaltear 150g de pechuga de pollo en tiras con 1 pimiento morrón mixto (100g) y 1/2 cebolla blanca fileteada en 1 cucharadita de aceite de oliva con sal y pimienta. Acompañar con 3 tortillas de maíz calientes y salsa."
  },

  // --- CENAS ---
  {
    id: "cat_ensalada_pollo",
    nombre: "Ensalada verde con pechuga de pollo y vinagreta ligera",
    keywords: ["ensalada", "pollo", "lechuga", "pepino", "jitomate", "cena", "ligera"],
    categoria: "cena",
    calorias: 340,
    proteina: 38,
    carbohidratos: 14,
    grasas: 14,
    foto_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    texto: "Ensalada verde con pechuga de pollo y vinagreta ligera\n\nMezclar 2 tazas de lechuga romana picada con 1 jitomate, 1/2 pepino en rodajas y 40g de aguacate. Agregar 140g de pechuga de pollo a la plancha en tiras y aderezar con vinagre de manzana, limón y 1 cucharadita de aceite de oliva."
  },
  {
    id: "cat_crema_brocoli_pollo",
    nombre: "Crema campirana de brócoli con pollo deshebrado",
    keywords: ["crema", "brocoli", "pollo", "papa", "sopa", "cena", "caliente"],
    categoria: "cena",
    calorias: 360,
    proteina: 35,
    carbohidratos: 28,
    grasas: 9,
    foto_url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80",
    texto: "Crema campirana de brócoli con pollo deshebrado\n\nCocer 150g de brócoli con 1/2 papa (70g) y licuar con 1/2 taza de leche descremada y ajo sofrito hasta obtener textura sedosa. Servir caliente montando 120g de pechuga de pollo deshebrada con sal y pimienta al gusto."
  },
  {
    id: "cat_quesadillas_oaxaca",
    nombre: "Quesadillas de maíz con queso Oaxaca y champiñones",
    keywords: ["quesadilla", "quesadillas", "queso", "oaxaca", "champinones", "tortillas", "cena"],
    categoria: "cena",
    calorias: 380,
    proteina: 22,
    carbohidratos: 40,
    grasas: 15,
    foto_url: "https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80",
    texto: "Quesadillas de maíz con queso Oaxaca y champiñones\n\nSaltear 1 taza de champiñones rebanados (80g) con ajo y orégano. Rellenar 2 tortillas de maíz (60g) con los champiñones y 60g de queso Oaxaca deshebrado, dorando en comal a fuego bajo hasta derretir."
  },
  {
    id: "cat_sandwich_pavo",
    nombre: "Sándwich de pechuga de pavo con queso panela y aguacate",
    keywords: ["sandwich", "sándwich", "pavo", "pan integral", "aguacate", "lechuga", "jitomate", "panela"],
    categoria: "cena",
    calorias: 360,
    proteina: 28,
    carbohidratos: 34,
    grasas: 12,
    foto_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
    texto: "Sándwich de pechuga de pavo con queso panela y aguacate\n\nArmar un sándwich con 2 rebanadas de pan integral de caja (60g), 4 rebanadas de jamón de pavo (80g), 40g de queso panela rebanado, rodajas de jitomate, hojas de lechuga, mostaza Dijon y 30g de aguacate."
  },

  // --- COLACIONES / SNACKS ---
  {
    id: "cat_smoothie_prot",
    nombre: "Batido de proteína con plátano y leche de almendras",
    keywords: ["licuado", "batido", "smoothie", "proteina", "scoop", "platano", "leche", "almendras"],
    categoria: "colacion",
    calorias: 250,
    proteina: 27,
    carbohidratos: 30,
    grasas: 3,
    foto_url: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
    texto: "Batido de proteína con plátano y leche de almendras\n\nLicuar 1 scoop (30g) de proteína Whey con 1 plátano mediano (100g), 250ml de leche de almendras sin azúcar, canela en polvo y cubos de hielo hasta lograr una consistencia espumosa y fría."
  },
  {
    id: "cat_yogurt_griego",
    nombre: "Yogur griego con granola, almendras y frutos rojos",
    keywords: ["yogur", "yogurt", "griego", "granola", "almendras", "nueces", "fresas", "berries"],
    categoria: "colacion",
    calorias: 280,
    proteina: 20,
    carbohidratos: 28,
    grasas: 9,
    foto_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80",
    texto: "Yogur griego con granola, almendras y frutos rojos\n\nServir 150g de yogurt griego natural sin azúcar en un tazón. Agregar 30g de granola artesanal reducida en azúcar, 10 almendras fileteadas (12g) y 50g de fresas o arándanos frescos."
  },
  {
    id: "cat_manzana_cacahuate",
    nombre: "Manzana en gajos con crema de cacahuate natural",
    keywords: ["manzana", "cacahuate", "peanut butter", "snack", "colacion"],
    categoria: "colacion",
    calorias: 210,
    proteina: 6,
    carbohidratos: 25,
    grasas: 10,
    foto_url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&auto=format&fit=crop&q=80",
    texto: "Manzana en gajos con crema de cacahuate natural\n\nCortar 1 manzana mediana (150g) en gajos delgados y espolvorear con una pizca de canela en polvo. Acompañar para untar con 1 cucharada sopera colmada (20g) de crema de cacahuate 100% natural sin azúcar añadida."
  },
  {
    id: "cat_cottage_fruta",
    nombre: "Bowl de queso cottage con papaya y nueces",
    keywords: ["fruta", "papaya", "melon", "manzana", "cottage", "requeson", "miel"],
    categoria: "colacion",
    calorias: 240,
    proteina: 18,
    carbohidratos: 22,
    grasas: 8,
    foto_url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&auto=format&fit=crop&q=80",
    texto: "Bowl de queso cottage con papaya y nueces\n\nServir 120g de queso cottage bajo en grasa en un tazón, acompañado de 1 taza (140g) de papaya picada en cubos y 15g de nueces de castilla picadas con una pizca de canela."
  }
];

// Limpieza y normalización de texto para matching
function normalizeText(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Busca platillos en el catálogo filtrando por texto y categoría.
 */
export function buscarPlatillosCatalogo(query = "", categoria = "todos") {
  const q = normalizeText(query);
  return CATALOGO_PLATILLOS_BASE.filter(item => {
    const coincideCat = categoria === "todos" || item.categoria === categoria;
    if (!coincideCat) return false;
    if (!q) return true;
    const nombreNorm = normalizeText(item.nombre);
    const kwNorm = (item.keywords || []).map(k => normalizeText(k)).join(" ");
    return nombreNorm.includes(q) || kwNorm.includes(q);
  });
}

/**
 * Busca si ya existe una foto para el platillo en el catálogo de FLUX
 * Compara por coincidencia semántica de palabras clave de ingredientes.
 */
export async function searchDishPhotoInCatalog(dishText, customKeywords = []) {
  if (!dishText && customKeywords.length === 0) return null;
  const normalized = normalizeText(dishText);
  const words = new Set([
    ...normalized.split(/\s+/).filter(w => w.length > 2),
    ...customKeywords.map(k => normalizeText(k)),
  ]);

  let bestMatch = null;
  let maxScore = 0;

  // 1. Evaluar en la biblioteca base de FLUX
  for (const item of CATALOGO_PLATILLOS_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      const normKw = normalizeText(kw);
      if (words.has(normKw) || normalized.includes(normKw)) {
        score += 1.5;
      }
    }
    if (score > maxScore && score >= 2) {
      maxScore = score;
      bestMatch = item;
    }
  }

  // 2. Intentar buscar en la base de datos de Supabase si hay coincidencia adicional guardada
  try {
    const remote = await dbGet("catalogo_platillos?limit=50").catch(() => []);
    if (Array.isArray(remote) && remote.length > 0) {
      for (const item of remote) {
        let score = 0;
        const itemKeywords = Array.isArray(item.palabras_clave) ? item.palabras_clave : (item.palabras_clave || "").split(",");
        for (const kw of itemKeywords) {
          const normKw = normalizeText(kw);
          if (normKw && (words.has(normKw) || normalized.includes(normKw))) {
            score += 1.8;
          }
        }
        if (score > maxScore && score >= 2) {
          maxScore = score;
          bestMatch = {
            id: item.id,
            nombre: item.nombre_normalizado || item.nombre,
            foto_url: item.foto_url,
          };
        }
      }
    }
  } catch {}

  return bestMatch ? bestMatch.foto_url : null;
}

/**
 * Guarda o registra una foto en el catálogo compartido de FLUX para que otros
 * nutriólogos o comidas la puedan reutilizar en el futuro.
 */
export async function registerDishPhotoInCatalog(dishName, keywords = [], photoUrl) {
  if (!dishName || !photoUrl) return;
  try {
    const payload = {
      nombre_normalizado: dishName.trim(),
      palabras_clave: keywords.length > 0 ? keywords : dishName.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2),
      foto_url: photoUrl,
    };
    await dbPost("catalogo_platillos", payload).catch(() => {});
  } catch {}
}
