/**
 * foodPhotoCatalog.js
 * Catálogo Clínico de Platillos Estructurados con Equivalentes SMAE (5ª Ed.) de FLUX.
 * Cada platillo incluye receta libre, fotografía de referencia, etiquetas de alérgenos/restricciones
 * (`tags_restriccion`) y su desglose determinístico de equivalentes SMAE (`smae_equivalentes`),
 * de donde se calculan automáticamente sus calorías y macronutrientes exactos.
 */
import { dbGet, dbPost } from "./supabase";
import { calculateSmaeTotals, estimateMealSmaeMap } from "./smaeData";

export const KEY_PLATILLOS_SMAE = "flux_platillos_smae_v2";

// Purgar llave obsoleta anterior si existía en el navegador
try {
  localStorage.removeItem("flux_biblioteca_platillos");
} catch {}

export const CATEGORIAS_PLATILLOS = [
  { id: "todos", nombre: "Todos", icono: "🍽️" },
  { id: "desayuno", nombre: "Desayunos", icono: "🍳" },
  { id: "comida", nombre: "Comidas", icono: "🍲" },
  { id: "cena", nombre: "Cenas", icono: "🌙" },
  { id: "colacion", nombre: "Snacks / Colaciones", icono: "🍎" },
];

export const DISH_RESTRICTION_OPTIONS = [
  { id: "lacteos", label: "Contiene Lácteos", icono: "🥛" },
  { id: "gluten", label: "Contiene Gluten", icono: "🌾" },
  { id: "mariscos", label: "Pescado / Mariscos", icono: "🦐" },
  { id: "carne_roja", label: "Carne Roja / Cerdo", icono: "🥩" },
  { id: "nueces", label: "Frutos Secos / Cacahuate", icono: "🥜" },
  { id: "animal_meat", label: "Proteína Animal", icono: "🍗" },
];

function createStructuredDish(rawDish) {
  const smaeMap =
    rawDish.smae_equivalentes && Object.keys(rawDish.smae_equivalentes).length > 0
      ? rawDish.smae_equivalentes
      : estimateMealSmaeMap(rawDish.texto || rawDish.nombre || "");
  const totals = calculateSmaeTotals(smaeMap);
  return {
    ...rawDish,
    smae_equivalentes: smaeMap,
    tags_restriccion: Array.isArray(rawDish.tags_restriccion)
      ? rawDish.tags_restriccion
      : [],
    calorias: totals.kcal > 0 ? totals.kcal : Number(rawDish.calorias || 0),
    proteina: totals.kcal > 0 ? totals.proteina : Number(rawDish.proteina || 0),
    carbohidratos:
      totals.kcal > 0 ? totals.carbohidratos : Number(rawDish.carbohidratos || 0),
    grasas: totals.kcal > 0 ? totals.grasas : Number(rawDish.grasas || 0),
  };
}

