import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

const regexGrafica = /const primerExObj = ejercicios\[0\] \? getVariantObj\(ejercicios\[0\]\)\.obj : null;[\s\S]*?const graficaData = [\s\S]*?: \[\];/;

const newGraficaStr = `  const targetExIndex = expandedEx !== null ? expandedEx : 0;
  const targetEx = ejercicios[targetExIndex];
  const targetExObj = targetEx ? getVariantObj(targetEx).obj : null;
  const totalSemanas = rutinaActiva?.semanas || 4;
  const numSeries = targetExObj ? parseInt(targetExObj.num_series) || 4 : 4;

  const calcular1RMForGraph = (peso, reps) => {
    const p = parseFloat(peso), r = parseFloat(reps);
    if (!p || !r || p <= 0 || r <= 0) return null;
    if (r === 1) return p;
    return p * (1 + r / 30);
  };

  const graficaData = targetExObj
    ? Array.from({ length: totalSemanas }, (_, w) => {
        const dataPoint = { week: \`Sem \${w + 1}\` };
        let hasData = false;
        for (let s = 0; s < numSeries; s++) {
          const variantId = activeVariant[targetEx.id] || 'original';
          const p = parseFloat(progreso[\`\${targetEx.id}-\${w}-\${s}-peso-\${variantId}\`]);
          const rVal = progreso[\`\${targetEx.id}-\${w}-\${s}-reps-\${variantId}\`];
          const r = rVal === "Falta" ? 0 : parseFloat(rVal);
          
          if (!isNaN(p) && !isNaN(r) && p > 0 && r > 0) {
            const e1rm = calcular1RMForGraph(p, r);
            if (e1rm) {
              dataPoint[\`serie_\${s}\`] = Math.round(e1rm * 10) / 10;
              hasData = true;
            }
          }
        }
        return hasData ? dataPoint : null;
      }).filter(Boolean)
    : [];`;

content = content.replace(regexGrafica, newGraficaStr);
fs.writeFileSync('src/components/cliente/Training.jsx', content);
