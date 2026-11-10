import { stripSmaeTag } from "../../lib/smaeData";
import React, { useState, useMemo, useEffect } from "react";
import { X, ShoppingBag, Check, Copy, CheckCheck, Search, Trash2, Filter, Utensils, Apple, Wheat, Milk, Package, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { useBackButton } from "../../lib/backButtonHandler";
import { parseMealOptions } from "../../lib/mealOptions";
import { generateGroceryListWithAi } from "../../lib/clinicalAi";

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

  const UNIDADES_LIST = "g|gr|grs|gm|gms|gramo|gramos|kg|kilo|kilos|ml|l|lt|lts|litros|taza|tazas|cda|cdas|cucharada|cucharadas|cdita|cditas|cucharadita|cucharaditas|pza|pzas|pieza|piezas|rebanada|rebanadas|scoop|scoops|lata|latas|sobre|sobres|vaso|vasos|paquete|paquetes";

  // ESTRATEGIA 1: Cantidad en paréntesis, ej. "Pechuga de pollo (150g)" o "Arroz (1 taza)"
  const parenMatch = cleaned.match(new RegExp(`\\((?:aprox\\.?\\s*)?(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+)\\s*(${UNIDADES_LIST})?\\.?\\)`, "i"));
  if (parenMatch) {
    cantidadNum = parseNumberStr(parenMatch[1]);
    unidad = (parenMatch[2] || (cantidadNum >= 25 ? "g" : "pzas")).toLowerCase();
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
      const startUnitMatch = cleaned.match(new RegExp(`^(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)\\s*(${UNIDADES_LIST})\\b\\.?\\s*(?:de\\b|del\\b)?\\s*(.*)$`, "i"));
      if (startUnitMatch) {
        cantidadNum = parseNumberStr(startUnitMatch[1]);
        unidad = startUnitMatch[2].toLowerCase();
        itemNombre = (startUnitMatch[3] || "").trim();
      } else {
        // ESTRATEGIA 4: Número o fracción al inicio sin unidad explícita, ej. "1/2 aguacate", "2 huevos", "250 de carne molida"
        const countMatch = cleaned.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:de\s+|del\s+)?(.*)$/i);
        if (countMatch && countMatch[2] && countMatch[2].trim().length > 1) {
          cantidadNum = parseNumberStr(countMatch[1]);
          unidad = cantidadNum >= 25 ? "g" : "pzas";
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
  if (["gr", "grs", "gm", "gms", "gramo", "gramos"].includes(unidad)) unidad = "g";
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
      const parsedOptions = parseMealOptions(meal);
      const textsToParse = incluirAlternativas
        ? parsedOptions
        : (parsedOptions.length > 0 ? [parsedOptions[0]] : []);

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

// Normalización de items AI
function normalizeAiItem(item) {
  const rawCat = (item?.categoria || "").toLowerCase().trim();
  const cat = CATEGORIAS[rawCat] ? rawCat : "otros";
  const rawNombre = (item?.nombre || "Alimento").trim();
  const displayNombre = rawNombre.charAt(0).toUpperCase() + rawNombre.slice(1);
  const normName = normalizeStr(rawNombre);
  const un = (item?.unidad || "").toLowerCase().trim();
  const id = item?.id || `${cat}_${normName}_${un}`;
  const cant = typeof item?.cantidadNum === "number" && !isNaN(item.cantidadNum) && item.cantidadNum > 0
    ? Math.round(item.cantidadNum * 10) / 10
    : null;

  return {
    id,
    nombre: displayNombre,
    categoria: cat,
    cantidadNum: cant,
    unidad: item?.unidad || "",
    veces: typeof item?.veces === "number" && item.veces > 0 ? item.veces : 1
  };
}

export default function GroceryListModal({ dias = [], onClose, clienteNombre, semanaActualCiclo = 1 }) {
  useBackButton(true, onClose, 60);
  const [incluirAlt, setIncluirAlt] = useState(false);
  const [activeFilter, setActiveFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  // Hash del contenido de los días para invalidar caché automáticamente si cambia la dieta
  const menuHash = useMemo(() => {
    try {
      return JSON.stringify(
        (dias || []).map((d) => (d?.comidas || []).map((c) => [stripSmaeTag(c?.opcion1), stripSmaeTag(c?.opcion2)]))
      );
    } catch {
      return "";
    }
  }, [dias]);

  const aiCacheKey = `flux_grocery_ai_${clienteNombre || "global"}_s${semanaActualCiclo}_${incluirAlt ? "alt" : "main"}`;

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

  // Estado para ingredientes calculados por IA
  const [aiItems, setAiItems] = useState(() => {
    try {
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.hash === menuHash && Array.isArray(parsed?.items) && parsed.items.length > 0) {
          return parsed.items.map(normalizeAiItem);
        }
      }
    } catch (e) {
      console.warn("Error leyendo cache IA de lista de super:", e);
    }
    return null;
  });

  const [loadingAi, setLoadingAi] = useState(false);
  const [resumenDias, setResumenDias] = useState(() => {
    try {
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.hash === menuHash && parsed?.resumenDias) {
          return parsed.resumenDias;
        }
      }
    } catch {}
    return "";
  });
  const [isAiGenerated, setIsAiGenerated] = useState(() => {
    try {
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed?.hash === menuHash && parsed?.origen !== "fallback_local";
      }
    } catch {
      return false;
    }
    return false;
  });

  // Carga inteligente con IA y cache local instantáneo
  useEffect(() => {
    let isCancelled = false;

    // Si ya tenemos items en cache válidos, usarlos de inmediato
    try {
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.hash === menuHash && Array.isArray(parsed?.items) && parsed.items.length > 0) {
          setAiItems(parsed.items.map(normalizeAiItem));
          setResumenDias(parsed?.resumenDias || "");
          setIsAiGenerated(parsed?.origen !== "fallback_local");
          setLoadingAi(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Error validando cache:", e);
    }

    if (!dias || dias.length === 0) {
      setAiItems([]);
      setResumenDias("");
      setLoadingAi(false);
      return;
    }

    setLoadingAi(true);

    generateGroceryListWithAi({
      dias,
      incluirAlternativas: incluirAlt,
      fallbackFn: parseDietIngredients
    })
      .then((res) => {
        if (isCancelled) return;
        if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
          const cleaned = res.items.map(normalizeAiItem);
          const rDias = res.resumenDias || "";
          setAiItems(cleaned);
          setResumenDias(rDias);
          setIsAiGenerated(res.origen !== "fallback_local");
          try {
            localStorage.setItem(aiCacheKey, JSON.stringify({
              hash: menuHash,
              items: cleaned,
              resumenDias: rDias,
              origen: res.origen,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn(e);
          }
        } else {
          const fallback = parseDietIngredients(dias, incluirAlt).map(normalizeAiItem);
          setAiItems(fallback);
          setResumenDias("");
          setIsAiGenerated(false);
        }
      })
      .catch((err) => {
        console.warn("Fallo IA en lista de súper, activando fallback local:", err);
        if (!isCancelled) {
          const fallback = parseDietIngredients(dias, incluirAlt).map(normalizeAiItem);
          setAiItems(fallback);
          setResumenDias("");
          setIsAiGenerated(false);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingAi(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dias, incluirAlt, menuHash, aiCacheKey]);

  // Regeneración manual con IA
  const handleRegenerate = async () => {
    if (loadingAi) return;
    setLoadingAi(true);
    try {
      const res = await generateGroceryListWithAi({
        dias,
        incluirAlternativas: incluirAlt,
        fallbackFn: parseDietIngredients
      });
      if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
        const cleaned = res.items.map(normalizeAiItem);
        const rDias = res.resumenDias || "";
        setAiItems(cleaned);
        setResumenDias(rDias);
        setIsAiGenerated(res.origen !== "fallback_local");
        try {
          localStorage.setItem(aiCacheKey, JSON.stringify({
            hash: menuHash,
            items: cleaned,
            resumenDias: rDias,
            origen: res.origen,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn(e);
        }
      }
    } catch (err) {
      console.warn("Error regenerando lista de súper con IA:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  // Lista de ingredientes consolidada
  const ingredients = useMemo(() => {
    if (aiItems !== null) return aiItems;
    return parseDietIngredients(dias, incluirAlt).map(normalizeAiItem);
  }, [aiItems, dias, incluirAlt]);

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

  const targetItems = useMemo(() => {
    return filteredIngredients.length > 0 ? filteredIngredients : ingredients;
  }, [filteredIngredients, ingredients]);

  const allTargetSelected = useMemo(() => {
    if (targetItems.length === 0) return false;
    return targetItems.every((it) => !!checkedItems[it.id]);
  }, [targetItems, checkedItems]);

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleToggleSelectAll = () => {
    if (allTargetSelected) {
      // Si todos están seleccionados, desmarcar los ítems del objetivo
      const nextChecked = { ...checkedItems };
      targetItems.forEach((it) => {
        delete nextChecked[it.id];
      });
      setCheckedItems(nextChecked);
    } else {
      // Marcar todos los ítems del objetivo como comprados
      const nextChecked = { ...checkedItems };
      targetItems.forEach((it) => {
        nextChecked[it.id] = true;
      });
      setCheckedItems(nextChecked);
    }
  };

  const handleClearAll = () => {
    setCheckedItems({});
  };

  const handleCopy = () => {
    // Generar formato limpio agrupado por categorías para WhatsApp / Notas
    let text = `🛒 *LISTA DEL SÚPER — ${resumenDias ? resumenDias.toUpperCase() : `SEMANA ${semanaActualCiclo}`}*\n`;
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
    <div className="fixed inset-0 z-[100] bg-[#0B1929]/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-3xl w-full md:max-w-2xl h-full max-h-full md:h-auto md:max-h-[90vh] flex flex-col shadow-2xl border-0 md:border md:border-[#E2E8F0] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── Modal Header ── */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-[#F0F4FA] flex items-center justify-between gap-3 bg-white shrink-0 modal-safe-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#E8F1FB] text-[var(--brand-primary)] flex items-center justify-center shadow-sm shrink-0">
              <ShoppingBag size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0B1929] leading-snug truncate" style={{ fontFamily: "DM Sans" }}>
                  Lista de Compras del Súper
                </h2>
                {isAiGenerated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                    <Sparkles size={10} className="text-purple-600" />
                    IA Activa
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#6B7A8D] truncate">
                {resumenDias || `Plan semanal • Semana ${semanaActualCiclo}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-[#6B7A8D] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Toolbar: Search, Action Buttons, Progress & Filters ── */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col gap-2.5 shrink-0">
          
          {/* Row 1: Search Input + Desktop Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Buscar ingrediente (ej. pollo, arroz, avena)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0B1929] placeholder-[#94A3B8] focus:outline-none focus:border-[var(--brand-primary)] shadow-2xs"
              />
            </div>

            {/* Action Buttons: Side-by-side 2-column grid on mobile, inline flex on desktop */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className={`h-9 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    allTargetSelected
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-white text-[#0B1929] border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] shadow-2xs"
                  }`}
                >
                  {allTargetSelected ? (
                    <>
                      <CheckCheck size={14} className="text-emerald-600 shrink-0" />
                      <span className="truncate">Desmarcar todo</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="text-[var(--brand-primary)] shrink-0" />
                      <span className="truncate">Seleccionar todo</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="h-9 px-3.5 rounded-xl text-xs font-bold text-white bg-[var(--brand-primary)] hover:opacity-90 shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copied ? <CheckCheck size={14} className="text-green-300 shrink-0" /> : <Copy size={14} className="shrink-0" />}
                <span className="truncate">{copied ? "¡Copiado!" : "Copiar a WhatsApp"}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Compact Progress Bar + Alternative Options Toggle + Regenerate AI */}
          <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-[#6B7A8D]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-bold text-[#0B1929] whitespace-nowrap text-[11px] sm:text-xs">
                {completedCount}/{totalCount} comprados
              </span>
              <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden shrink-0">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
              {completedCount > 0 && !allTargetSelected && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="Desmarcar comprados"
                  className="text-[11px] font-semibold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={loadingAi}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Reanalizar y consolidar la lista nuevamente con IA"
              >
                <Sparkles size={12} className={loadingAi ? "animate-spin text-purple-600" : "text-purple-600"} />
                <span className="hidden sm:inline">{loadingAi ? "Analizando..." : "Reanalizar con IA"}</span>
                <span className="sm:hidden">{loadingAi ? "..." : "IA"}</span>
              </button>

              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] cursor-pointer select-none shrink-0 shadow-2xs">
                <input
                  type="checkbox"
                  checked={incluirAlt}
                  onChange={(e) => setIncluirAlt(e.target.checked)}
                  className="rounded text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] w-3.5 h-3.5"
                />
                <span className="text-[11px] sm:text-xs font-medium text-[#0B1929]">
                  Incluir alternativas
                </span>
              </label>
            </div>
          </div>

          {/* Row 3: Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto scroll-hide pt-0.5">
            <button
              onClick={() => setActiveFilter("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
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
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2 modal-safe-footer">
          {loadingAi && ingredients.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-xs animate-pulse">
                <Sparkles className="w-6 h-6 animate-spin text-purple-600" />
              </div>
              <p className="font-bold text-[#0B1929] text-sm" style={{ fontFamily: "DM Sans" }}>
                Consolidando lista inteligente con IA...
              </p>
              <p className="text-xs text-[#6B7A8D] max-w-xs mx-auto">
                Analizando recetas, sumando ingredientes idénticos y organizando por pasillos del súper.
              </p>
            </div>
          ) : filteredIngredients.length === 0 ? (
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
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer select-none ${
                    isChecked
                      ? "bg-gray-50/80 border-[#E2E8F0] opacity-60"
                      : "bg-white border-[#E2E8F0] hover:border-[var(--brand-primary)]/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                        isChecked
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {isChecked && <Check size={13} className="stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-sm font-bold truncate transition-all ${
                          isChecked ? "line-through text-[#94A3B8]" : "text-[#0B1929]"
                        }`}
                      >
                        {item.nombre}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-[#6B7A8D] font-mono whitespace-nowrap">
                          {catDef.icono} {catDef.nombre}
                        </span>
                        {item.veces > 1 && (
                          <span className="text-[10px] text-[var(--brand-primary)] font-medium whitespace-nowrap">
                            • en {item.veces} comidas
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.cantidadNum ? (
                    <div className="shrink-0 text-right">
                      <span className="inline-block px-2.5 py-1 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 font-mono font-bold text-xs shadow-2xs">
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
      </div>
    </div>
  );
}
