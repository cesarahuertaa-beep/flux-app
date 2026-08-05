import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../styles/theme";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

const fmtShort = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m${s}s`;
};

const parseInput = (raw) => {
  // Accepts: "90", "1:30", "1m30s", "1m", "30s"
  raw = raw.trim();
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  const colonMatch = raw.match(/^(\d+):(\d+)$/);
  if (colonMatch) return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  const labelMatch = raw.match(/^(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (labelMatch) return (parseInt(labelMatch[1] || 0) * 60) + parseInt(labelMatch[2] || 0);
  return null;
};

const LS_KEY = "timer_pills_v1";

const loadPills = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
};
const savePills = (pills) => {
  localStorage.setItem(LS_KEY, JSON.stringify(pills));
};

// ── Beep Sound ───────────────────────────────────────────────────────────────
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beepSeq = [880, 880, 1320];
    beepSeq.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.25);
    });
  } catch (_) {}
};

// ── Component ─────────────────────────────────────────────────────────────────
export function TimerWidget() {
  const [open,        setOpen]        = useState(false);
  const [mode,        setMode]        = useState("countdown"); // "countdown" | "stopwatch"
  const [running,     setRunning]     = useState(false);
  const [elapsed,     setElapsed]     = useState(0);   // for stopwatch (up)
  const [remaining,   setRemaining]   = useState(0);   // for countdown (down)
  const [target,      setTarget]      = useState(0);   // initial countdown value
  const [pills,       setPills]       = useState(loadPills);
  const [addingPill,  setAddingPill]  = useState(false);
  const [pillInput,   setPillInput]   = useState("");
  const [pillError,   setPillError]   = useState("");
  const [editTarget,  setEditTarget]  = useState("");  // manual input for countdown
  const [editMode,    setEditMode]    = useState(false);
  const [done,        setDone]        = useState(false);
  const intervalRef   = useRef(null);
  const pillInputRef  = useRef(null);
  const editInputRef  = useRef(null);

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      if (mode === "stopwatch") {
        setElapsed(p => p + 1);
      } else {
        setRemaining(p => {
          if (p <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setDone(true);
            playBeep();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
            return 0;
          }
          return p - 1;
        });
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  // ── Reset done flag when user interacts ──────────────────────────────────
  useEffect(() => { if (open) setDone(false); }, [open]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const startPause = () => {
    if (mode === "countdown" && !running && remaining === 0 && target === 0) return; // nothing set
    if (mode === "countdown" && !running && remaining === 0) setRemaining(target);
    setRunning(p => !p);
    setDone(false);
  };

  const reset = () => {
    setRunning(false);
    setDone(false);
    if (mode === "countdown") setRemaining(target);
    else setElapsed(0);
  };

  const applyPill = (secs) => {
    setMode("countdown");
    setTarget(secs);
    setRemaining(secs);
    setRunning(false);
    setDone(false);
    setEditMode(false);
  };

  const switchMode = (m) => {
    setRunning(false);
    setDone(false);
    setMode(m);
    setElapsed(0);
    setRemaining(target);
  };

  // ── Pills ──────────────────────────────────────────────────────────────────
  const confirmPill = () => {
    const secs = parseInput(pillInput);
    if (!secs || secs <= 0) { setPillError("Formato inválido. Ej: 90 · 1:30 · 2m · 1m30s"); return; }
    if (secs > 7200) { setPillError("Máximo 2 horas (7200 seg)"); return; }
    const next = [...pills, secs];
    setPills(next); savePills(next);
    setPillInput(""); setPillError(""); setAddingPill(false);
  };

  const removePill = (idx) => {
    const next = pills.filter((_, i) => i !== idx);
    setPills(next); savePills(next);
  };

  // ── Countdown manual edit ─────────────────────────────────────────────────
  const applyEdit = () => {
    const secs = parseInput(editTarget);
    if (!secs || secs <= 0) return;
    setTarget(secs); setRemaining(secs); setRunning(false); setDone(false);
    setEditMode(false); setEditTarget("");
  };

  // ── Derived display values ────────────────────────────────────────────────
  const displayTime = mode === "stopwatch" ? elapsed : remaining;
  const progress    = (mode === "countdown" && target > 0) ? (remaining / target) : 0;
  const isLow       = mode === "countdown" && target > 0 && remaining <= 10 && remaining > 0;
  const accent      = done ? "#f87171" : (isLow ? "#fb923c" : C.accent);

  // Mini label shown when widget is collapsed
  const miniLabel = running
    ? (mode === "countdown" ? fmt(remaining) : fmt(elapsed))
    : (done ? "¡Listo!" : null);

  // ── Styles ────────────────────────────────────────────────────────────────
  const panelRadius = 20;

  return (
    <>
      {/* ── Floating Button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(p => !p)}
        title="Cronómetro"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9000,
          width: miniLabel ? "auto" : 52,
          height: 52,
          minWidth: 52,
          padding: miniLabel ? "0 16px" : 0,
          borderRadius: 26,
          border: `1.5px solid ${running ? accent : C.border}`,
          background: running
            ? `linear-gradient(135deg, ${accent}22, ${accent}10)`
            : "rgba(7,16,29,0.92)",
          backdropFilter: "blur(16px)",
          boxShadow: running
            ? `0 0 24px ${accent}44, 0 4px 20px rgba(0,0,0,0.5)`
            : "0 4px 20px rgba(0,0,0,0.5)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          animation: running ? "pulseGlow 2s infinite" : "none",
        }}
      >
        {/* Timer icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={running ? accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <polyline points="12 7 12 12 15 15"/>
          <line x1="9" y1="2" x2="15" y2="2"/>
        </svg>
        {miniLabel && (
          <span style={{ fontSize: 13, fontWeight: 700, color: accent, fontFamily: "'Rajdhani',monospace", letterSpacing: 1 }}>
            {miniLabel}
          </span>
        )}
      </button>

      {/* ── Expanded Panel ───────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 86,
            right: 24,
            zIndex: 9001,
            width: 300,
            background: "linear-gradient(160deg, rgba(11,22,40,0.97) 0%, rgba(7,13,24,0.99) 100%)",
            border: `1px solid ${C.borderMid}`,
            borderRadius: panelRadius,
            boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(46,92,184,0.08)",
            backdropFilter: "blur(24px)",
            padding: "20px 20px 16px",
            animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            userSelect: "none",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Cronómetro</span>
            {/* Mode toggle */}
            <div style={{ display: "flex", background: "rgba(46,92,184,0.07)", borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {[["countdown","Cuenta atrás"],["stopwatch","Cronómetro"]].map(([m, lb]) => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", border: "none",
                  background: mode === m ? C.accent : "transparent",
                  color: mode === m ? "#fff" : C.muted,
                  transition: "all 0.2s",
                }}>{lb}</button>
              ))}
            </div>
          </div>

          {/* ── Circular Progress + Time Display ── */}
          <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 18px" }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              {/* Track */}
              <circle cx="70" cy="70" r="60" fill="none" stroke={`${accent}18`} strokeWidth="8"/>
              {/* Progress arc */}
              {mode === "countdown" && target > 0 && (
                <circle
                  cx="70" cy="70" r="60"
                  fill="none"
                  stroke={accent}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  strokeDashoffset={`${2 * Math.PI * 60 * (1 - progress)}`}
                  style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s" }}
                />
              )}
              {/* Stopwatch constant ring */}
              {mode === "stopwatch" && (
                <circle cx="70" cy="70" r="60" fill="none" stroke={`${accent}40`} strokeWidth="4"/>
              )}
            </svg>

            {/* Time text */}
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2
            }}>
              {done ? (
                <span style={{ fontSize: 28, fontWeight: 800, color: "#f87171", fontFamily: "'Rajdhani',sans-serif", animation: "pulseGlow 0.6s infinite" }}>¡Listo!</span>
              ) : editMode ? (
                <input
                  ref={editInputRef}
                  autoFocus
                  value={editTarget}
                  onChange={e => setEditTarget(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") applyEdit(); if (e.key === "Escape") { setEditMode(false); setEditTarget(""); }}}
                  placeholder="1:30 · 90 · 2m"
                  style={{
                    width: 90, textAlign: "center", fontSize: 14, background: "transparent",
                    border: "none", borderBottom: `1px solid ${accent}`, color: C.text,
                    outline: "none", padding: "2px 0",
                  }}
                />
              ) : (
                <>
                  <span
                    onClick={() => { if (mode === "countdown") { setEditMode(true); setRunning(false); } }}
                    style={{
                      fontSize: 36, fontWeight: 800, color: done ? "#f87171" : (isLow ? "#fb923c" : C.text),
                      fontFamily: "'Rajdhani',monospace", letterSpacing: 2,
                      cursor: mode === "countdown" ? "text" : "default",
                      transition: "color 0.3s",
                    }}
                  >{fmt(displayTime)}</span>
                  {mode === "countdown" && target > 0 && (
                    <span style={{ fontSize: 10, color: C.muted }}>de {fmt(target)}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Controls ── */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            {/* Reset */}
            <button onClick={reset} style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "rgba(46,92,184,0.08)", border: `1px solid ${C.border}`,
              color: C.muted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
            </button>

            {/* Play/Pause */}
            <button onClick={startPause} style={{
              width: 60, height: 60, borderRadius: "50%",
              background: running
                ? `linear-gradient(135deg, ${accent}, ${accent}bb)`
                : `linear-gradient(135deg, ${C.accent}, ${C.accentMid})`,
              border: "none",
              boxShadow: `0 0 20px ${accent}55`,
              color: "#fff", cursor: "pointer", fontSize: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              {running ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>

            {/* Lap / placeholder */}
            <button onClick={() => {}} style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "rgba(46,92,184,0.08)", border: `1px solid ${C.border}`,
              color: C.muted, cursor: "default", opacity: 0.3,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/></svg>
            </button>
          </div>

          {/* ── Quick Access Pills ── */}
          {mode === "countdown" && (
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                Accesos rápidos
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {pills.map((secs, i) => (
                  <div key={i} style={{ position: "relative", display: "inline-flex" }}>
                    <button
                      onClick={() => applyPill(secs)}
                      style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: target === secs ? `${C.accent}22` : "rgba(46,92,184,0.07)",
                        border: `1px solid ${target === secs ? C.accent : C.border}`,
                        color: target === secs ? C.accent : C.mutedLight,
                        cursor: "pointer", transition: "all 0.2s",
                        paddingRight: 22,
                      }}
                    >{fmtShort(secs)}</button>
                    <button
                      onClick={() => removePill(i)}
                      style={{
                        position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", color: C.muted, cursor: "pointer",
                        fontSize: 12, lineHeight: 1, padding: 0,
                      }}
                    >×</button>
                  </div>
                ))}

                {/* Add pill button */}
                {!addingPill ? (
                  <button
                    onClick={() => { setAddingPill(true); setPillError(""); setTimeout(() => pillInputRef.current?.focus(), 50); }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "rgba(46,92,184,0.08)", border: `1px dashed ${C.borderMid}`,
                      color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: "26px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                  >+</button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexBasis: "100%", marginTop: 4 }}>
                    <input
                      ref={pillInputRef}
                      value={pillInput}
                      onChange={e => { setPillInput(e.target.value); setPillError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") confirmPill(); if (e.key === "Escape") { setAddingPill(false); setPillInput(""); setPillError(""); } }}
                      placeholder="1:30 · 90 · 2m"
                      style={{
                        flex: 1, fontSize: 12, padding: "5px 10px",
                        borderRadius: 8, border: `1px solid ${pillError ? "#f87171" : C.border}`,
                        background: "rgba(7,16,29,0.7)", color: C.text, outline: "none",
                      }}
                    />
                    <button onClick={confirmPill} style={{
                      padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: C.gradBtn, border: "none", color: "#fff", cursor: "pointer",
                    }}>OK</button>
                    <button onClick={() => { setAddingPill(false); setPillInput(""); setPillError(""); }} style={{
                      padding: "5px 8px", borderRadius: 8, fontSize: 11, background: "transparent",
                      border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer",
                    }}>✕</button>
                  </div>
                )}

                {pillError && (
                  <div style={{ flexBasis: "100%", fontSize: 10, color: "#f87171", marginTop: 2 }}>{pillError}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(16px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 20px ${C.accent}44, 0 4px 20px rgba(0,0,0,0.5); }
          50%      { box-shadow: 0 0 36px ${C.accent}88, 0 4px 20px rgba(0,0,0,0.5); }
        }
      `}</style>
    </>
  );
}
