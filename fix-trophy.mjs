import fs from 'fs';
let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

content = content.replace(
  /import \{ (.*?) \} from "lucide-react";/,
  'import { $1, Trophy } from "lucide-react";'
);

content = content.replace(
  /<span className="text-2xl">🏆<\/span>/,
  '<Trophy size={32} className="text-[#10B981]" />'
);

content = content.replace(
  /<span className="text-2xl">Y\?<\/span>/,
  '<Trophy size={32} className="text-[#10B981]" />'
);

fs.writeFileSync('src/pages/Cliente.jsx', content);
