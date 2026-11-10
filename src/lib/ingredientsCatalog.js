/**
 * Catálogo Maestro de Ingredientes Culinarios de FLUX + Equivalentes Oficiales SMAE (5ª Ed.)
 * Contiene ingredientes universales y de la gastronomía cotidiana (México y Latinoamérica).
 * Cada ingrediente cuenta con imagen transparente (TheMealDB CDN o fallback), categoría culinaria,
 * grupo oficial SMAE, porción de 1 equivalente y etiquetas clínicas de alérgenos/restricciones.
 */

import { SMAE_GROUPS_MAP, DIET_RESTRICTION_TAGS } from "./smaeData";

export const CATEGORIAS_INGREDIENTES = [
  { id: "todos", nombre: "Todos", icono: "🍽️" },
  { id: "proteinas", nombre: "AOA / Proteínas", icono: "🥩" },
  { id: "cereales", nombre: "Cereales y Tubérculos", icono: "🌾" },
  { id: "verduras", nombre: "Verduras", icono: "🥦" },
  { id: "frutas", nombre: "Frutas", icono: "🍎" },
  { id: "legumbres", nombre: "Leguminosas", icono: "🫘" },
  { id: "lacteos", nombre: "Leche y Lácteos", icono: "🥛" },
  { id: "grasas", nombre: "Aceites y Grasas", icono: "🥑" },
  { id: "especias", nombre: "Condimentos (Libres)", icono: "🧂" }
];

const img = (name) => `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name)}.png`;

