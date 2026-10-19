import React, { useState, useMemo, useEffect } from "react";
import { X, ShoppingBag, Check, Copy, CheckCheck, Search, Trash2, Filter, Utensils, Apple, Wheat, Milk, Package } from "lucide-react";

// Categorías del supermercado
const CATEGORIAS = {
  proteinas: {
    nombre: "Carnes y Proteínas",
    icono: "🥩",
    color: "bg-red-50 text-red-700 border-red-200",
    keywords: [
      "pollo", "pechuga", "res", "carne", "bistec", "molida", "atun", "atún", "salmon", "salmón",
      "pescado", "tilapia", "huevo", "huevos", "clara", "claras", "pavo", "jamon", "jamón",
      "camaron", "camarón", "camarones", "proteina", "proteína", "whey", "tofu", "lomo", "cerdo",
      "cottage", "panela", "sardina", "atun", "milanesa"
    ]
  },
  verduras_frutas: {
    nombre: "Frutas y Verduras",
    icono: "🥦",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    keywords: [
      "espinaca", "espinacas", "lechuga", "brocoli", "brócoli", "jitomate", "tomate", "cebolla",
      "calabaza", "calabacita", "calabacitas", "zanahoria", "zanahorias", "pepino", "pepinos",
      "pimiento", "pimientos", "champiñon", "champiñón", "champiñones", "apio", "manzana", "manzanas",
      "platano", "plátano", "platanos", "plátanos", "fresa", "fresas", "mora", "moras", "berries",
      "kiwi", "naranja", "limon", "limón", "aguacate", "aguacates", "uva", "uvas", "piña", "sandia",
      "sandía", "mango", "papaya", "guayaba", "toronja", "esparragos", "espárragos", "nopal", "nopales"
    ]
  },
  cereales: {
    nombre: "Granos, Cereales y Tubérculos",
    icono: "🍚",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    keywords: [
      "arroz", "avena", "tortilla", "tortillas", "pan", "papa", "papas", "camote", "pasta",
      "fideos", "tostada", "tostadas", "quinoa", "harina", "elote", "galleta", "galletas",
      "salvado", "bagel", "bolillo", "wrap", "crepa", "spaghetti"
    ]
  },
  lacteos_grasas: {
    nombre: "Lácteos y Grasas Saludables",
    icono: "🧀",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    keywords: [
      "leche", "yogur", "yogurt", "queso", "almendra", "almendras", "nuez", "nueces",
      "cacahuate", "cacahuates", "mani", "maní", "crema de mani", "crema de cacahuate",
      "mantequilla", "aceite", "oliva", "chia", "chía", "linaza", "semilla", "semillas",
      "margarina", "aderezo", "mayonesa"
    ]
  },
  otros: {
    nombre: "Despensa y Varios",
    icono: "📦",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    keywords: []
  }
};

