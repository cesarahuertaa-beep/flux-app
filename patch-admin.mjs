import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// 1. Import Aprobaciones
content = content.replace(
  'import PerfilNutriologo from "../components/admin/PerfilNutriologo";',
  `import PerfilNutriologo from "../components/admin/PerfilNutriologo";
import Aprobaciones from "../components/admin/Aprobaciones";`
);

// 2. Add to SIDEBAR_ITEMS for staff/superadmin
// Look for the SIDEBAR_ITEMS assignment.
const sideBarItemsOld = `        { id: "directorio",   label: "Directorio",      icon: <Users size={18} strokeWidth={1.5} /> },
        { id: "membresia",    label: "Membresía",       icon: <CreditCard size={18} strokeWidth={1.5} /> }
      ]`;

const sideBarItemsNew = `        { id: "directorio",   label: "Directorio",      icon: <Users size={18} strokeWidth={1.5} /> },
        { id: "aprobaciones", label: "Aprobaciones",    icon: <UserCheck size={18} strokeWidth={1.5} /> },
        { id: "membresia",    label: "Membresía",       icon: <CreditCard size={18} strokeWidth={1.5} /> }
      ]`;

content = content.replace(sideBarItemsOld, sideBarItemsNew);

// Wait, UserCheck needs to be imported in Admin.jsx.
content = content.replace(
  'import { Activity, Dumbbell, Settings, MessageSquare, LogOut, FileText, ChevronRight, Menu, X, Users, CreditCard, PlusCircle, Search, Trash2, CalendarDays, Upload, Image as ImageIcon, Briefcase, Key } from "lucide-react";',
  'import { Activity, Dumbbell, Settings, MessageSquare, LogOut, FileText, ChevronRight, Menu, X, Users, CreditCard, PlusCircle, Search, Trash2, CalendarDays, Upload, Image as ImageIcon, Briefcase, Key, UserCheck } from "lucide-react";'
);

// 3. Render the Aprobaciones tab
content = content.replace(
  '{tab === "membresia" && <SubComponentWrapper><MiMembresia clientes={clientes} profileId={profileId} setMsg={setMsg}/></SubComponentWrapper>}',
  `{tab === "membresia" && <SubComponentWrapper><MiMembresia clientes={clientes} profileId={profileId} setMsg={setMsg}/></SubComponentWrapper>}
        {tab === "aprobaciones" && (isSuperadmin || role === "staff") && <SubComponentWrapper><Aprobaciones setMsg={setMsg}/></SubComponentWrapper>}`
);

fs.writeFileSync('src/pages/Admin.jsx', content);