export const INGREDIENTES_CATALOGO = [
  // --- CEREALES Y TUBÉRCULOS (SMAE: cereales_sg = 70 kcal, 2P, 15C, 0G) ---
  { id: "tortilla-maiz", nombre: "Tortilla de maíz", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 1, unidadBase: "pieza", gramosBase: 30, porcion1Eq: "1 pieza (30 g)", dietTags: [], foto: img("Tortillas") },
  { id: "tortilla-harina", nombre: "Tortilla de harina integral", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 1, unidadBase: "pieza chica", gramosBase: 25, porcion1Eq: "1 pza chica (25 g)", dietTags: ["gluten"], foto: img("Flour") },
  { id: "avena", nombre: "Avena en hojuelas", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 20, porcion1Eq: "⅓ taza (20 g)", dietTags: [], foto: img("Oats") },
  { id: "arroz-blanco", nombre: "Arroz blanco cocido", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 70, porcion1Eq: "½ taza (70 g)", dietTags: [], foto: img("Rice") },
  { id: "arroz-integral", nombre: "Arroz integral cocido", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 70, porcion1Eq: "½ taza (70 g)", dietTags: [], foto: img("Brown Rice") },
  { id: "papa", nombre: "Papa cocida / al horno", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.5, unidadBase: "pieza mediana", gramosBase: 68, porcion1Eq: "½ pieza (68 g)", dietTags: [], foto: img("Potatoes") },
  { id: "camote", nombre: "Camote / Batata cocido", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 55, porcion1Eq: "⅓ taza (55 g)", dietTags: [], foto: img("Sweet Potatoes") },
  { id: "pan-integral", nombre: "Pan integral de caja", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 1, unidadBase: "rebanada", gramosBase: 27, porcion1Eq: "1 rebanada (27 g)", dietTags: ["gluten"], foto: img("Bread") },
  { id: "pan-masa-madre", nombre: "Pan de masa madre", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 1, unidadBase: "rebanada", gramosBase: 30, porcion1Eq: "1 rebanada (30 g)", dietTags: ["gluten"], foto: img("Bread") },
  { id: "pasta-integral", nombre: "Pasta / Espagueti cocido", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 60, porcion1Eq: "½ taza (60 g)", dietTags: ["gluten"], foto: img("Spaghetti") },
  { id: "quinoa", nombre: "Quinoa cocida", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 60, porcion1Eq: "½ taza (60 g)", dietTags: [], foto: img("Quinoa") },
  { id: "tostadas-maiz", nombre: "Tostadas horneadas de maíz (Salmas)", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 2, unidadBase: "piezas", gramosBase: 24, porcion1Eq: "2 piezas (24 g)", dietTags: [], foto: img("Tortillas") },
  { id: "elote", nombre: "Elote / Maíz desgranado", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, porcion1Eq: "½ taza (82 g)", dietTags: [], foto: img("Sweetcorn") },
  { id: "bagel-integral", nombre: "Bagel integral", categoria: "cereales", smaeGroup: "cereales_sg", cantidadBase: 0.33, unidadBase: "pieza", gramosBase: 28, porcion1Eq: "⅓ pieza (28 g)", dietTags: ["gluten"], foto: img("Bagel") },

  // --- CARNES Y PROTEÍNAS (AOA Muy Bajo / Bajo / Moderado) ---
  { id: "pechuga-pollo", nombre: "Pechuga de pollo", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g cocido", dietTags: ["animal_meat"], foto: img("Chicken Breast") },
  { id: "pollo-deshebrado", nombre: "Pollo deshebrado", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g", dietTags: ["animal_meat"], foto: img("Chicken") },
  { id: "muslo-pollo", nombre: "Muslo de pollo sin piel", categoria: "proteinas", smaeGroup: "aoa_m", cantidadBase: 35, unidadBase: "g", gramosBase: 35, porcion1Eq: "35 g", dietTags: ["animal_meat"], foto: img("Chicken Thighs") },
  { id: "bistec-res", nombre: "Bistec de res magro", categoria: "proteinas", smaeGroup: "aoa_b", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g", dietTags: ["animal_meat", "carne_roja"], foto: img("Beef") },
  { id: "carne-res-molida", nombre: "Carne de res molida magra", categoria: "proteinas", smaeGroup: "aoa_b", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g", dietTags: ["animal_meat", "carne_roja"], foto: img("Minced Beef") },
  { id: "claras-huevo", nombre: "Claras de huevo", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 2, unidadBase: "piezas", gramosBase: 66, porcion1Eq: "2 claras (66 g)", dietTags: [], foto: img("Egg White") },
  { id: "huevo-entero", nombre: "Huevo entero", categoria: "proteinas", smaeGroup: "aoa_m", cantidadBase: 1, unidadBase: "pieza", gramosBase: 50, porcion1Eq: "1 pieza (50 g)", dietTags: [], foto: img("Eggs") },
  { id: "filete-pescado", nombre: "Filete de pescado blanco / Tilapia", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 40, unidadBase: "g", gramosBase: 40, porcion1Eq: "40 g", dietTags: ["animal_meat", "mariscos"], foto: img("Fish") },
  { id: "atun-lata", nombre: "Atún en lata (en agua, drenado)", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g (¼ lata)", dietTags: ["animal_meat", "mariscos"], foto: img("Tuna") },
  { id: "salmon", nombre: "Salmón fresco", categoria: "proteinas", smaeGroup: "aoa_b", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g", dietTags: ["animal_meat", "mariscos"], foto: img("Salmon") },
  { id: "camarones", nombre: "Camarones limpios", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 35, unidadBase: "g", gramosBase: 35, porcion1Eq: "35 g (~5 pzas)", dietTags: ["animal_meat", "mariscos"], foto: img("Prawns") },
  { id: "lomo-cerdo", nombre: "Lomo de cerdo magro", categoria: "proteinas", smaeGroup: "aoa_b", cantidadBase: 35, unidadBase: "g", gramosBase: 35, porcion1Eq: "35 g", dietTags: ["animal_meat", "carne_roja"], foto: img("Pork") },
  { id: "pechuga-pavo", nombre: "Pechuga de pavo", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 2, unidadBase: "rebanadas", gramosBase: 42, porcion1Eq: "2 reb. (42 g)", dietTags: ["animal_meat"], foto: img("Turkey") },
  { id: "jamon-pavo", nombre: "Jamón de pavo bajo en sodio", categoria: "proteinas", smaeGroup: "aoa_b", cantidadBase: 2, unidadBase: "rebanadas", gramosBase: 42, porcion1Eq: "2 reb. (42 g)", dietTags: ["animal_meat"], foto: img("Ham") },
  { id: "tofu", nombre: "Tofu firme", categoria: "proteinas", smaeGroup: "aoa_b", cantidadBase: 60, unidadBase: "g", gramosBase: 60, porcion1Eq: "60 g", dietTags: [], foto: img("Tofu") },
  { id: "proteina-whey", nombre: "Proteína Whey en polvo", categoria: "proteinas", smaeGroup: "aoa_mb", cantidadBase: 10, unidadBase: "g", gramosBase: 10, porcion1Eq: "⅓ scoop (7g Prot)", dietTags: ["lacteos"], foto: img("Milk") },

  // --- VERDURAS Y HORTALIZAS (SMAE: verduras = 25 kcal, 2P, 4C, 0G) ---
  { id: "brocoli", nombre: "Brócoli cocido", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 92, porcion1Eq: "½ taza (92 g)", dietTags: [], foto: img("Broccoli") },
  { id: "espinacas", nombre: "Espinacas crudas", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 2, unidadBase: "tazas", gramosBase: 120, porcion1Eq: "2 tazas (120 g)", dietTags: [], foto: img("Spinach") },
  { id: "calabacita", nombre: "Calabacita / Calabacín", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "pieza", gramosBase: 110, porcion1Eq: "1 pieza (110 g)", dietTags: [], foto: img("Courgettes") },
  { id: "nopal", nombre: "Nopal cocido", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "taza", gramosBase: 149, porcion1Eq: "1 taza (149 g)", dietTags: [], foto: img("Spring Onions") },
  { id: "jitomate", nombre: "Jitomate / Tomate rojo", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "pieza", gramosBase: 120, porcion1Eq: "1 pieza (120 g)", dietTags: [], foto: img("Tomato") },
  { id: "pepino", nombre: "Pepino rebanado", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "taza", gramosBase: 104, porcion1Eq: "1 taza (104 g)", dietTags: [], foto: img("Cucumber") },
  { id: "zanahoria", nombre: "Zanahoria picada o rallada", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 64, porcion1Eq: "½ taza (64 g)", dietTags: [], foto: img("Carrots") },
  { id: "champinones", nombre: "Champiñones / Setas", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "taza", gramosBase: 96, porcion1Eq: "1 taza (96 g)", dietTags: [], foto: img("Mushrooms") },
  { id: "esparragos", nombre: "Espárragos", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 6, unidadBase: "piezas", gramosBase: 90, porcion1Eq: "6 piezas (90 g)", dietTags: [], foto: img("Asparagus") },
  { id: "ejotes", nombre: "Ejotes / Judías verdes", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 63, porcion1Eq: "½ taza (63 g)", dietTags: [], foto: img("Green Beans") },
  { id: "pimiento-rojo", nombre: "Pimiento morrón rojo", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "taza", gramosBase: 92, porcion1Eq: "1 taza (92 g)", dietTags: [], foto: img("Red Pepper") },
  { id: "pimiento-verde", nombre: "Pimiento morrón verde", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "taza", gramosBase: 92, porcion1Eq: "1 taza (92 g)", dietTags: [], foto: img("Green Pepper") },
  { id: "lechuga", nombre: "Lechuga romana / orejona", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 3, unidadBase: "tazas", gramosBase: 140, porcion1Eq: "3 tazas (140 g)", dietTags: [], foto: img("Lettuce") },
  { id: "coliflor", nombre: "Coliflor cocida", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1, unidadBase: "taza", gramosBase: 125, porcion1Eq: "1 taza (125 g)", dietTags: [], foto: img("Cauliflower") },
  { id: "apio", nombre: "Apio crudo", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 1.5, unidadBase: "tazas", gramosBase: 135, porcion1Eq: "1½ tazas (135 g)", dietTags: [], foto: img("Celery") },
  { id: "betabel", nombre: "Betabel / Remolacha", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.25, unidadBase: "pieza", gramosBase: 43, porcion1Eq: "¼ pieza (43 g)", dietTags: [], foto: img("Beetroot") },
  { id: "cebolla-blanca", nombre: "Cebolla blanca", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 58, porcion1Eq: "½ taza (58 g)", dietTags: [], foto: img("Onion") },
  { id: "cebolla-morada", nombre: "Cebolla morada", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 58, porcion1Eq: "½ taza (58 g)", dietTags: [], foto: img("Red Onion") },
  { id: "tomate-verde", nombre: "Tomate verde / Tomatillo", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 5, unidadBase: "piezas", gramosBase: 100, porcion1Eq: "5 piezas (100 g)", dietTags: [], foto: img("Tomatoes") },
  { id: "chile-poblano", nombre: "Chile poblano", categoria: "verduras", smaeGroup: "verduras", cantidadBase: 0.5, unidadBase: "pieza", gramosBase: 64, porcion1Eq: "½ pieza (64 g)", dietTags: [], foto: img("Green Pepper") },
  { id: "chile-chipotle", nombre: "Chile chipotle", categoria: "verduras", smaeGroup: "libre", cantidadBase: 1, unidadBase: "pieza", gramosBase: 15, porcion1Eq: "Al gusto", dietTags: [], foto: img("Chilli Powder") },
  { id: "chile-serrano", nombre: "Chile serrano", categoria: "verduras", smaeGroup: "libre", cantidadBase: 2, unidadBase: "piezas", gramosBase: 20, porcion1Eq: "Al gusto", dietTags: [], foto: img("Green Chilli") },
  { id: "chile-jalapeno", nombre: "Chile jalapeño", categoria: "verduras", smaeGroup: "libre", cantidadBase: 2, unidadBase: "piezas", gramosBase: 30, porcion1Eq: "Al gusto", dietTags: [], foto: img("Jalapeno") },
  { id: "ajo", nombre: "Ajo", categoria: "verduras", smaeGroup: "libre", cantidadBase: 1, unidadBase: "diente", gramosBase: 5, porcion1Eq: "Al gusto", dietTags: [], foto: img("Garlic") },
  { id: "cilantro", nombre: "Cilantro fresco", categoria: "verduras", smaeGroup: "libre", cantidadBase: 2, unidadBase: "cucharadas", gramosBase: 10, porcion1Eq: "Al gusto", dietTags: [], foto: img("Coriander") },
  { id: "perejil", nombre: "Perejil fresco", categoria: "verduras", smaeGroup: "libre", cantidadBase: 2, unidadBase: "cucharadas", gramosBase: 10, porcion1Eq: "Al gusto", dietTags: [], foto: img("Parsley") },

  // --- FRUTAS (SMAE: frutas = 60 kcal, 0P, 15C, 0G) ---
  { id: "platano", nombre: "Plátano / Banana", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 0.5, unidadBase: "pieza", gramosBase: 54, porcion1Eq: "½ pieza (54 g)", dietTags: [], foto: img("Banana") },
  { id: "manzana", nombre: "Manzana", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1, unidadBase: "pieza mediana", gramosBase: 138, porcion1Eq: "1 pieza (138 g)", dietTags: [], foto: img("Apple") },
  { id: "fresas", nombre: "Fresas rebanadas", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1, unidadBase: "taza", gramosBase: 166, porcion1Eq: "1 taza (166 g)", dietTags: [], foto: img("Strawberries") },
  { id: "frutos-rojos", nombre: "Frutos rojos / Arándanos", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 110, porcion1Eq: "¾ taza (110 g)", dietTags: [], foto: img("Blueberries") },
  { id: "papaya", nombre: "Papaya picada", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1, unidadBase: "taza", gramosBase: 140, porcion1Eq: "1 taza (140 g)", dietTags: [], foto: img("Papaya") },
  { id: "melon", nombre: "Melón picado", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1, unidadBase: "taza", gramosBase: 160, porcion1Eq: "1 taza (160 g)", dietTags: [], foto: img("Melon") },
  { id: "sandia", nombre: "Sandía picada", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1, unidadBase: "taza", gramosBase: 160, porcion1Eq: "1 taza (160 g)", dietTags: [], foto: img("Watermelon") },
  { id: "naranja", nombre: "Naranja", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 2, unidadBase: "piezas chicas", gramosBase: 152, porcion1Eq: "2 pzas (152 g)", dietTags: [], foto: img("Orange") },
  { id: "pina", nombre: "Piña picada", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 124, porcion1Eq: "¾ taza (124 g)", dietTags: [], foto: img("Pineapple") },
  { id: "mango", nombre: "Mango picado", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, porcion1Eq: "½ taza (82 g)", dietTags: [], foto: img("Mango") },
  { id: "kiwi", nombre: "Kiwi", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1.5, unidadBase: "piezas", gramosBase: 114, porcion1Eq: "1½ pzas (114 g)", dietTags: [], foto: img("Kiwi") },
  { id: "uvas", nombre: "Uvas", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 18, unidadBase: "piezas", gramosBase: 86, porcion1Eq: "18 piezas (86 g)", dietTags: [], foto: img("Grapes") },
  { id: "toronja", nombre: "Toronja / Pomelo", categoria: "frutas", smaeGroup: "frutas", cantidadBase: 1, unidadBase: "pieza", gramosBase: 150, porcion1Eq: "1 pieza (150 g)", dietTags: [], foto: img("Grapefruit") },
  { id: "limon", nombre: "Limón fresco", categoria: "frutas", smaeGroup: "libre", cantidadBase: 2, unidadBase: "piezas", gramosBase: 40, porcion1Eq: "Libre", dietTags: [], foto: img("Lemon") },

  // --- LÁCTEOS Y QUESOS (SMAE: leche_d / aoa_mb / aoa_b) ---
  { id: "yogurt-griego", nombre: "Yogurt griego natural sin azúcar", categoria: "lacteos", smaeGroup: "leche_d", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 150, porcion1Eq: "¾ taza (150 g)", dietTags: ["lacteos"], foto: img("Greek Yogurt") },
  { id: "leche-descremada", nombre: "Leche descremada / light", categoria: "lacteos", smaeGroup: "leche_d", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, porcion1Eq: "1 taza (240 ml)", dietTags: ["lacteos"], foto: img("Milk") },
  { id: "queso-panela", nombre: "Queso panela", categoria: "lacteos", smaeGroup: "aoa_b", cantidadBase: 40, unidadBase: "g", gramosBase: 40, porcion1Eq: "40 g", dietTags: ["lacteos"], foto: img("Cheese") },
  { id: "queso-cottage", nombre: "Queso cottage bajo en grasa", categoria: "lacteos", smaeGroup: "aoa_mb", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 48, porcion1Eq: "3 cdas (48 g)", dietTags: ["lacteos"], foto: img("Cottage Cheese") },
  { id: "queso-oaxaca", nombre: "Queso Oaxaca / Hebra light", categoria: "lacteos", smaeGroup: "aoa_b", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g", dietTags: ["lacteos"], foto: img("Mozzarella") },
  { id: "requeson", nombre: "Requesón / Ricotta", categoria: "lacteos", smaeGroup: "aoa_m", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 45, porcion1Eq: "3 cdas (45 g)", dietTags: ["lacteos"], foto: img("Ricotta") },
  { id: "queso-feta", nombre: "Queso feta", categoria: "lacteos", smaeGroup: "aoa_m", cantidadBase: 30, unidadBase: "g", gramosBase: 30, porcion1Eq: "30 g", dietTags: ["lacteos"], foto: img("Feta") },
  { id: "queso-parmesano", nombre: "Queso parmesano", categoria: "lacteos", smaeGroup: "aoa_a", cantidadBase: 20, unidadBase: "g", gramosBase: 20, porcion1Eq: "2½ cdas (20 g)", dietTags: ["lacteos"], foto: img("Parmesan") },
  { id: "leche-almendras", nombre: "Leche de almendras sin azúcar", categoria: "lacteos", smaeGroup: "grasas_cp", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, porcion1Eq: "1 taza (240 ml)", dietTags: ["nueces"], foto: img("Almond Milk") },
  { id: "mantequilla", nombre: "Mantequilla pura", categoria: "lacteos", smaeGroup: "grasas_sp", cantidadBase: 1.5, unidadBase: "cditas", gramosBase: 6, porcion1Eq: "1½ cditas (6 g)", dietTags: ["lacteos"], foto: img("Butter") },

  // --- LEGUMINOSAS (SMAE: leguminosas = 120 kcal, 8P, 20C, 1G) ---
  { id: "frijoles-negros", nombre: "Frijoles negros cocidos", categoria: "legumbres", smaeGroup: "leguminosas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 86, porcion1Eq: "½ taza (86 g)", dietTags: [], foto: img("Black Beans") },
  { id: "frijoles-pintos", nombre: "Frijoles bayos / pintos cocidos", categoria: "legumbres", smaeGroup: "leguminosas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 86, porcion1Eq: "½ taza (86 g)", dietTags: [], foto: img("Pinto Beans") },
  { id: "lentejas", nombre: "Lentejas cocidas", categoria: "legumbres", smaeGroup: "leguminosas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 99, porcion1Eq: "½ taza (99 g)", dietTags: [], foto: img("Lentils") },
  { id: "garbanzos", nombre: "Garbanzos cocidos", categoria: "legumbres", smaeGroup: "leguminosas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, porcion1Eq: "½ taza (82 g)", dietTags: [], foto: img("Chickpeas") },
  { id: "edamames", nombre: "Edamames cocidos", categoria: "legumbres", smaeGroup: "leguminosas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 85, porcion1Eq: "½ taza (85 g)", dietTags: [], foto: img("Soybeans") },

  // --- GRASAS SALUDABLES, FRUTOS SECOS Y SEMILLAS (SMAE: grasas_sp / grasas_cp) ---
  { id: "aguacate", nombre: "Aguacate Hass", categoria: "grasas", smaeGroup: "grasas_sp", cantidadBase: 0.33, unidadBase: "pieza", gramosBase: 33, porcion1Eq: "⅓ pieza (33 g)", dietTags: [], foto: img("Avocado") },
  { id: "aceite-oliva", nombre: "Aceite de oliva extra virgen", categoria: "grasas", smaeGroup: "grasas_sp", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, porcion1Eq: "1 cdita (5 ml)", dietTags: [], foto: img("Olive Oil") },
  { id: "aceite-aguacate", nombre: "Aceite de aguacate", categoria: "grasas", smaeGroup: "grasas_sp", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, porcion1Eq: "1 cdita (5 ml)", dietTags: [], foto: img("Avocado") },
  { id: "almendras", nombre: "Almendras", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 10, unidadBase: "piezas", gramosBase: 12, porcion1Eq: "10 piezas (12 g)", dietTags: ["nueces"], foto: img("Almonds") },
  { id: "nueces", nombre: "Nueces de castilla / pecana", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 7, unidadBase: "mitades", gramosBase: 14, porcion1Eq: "7 mitades (14 g)", dietTags: ["nueces"], foto: img("Walnuts") },
  { id: "cacahuates", nombre: "Cacahuates / Maní tostado", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 14, unidadBase: "piezas", gramosBase: 12, porcion1Eq: "14 piezas (12 g)", dietTags: ["nueces"], foto: img("Peanuts") },
  { id: "crema-cacahuate", nombre: "Crema de cacahuate natural", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 2, unidadBase: "cditas", gramosBase: 10, porcion1Eq: "2 cditas (10 g)", dietTags: ["nueces"], foto: img("Peanut Butter") },
  { id: "semillas-chia", nombre: "Semillas de chía", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 10, porcion1Eq: "1 cda (10 g)", dietTags: [], foto: img("Chia Seeds") },
  { id: "semillas-linaza", nombre: "Semillas de linaza", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 10, porcion1Eq: "1 cda (10 g)", dietTags: [], foto: img("Flaxseed") },
  { id: "semillas-calabaza", nombre: "Semillas de calabaza / Pepitas", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 10, porcion1Eq: "1 cda (10 g)", dietTags: [], foto: img("Pumpkin Seeds") },
  { id: "ajonjoli", nombre: "Ajonjolí / Sésamo", categoria: "grasas", smaeGroup: "grasas_cp", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 10, porcion1Eq: "1 cda (10 g)", dietTags: [], foto: img("Sesame Seeds") },

  // --- ESPECIAS, CONDIMENTOS Y SALSAS ---
  { id: "miel-abeja", nombre: "Miel pura de abeja", categoria: "especias", smaeGroup: "azucares_sg", cantidadBase: 2, unidadBase: "cditas", gramosBase: 10, porcion1Eq: "2 cditas (10 g)", dietTags: [], foto: img("Honey") },
  { id: "sal", nombre: "Sal de mar / yodada", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "pizca", gramosBase: 1, porcion1Eq: "Libre", dietTags: [], foto: img("Salt") },
  { id: "pimienta-negra", nombre: "Pimienta negra molida", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "pizca", gramosBase: 1, porcion1Eq: "Libre", dietTags: [], foto: img("Black Pepper") },
  { id: "oregano", nombre: "Orégano seco", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "cdita", gramosBase: 2, porcion1Eq: "Libre", dietTags: [], foto: img("Oregano") },
  { id: "comino", nombre: "Comino molido", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "pizca", gramosBase: 1, porcion1Eq: "Libre", dietTags: [], foto: img("Cumin") },
  { id: "canela", nombre: "Canela en polvo", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "cdita", gramosBase: 2, porcion1Eq: "Libre", dietTags: [], foto: img("Cinnamon") },
  { id: "vainilla", nombre: "Extracto de vainilla", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, porcion1Eq: "Libre", dietTags: [], foto: img("Vanilla") },
  { id: "salsa-soya", nombre: "Salsa de soya reducida en sodio", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, porcion1Eq: "Libre", dietTags: ["gluten"], foto: img("Soy Sauce") },
  { id: "mostaza-dijon", nombre: "Mostaza Dijon", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, porcion1Eq: "Libre", dietTags: [], foto: img("Dijon Mustard") },
  { id: "vinagre-manzana", nombre: "Vinagre de manzana", categoria: "especias", smaeGroup: "libre", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 15, porcion1Eq: "Libre", dietTags: [], foto: img("Cider Vinegar") }
];

const MASTER_BY_ID = Object.fromEntries(INGREDIENTES_CATALOGO.map((i) => [i.id, i]));

// Normalizador de búsqueda insensible a acentos y mayúsculas
export function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Devuelve la información SMAE completa de un ingrediente (incluso si viene de localStorage antiguo).
 */
export function getIngredientSmaeInfo(ing) {
  if (!ing) return null;
  const master = MASTER_BY_ID[ing.id] || {};
  const merged = { ...master, ...ing };
  const smaeGroup = merged.smaeGroup || master.smaeGroup || "libre";
  const grpMeta = SMAE_GROUPS_MAP[smaeGroup] || null;
  return {
    ...merged,
    smaeGroup,
    smaeMeta: grpMeta,
    porcion1Eq: merged.porcion1Eq || master.porcion1Eq || (merged.gramosBase ? `${merged.gramosBase} g` : "1 porción"),
    gramosBase: merged.gramosBase || master.gramosBase || 30,
    cantidadBase: merged.cantidadBase || master.cantidadBase || 1,
    unidadBase: merged.unidadBase || master.unidadBase || "porción",
    dietTags: merged.dietTags || master.dietTags || [],
  };
}

/**
 * Formatea un ingrediente con el número de equivalentes SMAE seleccionado y devuelve sus macros exactos.
 */
export function formatIngredientSmaePortion(ing, equivalents = 1) {
  const info = getIngredientSmaeInfo(ing);
  if (!info) return { label: "", kcal: 0, proteina: 0, carbohidratos: 0, grasas: 0, smaeGroup: "libre" };

  if (info.smaeGroup === "libre" || !info.smaeMeta) {
    return {
      label: `${info.nombre} (al gusto)`,
      shortPortion: "Libre",
      kcal: 0,
      proteina: 0,
      carbohidratos: 0,
      grasas: 0,
      smaeGroup: "libre",
      equivalents: 0,
    };
  }

  const eq = Math.max(0.5, Math.round(Number(equivalents || 1) * 2) / 2);
  const gramos = Math.round((info.gramosBase || 30) * eq);
  let portionText = "";

  if (info.unidadBase === "g" || info.unidadBase === "ml") {
    portionText = `${gramos} ${info.unidadBase} de ${info.nombre}`;
  } else {
    const rawCant = (info.cantidadBase || 1) * eq;
    const cantStr = String(Math.round(rawCant * 100) / 100);
    const fracMap = {
      "0.25": "¼",
      "0.33": "⅓",
      "0.5": "½",
      "0.66": "⅔",
      "0.75": "¾",
      "1.25": "1¼",
      "1.33": "1⅓",
      "1.5": "1½",
      "1.66": "1⅔",
      "1.75": "1¾",
      "2.5": "2½",
    };
    const prettyCant = fracMap[cantStr] || cantStr;
    portionText = `${prettyCant} ${info.unidadBase} de ${info.nombre} (${gramos} g)`;
  }

  const grp = info.smaeMeta;
  return {
    label: portionText,
    shortPortion: `${gramos} g (${eq} eq ${grp.corto})`,
    kcal: Math.round(grp.kcal * eq),
    proteina: Math.round(grp.proteina * eq),
    carbohidratos: Math.round(grp.carbohidratos * eq),
    grasas: Math.round(grp.grasas * eq),
    smaeGroup: info.smaeGroup,
    smaeCorto: grp.corto,
    equivalents: eq,
  };
}

/**
 * Evalúa si un ingrediente o platillo está excluido o es favorito según la Evaluación del Ciclo + Expediente.
 */
export function evaluateIngredientForPatient(ing, { aversionesText = "", preferenciasText = "", expediente = null } = {}) {
  const info = getIngredientSmaeInfo(ing);
  if (!info) return { isExcluded: false, excludeReason: "", isFavorite: false };

  const normAvers = normalizar(
    `${aversionesText || ""} ${expediente?.alergias_intolerancias || ""} ${expediente?.aversiones_alimentos || ""}`
  );
  const normPref = normalizar(`${preferenciasText || ""} ${expediente?.preferencias_alimentos || ""}`);
  const normName = normalizar(info.nombre);
  const baseWord = normName.split(/\s+/)[0] || "";

  // 1. Verificar etiquetas de restricción rápida (Sin Lácteos, Sin Gluten, Sin Mariscos, etc.)
  for (const tagRule of DIET_RESTRICTION_TAGS) {
    const isTagActive = tagRule.keywords.some((kw) => normAvers.includes(normalizar(kw)));
    if (isTagActive && (info.dietTags || []).includes(tagRule.tagMatch)) {
      return {
        isExcluded: true,
        excludeReason: tagRule.shortLabel,
        isFavorite: false,
      };
    }
  }

  // 2. Verificar coincidencia directa en aversiones o alergias
  if (normAvers && baseWord.length >= 4 && normAvers.includes(baseWord)) {
    return {
      isExcluded: true,
      excludeReason: "Evitar en consulta",
      isFavorite: false,
    };
  }

  // 3. Verificar si es favorito en la consulta
  const isFavorite = Boolean(normPref && baseWord.length >= 4 && normPref.includes(baseWord));

  return {
    isExcluded: false,
    excludeReason: "",
    isFavorite,
  };
}

/**
 * Devuelve el catálogo activo de ingredientes enriquecido con metadatos SMAE.
 */
export function getIngredientesCatalog() {
  try {
    const raw = localStorage.getItem("flux_biblioteca_ingredientes");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => getIngredientSmaeInfo(item));
      }
    }
  } catch {}
  return INGREDIENTES_CATALOGO.map((item) => getIngredientSmaeInfo(item));
}

/**
 * Busca ingredientes en el catálogo filtrando por texto y categoría.
 */
export function buscarIngredientes(query = "", categoria = "todos") {
  const q = normalizar(query);
  const list = getIngredientesCatalog();
  return list.filter(item => {
    const coincideCat = categoria === "todos" || item.categoria === categoria || item.smaeGroup === categoria;
    if (!coincideCat) return false;
    if (!q) return true;
    const nombreNorm = normalizar(item.nombre);
    const idNorm = normalizar(item.id);
    const smaeNorm = normalizar(item.smaeMeta?.nombre || "");
    return nombreNorm.includes(q) || idNorm.includes(q) || smaeNorm.includes(q);
  });
}
