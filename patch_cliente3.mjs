import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// 1. Remove isCivil definition
content = content.replace('const isCivil = cliente?.nutriologo_id === null;', '');

// 2. SIDEBAR_ITEMS
const sidebarStart = content.indexOf('const SIDEBAR_ITEMS = isCivil ? [');
const sidebarEnd = content.indexOf('];', sidebarStart) + 2;

const newSidebar = `  // Ocultar pestaña de citas si es usuario civil (no tiene nutriólogo)
  const isActuallyCivil = cliente?.nutriologo_id === null;

  const SIDEBAR_ITEMS = [
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...((!isActuallyCivil && cliente?.objetivo !== "Mi entrenamiento personal") ? [
      { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];`;

content = content.substring(0, sidebarStart) + newSidebar + content.substring(sidebarEnd);

// 3. Remove conditional rendering for Civil tabs inside the Main view
const tabsStartStr = '{tab === "programar" && isCivil && (';
const tabsEndStr = '{tab === "nutricion" && (!atletaModeCivil) && (';

const tabsStartIdx = content.indexOf(tabsStartStr);
const tabsEndIdx = content.indexOf(tabsEndStr);

if (tabsStartIdx !== -1 && tabsEndIdx !== -1) {
  content = content.substring(0, tabsStartIdx) + '{tab === "nutricion" && (' + content.substring(tabsEndIdx + tabsEndStr.length);
}

// 4. In the Top Bar for "Modo Atleta":
const topBarStart = content.indexOf('{isAtletaMode && (');
const topBarEnd = content.indexOf(')}', topBarStart) + 2;

const newTopBar = `{isAtletaMode && (
        <div className="bg-[#10B981] bg-opacity-10 border-b border-[#10B981] border-opacity-20 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="font-bold text-[#065F46] text-sm md:text-base flex items-center gap-2">
              <Dumbbell size={16} /> {cliente?.nutriologo_id === null ? "Entrenando" : "Estás en Modo Atleta"}
            </span>
            <span className="text-[#047857] text-xs md:text-sm hidden sm:block">
              {cliente?.nutriologo_id === null ? "Modo de ejecución de rutina." : "Previsualiza tu app exactamente como lo verían tus pacientes."}
            </span>
          </div>
          <button onClick={onBackToAdmin} className="bg-[#10B981] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors shadow-sm whitespace-nowrap">
            {cliente?.nutriologo_id === null ? "Volver al Editor" : "Volver al Panel"}
          </button>
        </div>
      )}`;

content = content.substring(0, topBarStart) + newTopBar + content.substring(topBarEnd);

// Remove `const [atletaModeCivil, setAtletaModeCivil] = useState(false);`
content = content.replace('const [atletaModeCivil, setAtletaModeCivil] = useState(false);', '');

// Remove the `if (isCivil) { try { ... } }` for library fetching
const loadBibStart = content.indexOf('if (isCivil) {');
const loadBibEnd = content.indexOf('}', content.indexOf('} catch(e) {}')) + 1;
if (loadBibStart !== -1 && loadBibEnd !== -1) {
    content = content.substring(0, loadBibStart) + content.substring(loadBibEnd);
}

// Also fix `{(tab === "deporte" || atletaModeCivil) && (` -> `{(tab === "deporte") && (`
content = content.replace('{(tab === "deporte" || atletaModeCivil) && (', '{tab === "deporte" && (');

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Cliente.jsx for Modo Atleta');
