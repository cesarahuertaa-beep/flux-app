/**
 * smaeData.js
 * Base de Datos Maestra del Sistema Mexicano de Alimentos Equivalentes (SMAE - 5ª Edición).
 *
 * Única fuente de verdad para:
 * 1. Los 16 Grupos y Subgrupos Oficiales del SMAE con su aporte bromatológico estándar por 1 equivalente.
 * 2. El Catálogo Oficial de Alimentos Equivalentes del SMAE (porción casera, gramos netos, grupo SMAE y etiquetas clínicas).
 * 3. Conversión automática de Macros (Kcal / P / C / G) a Cuadro Dietosintético SMAE con convergencia calórica.
 * 4. Cálculo exacto de macros y equivalentes por comida y por día a partir de selectores estructurados.
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
    icono: "🫓",
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
    color: "stone",
    kcal: 120,
    proteina: 8,
    carbohidratos: 20,
    grasas: 1,
  },
  {
    id: "aoa_mb",
    nombre: "Alimentos de Origen Animal (Muy Bajo Aporte de Grasa)",
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
    nombre: "Alimentos de Origen Animal (Bajo Aporte de Grasa)",
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
    nombre: "Alimentos de Origen Animal (Moderado Aporte de Grasa)",
    corto: "AOA Moderado",
    icono: "🥚",
    color: "violet",
    kcal: 75,
    proteina: 7,
    carbohidratos: 0,
    grasas: 5,
  },
  {
    id: "aoa_a",
    nombre: "Alimentos de Origen Animal (Alto Aporte de Grasa)",
    corto: "AOA Alto",
    icono: "🧀",
    color: "purple",
    kcal: 100,
    proteina: 7,
    carbohidratos: 0,
    grasas: 8,
  },
  {
    id: "leche_d",
    nombre: "Leche y Sustitutos (Descremada)",
    corto: "Leche Descr.",
    icono: "🥛",
    color: "sky",
    kcal: 95,
    proteina: 9,
    carbohidratos: 12,
    grasas: 2,
  },
  {
    id: "leche_sd",
    nombre: "Leche y Sustitutos (Semidescremada)",
    corto: "Leche Semi.",
    icono: "🥛",
    color: "cyan",
    kcal: 110,
    proteina: 9,
    carbohidratos: 12,
    grasas: 4,
  },
  {
    id: "leche_e",
    nombre: "Leche y Sustitutos (Entera)",
    corto: "Leche Entera",
    icono: "🥛",
    color: "blue",
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
    color: "lime",
    kcal: 45,
    proteina: 0,
    carbohidratos: 0,
    grasas: 5,
  },
  {
    id: "grasas_cp",
    nombre: "Aceites y Grasas (Con Proteína)",
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
  {
    id: "libres",
    nombre: "Alimentos Libres en Energía",
    corto: "Libres",
    icono: "🧂",
    color: "slate",
    kcal: 0,
    proteina: 0,
    carbohidratos: 0,
    grasas: 0,
  },
];

export const SMAE_GROUPS_MAP = Object.fromEntries(
  SMAE_GROUPS.map((g) => [g.id, g])
);

/**
 * Etiquetas clínicas de restricción rápida (1 clic en Evaluación Paso 2, en Biblioteca y en Programar).
 */