const RAW_PLATILLOS_BASE = [
  // --- DESAYUNOS ---
  {
    id: "smae_dish_huevos_jamon_pan",
    nombre: "Huevos revueltos con jamón de pavo y pan integral tostado",
    keywords: ["huevo", "huevos", "jamon", "pavo", "pan", "tostado", "desayuno"],
    categoria: "desayuno",
    smae_equivalentes: {
      aoa_m: 2,       // 2 huevos enteros
      aoa_b: 1,       // 2 rebanadas jamón de pavo (42g)
      cereales_sg: 2, // 2 rebanadas pan integral (54g)
      grasas_sp: 1,   // 1 cdita aceite de oliva (5ml)
    },
    tags_restriccion: ["gluten", "animal_meat"],
    foto_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
    texto:
      "Huevos revueltos con jamón de pavo y pan integral tostado\n\nPreparar 2 huevos enteros (100 g) revueltos con 2 rebanadas de jamón de pavo bajo en sodio (42 g) en sartén con 1 cdita de aceite de oliva (5 ml). Acompañar con 2 rebanadas de pan integral tostado (54 g).",
  },
  {
    id: "smae_dish_omelette_claras_panela",
    nombre: "Omelette de claras con espinacas, queso panela y tortilla de maíz",
    keywords: ["omelette", "claras", "espinacas", "panela", "queso", "tortilla"],
    categoria: "desayuno",
    smae_equivalentes: {
      aoa_mb: 2,      // 4 claras de huevo (132g)
      aoa_b: 1,       // 40g queso panela
      verduras: 1,    // 2 tazas espinaca cruda (120g)
      cereales_sg: 1, // 1 tortilla de maíz (30g)
      grasas_sp: 1,   // 1 cdita aceite de oliva (5ml)
    },
    tags_restriccion: ["lacteos"],
    foto_url: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=600&auto=format&fit=crop&q=80",
    texto:
      "Omelette de claras con espinacas, queso panela y tortilla de maíz\n\nBatir 4 claras de huevo (132 g) y cocinar en sartén con 1 cdita de aceite de oliva (5 ml). Rellenar con 2 tazas de espinacas salteadas (120 g) y 40 g de queso panela en cubos. Acompañar con 1 tortilla de maíz caliente (30 g).",
  },
  {
    id: "smae_dish_avena_whey_frutos",
    nombre: "Bowl de avena con proteína Whey, frutos rojos y almendras",
    keywords: ["avena", "proteina", "whey", "frutos rojos", "fresas", "almendras", "leche"],
    categoria: "desayuno",
    smae_equivalentes: {
      cereales_sg: 2, // 2/3 taza avena en hojuelas (40g)
      leche_d: 1,     // 1 taza leche descremada (240ml)
      aoa_mb: 2,      // 2/3 scoop proteína Whey (20g)
      frutas: 1,      // 1 taza fresas / frutos rojos (150g)
      grasas_cp: 1,   // 10 almendras fileteadas (12g)
    },
    tags_restriccion: ["lacteos", "nueces"],
    foto_url: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=600&auto=format&fit=crop&q=80",
    texto:
      "Bowl de avena con proteína Whey, frutos rojos y almendras\n\nCocer ⅔ de taza de avena en hojuelas (40 g) en 1 taza de leche descremada (240 ml) con canela al gusto. Integrar 20 g de proteína Whey en polvo y coronar con 1 taza de fresas o frutos rojos (150 g) y 10 almendras fileteadas (12 g).",
  },
  {
    id: "smae_dish_hotcakes_avena_platano",
    nombre: "Hot cakes de avena con claras, plátano y miel de abeja",
    keywords: ["hot cakes", "hotcakes", "pancakes", "avena", "platano", "miel", "claras"],
    categoria: "desayuno",
    smae_equivalentes: {
      cereales_sg: 2, // 2/3 taza avena en hojuelas (40g)
      frutas: 1,      // 1/2 plátano tabasco (54g)
      aoa_mb: 2,      // 4 claras de huevo (132g)
      azucares_sg: 1, // 2 cditas miel de abeja (10g)
      grasas_cp: 1,   // 2 cditas crema de cacahuate (10g)
    },
    tags_restriccion: ["nueces"],
    foto_url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&auto=format&fit=crop&q=80",
    texto:
      "Hot cakes de avena con claras, plátano y miel de abeja\n\nLicuar ⅔ de taza de avena en hojuelas (40 g) con ½ plátano (54 g), 4 claras de huevo (132 g), canela y vainilla. Cocinar en sartén antiadherente y servir con 2 cditas de miel de abeja (10 g) y 2 cditas de crema de cacahuate natural (10 g).",
  },
  {
    id: "smae_dish_chilaquiles_pollo_panela",
    nombre: "Chilaquiles horneados con pollo deshebrado y queso panela",
    keywords: ["chilaquiles", "totopos", "pollo", "panela", "salsa verde", "desayuno"],
    categoria: "desayuno",
    smae_equivalentes: {
      cereales_sg: 3, // 3 tortillas de maíz horneadas (90g)
      aoa_mb: 3,      // 90g pechuga de pollo deshebrada
      aoa_b: 1,       // 40g queso panela
      verduras: 1,    // 5 tomates verdes + cebolla y cilantro
      grasas_sp: 1,   // 1/3 pieza de aguacate Hass (33g)
    },
    tags_restriccion: ["lacteos", "animal_meat"],
    foto_url: "https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80",
    texto:
      "Chilaquiles horneados con pollo deshebrado y queso panela\n\nHornear 3 tortillas de maíz (90 g) en triángulos hasta dorar. Bañar con salsa verde hervida (100 g de tomate verde, cebolla y cilantro) y servir con 90 g de pechuga de pollo deshebrada, 40 g de queso panela desmoronado y ⅓ de aguacate Hass (33 g).",
  },
  {
    id: "smae_dish_avocado_toast_huevo",
    nombre: "Avocado toast en pan de masa madre con huevos estrellados",
    keywords: ["avocado", "toast", "aguacate", "pan", "masa madre", "huevo", "estrellado"],
    categoria: "desayuno",
    smae_equivalentes: {
      cereales_sg: 2, // 2 rebanadas pan masa madre (60g)
      aoa_m: 2,       // 2 huevos enteros (100g)
      grasas_sp: 2,   // 2/3 pieza aguacate Hass (66g)
      verduras: 0.5,  // Jitomate cherry / germinado (60g)
    },
    tags_restriccion: ["gluten"],
    foto_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
    texto:
      "Avocado toast en pan de masa madre con huevos estrellados\n\nTostar 2 rebanadas de pan de masa madre (60 g). Untar ⅔ de pieza de aguacate Hass machacado (66 g) con limón, sal y pimienta. Montar 2 huevos estrellados al comal sin aceite (100 g) y acompañar con ½ taza de jitomate cherry (60 g).",
  },

  // --- COMIDAS ---
  {
    id: "smae_dish_pollo_arroz_brocoli",
    nombre: "Pechuga de pollo a la plancha con arroz al vapor y brócoli",
    keywords: ["pollo", "pechuga", "arroz", "brocoli", "comida"],
    categoria: "comida",
    smae_equivalentes: {
      aoa_mb: 5,      // 150g pechuga de pollo cocida
      cereales_sg: 2, // 1 taza de arroz cocido (140g)
      verduras: 2,    // 1 taza de brócoli cocido (184g)
      grasas_sp: 1,   // 1 cdita aceite de oliva (5ml)
    },
    tags_restriccion: ["animal_meat"],
    foto_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    texto:
      "Pechuga de pollo a la plancha con arroz al vapor y brócoli\n\nAsar 150 g de pechuga de pollo en sartén con 1 cdita de aceite de oliva (5 ml), ajo, sal y limón. Acompañar con 1 taza de arroz blanco o integral cocido (140 g) y 1 taza de arbolitos de brócoli al vapor (184 g).",
  },
  {
    id: "smae_dish_bistec_papa_ensalada",
    nombre: "Bistec de res magro con papa al horno, frijoles y ensalada",
    keywords: ["bistec", "res", "carne", "papa", "frijoles", "ensalada", "aguacate"],
    categoria: "comida",
    smae_equivalentes: {
      aoa_b: 4,       // 120g bistec de res magro
      cereales_sg: 2, // 1 papa mediana cocida/horneada (136g)
      leguminosas: 1, // 1/2 taza frijoles de la olla (86g)
      verduras: 1,    // Ensalada de lechuga, pepino y jitomate
      grasas_sp: 1,   // 1/3 pieza de aguacate Hass (33g)
    },
    tags_restriccion: ["animal_meat", "carne_roja"],
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80",
    texto:
      "Bistec de res magro con papa al horno, frijoles y ensalada\n\nAsar 120 g de bistec de res magro sazonado con sal y pimienta. Servir con 1 papa mediana al horno en gajos (136 g), ½ taza de frijoles negros de la olla (86 g), ensalada fresca de lechuga con jitomate y ⅓ de pieza de aguacate Hass (33 g).",
  },
  {
    id: "smae_dish_salmon_quinoa_esparragos",
    nombre: "Salmón al grill con quinoa, espárragos y aceite de oliva",
    keywords: ["salmon", "pescado", "quinoa", "esparragos", "comida"],
    categoria: "comida",
    smae_equivalentes: {
      aoa_b: 4,       // 120g salmón fresco
      cereales_sg: 2, // 1 taza de quinoa cocida (120g)
      verduras: 1.5,  // 9 piezas de espárragos (135g)
      grasas_sp: 2,   // 2 cditas aceite de oliva extra virgen (10ml)
    },
    tags_restriccion: ["animal_meat", "mariscos"],
    foto_url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80",
    texto:
      "Salmón al grill con quinoa, espárragos y aceite de oliva\n\nSellar 120 g de filete de salmón fresco a la plancha con limón, eneldo y pimienta. Acompañar con 1 taza de quinoa cocida (120 g) y 9 espárragos salteados (135 g) con 2 cditas de aceite de oliva extra virgen (10 ml).",
  },
  {
    id: "smae_dish_pescado_veracruzana_arroz",
    nombre: "Filete de pescado blanco a la veracruzana con arroz y aguacate",
    keywords: ["pescado", "tilapia", "huachinango", "veracruzana", "arroz", "aguacate"],
    categoria: "comida",
    smae_equivalentes: {
      aoa_mb: 4,      // 160g filete de pescado blanco
      cereales_sg: 2, // 1 taza de arroz blanco cocido (140g)
      verduras: 1.5,  // Jitomate, cebolla y pimiento morrón
      grasas_sp: 1.5, // 1 cdita aceite de oliva + 5 aceitunas / aguacate
    },
    tags_restriccion: ["animal_meat", "mariscos"],
    foto_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    texto:
      "Filete de pescado blanco a la veracruzana con arroz y aguacate\n\nCocinar 160 g de filete de pescado blanco en salsa de jitomate, cebolla y pimiento morrón (150 g) guisada con 1 cdita de aceite de oliva. Servir con 1 taza de arroz blanco al vapor (140 g) y rodajas de aguacate.",
  },
  {
    id: "smae_dish_tacos_pollo_aguacate",
    nombre: "Tacos de pechuga de pollo con pico de gallo y aguacate",
    keywords: ["tacos", "pollo", "tortilla", "maiz", "pico de gallo", "aguacate"],
    categoria: "comida",
    smae_equivalentes: {
      cereales_sg: 3, // 3 tortillas de maíz (90g)
      aoa_mb: 4,      // 120g pechuga de pollo deshebrada
      verduras: 1,    // 1 taza pico de gallo (jitomate, cebolla, cilantro)
      grasas_sp: 1.5, // 1/2 pieza de aguacate Hass (50g)
    },
    tags_restriccion: ["animal_meat"],
    foto_url: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80",
    texto:
      "Tacos de pechuga de pollo con pico de gallo y aguacate\n\nCalentar 3 tortillas de maíz (90 g) y rellenar con 120 g de pechuga de pollo deshebrada o asada. Acompañar con 1 taza de pico de gallo fresco (jitomate, cebolla, cilantro y limón) y ½ pieza de aguacate Hass en rebanadas (50 g).",
  },
  {
    id: "smae_dish_picadillo_res_arroz",
    nombre: "Picadillo de res magro con verduras y arroz blanco",
    keywords: ["picadillo", "res", "molida", "zanahoria", "calabacita", "arroz"],
    categoria: "comida",
    smae_equivalentes: {
      aoa_b: 4,       // 120g carne molida de res magra
      cereales_sg: 2, // 1 taza de arroz blanco cocido (140g)
      verduras: 2,    // Calabacita, zanahoria y jitomate (180g)
      grasas_sp: 1,   // 1 cdita aceite de oliva (5ml)
    },
    tags_restriccion: ["animal_meat", "carne_roja"],
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80",
    texto:
      "Picadillo de res magro con verduras y arroz blanco\n\nGuisar 120 g de carne molida de res magra (90/10) con ½ taza de zanahoria picada y 1 calabacita en cubos en caldillo de jitomate natural con 1 cdita de aceite de oliva. Servir acompañado de 1 taza de arroz blanco cocido (140 g).",
  },

  // --- CENAS ---
  {
    id: "smae_dish_ensalada_pollo_aguacate",
    nombre: "Ensalada fresca con pechuga de pollo al grill, aguacate y tostadas",
    keywords: ["ensalada", "pollo", "lechuga", "pepino", "aguacate", "salmas", "tostadas", "cena"],
    categoria: "cena",
    smae_equivalentes: {
      aoa_mb: 4,      // 120g pechuga de pollo al grill
      verduras: 2,    // 3 tazas lechuga + 1 taza pepino y jitomate
      grasas_sp: 2,   // 1/3 aguacate (33g) + 1 cdita aceite de oliva (5ml)
      cereales_sg: 1, // 1 paquete tostadas horneadas Salmas (18g)
    },
    tags_restriccion: ["animal_meat"],
    foto_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    texto:
      "Ensalada fresca con pechuga de pollo al grill, aguacate y tostadas\n\nMezclar 3 tazas de lechuga romana con 1 taza de pepino y jitomate. Montar 120 g de pechuga de pollo a la plancha en tiras, ⅓ de pieza de aguacate Hass (33 g) y aderezar con 1 cdita de aceite de oliva y limón. Acompañar con 1 paquete de tostadas horneadas Salmas (3 pzas).",
  },
  {
    id: "smae_dish_quesadillas_oaxaca_champinones",
    nombre: "Quesadillas en tortilla de maíz con queso Oaxaca light y champiñones",
    keywords: ["quesadillas", "queso", "oaxaca", "champinones", "tortilla", "cena"],
    categoria: "cena",
    smae_equivalentes: {
      cereales_sg: 2, // 2 tortillas de maíz (60g)
      aoa_b: 2,       // 60g queso Oaxaca light
      verduras: 1,    // 1 taza champiñones rebanados (96g)
      grasas_sp: 1,   // 1/3 pieza aguacate Hass (33g)
    },
    tags_restriccion: ["lacteos"],
    foto_url: "https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80",
    texto:
      "Quesadillas en tortilla de maíz con queso Oaxaca light y champiñones\n\nSaltear 1 taza de champiñones rebanados (96 g) con ajo y epazote. Armar 2 quesadillas en tortilla de maíz (60 g) con 60 g de queso Oaxaca light deshebrado y los champiñones. Acompañar con ⅓ de aguacate Hass (33 g) y salsa casera.",
  },
  {
    id: "smae_dish_sandwich_pavo_panela",
    nombre: "Sándwich integral de pechuga de pavo, queso panela y aguacate",
    keywords: ["sandwich", "pavo", "panela", "pan integral", "aguacate", "cena"],
    categoria: "cena",
    smae_equivalentes: {
      cereales_sg: 2, // 2 rebanadas pan integral (54g)
      aoa_mb: 1,      // 2 rebanadas pechuga de pavo (42g)
      aoa_b: 1,       // 40g queso panela
      verduras: 0.5,  // Lechuga, jitomate y cebolla
      grasas_sp: 1,   // 1/3 pieza de aguacate Hass (33g)
    },
    tags_restriccion: ["lacteos", "gluten", "animal_meat"],
    foto_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
    texto:
      "Sándwich integral de pechuga de pavo, queso panela y aguacate\n\nArmar un sándwich con 2 rebanadas de pan integral de caja (54 g), 2 rebanadas de pechuga de pavo (42 g), 40 g de queso panela, lechuga, jitomate, mostaza Dijon y ⅓ de pieza de aguacate Hass (33 g).",
  },
  {
    id: "smae_dish_tostadas_atun_aguacate",
    nombre: "Tostadas horneadas de atún con pico de gallo y aguacate",
    keywords: ["atun", "tostadas", "salmas", "pico de gallo", "aguacate", "cena"],
    categoria: "cena",
    smae_equivalentes: {
      aoa_mb: 3,      // 1 lata de atún en agua drenado (90g)
      cereales_sg: 2, // 2 paquetes de Salmas / 4 tostadas horneadas
      verduras: 1,    // 1 taza de pepino, jitomate y cebolla picada
      grasas_sp: 1,   // 1/3 pieza de aguacate Hass (33g)
    },
    tags_restriccion: ["animal_meat", "mariscos"],
    foto_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    texto:
      "Tostadas horneadas de atún con pico de gallo y aguacate\n\nMezclar 90 g de atún en agua drenado con 1 taza de pepino, jitomate, cebolla morada, cilantro y jugo de limón. Servir sobre 4 tostadas de maíz horneadas y coronar con ⅓ de pieza de aguacate Hass (33 g).",
  },

  // --- COLACIONES / SNACKS ---
  {
    id: "smae_dish_yogurt_griego_frutos_almendras",
    nombre: "Yogurt griego sin azúcar con fresas y almendras",
    keywords: ["yogurt", "yogur", "griego", "fresas", "almendras", "colacion", "snack"],
    categoria: "colacion",
    smae_equivalentes: {
      leche_d: 1,   // 3/4 taza yogurt griego sin azúcar (150g)
      frutas: 1,    // 1 taza fresas rebanadas (166g)
      grasas_cp: 1, // 10 almendras (12g)
    },
    tags_restriccion: ["lacteos", "nueces"],
    foto_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80",
    texto:
      "Yogurt griego sin azúcar con fresas y almendras\n\nServir ¾ de taza de yogurt griego natural sin azúcar (150 g) acompañado de 1 taza de fresas rebanadas (166 g) y 10 piezas de almendras fileteadas (12 g).",
  },
  {
    id: "smae_dish_manzana_crema_cacahuate",
    nombre: "Manzana en gajos con crema de cacahuate natural",
    keywords: ["manzana", "cacahuate", "crema de cacahuate", "colacion", "snack"],
    categoria: "colacion",
    smae_equivalentes: {
      frutas: 1,    // 1 manzana mediana (138g)
      grasas_cp: 2, // 4 cditas / 20g crema de cacahuate natural
    },
    tags_restriccion: ["nueces"],
    foto_url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&auto=format&fit=crop&q=80",
    texto:
      "Manzana en gajos con crema de cacahuate natural\n\nCortar 1 manzana mediana (138 g) en gajos, espolvorear con canela al gusto y acompañar con 4 cucharaditas (20 g) de crema de cacahuate 100% natural sin azúcar.",
  },
  {
    id: "smae_dish_shake_whey_platano",
    nombre: "Batido post-entreno de proteína Whey con plátano y leche",
    keywords: ["batido", "licuado", "smoothie", "whey", "proteina", "platano", "colacion"],
    categoria: "colacion",
    smae_equivalentes: {
      aoa_mb: 3,  // 1 scoop completo de proteína Whey (30g)
      frutas: 1,  // 1/2 plátano tabasco (54g)
      leche_d: 1, // 1 taza de leche descremada (240ml)
    },
    tags_restriccion: ["lacteos"],
    foto_url: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
    texto:
      "Batido post-entreno de proteína Whey con plátano y leche\n\nLicuar 1 scoop de proteína Whey aislada (30 g) con ½ plátano tabasco (54 g), 1 taza de leche descremada (240 ml), hielo y canela al gusto.",
  },
  {
    id: "smae_dish_cottage_papaya_nueces",
    nombre: "Bowl de queso cottage con papaya picada y nueces",
    keywords: ["cottage", "queso", "papaya", "nueces", "fruta", "colacion"],
    categoria: "colacion",
    smae_equivalentes: {
      aoa_mb: 2,    // 6 cucharadas queso cottage (96g)
      frutas: 1,    // 1 taza papaya picada (140g)
      grasas_cp: 1, // 7 mitades de nuez pecana (14g)
    },
    tags_restriccion: ["lacteos", "nueces"],
    foto_url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&auto=format&fit=crop&q=80",
    texto:
      "Bowl de queso cottage con papaya picada y nueces\n\nServir 6 cucharadas de queso cottage bajo en grasa (96 g) acompañado de 1 taza de papaya picada (140 g) y 7 mitades de nuez pecana (14 g).",
  },
];

