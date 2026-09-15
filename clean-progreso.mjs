import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Progreso.jsx', 'utf8');

// Remove SilhouetteSVG
const silStart = content.indexOf('const SilhouetteSVG = () => (');
if (silStart !== -1) {
  const silEnd = content.indexOf(');', silStart) + 2;
  content = content.substring(0, silStart) + content.substring(silEnd);
}

// Remove MuscularSVG
const musStart = content.indexOf('const MuscularSVG = ({ groups }) => {');
if (musStart !== -1) {
  // It ends with </svg>\n    );\n  };
  const musEndStr = '</svg>\n    );\n  };';
  const musEnd = content.indexOf(musEndStr, musStart) + musEndStr.length;
  content = content.substring(0, musStart) + content.substring(musEnd);
}

fs.writeFileSync('src/components/cliente/Progreso.jsx', content);
