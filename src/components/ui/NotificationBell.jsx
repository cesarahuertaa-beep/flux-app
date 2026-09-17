import React, { useState, useEffect, useRef } from 'react';
import { Bell, CreditCard, Dumbbell, Activity, ShieldAlert, CircleAlert, CheckCircle2 } from 'lucide-react';
import { dbGet, dbPatch } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NotificationBell({ profileId, onNavigate }) {
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const fetchNotifs = async () => {
    if (!profileId) return;
    try {
      const data = await dbGet(`notificaciones?profile_id=eq.${profileId}&order=created_at.desc&limit=20`);
      setNotifs(data || []);
      setUnreadCount(data.filter(n => !n.leida).length);
    } catch (e) {
      console.error("Error cargando notificaciones", e);
    }
  };

  useEffect(() => {
    fetchNotifs();
    // Refresh unread count every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [profileId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const markAsRead = async (id) => {
    try {
      await dbPatch(`notificaciones?id=eq.${id}`, { leida: true });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await dbPatch(`notificaciones?profile_id=eq.${profileId}&leida=eq.false`, { leida: true });
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotifClick = async (n) => {
    if (!n.leida) {
      await markAsRead(n.id);
    }
    setOpen(false);
    if (n.link_url && onNavigate) {
      onNavigate(n.link_url);
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'pago': return <CreditCard className="w-5 h-5 text-emerald-500" />;
      case 'plan': return <Dumbbell className="w-5 h-5 text-blue-500" />;
      case 'progreso': return <Activity className="w-5 h-5 text-purple-500" />;
      case 'alerta': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'sistema': return <CircleAlert className="w-5 h-5 text-orange-500" />;
      default: return <Bell className="w-5 h-5 text-[#6B7A8D]" />;
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2 text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F0F4FA] rounded-xl transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[#E2E8F0] overflow-hidden z-[100] animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F4FA] bg-[#F8FAFC]">
            <h3 className="font-bold text-[#0B1929] flex items-center gap-2">
              Notificaciones
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs font-semibold text-[var(--brand-primary)] hover:opacity-80 transition-opacity flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[#6B7A8D]">
                <Bell className="w-12 h-12 text-[#E2E8F0] mb-3" />
                <p className="text-sm">No tienes notificaciones por ahora.</p>
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left p-4 border-b border-[#F0F4FA] hover:bg-[#F8FAFC] transition-colors flex gap-3 ${!n.leida ? 'bg-blue-50/30' : ''}`}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${!n.leida ? 'opacity-100' : 'opacity-60'}`}>
                    {getIcon(n.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm mb-1 ${!n.leida ? 'font-bold text-[#0B1929]' : 'font-medium text-[#6B7A8D]'}`}>
                      {n.titulo}
                    </p>
                    <p className={`text-xs mb-1.5 leading-relaxed ${!n.leida ? 'text-[#475569]' : 'text-[#9BA5B0]'}`}>
                      {n.mensaje}
                    </p>
                    <p className="text-[10px] text-[#9BA5B0] font-mono">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  {!n.leida && (
                    <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] flex-shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="p-3 bg-[#F8FAFC] border-t border-[#F0F4FA] text-center">
            <p className="text-[10px] text-[#9BA5B0]">Flux Notification System</p>
          </div>
        </div>
      )}
    </div>
  );
}
