/**
 * FLUX Login — Diseño de Stitch + Lógica de autenticación FLUX
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useBrand } from '../components/BrandContext';
import { authSignIn, authResetPassword, authUpdatePassword, setAuthToken, setProfileId, dbGet } from '../lib/supabase';

// ── Componente de input con toggle de visibilidad ─────────────────────────
const PasswordInput = ({ placeholder, value, onChange, onKeyDown }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

// ── Fondo decorativo (ondas SVG + orbes) ─────────────────────────────────
const Background = () => (
  <div className="absolute inset-0 z-0 overflow-hidden">
    <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
    <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
    <div className="absolute top-1/2 left-0 w-full h-full opacity-20 rotate-12">
      <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="transparent" />
            <stop offset="50%"  stopColor="#4f46e5" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d="M0,500 Q250,400 500,500 T1000,500" fill="none" stroke="url(#wave-gradient)" strokeWidth="0.5" />
        <path d="M0,520 Q250,420 500,520 T1000,520" fill="none" stroke="url(#wave-gradient)" strokeWidth="0.3" />
        <path d="M0,480 Q250,380 500,480 T1000,480" fill="none" stroke="url(#wave-gradient)" strokeWidth="0.2" />
      </svg>
    </div>
  </div>
);

// ── Logo FLUX con "X" brillante (estilo Stitch) ───────────────────────────
const FluxBranding = ({ brand }) => {
  const hasCustomLogo = brand?.logo_url && brand.logo_url !== '/logo.png';
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1 }}
      className="flex flex-col items-center md:items-start text-center md:text-left"
    >
      {hasCustomLogo ? (
        <img src={brand.logo_url} alt={brand.nombre_marca} className="h-24 object-contain mb-4" />
      ) : (
        <div className="flex items-baseline mb-2">
          <h1 className="text-7xl md:text-9xl font-display font-bold tracking-tighter text-white">
            FLU
          </h1>
          <div className="relative inline-flex items-center justify-center">
            <span className="text-7xl md:text-9xl font-display font-bold tracking-tighter text-white/90 relative z-10 italic">X</span>
            <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full z-0 animate-pulse" />
            <div className="absolute -inset-2 bg-gradient-to-tr from-purple-600/40 to-blue-500/40 blur-xl opacity-50 rotate-45 rounded-sm" />
          </div>
        </div>
      )}
      <p className="text-xl md:text-2xl font-light text-blue-100/40 tracking-wider">
        {brand?.nombre_marca && brand.nombre_marca !== 'FLUX' ? brand.nombre_marca : 'Fueling Your Performance'}
      </p>
    </motion.div>
  );
};

// ── Login principal ───────────────────────────────────────────────────────
export default function Login({ onLogin }) {
  const [mode,        setMode]        = useState('login');
  const [email,       setEmail]       = useState('');
  const [pass,        setPass]        = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [err,         setErr]         = useState('');
  const [info,        setInfo]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const brand = useBrand();

  // Detectar token de invitación/recovery en la URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const token  = params.get('access_token');
      const type   = params.get('type');
      if (token && (type === 'invite' || type === 'recovery' || type === 'signup')) {
        setAccessToken(token);
        setMode('set_password');
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────
  const submit = async () => {
    setLoading(true); setErr(''); setInfo('');
    try {
      const data = await authSignIn(email.trim(), pass);
      setAuthToken(data.access_token);
      setProfileId(data.user.id);

      const profiles = await dbGet(`profiles?id=eq.${data.user.id}`);
      const role = profiles.length ? profiles[0].role : null;

      if (role === 'admin' || role === 'superadmin' || role === 'nutriologo' || role === 'administrativo') {
        if ((role === 'nutriologo' || role === 'administrativo') && profiles[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr('Tu cuenta está suspendida. Contacta a soporte.');
          setLoading(false); return;
        }
        onLogin({ role: role === 'admin' ? 'admin' : role, token: data.access_token, profileId: data.user.id });
        return;
      }
      // Cliente
      const rows = await dbGet(`clientes?email=ilike.${encodeURIComponent(email.trim())}&activo=eq.true`);
      if (!rows.length) {
        setAuthToken(null); setProfileId(null);
        setErr('No se encontró tu cuenta activa.');
        setLoading(false); return;
      }
      const clientData = rows[0];
      if (clientData.nutriologo_id) {
        const nut = await dbGet(`profiles?id=eq.${clientData.nutriologo_id}&select=activo`);
        if (nut.length && nut[0].activo === false) {
          setAuthToken(null); setProfileId(null);
          setErr('El servicio de tu clínica está suspendido temporalmente.');
          setLoading(false); return;
        }
      }
      onLogin({ role: 'client', data: clientData, token: data.access_token });
    } catch (e) { setAuthToken(null); setProfileId(null); setErr(e.message); setLoading(false); }
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const sendReset = async () => {
    if (!email) { setErr('Escribe tu email'); return; }
    setLoading(true); setErr('');
    try {
      await authResetPassword(email.trim());
      setInfo('✅ Revisa tu email para restablecer tu contraseña.');
      setMode('login');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  // ── Set password ────────────────────────────────────────────────────────
  const setPassword = async () => {
    if (newPass.length < 6) { setErr('Mínimo 6 caracteres'); return; }
    if (newPass !== confirmPass) { setErr('Las contraseñas no coinciden'); return; }
    setLoading(true); setErr('');
    try {
      await authUpdatePassword(accessToken, newPass);
      setInfo('✅ Contraseña establecida. Ya puedes entrar.');
      setMode('login');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen w-full bg-[#05070a] text-white font-sans overflow-hidden flex items-center justify-center p-4">
      <Background />

      <div className="relative z-10 w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-12 md:gap-24">

        {/* ── Branding ── */}
        <FluxBranding brand={brand} />

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-md bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]"
        >
          {/* Notificaciones */}
          {err && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center leading-relaxed">
              {err}
            </div>
          )}
          {info && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs text-center leading-relaxed">
              {info}
            </div>
          )}

          {/* ── MODO LOGIN ── */}
          {mode === 'login' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-display font-bold text-center">Bienvenido</h2>
              <form className="space-y-6" onSubmit={e => { e.preventDefault(); submit(); }}>
                <div>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                  />
                </div>
                <PasswordInput
                  placeholder="Contraseña"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                <div className="flex flex-col gap-5 pt-2">
                  <motion.button
                    id="btn-login"
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 text-white font-semibold py-4 rounded-full shadow-[0_10px_30px_-5px_rgba(59,130,246,0.4)] transition-all"
                  >
                    {loading ? 'Verificando...' : 'Entrar'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setErr(''); }}
                    className="text-center text-sm font-medium text-white/40 hover:text-white underline underline-offset-4 decoration-white/10 hover:decoration-white transition-all"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </form>
              <p className="text-[10px] tracking-[4px] text-white/10 font-bold uppercase text-center pt-2">Keep Going 💪</p>
            </div>
          )}

          {/* ── MODO RESET ── */}
          {mode === 'reset' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-display font-bold text-center">Recuperar acceso</h2>
              <form className="space-y-6" onSubmit={e => { e.preventDefault(); sendReset(); }}>
                <input
                  type="email"
                  placeholder="Tu email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                />
                <div className="flex flex-col gap-5 pt-2">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-4 rounded-full shadow-[0_10px_30px_-5px_rgba(59,130,246,0.4)] transition-all"
                  >
                    {loading ? 'Enviando...' : 'Enviar instrucciones'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErr(''); }}
                    className="text-center text-sm font-medium text-white/40 hover:text-white underline underline-offset-4 decoration-white/10 hover:decoration-white transition-all"
                  >
                    Volver al login
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── MODO SET PASSWORD ── */}
          {mode === 'set_password' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-display font-bold text-center">Nueva contraseña</h2>
              <form className="space-y-6" onSubmit={e => { e.preventDefault(); setPassword(); }}>
                <div className="space-y-3">
                  <PasswordInput
                    placeholder="Nueva contraseña"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                  />
                  {/* Barra de progreso */}
                  <div className="flex gap-1.5 h-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`flex-1 rounded-full transition-all ${newPass.length > i*2 ? 'bg-blue-500/70' : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 font-medium tracking-wide">Mínimo 6 caracteres</p>
                </div>
                <div className="space-y-3">
                  <PasswordInput
                    placeholder="Confirmar contraseña"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && setPassword()}
                  />
                  <div className="flex gap-1.5 h-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`flex-1 rounded-full transition-all ${confirmPass.length > i*2 && confirmPass === newPass.slice(0, confirmPass.length) ? 'bg-blue-500/30' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-5 pt-4">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 text-white font-semibold py-4 rounded-full shadow-[0_10px_30px_-5px_rgba(59,130,246,0.4)] transition-all"
                  >
                    {loading ? 'Guardando...' : 'Establecer contraseña'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErr(''); }}
                    className="text-center text-sm font-medium text-white/40 hover:text-white underline underline-offset-4 decoration-white/10 hover:decoration-white transition-all"
                  >
                    Volver al login
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
