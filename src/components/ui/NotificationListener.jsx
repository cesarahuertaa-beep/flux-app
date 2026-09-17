import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function NotificationListener({ profileId }) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!profileId) return;

    // Pedir permisos
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    // Configurar suscripcion a Realtime
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
  }, [profileId]);

  return null;
}


