import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BellRing, X } from 'lucide-react';

export default function NotificationListener({ profileId }) {
  const channelRef = useRef(null);
  const [permission, setPermission] = useState('default');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        setShowBanner(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!profileId || permission !== 'granted') return;

    // Configurar suscripcion a Realtime solo si tenemos permiso
    channelRef.current = supabase
      .channel('notif-channel-' + profileId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const newNotif = payload.new;
          
          if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(newNotif.titulo, {
              body: newNotif.mensaje,
              icon: '/logo192.png'
            });

            n.onclick = () => {
              window.focus();
              n.close();
            };
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [profileId, permission]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const p = await Notification.requestPermission();
      setPermission(p);
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="bg-[var(--brand-primary)] text-white px-4 py-3 flex items-center justify-between z-[100] relative shadow-md">
      <div className="flex items-center gap-3">
        <BellRing size={18} className="animate-pulse" />
        <span className="text-sm font-medium">Activa las notificaciones para recibir alertas de tus pacientes.</span>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={requestPermission}
          className="bg-white text-[var(--brand-primary)] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-opacity-90 transition-all shadow-sm"
        >
          Permitir
        </button>
        <button onClick={() => setShowBanner(false)} className="text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}


