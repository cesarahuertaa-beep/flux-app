import { useState, useEffect } from 'react';

/**
 * InstallPrompt — Banner elegante para instalar FLUX como app nativa.
 * - Android/Chrome: botón automático de instalación
 * - iOS/Safari: instrucción manual con ícono de compartir
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow]                     = useState(false);
  const [isIos, setIsIos]                   = useState(false);
  const [dismissed, setDismissed]           = useState(false);

  useEffect(() => {
    // Ya fue instalada o ya fue descartada — no mostrar de nuevo
    const wasDismissed = localStorage.getItem('pwa-dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (wasDismissed || isStandalone) return;

    // Detectar iOS (Safari no dispara el evento beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (ios) {
      setIsIos(true);
      setShow(true);
      return;
    }

    // Android / Chrome / Edge — escuchar el evento nativo
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  if (!show || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 420,
      background: 'rgba(15,28,46,0.97)',
      border: '1px solid rgba(46,92,184,0.25)',
      borderRadius: 20,
      padding: '18px 20px',
      zIndex: 9999,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateX(-50%) translateY(24px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Ícono */}
      <img src="/logo.png" alt="FLUX" style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} />

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 }}>
          Instala FLUX
        </div>
        {isIos ? (
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Toca <strong style={{ color: '#2e5cb8' }}>Compartir</strong>{' '}
            <span style={{ fontSize: 13 }}>⎙</span> y luego{' '}
            <strong style={{ color: '#2e5cb8' }}>"Agregar a inicio"</strong>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Úsala como app nativa, sin abrir el navegador
          </div>
        )}
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {!isIos && (
          <button
            onClick={install}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#2e5cb8,#3d6fd0)',
              color: '#fff', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              whiteSpace: 'nowrap',
            }}
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'transparent', border: '1px solid rgba(46,92,184,0.2)',
            color: '#475569', fontSize: 11, cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
          }}
        >
          {isIos ? 'Cerrar' : 'Ahora no'}
        </button>
      </div>
    </div>
  );
}