// Limpieza y normalización de textos
function normalizeStr(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Extractor inteligente de cantidad y alimento
function extractQuantityAndFood(rawLine) {
  let cleaned = rawLine.trim();
  if (!cleaned || cleaned.length < 2) return null;

  // Quitar viñetas, guiones al inicio o numeraciones como "1. " o "1) "
  cleaned = cleaned.replace(/^[-*•]\s*/, "").replace(/^\d+[\.\)]\s+/, "").trim();
  if (!cleaned) return null;

  let cantidadNum = 0;
  let unidad = "";
  let itemNombre = cleaned;

  const parseNumberStr = (str) => {
    if (!str) return 0;
    str = str.trim().replace(",", ".");
    if (str.includes(" ") && str.includes("/")) {
      const parts = str.split(" ");
      const whole = parseFloat(parts[0]) || 0;
      const fracParts = parts[1].split("/");
      return whole + (parseFloat(fracParts[0]) / (parseFloat(fracParts[1]) || 1));
    }
    if (str.includes("/")) {
      const fracParts = str.split("/");
      return parseFloat(fracParts[0]) / (parseFloat(fracParts[1]) || 1);
    }
    return parseFloat(str) || 0;
  };

  const UNIDADES_LIST = "g|gr|grs|gramos|kg|kilo|kilos|ml|l|lt|lts|litros|taza|tazas|cda|cdas|cucharada|cucharadas|cdita|cditas|cucharadita|cucharaditas|pza|pzas|pieza|piezas|rebanada|rebanadas|scoop|scoops|lata|latas|sobre|sobres|vaso|vasos|paquete|paquetes";

  // ESTRATEGIA 1: Cantidad en paréntesis, ej. "Pechuga de pollo (150g)" o "Arroz (1 taza)"
  const parenMatch = cleaned.match(new RegExp(`\\((?:aprox\\.?\\s*)?(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+)\\s*(${UNIDADES_LIST})?\\)`, "i"));
  if (parenMatch) {
    cantidadNum = parseNumberStr(parenMatch[1]);
    unidad = (parenMatch[2] || "g").toLowerCase();
    itemNombre = cleaned.replace(parenMatch[0], "").trim();
  } else {
    // ESTRATEGIA 2: Cantidad al final, ej. "Pechuga de pollo 150g", "Avena 40 gr", "Pan 2 rebanadas"
    const endMatch = cleaned.match(new RegExp(`(?:[-–—:]\\s*)?(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+)\\s*(${UNIDADES_LIST})\\.?$`, "i"));
    if (endMatch) {
      cantidadNum = parseNumberStr(endMatch[1]);
      unidad = endMatch[2].toLowerCase();
      itemNombre = cleaned.slice(0, endMatch.index).trim();
    } else {
      // ESTRATEGIA 3: Cantidad al inicio con unidad explícita, ej. "150g de pechuga", "1 taza de avena", "2 rebanadas de pan"
      const startUnitMatch = cleaned.match(new RegExp(`^(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)\\s*(${UNIDADES_LIST})\\b(?:\\s+de|\\s+del)?\\s*(.*)$`, "i"));
      if (startUnitMatch) {
        cantidadNum = parseNumberStr(startUnitMatch[1]);
        unidad = startUnitMatch[2].toLowerCase();
        itemNombre = (startUnitMatch[3] || "").trim();
      } else {
        // ESTRATEGIA 4: Número o fracción al inicio sin unidad explícita, ej. "1/2 aguacate", "2 huevos", "3 claras", "1 manzana"
        const countMatch = cleaned.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:de\s+)?(.*)$/i);
        if (countMatch && countMatch[2] && countMatch[2].trim().length > 1) {
          cantidadNum = parseNumberStr(countMatch[1]);
          unidad = "pzas";
          itemNombre = countMatch[2].trim();
        }
      }
    }
  }

  // Limpiar nombre del ingrediente
  itemNombre = itemNombre
    .replace(/^[-–—:,]\s*/, "")
    .replace(/[-–—:,]\s*$/, "")
    .replace(/^(de|del|en)\s+/i, "")
    .trim();

  if (!itemNombre) itemNombre = cleaned;

  // Normalizar unidad
  if (["gr", "grs", "gramos"].includes(unidad)) unidad = "g";
  if (["kilo", "kilos"].includes(unidad)) unidad = "kg";
  if (["lt", "lts", "litros"].includes(unidad)) unidad = "L";
  if (["pieza", "piezas", "pza"].includes(unidad)) unidad = "pzas";
  if (["tazas"].includes(unidad)) unidad = "taza";
  if (["rebanadas"].includes(unidad)) unidad = "rebanada";
  if (["cdas", "cucharada", "cucharadas"].includes(unidad)) unidad = "cda";
  if (["cditas", "cucharadita", "cucharaditas"].includes(unidad)) unidad = "cdita";
  if (["scoops"].includes(unidad)) unidad = "scoop";
  if (["latas"].includes(unidad)) unidad = "lata";
  if (["sobres"].includes(unidad)) unidad = "sobre";
  if (["vasos"].includes(unidad)) unidad = "vaso";

  return {
    itemNombre,
    cantidadNum: cantidadNum > 0 ? cantidadNum : null,
    unidad: cantidadNum > 0 ? (unidad || "pzas") : ""
  };
}