export const DIET_RESTRICTION_TAGS = [
  {
    id: "sin_lacteos",
    label: "Sin Lácteos / Lactosa",
    shortLabel: "Sin Lácteos",
    icon: "🥛",
    tagMatch: "lacteos",
    keywords: ["sin lacteos", "sin lácteos", "sin lactosa", "intolerancia a la lactosa", "alergia a la proteina de leche"],
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
 * Catálogo Oficial de Alimentos del SMAE (5ª Edición).
 * Cada registro es un ingrediente oficial con su porción exacta de 1 equivalente:
 * - id: identificador único
 * - nombre: nombre oficial SMAE
 * - cantidadBase: cantidad en medida casera para 1 equivalente
 * - unidadBase: unidad casera ("taza", "pieza", "rebanada", "cucharada", "cdita", "g", "ml")
 * - gramosBase: peso neto comestible en gramos o ml de 1 equivalente
 * - dietTags: banderas determinísticas de restricción alimentaria
 * - keywords: sinónimos para asistencia opcional
 */
export const SMAE_FOODS_BY_GROUP = {
  verduras: [
    { id: "v_acelga", nombre: "Acelga cruda picada", cantidadBase: 2, unidadBase: "tazas", gramosBase: 98, dietTags: [], keywords: ["acelga", "acelgas"] },
    { id: "v_apio", nombre: "Apio crudo picado", cantidadBase: 1.5, unidadBase: "tazas", gramosBase: 135, dietTags: [], keywords: ["apio"] },
    { id: "v_berenjena", nombre: "Berenjena cocida picada", cantidadBase: 1, unidadBase: "taza", gramosBase: 99, dietTags: [], keywords: ["berenjena"] },
    { id: "v_betabel", nombre: "Betabel crudo rallado", cantidadBase: 0.25, unidadBase: "taza", gramosBase: 39, dietTags: [], keywords: ["betabel", "remolacha"] },
    { id: "v_brocoli", nombre: "Brócoli cocido", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 92, dietTags: [], keywords: ["brocoli", "brócoli"] },
    { id: "v_calabacita", nombre: "Calabacita alargada cocida", cantidadBase: 1, unidadBase: "pieza", gramosBase: 110, dietTags: [], keywords: ["calabacita", "calabacitas", "calabacin"] },
    { id: "v_cebolla", nombre: "Cebolla blanca o morada rebanada", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 58, dietTags: [], keywords: ["cebolla", "cebolla morada"] },
    { id: "v_champinones", nombre: "Champiñones cocidos rebanados", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 78, dietTags: [], keywords: ["champiñon", "champiñones", "setas", "portobello"] },
    { id: "v_chayote", nombre: "Chayote cocido picado", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 80, dietTags: [], keywords: ["chayote"] },
    { id: "v_chile_poblano", nombre: "Chile poblano sin piel", cantidadBase: 0.66, unidadBase: "pieza", gramosBase: 64, dietTags: [], keywords: ["chile poblano", "rajas poblanas"] },
    { id: "v_col_morada", nombre: "Col blanca o morada cruda picada", cantidadBase: 1.5, unidadBase: "tazas", gramosBase: 105, dietTags: [], keywords: ["col", "repollo", "col morada"] },
    { id: "v_col_bruselas", nombre: "Coles de Bruselas cocidas", cantidadBase: 3, unidadBase: "piezas", gramosBase: 63, dietTags: [], keywords: ["coles de bruselas"] },
    { id: "v_coliflor", nombre: "Coliflor cocida", cantidadBase: 1, unidadBase: "taza", gramosBase: 125, dietTags: [], keywords: ["coliflor"] },
    { id: "v_ejotes", nombre: "Ejotes cocidos picados", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 63, dietTags: [], keywords: ["ejote", "ejotes"] },
    { id: "v_esparragos", nombre: "Espárragos cocidos", cantidadBase: 6, unidadBase: "piezas", gramosBase: 90, dietTags: [], keywords: ["esparrago", "espárragos"] },
    { id: "v_espinaca", nombre: "Espinaca cruda picada", cantidadBase: 2, unidadBase: "tazas", gramosBase: 120, dietTags: [], keywords: ["espinaca", "espinacas"] },
    { id: "v_espinaca_cocida", nombre: "Espinaca cocida", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 90, dietTags: [], keywords: ["espinaca cocida"] },
    { id: "v_flor_calabaza", nombre: "Flor de calabaza cocida", cantidadBase: 1, unidadBase: "taza", gramosBase: 134, dietTags: [], keywords: ["flor de calabaza"] },
    { id: "v_jicama", nombre: "Jícama picada", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 60, dietTags: [], keywords: ["jicama", "jícama"] },
    { id: "v_jitomate", nombre: "Jitomate / Tomate saladet o bola", cantidadBase: 1, unidadBase: "pieza", gramosBase: 120, dietTags: [], keywords: ["jitomate", "tomate rojo", "tomate"] },
    { id: "v_jitomate_cherry", nombre: "Jitomate cherry", cantidadBase: 4, unidadBase: "piezas", gramosBase: 100, dietTags: [], keywords: ["jitomate cherry", "tomate cherry"] },
    { id: "v_lechuga", nombre: "Lechuga romana o italiana", cantidadBase: 3, unidadBase: "tazas", gramosBase: 141, dietTags: [], keywords: ["lechuga", "ensalada verde"] },
    { id: "v_nopales", nombre: "Nopal cocido picado", cantidadBase: 1, unidadBase: "taza", gramosBase: 149, dietTags: [], keywords: ["nopal", "nopales"] },
    { id: "v_pepino", nombre: "Pepino con cáscara rebanado", cantidadBase: 1, unidadBase: "taza", gramosBase: 104, dietTags: [], keywords: ["pepino", "pepinos"] },
    { id: "v_pimiento", nombre: "Pimiento morrón cocido o crudo", cantidadBase: 1, unidadBase: "taza", gramosBase: 92, dietTags: [], keywords: ["pimiento", "pimientos", "morron", "morrón"] },
    { id: "v_quelites", nombre: "Quelites o verdolagas cocidas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 75, dietTags: [], keywords: ["quelites", "verdolagas"] },
    { id: "v_rabano", nombre: "Rábano crudo rebanado", cantidadBase: 1, unidadBase: "taza", gramosBase: 116, dietTags: [], keywords: ["rabano", "rábano"] },
    { id: "v_salsa_casera", nombre: "Salsa verde o roja casera (sin aceite)", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 120, dietTags: [], keywords: ["salsa verde", "salsa roja", "pico de gallo"] },
    { id: "v_tomate_verde", nombre: "Tomate verde (Tomatillo)", cantidadBase: 5, unidadBase: "piezas", gramosBase: 95, dietTags: [], keywords: ["tomate verde", "tomatillo"] },
    { id: "v_zanahoria", nombre: "Zanahoria picada o rallada cruda", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 64, dietTags: [], keywords: ["zanahoria", "zanahorias"] },
  ],
  frutas: [
    { id: "f_arandano_fresco", nombre: "Arándano fresco (Blueberries)", cantidadBase: 1.5, unidadBase: "tazas", gramosBase: 125, dietTags: [], keywords: ["arandanos", "arándanos", "blueberries"] },
    { id: "f_ciruela", nombre: "Ciruela roja o amarilla", cantidadBase: 3, unidadBase: "piezas", gramosBase: 155, dietTags: [], keywords: ["ciruela", "ciruelas"] },
    { id: "f_ciruela_pasa", nombre: "Ciruela pasa deshuesada", cantidadBase: 7, unidadBase: "piezas", gramosBase: 56, dietTags: [], keywords: ["ciruela pasa"] },
    { id: "f_datil", nombre: "Dátil seco", cantidadBase: 2, unidadBase: "piezas", gramosBase: 17, dietTags: [], keywords: ["datil", "dátil", "datiles"] },
    { id: "f_durazno", nombre: "Durazno amarillo", cantidadBase: 2, unidadBase: "piezas chicas", gramosBase: 150, dietTags: [], keywords: ["durazno", "duraznos"] },
    { id: "f_frambuesa", nombre: "Frambuesa fresca", cantidadBase: 1, unidadBase: "taza", gramosBase: 123, dietTags: [], keywords: ["frambuesa", "frambuesas"] },
    { id: "f_fresas", nombre: "Fresas rebanadas", cantidadBase: 1, unidadBase: "taza", gramosBase: 166, dietTags: [], keywords: ["fresa", "fresas"] },
    { id: "f_frutos_rojos", nombre: "Frutos rojos mixtos (Fresas, moras, zarzamoras)", cantidadBase: 1, unidadBase: "taza", gramosBase: 145, dietTags: [], keywords: ["frutos rojos", "berries"] },
    { id: "f_granada", nombre: "Granada roja desgranada", cantidadBase: 1, unidadBase: "pieza", gramosBase: 87, dietTags: [], keywords: ["granada"] },
    { id: "f_guayaba", nombre: "Guayaba", cantidadBase: 3, unidadBase: "piezas", gramosBase: 123, dietTags: [], keywords: ["guayaba", "guayabas"] },
    { id: "f_higo", nombre: "Higo fresco", cantidadBase: 2, unidadBase: "piezas", gramosBase: 72, dietTags: [], keywords: ["higo", "higos"] },
    { id: "f_kiwi", nombre: "Kiwi", cantidadBase: 1.5, unidadBase: "piezas", gramosBase: 114, dietTags: [], keywords: ["kiwi", "kiwis"] },
    { id: "f_mamey", nombre: "Mamey picado", cantidadBase: 0.33, unidadBase: "pieza", gramosBase: 85, dietTags: [], keywords: ["mamey"] },
    { id: "f_mandarina", nombre: "Mandarina", cantidadBase: 2, unidadBase: "piezas chicas", gramosBase: 128, dietTags: [], keywords: ["mandarina", "mandarinas"] },
    { id: "f_mango", nombre: "Mango picado (Ataulfo o Manila)", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, dietTags: [], keywords: ["mango"] },
    { id: "f_manzana", nombre: "Manzana (Golden, Gala o Red)", cantidadBase: 1, unidadBase: "pieza mediana", gramosBase: 138, dietTags: [], keywords: ["manzana", "manzanas"] },
    { id: "f_melon", nombre: "Melón picado", cantidadBase: 1, unidadBase: "taza", gramosBase: 160, dietTags: [], keywords: ["melon", "melón"] },
    { id: "f_naranja", nombre: "Naranja en gajos", cantidadBase: 2, unidadBase: "piezas chicas", gramosBase: 152, dietTags: [], keywords: ["naranja", "naranjas"] },
    { id: "f_papaya", nombre: "Papaya picada", cantidadBase: 1, unidadBase: "taza", gramosBase: 140, dietTags: [], keywords: ["papaya"] },
    { id: "f_pera", nombre: "Pera", cantidadBase: 0.5, unidadBase: "pieza", gramosBase: 81, dietTags: [], keywords: ["pera", "peras"] },
    { id: "f_pina", nombre: "Piña picada", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 124, dietTags: [], keywords: ["piña", "pina"] },
    { id: "f_platano", nombre: "Plátano tabasco", cantidadBase: 0.5, unidadBase: "pieza", gramosBase: 54, dietTags: [], keywords: ["platano", "plátano", "banana"] },
    { id: "f_platano_dominico", nombre: "Plátano dominico", cantidadBase: 3, unidadBase: "piezas", gramosBase: 57, dietTags: [], keywords: ["platano dominico"] },
    { id: "f_sandia", nombre: "Sandía picada", cantidadBase: 1, unidadBase: "taza", gramosBase: 160, dietTags: [], keywords: ["sandia", "sandía"] },
    { id: "f_toronja", nombre: "Toronja en gajos", cantidadBase: 1, unidadBase: "taza", gramosBase: 154, dietTags: [], keywords: ["toronja"] },
    { id: "f_tuna", nombre: "Tuna verde o roja", cantidadBase: 2, unidadBase: "piezas", gramosBase: 138, dietTags: [], keywords: ["tuna", "tunas"] },
    { id: "f_uvas", nombre: "Uvas verdes o rojas", cantidadBase: 18, unidadBase: "piezas", gramosBase: 86, dietTags: [], keywords: ["uva", "uvas"] },
    { id: "f_zarzamora", nombre: "Zarzamora fresca", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 108, dietTags: [], keywords: ["zarzamora", "zarzamoras"] },
  ],
  cereales_sg: [
    { id: "c_amaranto", nombre: "Amaranto tostado", cantidadBase: 0.25, unidadBase: "taza", gramosBase: 16, dietTags: [], keywords: ["amaranto"] },
    { id: "c_arroz_blanco", nombre: "Arroz blanco cocido", cantidadBase: 0.25, unidadBase: "taza", gramosBase: 47, dietTags: [], keywords: ["arroz blanco", "arroz cocido", "arroz al vapor", "arroz"] },
    { id: "c_arroz_integral", nombre: "Arroz integral cocido", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 65, dietTags: [], keywords: ["arroz integral"] },
    { id: "c_avena_cruda", nombre: "Avena en hojuelas cruda", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 20, dietTags: ["gluten"], keywords: ["avena en hojuelas", "hojuelas de avena", "avena"] },
    { id: "c_avena_cocida", nombre: "Avena cocida en agua", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 164, dietTags: ["gluten"], keywords: ["avena cocida"] },
    { id: "c_bolillo_sin_migajon", nombre: "Bolillo sin migajón", cantidadBase: 0.33, unidadBase: "pieza", gramosBase: 20, dietTags: ["gluten"], keywords: ["bolillo", "birote"] },
    { id: "c_camote", nombre: "Camote cocido o al horno", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 69, dietTags: [], keywords: ["camote", "batata"] },
    { id: "c_cereal_maiz", nombre: "Hojuelas de maíz sin azúcar (Corn Flakes)", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 19, dietTags: [], keywords: ["corn flakes", "hojuelas de maiz"] },
    { id: "c_couscous", nombre: "Couscous cocido", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 52, dietTags: ["gluten"], keywords: ["couscous"] },
    { id: "c_elote", nombre: "Elote amarillo o blanco desgranado cocido", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, dietTags: [], keywords: ["elote", "granos de elote"] },
    { id: "c_galleta_habanera", nombre: "Galleta habanera o salada integral", cantidadBase: 4, unidadBase: "piezas", gramosBase: 18, dietTags: ["gluten"], keywords: ["galleta habanera", "galletas saladas"] },
    { id: "c_galleta_maria", nombre: "Galleta María", cantidadBase: 5, unidadBase: "piezas", gramosBase: 19, dietTags: ["gluten"], keywords: ["galleta maria", "galletas marias"] },
    { id: "c_galleta_arroz", nombre: "Tortitas de arroz inflado (Rice cakes)", cantidadBase: 2, unidadBase: "piezas", gramosBase: 18, dietTags: [], keywords: ["tortitas de arroz", "rice cakes", "galletas de arroz"] },
    { id: "c_harina_avena", nombre: "Harina de avena", cantidadBase: 2, unidadBase: "cucharadas", gramosBase: 20, dietTags: ["gluten"], keywords: ["harina de avena"] },
    { id: "c_palomitas_naturales", nombre: "Palomitas de maíz naturales (sin mantequilla)", cantidadBase: 2.5, unidadBase: "tazas", gramosBase: 20, dietTags: [], keywords: ["palomitas", "palomitas naturales"] },
    { id: "c_pan_integral", nombre: "Pan integral de caja o masa madre", cantidadBase: 1, unidadBase: "rebanada", gramosBase: 27, dietTags: ["gluten"], keywords: ["pan integral", "pan tostado", "pan de caja", "pan masa madre", "rebanada de pan"] },
    { id: "c_pan_ pita", nombre: "Pan árabe / Pan pita integral", cantidadBase: 0.5, unidadBase: "pieza", gramosBase: 30, dietTags: ["gluten"], keywords: ["pan pita", "pan arabe"] },
    { id: "c_papa", nombre: "Papa cocida o al horno", cantidadBase: 0.5, unidadBase: "pieza mediana", gramosBase: 68, dietTags: [], keywords: ["papa", "papa cocida", "papa al horno", "papas cambray", "pure de papa"] },
    { id: "c_pasta", nombre: "Pasta o espagueti cocido", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 55, dietTags: ["gluten"], keywords: ["pasta", "espagueti", "fusilli", "penne", "macarrones"] },
    { id: "c_platano_macho", nombre: "Plátano macho cocido", cantidadBase: 0.25, unidadBase: "pieza", gramosBase: 48, dietTags: [], keywords: ["platano macho"] },
    { id: "c_quinoa", nombre: "Quinoa cocida", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 60, dietTags: [], keywords: ["quinoa", "quinua"] },
    { id: "c_tostada_horneada", nombre: "Tostada de maíz horneada (Saníssimo / Salmas)", cantidadBase: 2, unidadBase: "piezas", gramosBase: 24, dietTags: [], keywords: ["tostada horneada", "tostadas horneadas", "salmas", "sanissimo"] },
    { id: "c_tortilla_maiz", nombre: "Tortilla de maíz", cantidadBase: 1, unidadBase: "pieza", gramosBase: 30, dietTags: [], keywords: ["tortilla de maiz", "tortilla de maíz", "tortillas de maiz", "tortilla"] },
    { id: "c_tortilla_nopal", nombre: "Tortilla de nopal / maíz", cantidadBase: 2, unidadBase: "piezas", gramosBase: 45, dietTags: [], keywords: ["tortilla de nopal", "tortillas de nopal"] },
    { id: "c_tortilla_harina_int", nombre: "Tortilla de harina integral", cantidadBase: 1, unidadBase: "pieza chica", gramosBase: 25, dietTags: ["gluten"], keywords: ["tortilla de harina", "tortilla de trigo"] },
  ],
  cereales_cg: [
    { id: "cg_granola", nombre: "Granola con frutos secos", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 21, dietTags: ["gluten", "nueces"], keywords: ["granola"] },
    { id: "cg_totopos", nombre: "Totopos de maíz fritos", cantidadBase: 6, unidadBase: "piezas", gramosBase: 24, dietTags: [], keywords: ["totopos"] },
    { id: "cg_tostada_frita", nombre: "Tostada de maíz frita", cantidadBase: 1, unidadBase: "pieza", gramosBase: 18, dietTags: [], keywords: ["tostada frita"] },
    { id: "cg_tortilla_harina", nombre: "Tortilla de harina blanca", cantidadBase: 1, unidadBase: "pieza", gramosBase: 30, dietTags: ["gluten"], keywords: ["tortilla de harina blanca"] },
    { id: "cg_waffle", nombre: "Waffle o Hot cake casero", cantidadBase: 1, unidadBase: "pieza chica", gramosBase: 38, dietTags: ["gluten", "lacteos"], keywords: ["waffle", "hot cake"] },
  ],
  leguminosas: [
    { id: "l_alubia", nombre: "Alubias cocidas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 90, dietTags: [], keywords: ["alubias"] },
    { id: "l_edamames", nombre: "Edamames (Frijol de soya tierno cocido)", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 78, dietTags: [], keywords: ["edamame", "edamames", "soya"] },
    { id: "l_frijol_olla", nombre: "Frijoles negros, bayos o peruanos de la olla", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 86, dietTags: [], keywords: ["frijoles", "frijol", "frijoles negros", "frijoles de la olla"] },
    { id: "l_frijol_molido", nombre: "Frijoles machacados sin grasa", cantidadBase: 0.33, unidadBase: "taza", gramosBase: 73, dietTags: [], keywords: ["frijoles molidos", "frijoles refritos"] },
    { id: "l_garbanzos", nombre: "Garbanzos cocidos", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 82, dietTags: [], keywords: ["garbanzo", "garbanzos", "hummus"] },
    { id: "l_habas", nombre: "Habas cocidas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 85, dietTags: [], keywords: ["habas"] },
    { id: "l_lentejas", nombre: "Lentejas cocidas", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 99, dietTags: [], keywords: ["lenteja", "lentejas"] },
    { id: "l_soya_texturizada", nombre: "Soya texturizada hidratada", cantidadBase: 0.5, unidadBase: "taza", gramosBase: 70, dietTags: [], keywords: ["soya texturizada"] },
  ],
  aoa_mb: [
    { id: "amb_pechuga_pollo", nombre: "Pechuga de pollo sin piel cocida o deshebrada", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["animal_meat"], keywords: ["pechuga de pollo", "pollo", "fajitas de pollo", "pollo deshebrado"] },
    { id: "amb_pescado_blanco", nombre: "Filete de pescado blanco (Tilapia / Róbalo / Huachinango)", cantidadBase: 40, unidadBase: "g", gramosBase: 40, dietTags: ["mariscos", "animal_meat"], keywords: ["filete de pescado", "pescado blanco", "tilapia", "robalo", "huachinango", "merluza"] },
    { id: "amb_atun_agua", nombre: "Atún en lata en agua (drenado)", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["mariscos", "animal_meat"], keywords: ["atun en agua", "atún en agua", "atun", "atún", "lata de atun"] },
    { id: "amb_claras_huevo", nombre: "Claras de huevo", cantidadBase: 2, unidadBase: "piezas", gramosBase: 66, dietTags: [], keywords: ["claras de huevo", "claras"] },
    { id: "amb_camarones", nombre: "Camarón cocido limpio", cantidadBase: 35, unidadBase: "g", gramosBase: 35, dietTags: ["mariscos", "animal_meat"], keywords: ["camaron", "camarón", "camarones"] },
    { id: "amb_pulpo_calamar", nombre: "Pulpo o calamar cocido", cantidadBase: 35, unidadBase: "g", gramosBase: 35, dietTags: ["mariscos", "animal_meat"], keywords: ["pulpo", "calamar"] },
    { id: "amb_pechuga_pavo", nombre: "Pechuga de pavo horneada en rebanadas", cantidadBase: 2, unidadBase: "rebanadas", gramosBase: 42, dietTags: ["animal_meat"], keywords: ["pechuga de pavo", "jamon de pavo", "jamón de pavo", "pavo"] },
    { id: "amb_queso_cottage", nombre: "Queso cottage bajo en grasa", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 48, dietTags: ["lacteos"], keywords: ["queso cottage", "cottage"] },
    { id: "amb_machaca", nombre: "Machaca o carne seca de res magra", cantidadBase: 12, unidadBase: "g", gramosBase: 12, dietTags: ["carne_roja", "animal_meat"], keywords: ["machaca", "carne seca"] },
    { id: "amb_whey_protein", nombre: "Proteína Whey Isolate en polvo (media medida)", cantidadBase: 10, unidadBase: "g", gramosBase: 10, dietTags: ["lacteos"], keywords: ["proteina whey", "scoop de proteina", "whey protein"] },
  ],
  aoa_b: [
    { id: "ab_bistec_res", nombre: "Bistec o carne de res magra (Filete / Sirloin / Falda)", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["carne_roja", "animal_meat"], keywords: ["bistec de res", "carne de res", "sirloin", "filete de res", "arrachera magra", "bistec"] },
    { id: "ab_molida_magra", nombre: "Carne molida de res o pollo magra (90/10)", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["carne_roja", "animal_meat"], keywords: ["carne molida", "molida de res", "picadillo"] },
    { id: "ab_lomo_cerdo", nombre: "Lomo o filete de cerdo magro", cantidadBase: 35, unidadBase: "g", gramosBase: 35, dietTags: ["carne_roja", "animal_meat"], keywords: ["lomo de cerdo", "filete de cerdo"] },
    { id: "ab_salmon", nombre: "Salmón o trucha fresca", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["mariscos", "animal_meat"], keywords: ["salmon", "salmón", "trucha"] },
    { id: "ab_atun_fresco", nombre: "Medallón de atún fresco", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["mariscos", "animal_meat"], keywords: ["medallon de atun", "atun fresco"] },
    { id: "ab_queso_panela", nombre: "Queso panela", cantidadBase: 40, unidadBase: "g", gramosBase: 40, dietTags: ["lacteos"], keywords: ["queso panela", "panela"] },
    { id: "ab_queso_fresco", nombre: "Queso fresco o canasto", cantidadBase: 40, unidadBase: "g", gramosBase: 40, dietTags: ["lacteos"], keywords: ["queso fresco"] },
    { id: "ab_queso_oaxaca_light", nombre: "Queso Oaxaca / Mozzarella light", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["lacteos"], keywords: ["queso oaxaca", "queso mozzarella", "queso hebra"] },
    { id: "ab_tofu", nombre: "Tofu firme", cantidadBase: 60, unidadBase: "g", gramosBase: 60, dietTags: [], keywords: ["tofu"] },
  ],
  aoa_m: [
    { id: "am_huevo_entero", nombre: "Huevo entero de gallina", cantidadBase: 1, unidadBase: "pieza", gramosBase: 50, dietTags: [], keywords: ["huevo", "huevos", "huevo entero", "huevos revueltos", "huevos estrellados"] },
    { id: "am_requeson", nombre: "Requesón o queso Ricotta", cantidadBase: 3, unidadBase: "cucharadas", gramosBase: 45, dietTags: ["lacteos"], keywords: ["requeson", "requesón", "ricotta"] },
    { id: "am_muslo_pollo", nombre: "Muslo o pierna de pollo sin piel", cantidadBase: 35, unidadBase: "g", gramosBase: 35, dietTags: ["animal_meat"], keywords: ["muslo de pollo", "pierna de pollo"] },
    { id: "am_sardina", nombre: "Sardina drenada", cantidadBase: 35, unidadBase: "g", gramosBase: 35, dietTags: ["mariscos", "animal_meat"], keywords: ["sardina", "sardinas"] },
    { id: "am_salchicha_pavo", nombre: "Salchicha de pavo", cantidadBase: 1, unidadBase: "pieza", gramosBase: 44, dietTags: ["animal_meat"], keywords: ["salchicha de pavo"] },
  ],
  aoa_a: [
    { id: "aa_queso_manchego", nombre: "Queso Manchego, Gouda o Chihuahua", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["lacteos"], keywords: ["queso manchego", "queso gouda", "queso chihuahua", "queso parmesano"] },
    { id: "aa_ribeye", nombre: "Corte Rib Eye o T-Bone con marmoleo", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["carne_roja", "animal_meat"], keywords: ["rib eye", "ribeye", "picaña"] },
    { id: "aa_chorizo_pavo", nombre: "Chorizo de pavo", cantidadBase: 30, unidadBase: "g", gramosBase: 30, dietTags: ["animal_meat"], keywords: ["chorizo"] },
  ],
  leche_d: [
    { id: "ld_leche_descremada", nombre: "Leche descremada o deslactosada light", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, dietTags: ["lacteos"], keywords: ["leche descremada", "leche light", "leche deslactosada light", "leche"] },
    { id: "ld_yogurt_griego", nombre: "Yogurt griego natural sin azúcar (0% grasa)", cantidadBase: 0.75, unidadBase: "taza", gramosBase: 150, dietTags: ["lacteos"], keywords: ["yogurt griego", "yogur griego", "yogurt natural"] },
    { id: "ld_jocoque", nombre: "Jocoque seco light", cantidadBase: 5, unidadBase: "cucharadas", gramosBase: 75, dietTags: ["lacteos"], keywords: ["jocoque"] },
  ],
  leche_sd: [
    { id: "lsd_leche_semi", nombre: "Leche semidescremada", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, dietTags: ["lacteos"], keywords: ["leche semidescremada"] },
    { id: "lsd_kefir", nombre: "Kéfir / Leche búlgara natural", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, dietTags: ["lacteos"], keywords: ["kefir", "kéfir"] },
  ],
  leche_e: [
    { id: "le_leche_entera", nombre: "Leche entera de vaca", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, dietTags: ["lacteos"], keywords: ["leche entera"] },
    { id: "le_yogurt_entero", nombre: "Yogurt natural entero", cantidadBase: 1, unidadBase: "taza", gramosBase: 227, dietTags: ["lacteos"], keywords: ["yogurt entero"] },
  ],
  grasas_sp: [
    { id: "gsp_aguacate", nombre: "Aguacate Hass", cantidadBase: 0.33, unidadBase: "pieza", gramosBase: 33, dietTags: [], keywords: ["aguacate", "guacamole"] },
    { id: "gsp_aceite_oliva", nombre: "Aceite de oliva extra virgen", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, dietTags: [], keywords: ["aceite de oliva", "aceite"] },
    { id: "gsp_aceite_aguacate", nombre: "Aceite de aguacate o canola", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, dietTags: [], keywords: ["aceite de aguacate", "aceite vegetal"] },
    { id: "gsp_aceite_coco", nombre: "Aceite de coco", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, dietTags: [], keywords: ["aceite de coco"] },
    { id: "gsp_aceitunas", nombre: "Aceitunas verdes o negras", cantidadBase: 8, unidadBase: "piezas", gramosBase: 32, dietTags: [], keywords: ["aceitunas"] },
    { id: "gsp_crema_acida", nombre: "Crema ácida o media crema reducida en grasa", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 15, dietTags: ["lacteos"], keywords: ["crema", "media crema"] },
    { id: "gsp_mantequilla", nombre: "Mantequilla o Ghee", cantidadBase: 1.5, unidadBase: "cditas", gramosBase: 6, dietTags: ["lacteos"], keywords: ["mantequilla", "ghee"] },
    { id: "gsp_mayonesa_light", nombre: "Mayonesa reducida en grasa", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 15, dietTags: [], keywords: ["mayonesa"] },
    { id: "gsp_queso_crema_light", nombre: "Queso crema light (Philadelphia)", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 19, dietTags: ["lacteos"], keywords: ["queso crema"] },
  ],
  grasas_cp: [
    { id: "gcp_almendras", nombre: "Almendras enteras o fileteadas", cantidadBase: 10, unidadBase: "piezas", gramosBase: 12, dietTags: ["nueces"], keywords: ["almendra", "almendras"] },
    { id: "gcp_nueces", nombre: "Nuez de Castilla (mitades)", cantidadBase: 7, unidadBase: "mitades", gramosBase: 14, dietTags: ["nueces"], keywords: ["nuez", "nueces"] },
    { id: "gcp_nuez_india", nombre: "Nuez de la India (Anacardos / Cashews)", cantidadBase: 7, unidadBase: "piezas", gramosBase: 13, dietTags: ["nueces"], keywords: ["nuez de la india", "cashews"] },
    { id: "gcp_pistaches", nombre: "Pistaches sin cáscara", cantidadBase: 18, unidadBase: "piezas", gramosBase: 13, dietTags: ["nueces"], keywords: ["pistache", "pistaches"] },
    { id: "gcp_cacahuates", nombre: "Cacahuate natural tostado", cantidadBase: 14, unidadBase: "piezas", gramosBase: 12, dietTags: ["nueces"], keywords: ["cacahuate", "cacahuates"] },
    { id: "gcp_crema_cacahuate", nombre: "Crema de cacahuate o almendra natural (sin azúcar)", cantidadBase: 2, unidadBase: "cditas", gramosBase: 10, dietTags: ["nueces"], keywords: ["crema de cacahuate", "mantequilla de mani", "crema de almendra"] },
    { id: "gcp_chia", nombre: "Semillas de chía o linaza", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 12, dietTags: [], keywords: ["chia", "chía", "linaza"] },
    { id: "gcp_pepitas", nombre: "Semillas de calabaza (Pepitas) o girasol", cantidadBase: 1.5, unidadBase: "cucharadas", gramosBase: 14, dietTags: [], keywords: ["semillas de calabaza", "pepitas", "semillas de girasol"] },
    { id: "gcp_ajonjoli", nombre: "Ajonjolí tostado o Tahini", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 10, dietTags: [], keywords: ["ajonjoli", "ajonjolí", "tahini"] },
  ],
  azucares_sg: [
    { id: "az_miel", nombre: "Miel de abeja o jarabe de maple puro", cantidadBase: 2, unidadBase: "cditas", gramosBase: 14, dietTags: [], keywords: ["miel", "miel de abeja", "jarabe de maple"] },
    { id: "az_mermelada", nombre: "Mermelada de fruta", cantidadBase: 2.5, unidadBase: "cditas", gramosBase: 17, dietTags: [], keywords: ["mermelada"] },
    { id: "az_ate", nombre: "Ate de membrillo o guayaba", cantidadBase: 15, unidadBase: "g", gramosBase: 15, dietTags: [], keywords: ["ate"] },
  ],
  libres: [
    { id: "lib_ajo", nombre: "Ajo fresco o en polvo", cantidadBase: 1, unidadBase: "cdita", gramosBase: 5, dietTags: [], keywords: ["ajo"] },
    { id: "lib_canela", nombre: "Canela en polvo o raja", cantidadBase: 1, unidadBase: "cdita", gramosBase: 3, dietTags: [], keywords: ["canela"] },
    { id: "lib_cilantro_perejil", nombre: "Cilantro, perejil o epazote fresco", cantidadBase: 0.25, unidadBase: "taza", gramosBase: 15, dietTags: [], keywords: ["cilantro", "perejil", "epazote"] },
    { id: "lib_limon", nombre: "Jugo de limón", cantidadBase: 2, unidadBase: "cucharadas", gramosBase: 30, dietTags: [], keywords: ["limon", "limón"] },
    { id: "lib_mostaza", nombre: "Mostaza Dijon o amarilla", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 15, dietTags: [], keywords: ["mostaza"] },
    { id: "lib_salsa_picante", nombre: "Chile serrano, jalapeño, habanero o chipotle", cantidadBase: 1, unidadBase: "pieza", gramosBase: 15, dietTags: [], keywords: ["chile serrano", "jalapeño", "chipotle", "habanero"] },
    { id: "lib_vinagre", nombre: "Vinagre de manzana o balsámico", cantidadBase: 1, unidadBase: "cucharada", gramosBase: 15, dietTags: [], keywords: ["vinagre"] },
    { id: "lib_cafe_te", nombre: "Café americano o Té sin azúcar", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, dietTags: [], keywords: ["cafe", "café", "te verde", "infusion"] },
    { id: "lib_leche_almendras", nombre: "Bebida de almendra sin azúcar (0g azúcar)", cantidadBase: 1, unidadBase: "taza", gramosBase: 240, dietTags: ["nueces"], keywords: ["leche de almendras", "leche de almendra"] },
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
    if (eq > 0 && grp.id !== "libres") {
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
 * Calcula una distribución clínica equilibrada en pasos de 0.5 equivalentes y aplica un cierre
 * iterativo de precisión para converger con las calorías y macros prescritos (Matemático, IA o Manual).
 */
export function autoDistributeSmaeFromMacros({ calorias = 2000, proteina = 140, carbohidratos = 200, grasas = 60 } = {}) {
  const targetKcal = Number(calorias) || 1800;
  const targetProt = Number(proteina) || Math.round((targetKcal * 0.28) / 4);
  const targetCarbs = Number(carbohidratos) || Math.round((targetKcal * 0.45) / 4);
  const targetFat = Number(grasas) || Math.round((targetKcal * 0.27) / 9);

  const roundHalf = (val) => Math.max(0, Math.round(val * 2) / 2);

  // 1. Base de micronutrientes y fibra adaptada al nivel calórico y de carbohidratos real
  let verduras = targetKcal >= 2200 ? 5 : targetKcal >= 1500 ? 4 : 3;
  let frutas = targetCarbs >= 210 ? 3 : targetCarbs >= 130 ? 2 : targetCarbs >= 70 ? 1 : 0.5;
  let leche_d = targetKcal >= 1600 && targetCarbs >= 90 ? 1 : targetCarbs >= 60 ? 0.5 : 0;
  let leguminosas = targetCarbs >= 150 ? 1 : targetCarbs >= 90 ? 0.5 : 0;

  // 2. Carbohidratos restantes → Cereales sin grasa (15g C, 2g P, 70 kcal por eq)
  const carbsUsed = verduras * 4 + frutas * 15 + leche_d * 12 + leguminosas * 20;
  const remCarbs = Math.max(0, targetCarbs - carbsUsed);
  let cereales_sg = roundHalf(remCarbs / 15);

  // 3. Proteína restante → AOA Muy Bajo (40 kcal, 7g P, 1g G), AOA Bajo (55 kcal, 7g P, 3g G), AOA Moderado (75 kcal, 7g P, 5g G)
  let grasas_cp = targetFat >= 60 ? 2 : targetFat >= 35 ? 1 : 0.5;
  const protUsed =
    verduras * 2 +
    cereales_sg * 2 +
    leguminosas * 8 +
    leche_d * 9 +
    grasas_cp * 3;

  const remProt = Math.max(7, targetProt - protUsed);
  const totalAoaEq = remProt / 7;
  let aoa_m = totalAoaEq >= 5 ? 2 : totalAoaEq >= 2.5 ? 1 : 0.5;
  let aoa_b = roundHalf(Math.max(0, (totalAoaEq - aoa_m) * 0.3));
  let aoa_mb = roundHalf(Math.max(0.5, totalAoaEq - aoa_m - aoa_b));

  // 4. Grasas restantes → Aceites y Grasas sin proteína (45 kcal, 5g G por eq)
  const fatUsed =
    leguminosas * 1 +
    aoa_mb * 1 +
    aoa_b * 3 +
    aoa_m * 5 +
    leche_d * 2 +
    grasas_cp * 5;
  const remFat = Math.max(0, targetFat - fatUsed);
  let grasas_sp = roundHalf(remFat / 5);

  const map = {
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
    leche_sd: 0,
    leche_e: 0,
    grasas_sp,
    grasas_cp,
    azucares_sg: 0,
    libres: 0,
  };

  // 5. Pase de convergencia calórica y de macros (ajusta en bloques de 0.5 eq hasta quedar dentro de ±20 kcal)
  for (let step = 0; step < 16; step++) {
    const cur = calculateSmaeTotals(map);
    const diffKcal = targetKcal - cur.kcal;
    if (Math.abs(diffKcal) <= 20) break;

    const diffC = targetCarbs - cur.carbohidratos;
    const diffP = targetProt - cur.proteina;
    const diffG = targetFat - cur.grasas;

    if (diffKcal > 20) {
      if (diffC >= 6) {
        map.cereales_sg = roundHalf(map.cereales_sg + 0.5);
      } else if (diffG >= 2.5) {
        map.grasas_sp = roundHalf(map.grasas_sp + 0.5);
      } else if (diffP >= 3) {
        map.aoa_mb = roundHalf(map.aoa_mb + 0.5);
      } else {
        map.grasas_sp = roundHalf(map.grasas_sp + 0.5);
      }
    } else if (diffKcal < -20) {
      if (diffC <= -6 && map.cereales_sg >= 0.5) {
        map.cereales_sg = roundHalf(map.cereales_sg - 0.5);
      } else if (diffG <= -2.5 && map.grasas_sp >= 0.5) {
        map.grasas_sp = roundHalf(map.grasas_sp - 0.5);
      } else if (diffP <= -3 && map.aoa_mb >= 1) {
        map.aoa_mb = roundHalf(map.aoa_mb - 0.5);
      } else if (map.grasas_sp >= 0.5) {
        map.grasas_sp = roundHalf(map.grasas_sp - 0.5);
      } else if (map.cereales_sg >= 0.5) {
        map.cereales_sg = roundHalf(map.cereales_sg - 0.5);
      } else if (map.aoa_b >= 0.5) {
        map.aoa_b = roundHalf(map.aoa_b - 0.5);
      } else {
        break;
      }
    }
  }

  return map;
}

/**
 * Serializa y deserializa el mapa de equivalentes SMAE para guardarlo en la metadata del día o comida.
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
 * Extrae o embebe el mapa estructurado de equivalentes SMAE dentro del texto de una comida
 * o usa la propiedad explícita `meal.smaeMap` si ya está presente en memoria.
 */
const MEAL_SMAE_TAG_REGEX = /\n?\[SMAE:([a-z0-9_.,=]+)\]$/i;

export function extractSmaeMapFromMealText(rawText = "") {
  const str = String(rawText || "");
  const m = str.match(MEAL_SMAE_TAG_REGEX);
  if (!m) return { cleanText: str, smaeMap: null };
  return {
    cleanText: str.replace(MEAL_SMAE_TAG_REGEX, "").trimEnd(),
    smaeMap: parseSmaeString(m[1]),
  };
}

export function embedSmaeMapInMealText(cleanText = "", smaeMap = {}) {
  const stripped = String(cleanText || "").replace(MEAL_SMAE_TAG_REGEX, "").trimEnd();
  const serialized = serializeSmaeMap(smaeMap);
  if (!serialized) return stripped;
  return `${stripped}\n[SMAE:${serialized}]`;
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
 * Respaldo secundario de detección en texto libre cuando una comida antigua aún no tiene `smaeMap` explícito.
 */
export function detectSwappableIngredientsInMeal(mealText = "") {
  if (!mealText || typeof mealText !== "string") return [];
  const normMeal = normalizeAccents(mealText);
  const detected = [];
  const seenGroupIds = new Set();

  for (const grp of SMAE_GROUPS) {
    if (grp.id === "libres") continue;
    const foods = SMAE_FOODS_BY_GROUP[grp.id] || [];
    for (const food of foods) {
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
          .slice(0, 6)
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
 * Obtiene el mapa de equivalentes SMAE de una comida.
 * Prioriza 100% el selector explícito `meal.smaeMap` (o el tag estructurado `[SMAE:...]`),
 * usando la detección de texto solo como fallback para comidas antiguas.
 */
export function estimateMealSmaeMap(mealOrText = "") {
  if (mealOrText && typeof mealOrText === "object") {
    if (mealOrText.smaeMap && typeof mealOrText.smaeMap === "object" && Object.keys(mealOrText.smaeMap).length > 0) {
      return mealOrText.smaeMap;
    }
    const rawOpt = String(mealOrText.opciones?.[0] || mealOrText.opcion1 || "");
    const { smaeMap } = extractSmaeMapFromMealText(rawOpt);
    if (smaeMap && Object.keys(smaeMap).length > 0) return smaeMap;
    return estimateMealSmaeMap(rawOpt);
  }

  const str = String(mealOrText || "");
  const { smaeMap: embedded } = extractSmaeMapFromMealText(str);
  if (embedded && Object.keys(embedded).length > 0) return embedded;

  const detected = detectSwappableIngredientsInMeal(str);
  const map = {};
  for (const item of detected) {
    map[item.groupId] = Math.round(((map[item.groupId] || 0) + (Number(item.equivalents) || 0)) * 10) / 10;
  }
  return map;
}

/**
 * Suma los equivalentes SMAE de todas las comidas de un día.
 */
export function estimateDaySmaeUsage(comidas = []) {
  const usedMap = {};
  if (!Array.isArray(comidas)) return usedMap;
  for (const meal of comidas) {
    const mealMap = estimateMealSmaeMap(meal);
    for (const [grpId, eq] of Object.entries(mealMap)) {
      usedMap[grpId] = Math.round(((usedMap[grpId] || 0) + (Number(eq) || 0)) * 10) / 10;
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
