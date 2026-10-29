/**
 * foodPhotoCatalog.js
 * Catálogo inteligente y banco compartido de platillos de FLUX.
 * Permite reutilizar fotografías profesionales de platillos existentes (costo $0, 0 ms)
 * mediante matching semántico y almacenar nuevas imágenes generadas o subidas por nutriólogos.
 */
import { dbGet, dbPost } from "./supabase";

export const CATALOGO_PLATILLOS_BASE = [
  {
    id: "cat_huevo_pan",
    nombre: "Huevos revueltos o estrellados con jamón/salchicha y pan",
    keywords: ["huevo", "huevos", "salchicha", "salchichas", "jamon", "pan", "tostada", "desayuno"],
    categoria: "desayuno",
    foto_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_omelette_esp",
    nombre: "Omelette de claras con espinacas y queso panela",
    keywords: ["omelette", "tortilla", "claras", "clara", "espinaca", "espinacas", "panela", "queso"],
    categoria: "desayuno",
    foto_url: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_avena_frutos",
    nombre: "Avena cocida con frutos rojos, plátano y proteína",
    keywords: ["avena", "frutos rojos", "berries", "platano", "crema de cacahuate", "proteina", "scoop", "leche"],
    categoria: "desayuno",
    foto_url: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_pancakes_avena",
    nombre: "Hot cakes / Pancakes saludables de avena y plátano",
    keywords: ["hot cakes", "hotcakes", "pancakes", "panqueques", "avena", "miel", "platano"],
    categoria: "desayuno",
    foto_url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_pollo_arroz",
    nombre: "Pechuga de pollo a la plancha con arroz blanco y verduras",
    keywords: ["pollo", "pechuga", "arroz", "arroz blanco", "arroz integral", "brocoli", "ensalada", "verduras"],
    categoria: "comida",
    foto_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_carne_papas",
    nombre: "Carne de res magra / Bistec con papas y vegetales",
    keywords: ["carne", "res", "bistec", "filete", "papa", "papas", "camote", "asada", "verduras"],
    categoria: "comida",
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_salmon_quinoa",
    nombre: "Filete de salmón a la plancha con espárragos o quinoa",
    keywords: ["salmon", "salmón", "pescado", "esparragos", "espárragos", "quinoa", "limon"],
    categoria: "comida",
    foto_url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_pescado_blanco",
    nombre: "Filete de pescado blanco a la plancha con ensalada",
    keywords: ["pescado", "tilapia", "merluza", "blanco", "ensalada", "arroz", "aguacate"],
    categoria: "comida",
    foto_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_ensalada_atun",
    nombre: "Ensalada o bowl de atún con tostadas de maíz y aguacate",
    keywords: ["atun", "atún", "tostadas", "tostada", "maiz", "aguacate", "mayonesa", "jitomate"],
    categoria: "comida",
    foto_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_tacos_fit",
    nombre: "Tacos de pollo o carne en tortilla de maíz con pico de gallo",
    keywords: ["tacos", "taco", "tortilla", "tortillas", "pico de gallo", "salsa", "pollo deshebrado"],
    categoria: "comida",
    foto_url: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_smoothie_prot",
    nombre: "Batido / Licuado de proteína con plátano y leche",
    keywords: ["licuado", "batido", "smoothie", "proteina", "scoop", "platano", "leche", "almendras"],
    categoria: "colacion",
    foto_url: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_yogurt_griego",
    nombre: "Yogur griego con granola, almendras y frutos secos",
    keywords: ["yogur", "yogurt", "griego", "granola", "almendras", "nueces", "fresas", "berries"],
    categoria: "colacion",
    foto_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_sandwich_pavo",
    nombre: "Sándwich de pechuga de pavo con aguacate en pan integral",
    keywords: ["sandwich", "sándwich", "pavo", "pan integral", "aguacate", "lechuga", "jitomate"],
    categoria: "colacion",
    foto_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_chilaquiles_fit",
    nombre: "Chilaquiles fit con pollo deshebrado y queso panela",
    keywords: ["chilaquiles", "totopos", "salsa verde", "salsa roja", "pollo", "deshebrado", "panela"],
    categoria: "desayuno",
    foto_url: "https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_bowl_fruta",
    nombre: "Bowl de fruta picada con queso cottage o requesón",
    keywords: ["fruta", "papaya", "melon", "manzana", "cottage", "requeson", "miel"],
    categoria: "colacion",
    foto_url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "cat_tostadas_aguacate",
    nombre: "Tostadas de aguacate (avocado toast) con huevo",
    keywords: ["avocado", "aguacate", "toast", "tostada", "huevo pochado", "pan masa madre"],
    categoria: "desayuno",
    foto_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
  },
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
