import fs from 'fs';

let file = 'src/pages/Cliente.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /t0\.setHours\(0,0,0,0\);\s*const now = new Date\(\);\s*now\.setHours\(0,0,0,0\);/;

const replacement = `t0.setHours(0,0,0,0);
    // AJUSTE: Alinear t0 al Lunes de esa misma semana para que las semanas sean de Lunes a Domingo
    const day = t0.getDay();
    const diffToMonday = t0.getDate() - day + (day === 0 ? -6 : 1);
    t0.setDate(diffToMonday);
    
    const now = new Date();
    now.setHours(0,0,0,0);`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
