/**
 * Catálogo Maestro de Ingredientes Culinarios de FLUX
 * Contiene ingredientes universales y de la gastronomía cotidiana (México y Latinoamérica).
 * Cada ingrediente cuenta con imagen transparente (TheMealDB CDN o fallback), categoría y nombre normalizado.
 */

export const CATEGORIAS_INGREDIENTES = [
  { id: "todos", nombre: "Todos", icono: "🍽️" },
  { id: "proteinas", nombre: "Carnes y Proteínas", icono: "🥩" },
  { id: "verduras", nombre: "Verduras y Hortalizas", icono: "🥦" },
  { id: "frutas", nombre: "Frutas", icono: "🍎" },
  { id: "cereales", nombre: "Granos y Cereales", icono: "🍚" },
  { id: "lacteos", nombre: "Lácteos y Quesos", icono: "🧀" },
  { id: "grasas", nombre: "Grasas y Semillas", icono: "🥑" },
  { id: "legumbres", nombre: "Legumbres", icono: "🫘" },
  { id: "especias", nombre: "Especias y Salsas", icono: "🧂" }
];

const img = (name) => `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name)}.png`;

export const INGREDIENTES_CATALOGO = [
  // --- CARNES Y PROTEÍNAS ---
  { id: "tortilla-maiz", nombre: "Tortilla de maíz", categoria: "cereales", foto: img("Tortillas") },
  { id: "tortilla-harina", nombre: "Tortilla de harina", categoria: "cereales", foto: img("Flour") },
  { id: "carne-res-molida", nombre: "Carne de res molida", categoria: "proteinas", foto: img("Minced Beef") },
  { id: "bistec-res", nombre: "Bistec de res", categoria: "proteinas", foto: img("Beef") },
  { id: "pechuga-pollo", nombre: "Pechuga de pollo", categoria: "proteinas", foto: img("Chicken Breast") },
  { id: "muslo-pollo", nombre: "Muslo de pollo", categoria: "proteinas", foto: img("Chicken Thighs") },
  { id: "pollo-deshebrado", nombre: "Pollo deshebrado", categoria: "proteinas", foto: img("Chicken") },
  { id: "claras-huevo", nombre: "Claras de huevo", categoria: "proteinas", foto: img("Egg White") },
  { id: "huevo-entero", nombre: "Huevo entero", categoria: "proteinas", foto: img("Eggs") },
  { id: "salmon", nombre: "Salmón", categoria: "proteinas", foto: img("Salmon") },
  { id: "atun-lata", nombre: "Atún en lata (agua)", categoria: "proteinas", foto: img("Tuna") },
  { id: "filete-pescado", nombre: "Filete de pescado blanco / Tilapia", categoria: "proteinas", foto: img("Fish") },
  { id: "camarones", nombre: "Camarones", categoria: "proteinas", foto: img("Prawns") },
  { id: "lomo-cerdo", nombre: "Lomo de cerdo magro", categoria: "proteinas", foto: img("Pork") },
  { id: "jamon-pavo", nombre: "Jamón de pavo", categoria: "proteinas", foto: img("Ham") },
  { id: "pechuga-pavo", nombre: "Pechuga de pavo", categoria: "proteinas", foto: img("Turkey") },
  { id: "tofu", nombre: "Tofu firme", categoria: "proteinas", foto: img("Tofu") },
  { id: "proteina-whey", nombre: "Proteína Whey en polvo", categoria: "proteinas", foto: img("Milk") },

  // --- VERDURAS Y HORTALIZAS ---
  { id: "chile-chipotle", nombre: "Chile chipotle", categoria: "verduras", foto: img("Chilli Powder") },
  { id: "chile-serrano", nombre: "Chile serrano", categoria: "verduras", foto: img("Green Chilli") },
  { id: "chile-jalapeno", nombre: "Chile jalapeño", categoria: "verduras", foto: img("Jalapeno") },
  { id: "chile-poblano", nombre: "Chile poblano", categoria: "verduras", foto: img("Green Pepper") },
  { id: "jitomate", nombre: "Jitomate / Tomate rojo", categoria: "verduras", foto: img("Tomato") },
  { id: "tomate-verde", nombre: "Tomate verde / Tomatillo", categoria: "verduras", foto: img("Tomatoes") },
  { id: "cebolla-blanca", nombre: "Cebolla blanca", categoria: "verduras", foto: img("Onion") },
  { id: "cebolla-morada", nombre: "Cebolla morada", categoria: "verduras", foto: img("Red Onion") },
  { id: "ajo", nombre: "Ajo", categoria: "verduras", foto: img("Garlic") },
  { id: "espinacas", nombre: "Espinacas", categoria: "verduras", foto: img("Spinach") },
  { id: "brocoli", nombre: "Brócoli", categoria: "verduras", foto: img("Broccoli") },
  { id: "calabacita", nombre: "Calabacita / Calabacín", categoria: "verduras", foto: img("Courgettes") },
  { id: "zanahoria", nombre: "Zanahoria", categoria: "verduras", foto: img("Carrots") },
  { id: "pepino", nombre: "Pepino", categoria: "verduras", foto: img("Cucumber") },
  { id: "pimiento-rojo", nombre: "Pimiento morrón rojo", categoria: "verduras", foto: img("Red Pepper") },
  { id: "pimiento-verde", nombre: "Pimiento morrón verde", categoria: "verduras", foto: img("Green Pepper") },
  { id: "champinones", nombre: "Champiñones / Setas", categoria: "verduras", foto: img("Mushrooms") },
  { id: "esparragos", nombre: "Espárragos", categoria: "verduras", foto: img("Asparagus") },
  { id: "nopal", nombre: "Nopal", categoria: "verduras", foto: img("Spring Onions") },
  { id: "apio", nombre: "Apio", categoria: "verduras", foto: img("Celery") },
  { id: "lechuga", nombre: "Lechuga romana / orejona", categoria: "verduras", foto: img("Lettuce") },
  { id: "coliflor", nombre: "Coliflor", categoria: "verduras", foto: img("Cauliflower") },
  { id: "betabel", nombre: "Betabel / Remolacha", categoria: "verduras", foto: img("Beetroot") },
  { id: "ejotes", nombre: "Ejotes / Judías verdes", categoria: "verduras", foto: img("Green Beans") },
  { id: "cilantro", nombre: "Cilantro fresco", categoria: "verduras", foto: img("Coriander") },
  { id: "perejil", nombre: "Perejil fresco", categoria: "verduras", foto: img("Parsley") },

  // --- FRUTAS ---
  { id: "aguacate", nombre: "Aguacate", categoria: "grasas", foto: img("Avocado") },
  { id: "limon", nombre: "Limón fresco", categoria: "frutas", foto: img("Lemon") },
  { id: "platano", nombre: "Plátano / Banana", categoria: "frutas", foto: img("Banana") },
  { id: "manzana", nombre: "Manzana", categoria: "frutas", foto: img("Apple") },
  { id: "fresas", nombre: "Fresas", categoria: "frutas", foto: img("Strawberries") },
  { id: "frutos-rojos", nombre: "Frutos rojos / Arándanos", categoria: "frutas", foto: img("Blueberries") },
  { id: "naranja", nombre: "Naranja", categoria: "frutas", foto: img("Orange") },
  { id: "pina", nombre: "Piña", categoria: "frutas", foto: img("Pineapple") },
  { id: "mango", nombre: "Mango", categoria: "frutas", foto: img("Mango") },
  { id: "papaya", nombre: "Papaya", categoria: "frutas", foto: img("Papaya") },
  { id: "sandia", nombre: "Sandía", categoria: "frutas", foto: img("Watermelon") },
  { id: "melon", nombre: "Melón", categoria: "frutas", foto: img("Melon") },
  { id: "kiwi", nombre: "Kiwi", categoria: "frutas", foto: img("Kiwi") },
  { id: "uvas", nombre: "Uvas", categoria: "frutas", foto: img("Grapes") },
  { id: "toronja", nombre: "Toronja / Pomelo", categoria: "frutas", foto: img("Grapefruit") },

  // --- GRANOS, CEREALES Y TUBÉRCULOS ---
  { id: "avena", nombre: "Avena en hojuelas", categoria: "cereales", foto: img("Oats") },
  { id: "arroz-blanco", nombre: "Arroz blanco", categoria: "cereales", foto: img("Rice") },
  { id: "arroz-integral", nombre: "Arroz integral", categoria: "cereales", foto: img("Brown Rice") },
  { id: "papa", nombre: "Papa / Patata", categoria: "cereales", foto: img("Potatoes") },
  { id: "camote", nombre: "Camote / Batata", categoria: "cereales", foto: img("Sweet Potatoes") },
  { id: "pan-integral", nombre: "Pan integral de caja", categoria: "cereales", foto: img("Bread") },
  { id: "pan-masa-madre", nombre: "Pan de masa madre", categoria: "cereales", foto: img("Bread") },
  { id: "pasta-integral", nombre: "Pasta / Espagueti", categoria: "cereales", foto: img("Spaghetti") },
  { id: "quinoa", nombre: "Quinoa", categoria: "cereales", foto: img("Quinoa") },
  { id: "tostadas-maiz", nombre: "Tostadas horneadas de maíz", categoria: "cereales", foto: img("Tortillas") },
  { id: "elote", nombre: "Elote / Maíz desgranado", categoria: "cereales", foto: img("Sweetcorn") },
  { id: "bagel-integral", nombre: "Bagel integral", categoria: "cereales", foto: img("Bagel") },

  // --- LÁCTEOS Y QUESOS ---
  { id: "queso-panela", nombre: "Queso panela", categoria: "lacteos", foto: img("Cheese") },
  { id: "queso-cottage", nombre: "Queso cottage bajo en grasa", categoria: "lacteos", foto: img("Cottage Cheese") },
  { id: "queso-oaxaca", nombre: "Queso Oaxaca / Hebra", categoria: "lacteos", foto: img("Mozzarella") },
  { id: "queso-parmesano", nombre: "Queso parmesano", categoria: "lacteos", foto: img("Parmesan") },
  { id: "queso-feta", nombre: "Queso feta", categoria: "lacteos", foto: img("Feta") },
  { id: "yogurt-griego", nombre: "Yogurt griego natural sin azúcar", categoria: "lacteos", foto: img("Greek Yogurt") },
  { id: "leche-descremada", nombre: "Leche descremada / light", categoria: "lacteos", foto: img("Milk") },
  { id: "leche-almendras", nombre: "Leche de almendras sin azúcar", categoria: "lacteos", foto: img("Almond Milk") },
  { id: "mantequilla", nombre: "Mantequilla pura", categoria: "lacteos", foto: img("Butter") },
  { id: "requeson", nombre: "Requesón", categoria: "lacteos", foto: img("Ricotta") },

  // --- LEGUMBRES ---
  { id: "frijoles-negros", nombre: "Frijoles negros cocidos", categoria: "legumbres", foto: img("Black Beans") },
  { id: "frijoles-pintos", nombre: "Frijoles bayos / pintos", categoria: "legumbres", foto: img("Pinto Beans") },
  { id: "lentejas", nombre: "Lentejas cocidas", categoria: "legumbres", foto: img("Lentils") },
  { id: "garbanzos", nombre: "Garbanzos cocidos", categoria: "legumbres", foto: img("Chickpeas") },
  { id: "edamames", nombre: "Edamames", categoria: "legumbres", foto: img("Soybeans") },

  // --- GRASAS SALUDABLES, FRUTOS SECOS Y SEMILLAS ---
  { id: "aceite-oliva", nombre: "Aceite de oliva extra virgen", categoria: "grasas", foto: img("Olive Oil") },
  { id: "aceite-aguacate", nombre: "Aceite de aguacate", categoria: "grasas", foto: img("Avocado") },
  { id: "almendras", nombre: "Almendras", categoria: "grasas", foto: img("Almonds") },
  { id: "nueces", nombre: "Nueces de castilla / pecana", categoria: "grasas", foto: img("Walnuts") },
  { id: "cacahuates", nombre: "Cacahuates / Maní tostado", categoria: "grasas", foto: img("Peanuts") },
  { id: "crema-cacahuate", nombre: "Crema de cacahuate natural", categoria: "grasas", foto: img("Peanut Butter") },
  { id: "semillas-chia", nombre: "Semillas de chía", categoria: "grasas", foto: img("Chia Seeds") },
  { id: "semillas-linaza", nombre: "Semillas de linaza", categoria: "grasas", foto: img("Flaxseed") },
  { id: "semillas-calabaza", nombre: "Semillas de calabaza / Pepitas", categoria: "grasas", foto: img("Pumpkin Seeds") },
  { id: "ajonjoli", nombre: "Ajonjolí / Sésamo", categoria: "grasas", foto: img("Sesame Seeds") },

  // --- ESPECIAS, CONDIMENTOS Y SALSAS ---
  { id: "sal", nombre: "Sal de mar / yodada", categoria: "especias", foto: img("Salt") },
  { id: "pimienta-negra", nombre: "Pimienta negra molida", categoria: "especias", foto: img("Black Pepper") },
  { id: "oregano", nombre: "Orégano seco", categoria: "especias", foto: img("Oregano") },
  { id: "comino", nombre: "Comino molido", categoria: "especias", foto: img("Cumin") },
  { id: "canela", nombre: "Canela en polvo", categoria: "especias", foto: img("Cinnamon") },
  { id: "vainilla", nombre: "Extracto de vainilla", categoria: "especias", foto: img("Vanilla") },
  { id: "miel-abeja", nombre: "Miel pura de abeja", categoria: "especias", foto: img("Honey") },
  { id: "salsa-soya", nombre: "Salsa de soya reducida en sodio", categoria: "especias", foto: img("Soy Sauce") },
  { id: "mostaza-dijon", nombre: "Mostaza Dijon", categoria: "especias", foto: img("Dijon Mustard") },
  { id: "vinagre-manzana", nombre: "Vinagre de manzana", categoria: "especias", foto: img("Cider Vinegar") }
];

// Normalizador de búsqueda insensible a acentos y mayúsculas
function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Devuelve el catálogo activo de ingredientes (incluye los creados o editados por Superadmin/Staff).
 */
export function getIngredientesCatalog() {
  try {
    const raw = localStorage.getItem("flux_biblioteca_ingredientes");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INGREDIENTES_CATALOGO;
}

/**
 * Busca ingredientes en el catálogo filtrando por texto y categoría.
 */
export function buscarIngredientes(query = "", categoria = "todos") {
  const q = normalizar(query);
  const list = getIngredientesCatalog();
  return list.filter(item => {
    const coincideCat = categoria === "todos" || item.categoria === categoria;
    if (!coincideCat) return false;
    if (!q) return true;
    const nombreNorm = normalizar(item.nombre);
    const idNorm = normalizar(item.id);
    return nombreNorm.includes(q) || idNorm.includes(q);
  });
}
