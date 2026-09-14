import fs from 'fs';
let file = 'src/pages/Login.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const [showPass, setShowPass]')) {
  content = content.replace(/const \[loading, setLoading\]\s*=\s*useState\(false\);/, 'const [loading, setLoading] = useState(false);\n  const [showPass, setShowPass] = useState(false);');
}
fs.writeFileSync(file, content);
