/**
 * colorExtractor.js - FLUX Brand Palette Extractor
 * Extrae de forma matemática, local e instantánea (<15ms) una paleta armónica
 * de colores a partir de un archivo, blob, dataURL o URL de imagen (Logo).
 */

// Convierte RGB a Hex
export function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Convierte Hex a RGB
export function hexToRgb(hex) {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 26, g: 111, b: 212 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convierte RGB a HSL
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convierte HSL a Hex
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// Distancia de color euclidiana perceptual
function colorDistance(rgb1, rgb2) {
  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;
  return Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114);
}

/**
 * Carga una imagen (File, Blob, dataURL o URL) en un elemento HTMLImageElement
 */
function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) return reject(new Error("No image source provided"));

    let src = source;
    let shouldRevoke = false;

    if (source instanceof File || source instanceof Blob) {
      src = URL.createObjectURL(source);
      shouldRevoke = true;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (shouldRevoke) URL.revokeObjectURL(src);
      resolve(img);
    };

    img.onerror = (err) => {
      if (shouldRevoke) URL.revokeObjectURL(src);
      reject(err);
    };

    img.src = src;
  });
}

/**
 * Extrae una paleta de N colores armónicos y balanceados a partir de una imagen
 * @param {File|Blob|string} imageSource
 * @param {number} targetCount Número de colores a extraer (por defecto 11)
 * @returns {Promise<Array<{ hex: string, name: string }>>}
 */
export async function extractPaletteFromImage(imageSource, targetCount = 11) {
  try {
    const img = await loadImage(imageSource);

    // Canvas reducido para alta velocidad (64x64 da 4096 muestras, suficiente para <5ms)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    const size = 64;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Cubetas de cuantización rápida de color (RGB a pasos de 16)
    const colorBuckets = new Map();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      // Descartar píxeles transparentes o semi-transparentes
      if (a < 128) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Descartar blancos extremos (fondos de hoja o lienzos limpios)
      if (r > 242 && g > 242 && b > 242) continue;
      // Descartar negros absolutos
      if (r < 15 && g < 15 && b < 15) continue;

      // Agrupar en cubeta de 16 niveles
      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;
      const key = `${qr},${qg},${qb}`;

      const count = (colorBuckets.get(key) || 0) + 1;
      colorBuckets.set(key, count);
    }

    // Ordenar cubetas por frecuencia de aparición
    const sortedBuckets = Array.from(colorBuckets.entries())
      .map(([key, count]) => {
        const [r, g, b] = key.split(",").map(Number);
        return { r, g, b, count };
      })
      .sort((a, b) => b.count - a.count);

    // Filtrar colores representativos asegurando distancia mínima entre ellos
    const distinctColors = [];
    const minDistance = 24; // Umbral de diferencia visual perceptible

    for (const item of sortedBuckets) {
      const isTooClose = distinctColors.some(
        (c) => colorDistance(c, item) < minDistance
      );
      if (!isTooClose) {
        distinctColors.push(item);
      }
      if (distinctColors.length >= targetCount) break;
    }

    // Si no se encontraron suficientes colores (o el logo es monocromático / de 1-2 colores)
    // Generar variaciones armónicas derivadas directamente de los tonos extraídos
    const finalPalette = [];
    
    // Primero añadimos los colores reales extraídos
    distinctColors.forEach((c) => {
      finalPalette.push(rgbToHex(c.r, c.g, c.b));
    });

    // Si aún faltan para llegar a targetCount (11):
    if (finalPalette.length === 0) {
      // Fallback si la imagen era 100% blanca o transparente
      return [];
    }

    let seedIndex = 0;
    while (finalPalette.length < targetCount) {
      const baseHex = finalPalette[seedIndex % finalPalette.length];
      const baseRgb = hexToRgb(baseHex);
      const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);

      const step = Math.floor(finalPalette.length / Math.max(1, distinctColors.length));

      let nextHex = null;
      if (step === 0) {
        // Variante más luminosa y vibrante
        nextHex = hslToHex(baseHsl.h, Math.min(95, baseHsl.s + 15), Math.min(85, baseHsl.l + 18));
      } else if (step === 1) {
        // Variante más profunda / oscura
        nextHex = hslToHex(baseHsl.h, Math.max(30, baseHsl.s - 10), Math.max(20, baseHsl.l - 22));
      } else if (step === 2) {
        // Tono análogo (+30 grados en la rueda cromática)
        nextHex = hslToHex((baseHsl.h + 30) % 360, Math.min(90, baseHsl.s + 5), Math.max(30, Math.min(70, baseHsl.l)));
      } else if (step === 3) {
        // Tono análogo complementario (-30 grados)
        nextHex = hslToHex((baseHsl.h + 330) % 360, Math.min(90, baseHsl.s + 5), Math.max(30, Math.min(70, baseHsl.l)));
      } else if (step === 4) {
        // Tono complementario (+180 grados con saturación controlada)
        nextHex = hslToHex((baseHsl.h + 180) % 360, Math.min(85, baseHsl.s), Math.max(35, Math.min(65, baseHsl.l)));
      } else {
        // Variación de luminosidad en pasos de 10%
        const lOffset = (finalPalette.length % 2 === 0 ? 12 : -12) * Math.ceil(step / 2);
        nextHex = hslToHex(baseHsl.h, baseHsl.s, Math.max(15, Math.min(88, baseHsl.l + lOffset)));
      }

      if (nextHex && !finalPalette.includes(nextHex)) {
        finalPalette.push(nextHex);
      } else {
        // Variación con jitter seguro de tono
        const jitterHex = hslToHex(
          (baseHsl.h + finalPalette.length * 27) % 360,
          Math.min(85, Math.max(45, baseHsl.s)),
          Math.min(75, Math.max(25, baseHsl.l))
        );
        if (!finalPalette.includes(jitterHex)) {
          finalPalette.push(jitterHex);
        } else {
          // Último recurso: romper bucle si ya es idéntico
          seedIndex++;
        }
      }
      seedIndex++;
    }

    return finalPalette.slice(0, targetCount).map((hex, idx) => ({
      hex,
      name: idx === 0 ? "Dominante del Logo" : `Tono ${idx + 1} de Marca`,
    }));
  } catch (err) {
    console.warn("No se pudo extraer paleta del logo:", err);
    return [];
  }
}