export const CATALOGO_PLATILLOS_BASE = RAW_PLATILLOS_BASE.map(createStructuredDish);

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
 * Devuelve el catálogo activo de platillos estructurados con SMAE.
 */
export function getPlatillosCatalog() {
  try {
    const raw = localStorage.getItem(KEY_PLATILLOS_SMAE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(createStructuredDish);
      }
    }
  } catch {}
  return CATALOGO_PLATILLOS_BASE;
}

/**
 * Busca platillos en el catálogo filtrando por texto y categoría.
 */
export function buscarPlatillosCatalogo(query = "", categoria = "todos") {
  const q = normalizeText(query);
  const list = getPlatillosCatalog();
  return list.filter((item) => {
    const coincideCat = categoria === "todos" || item.categoria === categoria;
    if (!coincideCat) return false;
    if (!q) return true;
    const nombreNorm = normalizeText(item.nombre);
    const kwNorm = (item.keywords || []).map((k) => normalizeText(k)).join(" ");
    const textoNorm = normalizeText(item.texto || "");
    return nombreNorm.includes(q) || kwNorm.includes(q) || textoNorm.includes(q);
  });
}

/**
 * Busca si ya existe una foto para el platillo en el catálogo de FLUX
 */
export async function searchDishPhotoInCatalog(dishText, customKeywords = []) {
  if (!dishText && customKeywords.length === 0) return null;
  const normalized = normalizeText(dishText);
  const words = new Set([
    ...normalized.split(/\s+/).filter((w) => w.length > 2),
    ...customKeywords.map((k) => normalizeText(k)),
  ]);

  let bestMatch = null;
  let maxScore = 0;

  for (const item of getPlatillosCatalog()) {
    let score = 0;
    for (const kw of item.keywords || []) {
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

  try {
    const remote = await dbGet("catalogo_platillos?limit=50").catch(() => []);
    if (Array.isArray(remote) && remote.length > 0) {
      for (const item of remote) {
        let score = 0;
        const itemKeywords = Array.isArray(item.palabras_clave)
          ? item.palabras_clave
          : (item.palabras_clave || "").split(",");
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
 * Guarda o registra una foto en el catálogo compartido de FLUX
 */
export async function registerDishPhotoInCatalog(dishName, keywords = [], photoUrl) {
  if (!dishName || !photoUrl) return;
  try {
    const payload = {
      nombre_normalizado: dishName.trim(),
      palabras_clave:
        keywords.length > 0
          ? keywords
          : dishName
              .toLowerCase()
              .split(/[\s,]+/)
              .filter((w) => w.length > 2),
      foto_url: photoUrl,
    };
    await dbPost("catalogo_platillos", payload).catch(() => {});
  } catch {}
}
