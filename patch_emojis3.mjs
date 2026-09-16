import fs from 'fs';

const files = [
  'src/components/admin/ProgresoCliente.jsx',
  'src/components/admin/ProgramarCliente.jsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // We can just use split/join for simple ones
  
  content = content.split('setMsg("❌ " + e.message)').join('setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>)');
  content = content.split('setMsg("❌ Error cargando: " + e.message)').join('setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error cargando: {e.message}</div>)');
  content = content.split('setMsg("❌ Error cargando historial: " + e.message)').join('setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error cargando historial: {e.message}</div>)');

  content = content.split('setMsg("✅ Evaluación actualizada")').join('setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Evaluación actualizada</div>)');
  content = content.split('setMsg("✅ Evaluación guardada")').join('setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Evaluación guardada</div>)');
  
  content = content.split('setMsg("🗑️ Evaluación eliminada")').join('setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Evaluación eliminada</div>)');

  content = content.split('setMsg(`✅ Ciclo eliminado. Se restauró: "${anteriores[0].nombre}"`)').join('setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> {`Ciclo eliminado. Se restauró: "${anteriores[0].nombre}"`}</div>)');

  // Also replace ✕ with X for lightbox
  content = content.split('onClick={()=>setLightbox(null)}>✕</div>').join('onClick={()=>setLightbox(null)}><X className="w-8 h-8" /></div>');

  fs.writeFileSync(file, content);
}
console.log("Emojis replaced with literal strings");
