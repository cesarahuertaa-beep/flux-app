import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// 1. Imports
content = content.replace(
  'User, CheckCircle2} from "lucide-react";',
  'User, CheckCircle2, UtensilsCrossed, Camera} from "lucide-react";'
);
content = content.replace(
  'import { AgendaAdmin } from "../components/admin/AgendaAdmin";',
  'import { AgendaAdmin } from "../components/admin/AgendaAdmin";\nimport ClienteView from "./Cliente";'
);

// 2. Sidebar
const sidebarRegex = /const SIDEBAR_ITEMS = isCivil \? \[\s*\{\s*id: "mi_plan"[\s\S]*?\]/;
const newSidebar = `const SIDEBAR_ITEMS = isCivil ? [
    { id: "mi_plan",         label: "Mi Plan",       icon: <Activity size={18} strokeWidth={1.5} /> },
    { id: "nutricion",       label: "Nutrición",     icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "entrenamiento",   label: "Entrenamiento", icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso_atleta", label: "Progreso",      icon: <Camera size={18} strokeWidth={1.5} /> },
    { id: "membresia",       label: "Membresía",     icon: <CreditCard size={18} strokeWidth={1.5} /> },
  ]`;
content = content.replace(sidebarRegex, newSidebar);

// 3. Remove action
const actionRegex = /action=\{\s*clienteData \? \(\s*<button[\s\S]*?<\/button>\s*\)\s*:\s*null\s*\}/;
content = content.replace(actionRegex, '');

// 4. Insert execution views at bottom
const views = `
      {isCivil && (tab === 'nutricion' || tab === 'entrenamiento' || tab === 'progreso_atleta') && clienteData && (
        <ClienteView 
          session={{ role:'cliente', data:clienteData, token:session?.token, profileId: session?.profileId, adminRole: session?.role }}
          isAtletaMode={false}
          isEmbedded={true}
          embeddedTab={tab === 'entrenamiento' ? 'deporte' : tab === 'progreso_atleta' ? 'progreso' : 'nutricion'}
          onLogout={onLogout}
        />
      )}
`;
const endIdx = content.lastIndexOf('</AppLayout>');
content = content.substring(0, endIdx) + views + content.substring(endIdx);

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log('Patched cleanly via regex and index');
