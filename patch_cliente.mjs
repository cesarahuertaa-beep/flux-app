import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// 1. Remove isCivil definition
content = content.replace('const isCivil = cliente?.nutriologo_id === null;', '');
// Replace `isCivil` with `false` where it might cause reference errors, or just refactor.
// Actually, let's just do a proper replace string by string.
content = content.split('const isCivil = cliente?.nutriologo_id === null;').join('');

// 2. Remove isCivil from SIDEBAR_ITEMS
// Old:
/*
  const SIDEBAR_ITEMS = isCivil ? [
    { id: "programar", label: "Mi Plan", icon: <Activity size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso", icon: <Camera size={18} strokeWidth={1.5} /> },
    { id: "membresia", label: "Membresía", icon: <ShoppingBag size={18} strokeWidth={1.5} /> },
    { id: "perfil", label: "Mi Perfil", icon: <User size={18} strokeWidth={1.5} /> }
  ] : [
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...(cliente?.objetivo !== "Mi entrenamiento personal" ? [
      { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];
*/
const oldSidebar = `  const SIDEBAR_ITEMS = isCivil ? [
    { id: "programar", label: "Mi Plan", icon: <Activity size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso", icon: <Camera size={18} strokeWidth={1.5} /> },
    { id: "membresia", label: "Membresía", icon: <ShoppingBag size={18} strokeWidth={1.5} /> },
    { id: "perfil", label: "Mi Perfil", icon: <User size={18} strokeWidth={1.5} /> }
  ] : [
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...(cliente?.objetivo !== "Mi entrenamiento personal" ? [
      { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];`;

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
content = content.replace(oldSidebar, newSidebar);

// 3. Remove conditional rendering for Civil tabs inside the Main view
const oldTabsStart = `{tab === "programar" && isCivil && (
                 <div className={atletaModeCivil ? "hidden" : "block"} style={{ minHeight: '80vh' }}>
                    <ProgramarCliente 
                       clientes={[cliente]} 
                       selected={cliente} 
                       isMiPlan={true} 
                       biblioteca={biblioteca} 
                       onModoAtleta={() => setAtletaModeCivil(true)} 
                       setMsg={() => {}} 
                       setSelected={() => {}} 
                    />
                 </div>
              )}
              
              {tab === "membresia" && isCivil && (
                 <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#6B7A8D]">
                    <ShoppingBag size={48} className="mb-4 text-[#CBD5E1]" />
                    <h2 className="text-xl font-bold text-[#0B1929] mb-2">Tu Membresía Civil</h2>
                    <p>Aquí podrás gestionar tu suscripción y beneficios.</p>
                 </div>
              )}

              {tab === "nutricion" && (!atletaModeCivil) && (`;

content = content.replace(oldTabsStart, '{tab === "nutricion" && (');

// 4. In the Top Bar for "Modo Atleta":
const oldTopBar = `{isAtletaMode && (
        <div className="bg-[#10B981] bg-opacity-10 border-b border-[#10B981] border-opacity-20 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="font-bold text-[#065F46] text-sm md:text-base flex items-center gap-2">
              {isCivil ? <><Dumbbell size={16} /> Entrenando</> : <><Dumbbell size={16} /> Estás en Modo Atleta</>}
            </span>
            <span className="text-[#047857] text-xs md:text-sm hidden sm:block">{isCivil ? "Modo de ejecución de rutina." : "Previsualiza tu app exactamente como lo verían tus pacientes."}</span>
          </div>
          <button onClick={onBackToAdmin} className="bg-[#10B981] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors shadow-sm whitespace-nowrap">
            {isCivil ? "Volver al Editor" : "Volver al Panel"}
          </button>
        </div>
      )}`;

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
content = content.replace(oldTopBar, newTopBar);


// Also remove `const [atletaModeCivil, setAtletaModeCivil] = useState(false);`
content = content.replace('const [atletaModeCivil, setAtletaModeCivil] = useState(false);', '');

// Also remove `if (isCivil) { try { const bib = await dbGet("biblioteca_ejercicios?order=nombre.asc"); setBiblioteca(bib); } catch(e) {} }`
const oldLoadBib = `if (isCivil) {
        try {
          const bib = await dbGet("biblioteca_ejercicios?order=nombre.asc");
          setBiblioteca(bib);
        } catch(e) {}
      }`;
content = content.replace(oldLoadBib, '');

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Cliente.jsx for Modo Atleta');
