import fs from 'fs';
let content = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

content = content.replace(
  /const \[saving, setSaving\] = useState\(false\);\r?\n  const \[msg, setMsg\] = useState\(""\);\r?\n  const \[err, setErr\] = useState\(""\);/g,
  'const [saving, setSaving] = useState(false);\n  const [saveSuccess, setSaveSuccess] = useState(false);\n  const [saveError, setSaveError] = useState(false);\n  const [msg, setMsg] = useState("");\n  const [err, setErr] = useState("");'
);

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', content);
