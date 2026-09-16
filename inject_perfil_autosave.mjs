import fs from 'fs';
let content = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

// 1. Add Loader2, XCircle to imports
content = content.replace(
  'import { User, Image as ImageIcon, MapPin, Link as LinkIcon, Phone, Save, LogOut, CheckCircle2, AlertCircle, Building2, ShoppingBag, RefreshCw, CreditCard } from "lucide-react";',
  'import { User, Image as ImageIcon, MapPin, Link as LinkIcon, Phone, Save, LogOut, CheckCircle2, AlertCircle, Building2, ShoppingBag, RefreshCw, CreditCard, Loader2, XCircle } from "lucide-react";'
);

// 2. Add save states
content = content.replace(
  'const [saving, setSaving] = useState(false);\n  const [msg, setMsg] = useState("");\n  const [err, setErr] = useState("");',
  'const [saving, setSaving] = useState(false);\n  const [saveSuccess, setSaveSuccess] = useState(false);\n  const [saveError, setSaveError] = useState(false);\n  const [msg, setMsg] = useState("");\n  const [err, setErr] = useState("");'
);

content = content.replace(
  'const [savingConfig, setSavingConfig] = useState(false);',
  'const [savingConfig, setSavingConfig] = useState(false);\n  const [configSuccess, setConfigSuccess] = useState(false);\n  const [configError, setConfigError] = useState(false);\n  const isFirstRender = useRef(true);\n  const isFirstRenderConfig = useRef(true);'
);

// 3. Add auto-save useEffects just before handleSaveConfig
const autoSaves = `
  // Auto-save para el perfil
  useEffect(() => {
    if (loading) return; // No auto-guardar mientras carga
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeoutId = setTimeout(async () => {
      setSaving(true);
      setSaveSuccess(false);
      setSaveError(false);
      try {
        const res = await dbPatch(\`profiles?id=eq.\${profileId}\`, {
          nombre: form.nombre,
          nombre_marca: form.nombre_marca,
          cedula: form.cedula,
          telefono: form.telefono,
          especialidad: form.especialidad,
          ubicacion_texto: form.ubicacion_texto,
          mapa_url: form.mapa_url,
          color_primario: form.color_primario,
          logo_url: form.logo_url
        });
        if (Array.isArray(res) && res.length === 0) {
          throw new Error("RLS error");
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (error) {
        setSaveError(true);
      }
      setSaving(false);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [form.nombre, form.nombre_marca, form.cedula, form.telefono, form.especialidad, form.ubicacion_texto, form.mapa_url, form.color_primario, form.logo_url, profileId, loading]);

  // Auto-save para config de cobro
  useEffect(() => {
    if (!isSuperadmin || loading) return;
    if (isFirstRenderConfig.current) {
      isFirstRenderConfig.current = false;
      return;
    }
    const timeoutId = setTimeout(async () => {
      setSavingConfig(true);
      setConfigSuccess(false);
      setConfigError(false);
      try {
        const res = await dbPatch("configuracion_plataforma?id=eq.1", {
          clabe: configPago.clabe,
          banco: configPago.banco,
          beneficiario: configPago.beneficiario,
          updated_at: new Date().toISOString()
        });
        if (Array.isArray(res) && res.length === 0) {
          throw new Error("RLS error");
        }
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 2000);
      } catch (error) {
        setConfigError(true);
      }
      setSavingConfig(false);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [configPago.clabe, configPago.banco, configPago.beneficiario, isSuperadmin, loading]);

`;
content = content.replace('const handleSaveConfig = async () => {', autoSaves + '\n  const handleSaveConfig = async () => {');

// 4. Remove original handleSaveConfig and handleSave buttons and alerts in UI
// First remove the old alerts
content = content.replace(/\{msg && \([\s\S]*?<\/div>\s*\)\}\s*\{err && \([\s\S]*?<\/div>\s*\)\}/, '');

// Second, add the silent indicator to the header
const headerReplace = /<div className="mb-6">\s*<h1 className="text-3xl font-extrabold text-\[\#0B1929\] tracking-tight" style=\{\{ fontFamily: 'DM Sans, sans-serif' \}\}>\s*\{isTeam \? "Configuraci.n de Cuenta" : "Configuraci.n de Profesional"\}\s*<\/h1>\s*<p className="text-\[\#6B7A8D\] mt-1">\s*\{isTeam \? "Actualiza tu informaci.n de contacto personal\." : "Completa estos datos para aparecer correctamente en el Directorio P.blico\."\}\s*<\/p>\s*<\/div>/;

const newHeader = `<div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {isTeam ? "Configuración de Cuenta" : "Configuración de Profesional"}
          </h1>
          <p className="text-[#6B7A8D] mt-1">
            {isTeam ? "Actualiza tu información de contacto personal." : "Completa estos datos para aparecer correctamente en el Directorio Público."}
          </p>
        </div>
        <div className="h-6 flex items-center justify-end min-w-[24px]">
          {saving && <Loader2 size={18} className="text-[#6B7A8D] animate-spin" />}
          {saveSuccess && !saving && <CheckCircle2 size={18} className="text-green-500" />}
          {saveError && !saving && <XCircle size={18} className="text-red-500" title="Error al guardar" />}
        </div>
      </div>`;

content = content.replace(headerReplace, newHeader);

// 5. Remove the handleSave button and adjust the bottom buttons
const saveButtonRegex = /<button onClick=\{handleSave\}[^>]*>\s*\{saving \? "Guardando\.\.\." : <><Save size=\{18\} \/> \{isTeam \? "Guardar Cambios" : "Guardar Perfil P.blico"\}<\/>\}\s*<\/button>/;
content = content.replace(saveButtonRegex, '');

// 6. Update the config indicator and remove the save config button
const configHeaderRegex = /<h3 className="font-bold text-\[\#0B1929\] flex items-center gap-2 mb-1">\s*<CreditCard size=\{18\} className="text-\[var\(--brand-primary\)\]" \/> Datos de Cobro \(SPEI\)\s*<\/h3>/;
const newConfigHeader = `<div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[#0B1929] flex items-center gap-2">
                <CreditCard size={18} className="text-[var(--brand-primary)]" /> Datos de Cobro (SPEI)
              </h3>
              <div className="h-6 flex items-center justify-end min-w-[24px]">
                {savingConfig && <Loader2 size={16} className="text-[#6B7A8D] animate-spin" />}
                {configSuccess && !savingConfig && <CheckCircle2 size={16} className="text-green-500" />}
                {configError && !savingConfig && <XCircle size={16} className="text-red-500" title="Error al guardar config" />}
              </div>
            </div>`;
content = content.replace(configHeaderRegex, newConfigHeader);

const saveConfigButtonRegex = /\{isSuperadmin && \(\s*<button[\s\S]*?Guardar datos de cobro\s*<\/button>\s*\)\}/;
content = content.replace(saveConfigButtonRegex, '');

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', content);
