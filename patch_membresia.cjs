
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'admin', 'MiMembresia.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace imports
content = content.replace(
  /import \{ CreditCard, /g,
  'import { dbGet, dbPost, storageUpload } from " ../../lib/supabase\;\nimport { useEffect } from \react\;\nimport { CreditCard, '
);

// Replace component start
const componentStartRegex = /export default function MiMembresia\(\{ clientes, profileId, setMsg \}\) \{/;
const newComponentStart = export default function MiMembresia({ clientes, profileId, setMsg }) {
 const [perfil, setPerfil] = useState(null);
 const [loading, setLoading] = useState(true);
 const [uploading, setUploading] = useState(false);

 useEffect(() => {
 async function fetchPerfil() {
 try {
 const data = await dbGet(\profiles?id=eq.\\);
 if (data && data.length) setPerfil(data[0]);
 } catch (e) { console.error(e); }
 setLoading(false);
 }
 if (profileId) fetchPerfil();
 }, [profileId]);;

content = content.replace(componentStartRegex, newComponentStart);

// Save back
fs.writeFileSync(filePath, content, 'utf8');
console.log(\Patched MiMembresia.jsx partially\);

