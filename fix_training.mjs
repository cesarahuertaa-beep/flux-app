import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

// The line is:
// export default function Training({
//   rutinas,
//   progreso,
//   ...
//   }) {
//   ...
//   const [activeVariant,   setActiveVariant]   = useState({}); // { [exId]: 'original' | 'alt_0' }

const regex = /const \[activeVariant,\s*setActiveVariant\]\s*=\s*useState\(\{\}\);.*?\r?\n/m;
content = content.replace(regex, match => `${match}  const [previewEx, setPreviewEx] = useState(null);\n`);

// Wait, the second time I ran the script, did I add the modal twice?
// Let's remove any duplicates of the modal
const modalStart = '{/* Modal preview */}';
const parts = content.split(modalStart);
if (parts.length > 2) {
  // It was duplicated. Let's rebuild the content.
  content = parts[0] + modalStart + parts[parts.length - 1]; // Just keep one copy
}

// But actually, I can just replace the whole file with a clean regex logic
// I'll just write `fix_training.mjs`.

fs.writeFileSync('src/components/cliente/Training.jsx', content);
