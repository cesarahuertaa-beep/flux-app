import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../styles/theme";

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

const fmt = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const fmtShort = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

const LS_KEY = "timer_pills_v2";
const loadPills = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } };
const savePills = (p) => localStorage.setItem(LS_KEY, JSON.stringify(p));

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.25);
    });
  } catch (_) {}
};

// ── Drum Column ───────────────────────────────────────────────────────────────
function DrumCol({ label, value, max, onChange }) {
  const prev = (value - 1 + max) % max;
  const next = (value + 1) % max;
  const startY = useRef(null);

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY > 0) onChange((value + 1) % max);
    else onChange((value - 1 + max) % max);
  };

  const handleTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e) => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 12) { dy > 0 ? onChange((value + 1) % max) : onChange((value - 1 + max) % max); }
    startY.current = null;
  };

  const accent = "var(--brand-accent, #2e5cb8)";

  const colRef = useRef(null);

  // Prevent page scroll when touching the drum column
  useEffect(() => {
    const el = colRef.current;
    if (!el) return;
    const stop = (e) => e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
        {label}
      </div>
      <div
        ref={colRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "ns-resize", userSelect: "none", touchAction: "none" }}
      >
        {/* Prev — tap to go back */}
        <div
          onClick={() => onChange((value - 1 + max) % max)}
          style={{ fontSize: 28, fontWeight: 700, color: "rgba(180,200,230,0.18)", fontFamily: "'Rajdhani',monospace", lineHeight: 1, cursor: "pointer", transition: "color 0.15s" }}
        >{pad(prev)}</div>

        {/* Current — highlighted */}
        <div style={{
          fontSize: 42, fontWeight: 800, color: "#fff",
          fontFamily: "'Rajdhani',monospace", lineHeight: 1,
          textShadow: `0 0 18px ${accent}88`,
          transition: "all 0.15s",
        }}>{pad(value)}</div>

        {/* Next — tap to go forward */}
        <div
          onClick={() => onChange((value + 1) % max)}
          style={{ fontSize: 28, fontWeight: 700, color: "rgba(180,200,230,0.18)", fontFamily: "'Rajdhani',monospace", lineHeight: 1, cursor: "pointer", transition: "color 0.15s" }}
        >{pad(next)}</div>
      </div>
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export function TimerWidget() {
  const [open,       setOpen]      = useState(false);
  const [hours,      setHours]     = useState(0);
  const [mins,       setMins]      = useState(2);
  const [secs,       setSecs]      = useState(0);
  const [running,    setRunning]   = useState(false);
  const [remaining,  setRemaining] = useState(0);
  const [target,     setTarget]    = useState(0);
  const [done,       setDone]      = useState(false);
  const [pills,      setPills]     = useState(loadPills);
  const [selPill,    setSelPill]   = useState(null);
  const [addingPill, setAddingPill]= useState(false);
  const [pillErr,    setPillErr]   = useState("");
  const [mode,       setMode]      = useState("set"); // "set" | "running"

  const pillInputRef = useRef(null);
  const intervalRef  = useRef(null);
  const accent       = "var(--brand-accent, #2e5cb8)";

  const totalSecs = hours * 3600 + mins * 60 + secs;

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining(p => {
        if (p <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false); setDone(true); setMode("set");
          playBeep();
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleStart = () => {
    if (totalSecs === 0) return;
    const t = totalSecs;
    setTarget(t); setRemaining(t);
    setRunning(true); setMode("running"); setDone(false);
  };

  const handlePause = () => setRunning(p => !p);

  const handleReset = () => {
    setRunning(false); setMode("set"); setDone(false);
    setRemaining(0); setTarget(0);
  };

  const applyPill = (pillSecs) => {
    const h = Math.floor(pillSecs / 3600);
    const m = Math.floor((pillSecs % 3600) / 60);
    const s = pillSecs % 60;
    setHours(h); setMins(m); setSecs(s);
    setSelPill(pillSecs);
    if (mode === "running") { handleReset(); }
  };

  // ── Pills ──────────────────────────────────────────────────────────────────
  const [pillRaw, setPillRaw] = useState("");
  const [pillH, setPillH]     = useState(0);
  const [pillM, setPillM]     = useState(1);
  const [pillS, setPillS]     = useState(0);

  const confirmPill = () => {
    const t = pillH * 3600 + pillM * 60 + pillS;
    if (t <= 0) { setPillErr("El tiempo debe ser mayor a 0"); return; }
    if (pills.includes(t)) { setPillErr("Ya tienes ese acceso"); return; }
    const next = [...pills, t];
    setPills(next); savePills(next);
    setPillH(0); setPillM(1); setPillS(0); setPillErr(""); setAddingPill(false);
  };

  const removePill = (idx, e) => {
    e.stopPropagation();
    const next = pills.filter((_, i) => i !== idx);
    setPills(next); savePills(next);
    if (selPill === pills[idx]) setSelPill(null);
  };

  // ── Progress arc ─────────────────────────────────────────────────────────
  const progress = target > 0 ? remaining / target : 0;
  const R = 28; const circ = 2 * Math.PI * R;

  // ── Mini label ────────────────────────────────────────────────────────────
  const miniLabel = running ? fmt(remaining) : (done ? "Done" : null);

  return (
    <>
      {/* ── Floating Button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(p => !p)}
        title="Cronómetro"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          width: miniLabel ? "auto" : 52, height: 52, minWidth: 52,
          padding: miniLabel ? "0 16px" : 0, borderRadius: 26,
          border: `1.5px solid ${running ? accent : C.border}`,
          background: running ? `linear-gradient(135deg, ${accent}22, ${accent}10)` : "rgba(7,16,29,0.92)",
          backdropFilter: "blur(16px)",
          boxShadow: running ? `0 0 24px ${accent}44, 0 4px 20px rgba(0,0,0,0.5)` : "0 4px 20px rgba(0,0,0,0.5)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Mini progress ring when running */}
        <svg width="28" height="28" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
          <circle cx="32" cy="32" r={R} fill="none" stroke={`${running ? accent : C.muted}30`} strokeWidth="5"/>
          {running && (
            <circle cx="32" cy="32" r={R} fill="none" stroke={accent} strokeWidth="5"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.9s linear" }}/>
          )}
          {!running && (
            <g transform="rotate(90,32,32)">
              <circle cx="32" cy="32" r="10" fill="none" stroke={C.muted} strokeWidth="2"/>
              <line x1="32" y1="24" x2="32" y2="32" stroke={C.muted} strokeWidth="2" strokeLinecap="round"/>
              <line x1="32" y1="32" x2="38" y2="36" stroke={C.muted} strokeWidth="2" strokeLinecap="round"/>
            </g>
          )}
        </svg>
        {miniLabel && (
          <span style={{ fontSize: 13, fontWeight: 700, color: done ? "#f87171" : accent, fontFamily: "'Rajdhani',monospace", letterSpacing: 1 }}>
            {miniLabel}
          </span>
        )}
      </button>

      {/* ── Expanded Panel ──────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 86, right: 24, zIndex: 9001, width: 300,
          background: "linear-gradient(160deg, rgba(11,22,40,0.97) 0%, rgba(7,13,24,0.99) 100%)",
          border: `1px solid ${C.borderMid}`, borderRadius: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(46,92,184,0.08)",
          backdropFilter: "blur(24px)", padding: "18px 16px 16px",
          animation: "timerSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}>

          {/* ── Header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Cronómetro
            </span>
            {mode === "running" && (
              <button onClick={handleReset} style={{
                fontSize: 10, fontWeight: 700, color: "#f87171", background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "3px 10px", cursor: "pointer",
              }}>Cancelar</button>
            )}
          </div>

          {/* ── Drum Picker (SET mode, hidden when adding pill) ── */}
          {mode === "set" && !addingPill && (
            <div style={{ position: "relative", marginBottom: 16 }}>
              {/* Highlight band behind center row */}
              <div style={{
                position: "absolute", left: 0, right: 0,
                top: "50%", transform: "translateY(-50%)",
                height: 52, borderRadius: 12,
                background: `${accent}10`,
                border: `1px solid ${accent}22`,
                pointerEvents: "none",
              }}/>
              <div style={{ display: "flex", gap: 0, padding: "8px 0", position: "relative", zIndex: 1 }}>
                <DrumCol label="Horas"    value={hours} max={24} onChange={setHours}/>
                <DrumCol label="Minutos"  value={mins}  max={60} onChange={setMins}/>
                <DrumCol label="Segundos" value={secs}  max={60} onChange={setSecs}/>
              </div>
            </div>
          )}

          {/* ── Running Display ── */}
          {mode === "running" && (
            <div style={{ textAlign: "center", marginBottom: 16, padding: "12px 0" }}>
              <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
                <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke={`${accent}18`} strokeWidth="7"/>
                  <circle cx="60" cy="60" r="52" fill="none" stroke={done ? "#f87171" : accent} strokeWidth="7"
                    strokeLinecap="round" strokeDasharray={2*Math.PI*52}
                    strokeDashoffset={2*Math.PI*52*(1-progress)}
                    style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{
                    fontSize: done ? 20 : 28, fontWeight: 800, fontFamily: "'Rajdhani',monospace",
                    color: done ? "#f87171" : "#fff", letterSpacing: 2,
                    animation: done ? "timerPulse 0.6s infinite" : "none",
                  }}>{done ? "¡Listo!" : fmt(remaining)}</span>
                  {!done && <span style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>de {fmt(target)}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── Quick Access Circles ── */}
          {!addingPill && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                Accesos rápidos
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {pills.map((pillSecs, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <button
                      onClick={() => applyPill(pillSecs)}
                      style={{
                        width: 62, height: 62, borderRadius: "50%", cursor: "pointer",
                        background: selPill === pillSecs ? `${accent}18` : "rgba(46,92,184,0.07)",
                        border: `2px solid ${selPill === pillSecs ? accent : "rgba(46,92,184,0.2)"}`,
                        color: selPill === pillSecs ? accent : C.mutedLight,
                        fontSize: 10, fontWeight: 700, fontFamily: "'Rajdhani',monospace",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: selPill === pillSecs ? `0 0 14px ${accent}44` : "none",
                        transition: "all 0.2s",
                      }}
                    >{fmtShort(pillSecs)}</button>
                    {/* Remove × */}
                    <button onClick={(e) => removePill(i, e)} style={{
                      position: "absolute", top: -3, right: -3,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "rgba(239,68,68,0.85)", border: "none",
                      color: "#fff", fontSize: 10, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700,
                    }}>×</button>
                  </div>
                ))}

                {/* Add pill circle */}
                <button
                  onClick={() => { setAddingPill(true); setPillErr(""); }}
                  style={{
                    width: 62, height: 62, borderRadius: "50%",
                    background: "rgba(46,92,184,0.05)",
                    border: `2px dashed ${C.borderMid}`,
                    color: C.muted, fontSize: 22, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                >+</button>
              </div>
            </div>
          )}

          {/* ── Add pill mini drum picker ── */}
          {addingPill && (
            <div style={{ marginBottom: 14, background: "rgba(46,92,184,0.06)", borderRadius: 14, padding: "10px 8px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                Nuevo acceso rápido
              </div>
              <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
                <DrumCol label="H" value={pillH} max={24} onChange={setPillH}/>
                <DrumCol label="M" value={pillM} max={60} onChange={setPillM}/>
                <DrumCol label="S" value={pillS} max={60} onChange={setPillS}/>
              </div>
              {pillErr && <div style={{ fontSize: 10, color: "#f87171", marginBottom: 6, textAlign: "center" }}>{pillErr}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setAddingPill(false); setPillErr(""); }} style={{
                  flex: 1, padding: "7px 0", borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: "transparent", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer",
                }}>Cancelar</button>
                <button onClick={confirmPill} style={{
                  flex: 2, padding: "7px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
                  background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                  border: "none", color: "#fff", cursor: "pointer",
                }}>Guardar acceso</button>
              </div>
            </div>
          )}

          {/* ── Main Action Button ── */}
          {mode === "set" ? (
            <button
              onClick={handleStart}
              disabled={totalSecs === 0}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 50,
                background: totalSecs === 0 ? "rgba(46,92,184,0.15)" : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                border: "none", color: totalSecs === 0 ? C.muted : "#fff",
                fontSize: 15, fontWeight: 700, cursor: totalSecs === 0 ? "not-allowed" : "pointer",
                boxShadow: totalSecs > 0 ? `0 4px 20px ${accent}55` : "none",
                transition: "all 0.2s", letterSpacing: "0.5px",
              }}
            >Iniciar</button>
          ) : (
            <button
              onClick={handlePause}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 50,
                background: running ? "rgba(251,146,60,0.15)" : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                border: `1px solid ${running ? "rgba(251,146,60,0.4)" : "transparent"}`,
                color: running ? "#fb923c" : "#fff",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: !running ? `0 4px 20px ${accent}55` : "none",
                transition: "all 0.2s", letterSpacing: "0.5px",
              }}
            >{running ? "Pausar" : "Continuar"}</button>
          )}
        </div>
      )}

      <style>{`
        @keyframes timerSlideUp {
          from { opacity:0; transform:translateY(14px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes timerPulse {
          0%,100% { opacity:1; } 50% { opacity:0.4; }
        }
      `}</style>
    </>
  );
}
