import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// 1. Add lucide imports
content = content.replace(
  ', UserCheck, Dumbbell, BarChart2, User, CheckCircle2} from "lucide-react";',
  ', UserCheck, Dumbbell, BarChart2, User, CheckCircle2, UtensilsCrossed, Camera} from "lucide-react";'
);

// 2. Add ClienteView import
content = content.replace(
  'import { AgendaAdmin } from "../components/admin/AgendaAdmin";',
  'import { AgendaAdmin } from "../components/admin/AgendaAdmin";\nimport ClienteView from "./Cliente";'
);

// 3. Update SIDEBAR_ITEMS
const oldSidebar = `  const SIDEBAR_ITEMS = isCivil ? [
    { id: "mi_plan",   label: "Mi Plan",    icon: <Activity size={18} strokeWidth={1.5} /> },
    
    { id: "membresia", label: "Membresía",  icon: <CreditCard size={18} strokeWidth={1.5} /> },
    
  ]`;
const newSidebar = `  const SIDEBAR_ITEMS = isCivil ? [
    { id: "mi_plan",         label: "Mi Plan",       icon: <Activity size={18} strokeWidth={1.5} /> },
    { id: "nutricion",       label: "Nutrición",     icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "entrenamiento",   label: "Entrenamiento", icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso_atleta", label: "Progreso",      icon: <Camera size={18} strokeWidth={1.5} /> },
    { id: "membresia",       label: "Membresía",     icon: <CreditCard size={18} strokeWidth={1.5} /> },
  ]`;
// The actual file might have CRLF or extra spaces, so let's do a more robust replace for sidebar.
content = content.replace(/const SIDEBAR_ITEMS = isCivil \? \[\s*\{\s*id: "mi_plan"[\s\S]*?\]/m, newSidebar);


// 4. Fix rendering of `mi_plan` and add new tabs
const oldMiPlanRender = `      {/* ════════════ CIVIL PREMIUM TABS ════════════ */}
      {isCivil && tab === "mi_plan" && (
        <SubComponentWrapper
          title="Mi Plan"
          action={
            clienteData ? (
              <button
                onClick={() => onModoAtleta(clienteData)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[var(--brand-primary)] hover:bg-[#F0F4FA] transition-colors shadow-sm"
              >
                <Dumbbell size={14} />
                <span>Modo Atleta</span>
              </button>
            ) : null
          }
        >
          {clienteData ? (
            <ProgramarCliente`;

const newMiPlanRender = `      {/* ════════════ CIVIL PREMIUM TABS ════════════ */}
      {isCivil && tab === "mi_plan" && (
        <SubComponentWrapper
          title="Mi Plan"
        >
          {clienteData ? (
            <ProgramarCliente`;

content = content.replace(oldMiPlanRender, newMiPlanRender);

// Insert the new Cliente execution views
const insertAfterStr = `          {clienteData && <MiMembresiaCivil myProfileId={profileId} setMsg={setMsg} />}
        </SubComponentWrapper>
      )}`;

const executionViews = `

      {isCivil && (tab === "nutricion" || tab === "entrenamiento" || tab === "progreso_atleta") && clienteData && (
        <ClienteView 
          session={{ role:"cliente", data:clienteData, token:session?.token, profileId: session?.profileId, adminRole: session?.role }}
          isAtletaMode={false}
          isEmbedded={true}
          embeddedTab={tab === "entrenamiento" ? "deporte" : tab === "progreso_atleta" ? "progreso" : "nutricion"}
          onLogout={onLogout}
        />
      )}`;

content = content.replace(insertAfterStr, insertAfterStr + executionViews);

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log('Patched Admin.jsx');
