import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

const map = {
  'Membres├¡a': 'Membresía',
  'Nutrici├│n': 'Nutrición',
  'Est├ís': 'Estás',
  'ejecuci├│n': 'ejecución',
  'ver├¡an': 'verían',
  'informaci├│n': 'información',
  '┬íFelicidades': '¡Felicidades',
  'nutri├│logo': 'nutriólogo',
  'pr├│xima': 'próxima',
  'evaluaci├│n': 'evaluación',
  'Aqu├¡': 'Aquí',
  'podr├ís': 'podrás',
  'suscripci├│n': 'suscripción'
};

for (const [bad, good] of Object.entries(map)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Fixed Cliente.jsx');
