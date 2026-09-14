import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

const regex = /const graficaData = targetExObj[\s\S]*?\}\)\.filter\(Boolean\)[\s\S]*?: \[\];/;

const newCode = `  let graficaDataRaw = targetExObj
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
        return { dataPoint, hasData };
      })
    : [];

  const lastDataIndex = graficaDataRaw.reduce((lastIdx, item, idx) => item.hasData ? idx : lastIdx, -1);
  const graficaData = lastDataIndex === -1 ? [] : graficaDataRaw.slice(0, lastDataIndex + 1).map(i => i.dataPoint);`;

content = content.replace(regex, newCode);
fs.writeFileSync('src/components/cliente/Training.jsx', content);
