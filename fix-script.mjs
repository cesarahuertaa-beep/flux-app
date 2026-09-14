import fs from 'fs';
let scriptContent = fs.readFileSync('implement-1rm-chart.mjs', 'utf8');

scriptContent = scriptContent.replace(/content = content\.replace\(\/\\\\\/\\\\\/  1RM Estimado.*?\/, ""\);/g, '');
scriptContent = scriptContent.replace(/content = content\.replace\(\/\\\\\/\\\\\/ 🏋️ 1RM Estimado.*?\/, ""\);/g, '');
scriptContent = scriptContent.replace(/content = content\.replace\(\/\\\\\/\\\\\/ .*?1RM Estimado.*?\/, ""\);/g, '');

// More direct approach:
const lines = scriptContent.split('\n');
const filtered = lines.filter(l => !l.includes('1RM Estimado'));
fs.writeFileSync('implement-1rm-chart.mjs', filtered.join('\n'));
