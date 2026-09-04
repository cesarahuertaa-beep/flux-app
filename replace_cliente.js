import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

const beforeReturn = `
  const handleSaveExercise = async (ejId, wi) => {
    setMsg(null);
    try {
      const rutina = rutinas[rutinaIdx];
      if (!rutina) return;
      const numSeries = rutina.ejercicios.find(e => e.id === ejId)?.num_series || 4;
      const upserts = [];
      for (let si = 0; si < numSeries; si++) {
        ["peso", "reps"].forEach(tipo => {
          const val = progreso[\`\${ejId}-\${wi}-\${si}-\${tipo}\`];
          if (val !== undefined && val !== "") {
            upserts.push({ ejercicio_id: ejId, cliente_id: cliente.id, semana: wi, serie: si, tipo, valor: val, updated_at: new Date().toISOString() });
          }
        });
      }
      if (upserts.length > 0) {
        await offlineAwareUpsert(upserts);
      }
    } catch(e) {
      console.error(e);
      setMsg({ ok: false, text: "❌ Error al guardar: " + e.message });
    }
  };

  const handleProgressChange = (ejId, wi, si, tipo, val) => {
    setProgreso(p => ({...p, [\`\${ejId}-\${wi}-\${si}-\${tipo}\`]: val}));
  };

  const NAV = [
    { id: "inicio", label: "Inicio", icon: <BarChart2 size={18} strokeWidth={1.5} /> },
    { id: "nutricion", label: "Nutrición", icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id: "deporte", label: "Entrenamiento", icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id: "progreso", label: "Galería Visual", icon: <Camera size={18} strokeWidth={1.5} /> },
    { id: "citas", label: "Citas", icon: <CalendarDays size={18} strokeWidth={1.5} /> },
  ];

  const rutina = rutinas[rutinaIdx];
  const diaActual = dias[diaIdx];
  const semanas = getSemanasConFecha(rutina);
  const currentCycleWeek = semanas.findIndex(s => s.isCurrent) + 1 || 1;

  return (
    <AppLayout 
      nav={NAV} 
      active={tab} 
      setActive={handleTabChange} 
      session={session} 
      onLogout={safeLogout}
    >
      {loading ? (
        <div style={{textAlign:"center",padding:"80px 0",color:C.muted}}>
          <div style={{
            width:44, height:44, borderRadius:"50%",
            border:\`3px solid \${C.border}\`,
            borderTopColor:C.accent,
            animation:"rotateSlow 0.8s linear infinite",
            margin:"0 auto 16px"
          }}/>
          <div>Cargando tu programa…</div>
        </div>
      ) : (
        <>
          {tab === "inicio" && (
            <div className="animate-in" style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              paddingTop: "15vh", textAlign: "center", opacity: 0.6
            }}>
              <img src={brand?.logo_url || "/logo.png"} alt="Flux Logo" style={{ width: 140, marginBottom: 20, opacity: 0.4, filter: "grayscale(100%) brightness(1.5)" }} />
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 24, color: C.text, marginBottom: 8 }}>Hola, {cliente.nombre.split(" ")[0]}</h2>
              <p style={{ color: C.muted, fontSize: 14 }}>Selecciona una opción en el menú para comenzar.</p>
            </div>
          )}

          {tab === "nutricion" && (
            <Nutrition 
              dias={dias} 
              clienteNombre={cliente.nombre} 
              caloriasMeta={nutri?.calorias_meta} 
            />
          )}

          {tab === "deporte" && (
            <Training 
              rutinas={rutinas} 
              progreso={progreso} 
              clienteNombre={cliente.nombre}
              onSaveExercise={handleSaveExercise}
              onProgressChange={handleProgressChange}
              semanaActualCiclo={currentCycleWeek}
            />
          )}

          {tab === "progreso" && (
            <div className="animate-in px-8 pt-8">
               <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: 'DM Sans' }}>Galería Corporal</h1>
               <p className="text-sm text-[#6B7A8D] mt-2 mb-6">Estamos migrando tus fotos a la nueva versión. ¡Pronto verás aquí todo tu progreso!</p>
            </div>
          )}

          {tab === "citas" && (
            <div className="animate-in p-4 md:p-8">
              <CitasCliente cliente={cliente} />
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
`;

const splitStr = '  const rutina = rutinas[rutinaIdx];\n  const diaActual = dias[diaIdx];\n  const semanas = getSemanasConFecha(rutina);';
const parts = content.split(splitStr);

if (parts.length === 2) {
  content = parts[0] + beforeReturn;
  fs.writeFileSync('src/pages/Cliente.jsx', content);
  console.log('Cliente.jsx successfully replaced');
} else {
  console.log('Error splitting Cliente.jsx');
}
