import fs from 'fs';

let file = 'src/pages/Cliente.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Agregar state ultimoPeso
content = content.replace(/const \[nutriologoBloqueado, setNutriologoBloqueado\] = useState\(false\);/, `const [nutriologoBloqueado, setNutriologoBloqueado] = useState(false);\n  const [ultimoPeso, setUltimoPeso] = useState(null);`);

// 2. Cargar metricas en loadData
const loadMetricasCode = `
      try {
        const met = await dbGet(\`metricas_progreso?cliente_id=eq.\${cliente.id}&order=fecha.desc&limit=1\`);
        if (met && met.length > 0 && met[0].peso) {
          setUltimoPeso(parseFloat(met[0].peso));
        }
      } catch(e) {}
`;
content = content.replace(/setCicloActivo\(ciclo\);/, `setCicloActivo(ciclo);\n${loadMetricasCode}`);

// 3. Pasar ultimoPeso a Training
content = content.replace(/isLocked=\{isFuture\}/, `isLocked={isFuture}\n              ultimoPeso={ultimoPeso}`);

fs.writeFileSync(file, content);
