import Dexie from 'dexie';  
export const db = new Dexie('FluxLocalDB');  
db.version(1).stores({  
  rutinas: 'id, cliente_id, updated_at',  
  ejercicios: 'id, rutina_id',  
  registros: 'id, rutina_id, cliente_id, ejercicio_id, fecha, is_synced',  
  sync_queue: '++id, table, action, data, created_at'  
}); 