// Analizador de ingredientes
function parseDietIngredients(dias, incluirAlternativas = false) {
  const map = new Map();

  dias.forEach((dia) => {
    (dia?.comidas || []).forEach((meal) => {
      const textsToParse = [meal.opcion1];
      if (incluirAlternativas && meal.opcion2) {
        textsToParse.push(meal.opcion2);
      }

      textsToParse.forEach((fullText) => {
        if (!fullText || typeof fullText !== "string") return;

        // Separar por comas, saltos de línea, signos + o punto y coma
        const rawLines = fullText.split(/[\n,;+]|\s+y\s+|\s+con\s+/i);

        rawLines.forEach((line) => {
          const parsed = extractQuantityAndFood(line);
          if (!parsed) return;

          const { itemNombre, cantidadNum, unidad } = parsed;

          // Identificar categoría según diccionario
          const normalizedItem = normalizeStr(itemNombre);
          let detectedCategory = "otros";

          for (const [catKey, catDef] of Object.entries(CATEGORIAS)) {
            if (catKey === "otros") continue;
            if (catDef.keywords.some((kw) => normalizedItem.includes(kw))) {
              detectedCategory = catKey;
              break;
            }
          }

          // Agrupación en el map
          const key = `${detectedCategory}_${normalizedItem}_${unidad}`;
          if (map.has(key)) {
            const existing = map.get(key);
            existing.veces += 1;
            if (cantidadNum && existing.cantidadNum) {
              existing.cantidadNum += cantidadNum;
            }
          } else {
            // Capitalizar la primera letra del nombre original
            const displayNombre = itemNombre.charAt(0).toUpperCase() + itemNombre.slice(1);
            map.set(key, {
              id: key,
              nombre: displayNombre,
              categoria: detectedCategory,
              cantidadNum: cantidadNum || null,
              unidad: unidad || "",
              veces: 1
            });
          }
        });
      });
    });
  });

  return Array.from(map.values());
}

