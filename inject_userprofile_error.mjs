import fs from 'fs';
let content = fs.readFileSync('src/components/UserProfile.jsx', 'utf8');

// Add saveError state
content = content.replace(
  'const [saveSuccess, setSaveSuccess] = useState(false);',
  'const [saveSuccess, setSaveSuccess] = useState(false);\n  const [saveError, setSaveError] = useState(false);'
);

// Reset saveError in timeout
content = content.replace(
  'setIsSaving(true);\n      setSaveSuccess(false);',
  'setIsSaving(true);\n      setSaveSuccess(false);\n      setSaveError(false);'
);

// Set saveError in catch
content = content.replace(
  'console.error("Error al autoguardar:", e);\n      }',
  'console.error("Error al autoguardar:", e);\n        setSaveError(true);\n      }'
);

// Add UI for saveError (XCircle)
content = content.replace(
  'import { User, Mail, LogOut, ShoppingBag, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";',
  'import { User, Mail, LogOut, ShoppingBag, RefreshCw, CheckCircle2, Loader2, XCircle } from "lucide-react";'
);

content = content.replace(
  '{saveSuccess && !isSaving && <CheckCircle2 size={18} className="text-green-500" />}',
  '{saveSuccess && !isSaving && <CheckCircle2 size={18} className="text-green-500" />}\n          {saveError && !isSaving && <XCircle size={18} className="text-red-500" title="Error de permisos al guardar" />}'
);

fs.writeFileSync('src/components/UserProfile.jsx', content);
