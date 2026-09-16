import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// 1. Add User to lucide-react imports if not there
if (!content.includes('User,')) {
  content = content.replace('UtensilsCrossed, Dumbbell', 'UtensilsCrossed, Dumbbell, User');
}

// 2. Add ProgramarCliente import
if (!content.includes('import { ProgramarCliente }')) {
  content = content.replace('import { UtensilsCrossed', `import { ProgramarCliente } from "../components/admin/ProgramarCliente";\nimport { UtensilsCrossed`);
}

// 3. Detect isCivil and add state
if (!content.includes('const isCivil = cliente?.nutriologo_id === null;')) {
  content = content.replace(
    'const [ultimoPeso, setUltimoPeso] = useState(null);',
    `const [ultimoPeso, setUltimoPeso] = useState(null);\n  const isCivil = cliente?.nutriologo_id === null;\n  const [atletaModeCivil, setAtletaModeCivil] = useState(false);\n  const [biblioteca, setBiblioteca] = useState([]);`
  );
}

// 4. Fetch biblioteca if isCivil
if (!content.includes('setBiblioteca(bib);')) {
  content = content.replace(
    'const cs = await dbGet(`ciclos?cliente_id=eq.${cliente.id}&activo=eq.true&limit=1`);',
    `if (isCivil) {
        try {
          const bib = await dbGet("biblioteca_ejercicios?order=nombre.asc");
          setBiblioteca(bib);
        } catch(e) {}
      }

      const cs = await dbGet(\`ciclos?cliente_id=eq.\${cliente.id}&activo=eq.true&limit=1\`);`
  );
}

// 5. SIDEBAR_ITEMS logic
if (!content.includes('isCivil ? [')) {
  const oldSidebar = `const SIDEBAR_ITEMS = [
    { id: "nutricion",label: "Nutrición",       icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte",  label: "Entrenamiento",   icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Progreso",        icon: <Camera size={18} strokeWidth={1.5} /> },
    ...(cliente?.objetivo !== "Mi entrenamiento personal" ? [
      { id: "citas",    label: "Citas",           icon: <CalendarDays size={18} strokeWidth={1.5} /> }
    ] : [])
  ];`;
  
  const newSidebar = `const SIDEBAR_ITEMS = isCivil ? [
    { id: "programar", label: "Mi Plan", icon: <Dumbbell size={18} strokeWidth={1.5} /> },
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
  
  // Try exact match or fallback to regex
  if (content.includes(oldSidebar)) {
    content = content.replace(oldSidebar, newSidebar);
  } else {
    // Replace blindly
    const sidebarRegex = /const SIDEBAR_ITEMS = \[[\s\S]*?\];\s*/;
    content = content.replace(sidebarRegex, newSidebar + "\n  ");
  }
}

// 6. Fix "Estás en Modo Atleta" header to support isCivil
if (!content.includes('atletaModeCivil')) {
  // Replace {isAtletaMode && (
  content = content.replace(
    /\{isAtletaMode && \(/g,
    `{(isAtletaMode || atletaModeCivil) && (`
  );
  
  // Replace onBackToAdmin with a ternary
  content = content.replace(
    /onClick=\{onBackToAdmin\}/g,
    `onClick={isCivil ? () => setAtletaModeCivil(false) : onBackToAdmin}`
  );
}

// 7. Render ProgramarCliente
if (!content.includes('<ProgramarCliente')) {
  const insertTarget = `{tab === "nutricion" && (`;
  const programarRender = `
              {tab === "programar" && isCivil && (
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

              {`;
  content = content.replace(insertTarget, programarRender + 'tab === "nutricion" && (!atletaModeCivil) && (');
}

// 8. Change {tab === "deporte" && ( to {(tab === "deporte" || atletaModeCivil) && (
content = content.replace(
  /\{tab === "deporte" && \(/g,
  `{(tab === "deporte" || atletaModeCivil) && (`
);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log("Cliente.jsx civil routing injected.");
