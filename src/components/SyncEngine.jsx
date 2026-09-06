import { useEffect, useState } from react;
import { db } from ../lib/db;
import { dbGet, dbPost, dbPatch } from ../lib/supabase;

export function SyncEngine({ clienteId }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener(online, handleOnline);
    window.addEventListener(offline, handleOffline);
    return () => {
      window.removeEventListener(online, handleOnline);
      window.removeEventListener(offline, handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || !clienteId) return;

    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        // 1. PUSH: Enviar datos locales (sync_queue) a Supabase
        const pending = await db.sync_queue.toArray();
        for (const task of pending) {
          try {
            if (task.action === POST) {
              await dbPost(task.table, task.data);
            } else if (task.action === PATCH) {
              await dbPatch(${task.table}?id=eq., task.data);
            }
            await db.sync_queue.delete(task.id);
          } catch (e) {
            if (e.message !== OFFLINE) {
              console.error(Error push task:, task, e);
            }
          }
        }

        // 2. PULL: Descargar datos frescos de Supabase
        const [rutinas, ejercicios, registros] = await Promise.all([
          dbGet(rutinas?cliente_id=eq.${clienteId}),
          dbGet(ejercicios?select=*),
          dbGet(registros?cliente_id=eq.${clienteId})
        ]);

        await db.transaction(rw, db.rutinas, db.ejercicios, db.registros, async () => {
          await db.rutinas.clear();
          if (rutinas.length) await db.rutinas.bulkAdd(rutinas);
          
          await db.ejercicios.clear();
          if (ejercicios.length) await db.ejercicios.bulkAdd(ejercicios);

          await db.registros.clear();
          if (registros.length) await db.registros.bulkAdd(registros);
        });
      } catch (err) {
        if (err.message !== OFFLINE) console.error(Sync error:, err);
      } finally {
        syncing = false;
      }
    };

    sync();
    const interval = setInterval(sync, 1000 * 60); // Sync cada 1 min si hay internet
    return () => clearInterval(interval);
  }, [isOnline, clienteId]);

  return null; // El motor es invisible
}