export default function GroceryListModal({ dias = [], onClose, clienteNombre, semanaActualCiclo = 1 }) {
  const [incluirAlt, setIncluirAlt] = useState(false);
  const [activeFilter, setActiveFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  // Clave de almacenamiento local para persistir los checks de compra
  const storageKey = `flux_grocery_checked_${clienteNombre || "global"}_s${semanaActualCiclo}`;
  const [checkedItems, setCheckedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(checkedItems));
    } catch (e) {
      console.error(e);
    }
  }, [checkedItems, storageKey]);

  // Lista de ingredientes parseados
  const ingredients = useMemo(() => {
    return parseDietIngredients(dias, incluirAlt);
  }, [dias, incluirAlt]);

  // Filtrado de ingredientes por categoría y búsqueda
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      const matchesCat = activeFilter === "todos" || item.categoria === activeFilter;
      const matchesSearch = !search || normalizeStr(item.nombre).includes(normalizeStr(search));
      return matchesCat && matchesSearch;
    });
  }, [ingredients, activeFilter, search]);

  // Conteo de completados
  const totalCount = ingredients.length;
  const completedCount = useMemo(() => {
    return ingredients.filter((it) => !!checkedItems[it.id]).length;
  }, [ingredients, checkedItems]);

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleClearAll = () => {
    setCheckedItems({});
  };

  const handleCopy = () => {
    // Generar formato limpio agrupado por categorías para WhatsApp / Notas
    let text = `🛒 *LISTA DEL SÚPER — SEMANA ${semanaActualCiclo}*\n`;
    if (clienteNombre) text += `👤 Paciente: ${clienteNombre}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const groups = {};
    ingredients.forEach((item) => {
      if (!groups[item.categoria]) groups[item.categoria] = [];
      groups[item.categoria].push(item);
    });

    Object.entries(CATEGORIAS).forEach(([catKey, catDef]) => {
      const itemsInCat = groups[catKey];
      if (itemsInCat && itemsInCat.length > 0) {
        text += `${catDef.icono} *${catDef.nombre.toUpperCase()}*\n`;
        itemsInCat.forEach((it) => {
          const isDone = !!checkedItems[it.id];
          const checkIcon = isDone ? "✅" : "▫️";
          let qtyStr = "";
          if (it.cantidadNum) {
            qtyStr = ` — ${Math.round(it.cantidadNum * 10) / 10} ${it.unidad}`.trim();
          }
          text += `${checkIcon} ${it.nombre}${qtyStr}\n`;
        });
        text += `\n`;
      }
    });

    text += `_Generado con FLUX Nutrición_`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B1929]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── Modal Header ── */}
        <div className="p-6 border-b border-[#F0F4FA] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F1FB] text-[var(--brand-primary)] flex items-center justify-center shadow-sm">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                Lista de Compras del Súper
              </h2>
              <p className="text-xs text-[#6B7A8D] mt-0.5">
                Ingredientes agrupados de tu plan semanal (Semana {semanaActualCiclo})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-[#6B7A8D] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Toolbar: Search, Filters, Stats & Export ── */}
        <div className="p-5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col gap-3.5 shrink-0">
          
          {/* Top Row: Search & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Buscar ingrediente (ej. pollo, arroz, avena)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] placeholder-[#94A3B8] focus:outline-none focus:border-[var(--brand-primary)] shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--brand-primary)] hover:opacity-90 shadow-sm transition-all cursor-pointer shrink-0"
              >
                {copied ? <CheckCheck size={14} className="text-green-300" /> : <Copy size={14} />}
                <span>{copied ? "¡Copiado!" : "Copiar a WhatsApp"}</span>
              </button>

              {completedCount > 0 && (
                <button
                  onClick={handleClearAll}
                  title="Desmarcar todos"
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-white border border-[#E2E8F0] hover:text-red-600 hover:border-red-200 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Middle Row: Progress indicator & Alternatives toggle */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs text-[#6B7A8D]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#0B1929]">
                {completedCount} de {totalCount} comprados
              </span>
              <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={incluirAlt}
                onChange={(e) => setIncluirAlt(e.target.checked)}
                className="rounded text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
              />
              <span className="text-xs">Incluir opciones alternativas (Opción 2)</span>
            </label>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto scroll-hide pb-0.5">
            <button
              onClick={() => setActiveFilter("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === "todos"
                  ? "bg-[#0B1929] text-white shadow-sm"
                  : "bg-white text-[#6B7A8D] border border-[#E2E8F0] hover:bg-gray-50"
              }`}
            >
              Todos ({ingredients.length})
            </button>
            {Object.entries(CATEGORIAS).map(([catKey, catDef]) => {
              const count = ingredients.filter((it) => it.categoria === catKey).length;
              if (count === 0) return null;
              return (
                <button
                  key={catKey}
                  onClick={() => setActiveFilter(catKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    activeFilter === catKey
                      ? "bg-[var(--brand-primary)] text-white shadow-sm"
                      : "bg-white text-[#6B7A8D] border border-[#E2E8F0] hover:bg-gray-50"
                  }`}
                >
                  <span>{catDef.icono}</span>
                  <span>{catDef.nombre}</span>
                  <span className="opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Ingredients Checklist Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredIngredients.length === 0 ? (
            <div className="py-12 text-center text-[#6B7A8D]">
              <ShoppingBag size={36} className="mx-auto mb-2 text-[#CBD5E1]" />
              <p className="font-semibold text-[#0B1929]">No se encontraron ingredientes</p>
              <p className="text-xs mt-1">Prueba con otro término de búsqueda o categoría.</p>
            </div>
          ) : (
            filteredIngredients.map((item) => {
              const isChecked = !!checkedItems[item.id];
              const catDef = CATEGORIAS[item.categoria] || CATEGORIAS.otros;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                    isChecked
                      ? "bg-gray-50/80 border-[#E2E8F0] opacity-60"
                      : "bg-white border-[#E2E8F0] hover:border-[var(--brand-primary)]/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                        isChecked
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {isChecked && <Check size={14} className="stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-sm font-bold truncate transition-all ${
                          isChecked ? "line-through text-[#94A3B8]" : "text-[#0B1929]"
                        }`}
                      >
                        {item.nombre}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#6B7A8D] font-mono">
                          {catDef.icono} {catDef.nombre}
                        </span>
                        {item.veces > 1 && (
                          <span className="text-[10px] text-[var(--brand-primary)] font-medium">
                            • en {item.veces} comidas
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.cantidadNum ? (
                    <div className="shrink-0 text-right">
                      <span className="inline-block px-3 py-1 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 font-mono font-bold text-xs shadow-xs">
                        {Math.round(item.cantidadNum * 10) / 10} {item.unidad}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#94A3B8] italic shrink-0 px-2">Al gusto</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="p-4 bg-gray-50 border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <p className="text-xs text-[#6B7A8D]">
            💡 Los artículos tachados se guardan automáticamente para cuando vayas al súper.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
