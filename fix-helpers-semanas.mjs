import fs from 'fs';

let file = 'src/utils/helpers.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /const startStr = start\.toLocaleDateString\("es-ES", \{ day: "2-digit", month: "2-digit" \}\);\s*const endStr = end\.toLocaleDateString\("es-ES", \{ day: "2-digit", month: "2-digit" \}\);\s*return \{\s*label: \`\$\{startStr\}-\$\{endStr\}\`,\s*isCurrent: now >= start && now <= end,\s*start,\s*end\s*\};/;

const replacement = `return {
      label: \`Semana \${i + 1}\`,
      isCurrent: now >= start && now <= end,
      start,
      end
    };`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
