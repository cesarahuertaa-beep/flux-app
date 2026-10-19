import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, RotateCcw, Save, ChevronDown, TrendingUp, TrendingDown, Minus, Dumbbell, Check, CheckCheck, X, Square, Trophy, Sparkles, Flame } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function TimerCard({ brandColor }) {
  const [seconds, setSeconds] = useState(90);
  const [initialSeconds, setInitialSeconds] = useState(90);
  const [status, setStatus] = useState("IDLE"); // IDLE, RUNNING, ALARMING
  
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);

  const startAlarm = () => {
    setStatus("ALARMING");
    if (navigator.vibrate) {
      const pattern = [];
      for (let i = 0; i < 20; i++) pattern.push(500, 500);
      navigator.vibrate(pattern);
    }
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      for (let i = 0; i < 20; i++) {
         gain.gain.setValueAtTime(1, ctx.currentTime + i);
         gain.gain.setValueAtTime(0, ctx.currentTime + i + 0.5);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      oscRef.current = osc;
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  const stopAlarm = () => {
    if (navigator.vibrate) navigator.vibrate(0);
    if (oscRef.current) {
      try { oscRef.current.stop(); } catch(e){}
      oscRef.current = null;
    }
  };

  useEffect(() => {
    if (status ==="RUNNING") {
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            startAlarm();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  useEffect(() => {
    return () => stopAlarm();
  }, []);

  const handleAction = () => {
    if (status ==="IDLE") {
      if (seconds > 0) setStatus("RUNNING");
    } else if (status ==="RUNNING") {
      setStatus("IDLE");
      setSeconds(initialSeconds);
    } else if (status ==="ALARMING") {
      stopAlarm();
      setSeconds(initialSeconds);
      setStatus("IDLE");
    }
  };

  const changeTime = (type, isUp) => {
    if (status !=="IDLE") return;
    setSeconds(prev => {
      let mins = Math.floor(prev / 60);
      let secs = prev % 60;
      if (type === 'min') {
        mins = isUp ? mins + 1 : Math.max(0, mins - 1);
      } else {
        secs = isUp ? secs + 1 : secs - 1;
        if (secs > 59) { secs = 0; mins++; }
        if (secs < 0) { secs = 59; mins = Math.max(0, mins - 1); }
      }
      const newVal = mins * 60 + secs;
      setInitialSeconds(newVal);
      return newVal;
    });
  };

  const handleWheel = (e, type) => {
    changeTime(type, e.deltaY < 0);
  };

  const handleTouchStart = (e) => {
    e.currentTarget.dataset.startY = e.touches[0].clientY;
  };

  const handleTouchMove = (e, type) => {
    if (status !=="IDLE") return;
    const startY = parseFloat(e.currentTarget.dataset.startY);
    const currentY = e.touches[0].clientY;
    const diff = startY - currentY;
    if (Math.abs(diff) > 20) {
      e.currentTarget.dataset.startY = currentY;
      changeTime(type, diff > 0);
    }
  };

  const pad = n => String(n).padStart(2, '0');

  let btnIcon = <Play size={16} className="ml-0.5" />;
  let btnClass ="text-white";
  let btnBg = brandColor ||"var(--brand-primary)";
  
  if (status ==="RUNNING") {
    btnIcon = <Square size={14} className="fill-current" />;
  } else if (status ==="ALARMING") {
    btnIcon = <Square size={14} className="fill-current" />;
    btnClass ="text-white animate-pulse";
    btnBg ="#ef4444"; // red-500
  }

  return (
    <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl p-4 flex items-center gap-4 mb-3">
      <div>
        <p className={`text-[10px] font-mono tracking-widest uppercase ${status ==="ALARMING" ?"text-red-500 font-bold" :"text-[#6B7A8D]"}`}>
          {status ==="ALARMING" ?"¡TIEMPO!" :"Descanso"}
        </p>
        <div className={`flex items-center text-3xl font-mono font-bold mt-1 select-none touch-none ${status ==="ALARMING" ?"text-red-500" :"text-[#0B1929]"}`}>
          <div 
            className={`cursor-ns-resize px-1 rounded transition-colors ${status==="IDLE"?'hover:bg-gray-100':'pointer-events-none'}`}
            onWheel={(e)=>handleWheel(e, 'min')}
            onTouchStart={handleTouchStart}
            onTouchMove={(e)=>handleTouchMove(e, 'min')}
          >
            {pad(Math.floor(seconds / 60))}
          </div>
          <span className="pb-1 opacity-50">:</span>
          <div 
            className={`cursor-ns-resize px-1 rounded transition-colors ${status==="IDLE"?'hover:bg-gray-100':'pointer-events-none'}`}
            onWheel={(e)=>handleWheel(e, 'sec')}
            onTouchStart={handleTouchStart}
            onTouchMove={(e)=>handleTouchMove(e, 'sec')}
          >
            {pad(seconds % 60)}
          </div>
        </div>
      </div>
      <div className="flex gap-2 ml-auto">
        <button
          onClick={handleAction}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${btnClass}`}
          style={{ background: btnBg }}
        >
          {btnIcon}
        </button>
      </div>
    </div>
  );
}

export default function Training({
  rutinas,
  progreso,
  progresoSemanaAnterior = {}, 
  clienteNombre,
  onProgressChange,
  semanaActualCiclo = 1,
  syncStatus ="synced",
  isLocked = false,
  ultimoPeso = null,
  isSelfManaged = false,
}) {
  // Semana actual (índice 0-based para leer de progreso)
  const wi = Math.max(0, semanaActualCiclo - 1);

  const [activeRutinaIdx, setActiveRutinaIdx] = useState(0);
  const [expandedEx,      setExpandedEx]      = useState(0); // Primer ejercicio abierto por defecto
  const [activeVariant,   setActiveVariant]   = useState({}); // { [exId]: 'original' | 'alt_0' }
  const [previewEx, setPreviewEx] = useState(null);
  const [showResumen,     setShowResumen]     = useState(false);
  const [unitPrefs,       setUnitPrefs]       = useState({}); // { [exId_variantId]: 'kg' | 'lb' }
  const [focusedInput,    setFocusedInput]    = useState(null); // { exId, wi, si }
  // Local raw text while user is typing — prevents React from overwriting mid-keystroke
  const [localWeightInputs, setLocalWeightInputs] = useState({}); // { [kgKey]: string }

  // Rutinas activas válidas (filtrar rutinas vacías sin ejercicios si existen otras con ejercicios)
  const rutinasValidas = useMemo(() => {
    if (!rutinas || rutinas.length === 0) return [];
    const conEjercicios = rutinas.filter(r => (r.ejercicios || []).length > 0);
    return conEjercicios.length > 0 ? conEjercicios : rutinas;
  }, [rutinas]);

  if (!rutinasValidas || rutinasValidas.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-[#F0F4FA] rounded-full flex items-center justify-center mb-4">
          <Dumbbell size={32} className="text-[#6B7A8D]" />
        </div>
        <h2 className="text-xl font-bold text-[#0B1929] mb-2" style={{ fontFamily:"DM Sans" }}>
          Rutina en preparación
        </h2>
        <p className="text-sm text-[#6B7A8D]">
          {isSelfManaged ?"Aún no has diseñado tu plan de entrenamiento." :"Tu nutriólogo está diseñando tu plan de entrenamiento."}
        </p>
      </div>
    );
  }

  const safeActiveIdx = activeRutinaIdx >= rutinasValidas.length ? 0 : activeRutinaIdx;
  const rutinaActiva = rutinasValidas[safeActiveIdx];
  const ejercicios   = rutinaActiva?.ejercicios || [];

  const getVariantObj = (ex) => {
    const variantId = activeVariant[ex.id] ||"original";
    if (variantId ==="original") return { obj: ex, variantId:"original" };
    const altIdx = parseInt(variantId.replace("alt_",""));
    return { obj: (ex.alternativas || [])[altIdx] || ex, variantId };
  };

  const totalSemanas = rutinaActiva?.semanas || 4;

  const calcular1RMForGraph = (peso, reps) => {
    const p = parseFloat(peso), r = parseFloat(reps);
    if (!p || !r || p <= 0 || r <= 0) return null;
    if (r === 1) return p;
    return p * (1 + r / 30);
  };

  const getExerciseGraphData = (ex, activeObj, variantId) => {
    if (!ex || !activeObj) return [];
    const nSeries = parseInt(activeObj.num_series || ex.num_series) || 4;
    const raw = Array.from({ length: totalSemanas }, (_, w) => {
      const dataPoint = { week: `Sem ${w + 1}` };
      let hasData = false;
      for (let s = 0; s < nSeries; s++) {
        const p = parseFloat(progreso[`${ex.id}-${w}-${s}-peso-${variantId}`]);
        const rVal = progreso[`${ex.id}-${w}-${s}-reps-${variantId}`];
        const r = rVal === "Falta" ? 0 : parseFloat(rVal);

        if (!isNaN(p) && !isNaN(r) && p > 0 && r > 0) {
          const e1rm = calcular1RMForGraph(p, r);
          if (e1rm) {
            dataPoint[`serie_${s}`] = Math.round(e1rm * 10) / 10;
            hasData = true;
          }
        }
      }
      return { dataPoint, hasData };
    });

    const lastDataIndex = raw.reduce((lastIdx, item, idx) => (item.hasData ? idx : lastIdx), -1);
    return lastDataIndex === -1 ? [] : raw.slice(0, lastDataIndex + 1).map(i => i.dataPoint);
  };

  const getPrevVal = (exId, variantId, exObj, si, tipo) => {
    if (wi === 0) {
      if (tipo ==="reps") return exObj.reps_sugeridas ||"10";
      if (tipo ==="peso") return exObj.peso_sugerido ||"-";
      return"";
    }
    const key = `${exId}-${wi - 1}-${si}-${tipo}-${variantId}`;
    const val = progresoSemanaAnterior[key] || progreso[key];
    return val ||"N/A";
  };

  const parseDisplayWeight = (dbVal, unit) => {
    if (typeof dbVal === 'string' && dbVal.startsWith("LB:")) return dbVal.replace("LB:","");
    if (!dbVal || dbVal ==="-" || isNaN(dbVal)) return dbVal;
    
    // If unit is lb, convert stored kg back to lb
    if (unit === 'lb') {
      const num = parseFloat(dbVal);
      const lb = num * 2.20462262;
      return Number(lb.toFixed(1)).toString();
    }
    return dbVal; // for kg, keep exactly as typed/stored
  };

  const parseDBWeight = (inputVal, unit) => {
    if (!inputVal || inputVal === "-") return inputVal;
    // Allow trailing dot or trailing zero after dot — don't convert yet
    if (inputVal.endsWith('.') || inputVal.endsWith('.0')) return inputVal;
    if (unit === 'lb') {
      const p = parseFloat(inputVal);
      if (isNaN(p)) return inputVal;
      return (p * 0.45359237).toFixed(4);
    }
    // For kg, return exactly what they typed
    return inputVal;
  };

  // ── 1RM Estimado (Fórmula Epley) ──────────────────────────────
  const calcular1RM = (peso, reps) => {
    const p = parseFloat(peso), r = parseFloat(reps);
    if (!p || !r || p <= 0 || r <= 0) return null;
    if (r === 1) return p;
    return p * (1 + r / 30);
  };

  // Retorna el Δ% entre semana actual y anterior, o null si faltan datos
  const calcularAvance = (pesoActual, repsActual, pesoPrev, repsPrev) => {
    const e1RM_actual = calcular1RM(pesoActual, repsActual);
    const e1RM_prev   = calcular1RM(pesoPrev, repsPrev);
    if (!e1RM_actual || !e1RM_prev) return null;
    return ((e1RM_actual - e1RM_prev) / e1RM_prev) * 100;
  };

  // ── Detección de Récord Personal (PR 🏆) por ejercicio ──
  const getExercisePRData = (ex, variantId, activeObj) => {
    const nSeries = parseInt(activeObj?.num_series || ex.num_series) || 3;
    let bestHistorical1RM = 0;

    // Buscar el mejor 1RM en todas las semanas anteriores (0 .. wi - 1)
    for (let w = 0; w < wi; w++) {
      for (let s = 0; s < nSeries; s++) {
        const pKey = `${ex.id}-${w}-${s}-peso-${variantId}`;
        const rKey = `${ex.id}-${w}-${s}-reps-${variantId}`;
        const p = progreso[pKey] ?? (w === wi - 1 ? progresoSemanaAnterior[pKey] : null);
        const r = progreso[rKey] ?? (w === wi - 1 ? progresoSemanaAnterior[rKey] : null);
        const e1rm = calcular1RM(p, r);
        if (e1rm && e1rm > bestHistorical1RM) bestHistorical1RM = e1rm;
      }
    }

    // Si estamos en semana 1 (wi === 0), usar peso/reps sugeridos como base si existen
    if (bestHistorical1RM === 0 && activeObj?.peso_sugerido && activeObj?.reps_sugeridas) {
      const base1RM = calcular1RM(activeObj.peso_sugerido, activeObj.reps_sugeridas);
      if (base1RM) bestHistorical1RM = base1RM;
    }

    let bestCurrent1RM = 0;
    let bestSetIdx = -1;
    let bestWeight = 0;
    let bestReps = 0;

    for (let s = 0; s < nSeries; s++) {
      const p = progreso[`${ex.id}-${wi}-${s}-peso-${variantId}`];
      const r = progreso[`${ex.id}-${wi}-${s}-reps-${variantId}`];
      const e1rm = calcular1RM(p, r);
      if (e1rm && e1rm > bestCurrent1RM) {
        bestCurrent1RM = e1rm;
        bestSetIdx = s;
        bestWeight = parseFloat(p);
        bestReps = parseFloat(r);
      }
    }

    const isPR =
      bestCurrent1RM > 0 &&
      bestHistorical1RM > 0 &&
      bestCurrent1RM > bestHistorical1RM + 0.1;

    const gainPct =
      bestHistorical1RM > 0
        ? ((bestCurrent1RM - bestHistorical1RM) / bestHistorical1RM) * 100
        : 0;

    return {
      isPR,
      bestHistorical1RM,
      bestCurrent1RM,
      gainPct,
      bestSetIdx,
      bestWeight,
      bestReps,
    };
  };

  // ── Métricas en vivo de la sesión del día ──
  let totalSetsDay = 0;
  let completedSetsDay = 0;
  let totalVolumeKg = 0;
  const sessionPRs = [];
  const musclesTrainedMap = {};

  ejercicios.forEach((ex) => {
    const { obj: activeObj, variantId } = getVariantObj(ex);
    const nSeries = parseInt(activeObj?.num_series || ex.num_series) || 3;
    totalSetsDay += nSeries;

    let exHasCompletedSet = false;
    for (let s = 0; s < nSeries; s++) {
      const rVal = progreso[`${ex.id}-${wi}-${s}-reps-${variantId}`];
      const pVal = progreso[`${ex.id}-${wi}-${s}-peso-${variantId}`];
      if (rVal !== undefined && rVal !== "") {
        completedSetsDay++;
        exHasCompletedSet = true;
        const rNum = parseFloat(rVal);
        const pNum = parseFloat(pVal);
        if (!isNaN(rNum) && rNum > 0 && !isNaN(pNum) && pNum > 0) {
          totalVolumeKg += rNum * pNum;
        }
      }
    }

    const prInfo = getExercisePRData(ex, variantId, activeObj);
    if (prInfo.isPR) {
      sessionPRs.push({
        id: ex.id,
        nombre: activeObj.nombre,
        grupo: activeObj.grupo_muscular || ex.grupo_muscular || "General",
        ...prInfo,
      });
    }

    if (exHasCompletedSet) {
      const grp = activeObj.grupo_muscular || ex.grupo_muscular || "General";
      if (!musclesTrainedMap[grp]) {
        musclesTrainedMap[grp] = { baseXP: 10, bonusXP: 0 };
      }
      if (prInfo.isPR && prInfo.gainPct > 0) {
        musclesTrainedMap[grp].bonusXP = Math.max(
          musclesTrainedMap[grp].bonusXP,
          Math.round(prInfo.gainPct)
        );
      }
    }
  });

  const completionPct =
    totalSetsDay > 0 ? Math.min(100, Math.round((completedSetsDay / totalSetsDay) * 100)) : 0;

  return (
    <div className="flex-1 flex flex-col relative bg-[#F7F9FC] min-h-full">
      {isLocked && (
        <div className="bg-amber-100 text-amber-800 px-4 py-2 text-center text-[11px] md:text-xs font-semibold">
          Este plan arranca en el futuro. Puedes ver tu rutina, pero aún no puedes registrar progreso.
        </div>
      )}
      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] pr-12 md:pr-8 mb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
              Rutina Semanal
            </p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
              Entrenamiento
            </h1>
            {isSelfManaged ? (
              <p className="text-sm text-[#6B7A8D] mt-1">
                Tu rutina activa — Semana {semanaActualCiclo}
              </p>
            ) : clienteNombre ? (
              <p className="text-sm text-[#6B7A8D] mt-1">
                Paciente:{" "}
                <span className="text-[var(--brand-primary)] font-medium">{clienteNombre}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Day tabs (las rutinas/días del cliente) ── */}
      <div className="sticky top-0 z-30 bg-[#F7F9FC]/95 backdrop-blur-sm px-6 md:px-8 py-2.5 mb-2 border-b border-[#E2E8F0]/60 shrink-0">
        <div className="flex gap-2 overflow-x-auto scroll-hide">
          {rutinasValidas.map((r, i) => {
            const isActive = safeActiveIdx === i;
            
            let shortTab = `Día ${i + 1}`;
            if (r.nombre) {
              const parts = String(r.nombre).split('|');
              if (parts.length > 1) {
                shortTab = parts[0];
              } else if (/^d[íi]a\s*\d+/i.test(r.nombre.trim())) {
                shortTab = r.nombre.trim();
              } else {
                const firstWord = String(r.nombre).trim().split(' ')[0].toUpperCase();
                const dayMap = {
                  "LUNES": "LUN", "MARTES": "MAR", "MIERCOLES": "MIE", "MIÉRCOLES": "MIE",
                  "JUEVES": "JUE", "VIERNES": "VIE", "SABADO": "SAB", "SÁBADO": "SAB", "DOMINGO": "DOM"
                };
                shortTab = dayMap[firstWord] || (firstWord.length <= 4 ? firstWord : firstWord.substring(0, 3));
              }
            }

            return (
              <button
                key={r.id || i}
                onClick={() => { setActiveRutinaIdx(i); setExpandedEx(0); }}
                className={`flex-1 min-w-[58px] py-2 px-3 rounded-lg text-xs font-semibold transition-all flex flex-col items-center justify-center shrink-0 ${
                  isActive
                    ? "bg-[var(--brand-primary)] text-white shadow-sm"
                    : "bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
                }`}
              >
                <span className="uppercase">{shortTab}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ✨ Subtítulo del día activo ✨ */}
      <div className="px-6 md:px-8 mb-3 shrink-0">
        <span className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase">
          {(() => {
            const nombre = rutinaActiva?.nombre;
            if (!nombre) return `Rutina — Semana ${semanaActualCiclo}`;
            const parts = String(nombre).split('|');
            const title = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
            return `${title} — Semana ${semanaActualCiclo}`;
          })()}
        </span>
      </div>

      {/* ── Lista de ejercicios ── */}
      <div className="px-6 md:px-8 flex-1 space-y-3 pb-32 md:pb-12 min-h-0">

        {/* Barra de Progreso de la Sesión del Día */}
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0B1929]">
                Progreso del Día: {completedSetsDay}/{totalSetsDay} series
              </span>
              {totalVolumeKg > 0 && (
                <span className="text-[11px] font-mono text-[#6B7A8D] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-md">
                  {Math.round(totalVolumeKg).toLocaleString("es-MX")} kg vol.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sessionPRs.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  <Trophy size={11} className="text-amber-500" /> {sessionPRs.length} PR
                </span>
              )}
              <span
                className={`font-mono font-bold ${
                  completionPct === 100 ? "text-emerald-600" : "text-[var(--brand-primary)]"
                }`}
              >
                {completionPct}%
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-[#F0F4FA] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                completionPct === 100 ? "bg-emerald-500" : "bg-[var(--brand-primary)]"
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Cronómetro inline, justo antes del primer ejercicio (igual que Figma) */}
        <TimerCard brandColor="var(--brand-primary)" />

        {ejercicios.map((ex, i) => {
          const numSeries = ex.num_series || 3;
          const isExpanded = expandedEx === i;

          const varData = getVariantObj(ex);
          const activeObj = varData.obj;
          const activeVarId = varData.variantId;
          const exPR = getExercisePRData(ex, activeVarId, activeObj);

          const otherVariants = [];
          if (activeVarId !=="original") {
            otherVariants.push({ obj: ex, variantId:"original" });
          }
          (ex.alternativas || []).forEach((alt, altIdx) => {
            const vid = `alt_${altIdx}`;
            if (vid !== activeVarId) otherVariants.push({ obj: alt, variantId: vid });
          });

          // Check if there is data this week for any variant of this exercise
          const isSaved = ["original","alt_0","alt_1"].some(vid => progreso[`${ex.id}-${wi}-0-reps-${vid}`] !== undefined);

          return (
            <div
              key={ex.id || i}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                isExpanded ?"border-[var(--brand-primary)] shadow-sm" :"border-[#E2E8F0]"
              }`}
            >
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedEx(isExpanded ? null : i)}
              >
                <div className="w-8 h-8 rounded-lg bg-[#E8F1FB] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-[var(--brand-primary)]">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0B1929]">{activeObj.nombre}</p>
                  <p className="text-xs text-[#6B7A8D]">{activeObj.grupo_muscular || activeObj.musculo ||"General"}</p>
                </div>
                {exPR.isPR && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold border border-amber-200 shadow-sm">
                    <Trophy size={12} className="text-amber-500" /> Nuevo PR
                  </span>
                )}
                {isSaved && (
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium border border-green-100 hidden md:block">
                    ✓ Guardado
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`text-[#CBD5E1] transition-transform flex-shrink-0 ${isExpanded ?"rotate-180" :""}`}
                />
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#F0F4FA] pt-4">

                  {/* Fila superior: Miniatura GIF + Alternativas */}
                  <div className="flex items-start gap-4 mb-5">
                    {/* Miniatura Activa */}
                      <button
                        onClick={() => setPreviewEx(activeObj)}
                        className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer text-left p-0"
                      >
                      {activeObj.gif_url ? (
                        <img src={activeObj.gif_url} alt={activeObj.nombre} className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <Dumbbell size={28} className="text-[#6B7A8D]" />
                      )}
                      {activeObj.gif_url && (
                        <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur border border-[#E2E8F0] rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-mono font-bold text-[#0B1929] tracking-widest uppercase">GIF</span>
                        </div>
                      )}
                      </button>

                    {/* Alternativas Clickables */}
                    <div className="flex-1 min-w-0 flex gap-3 overflow-x-auto pb-2 scroll-hide">
                      {otherVariants.map((v) => (
                        <button 
                          key={v.variantId}
                          onClick={() => setActiveVariant(s => ({ ...s, [ex.id]: v.variantId }))}
                          className="w-16 sm:w-20 flex-shrink-0 flex flex-col gap-1.5 items-center opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden">
                            {v.obj.gif_url ? (
                              <img src={v.obj.gif_url} className="w-full h-full object-contain mix-blend-multiply" />
                            ) : (
                              <Dumbbell size={20} className="text-[#6B7A8D]" />
                            )}
                            <div className="absolute top-1 left-1 bg-white/90 backdrop-blur border border-[#E2E8F0] rounded px-1 py-0.5">
                              <span className="text-[7px] font-bold text-[#0B1929] uppercase">{v.variantId === 'original' ? 'ORG' : 'ALT'}</span>
                            </div>
                          </div>
                          <p className="text-[9px] font-medium text-center text-[#6B7A8D] leading-tight line-clamp-2">
                            {v.obj.nombre}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tabla de Series */}
                  <div>
                    <div className="flex gap-2 mb-2 px-1 items-center">
                      <div className="w-8 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Serie</div>
                      <div className="flex-1 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Reps</div>
                      <div className="flex-1 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Peso</div>
                      <div className="w-14 text-center text-[10px] font-mono text-[#6B7A8D] uppercase">Avance</div>
                    </div>

                    {Array.from({ length: numSeries }).map((_, si) => {
                      const repKey   = `${ex.id}-${wi}-${si}-reps-${activeVarId}`;
                      const kgKey    = `${ex.id}-${wi}-${si}-peso-${activeVarId}`;
                      const repVal   = progreso[repKey] ||"";
                      const kgVal    = progreso[kgKey] ||"";
                      
                      const prevReps = getPrevVal(ex.id, activeVarId, activeObj, si,"reps");
                      const prevKg   = getPrevVal(ex.id, activeVarId, activeObj, si,"peso");
                      
                      const prefUnit = unitPrefs[`${ex.id}_${activeVarId}`] || activeObj.unidad || 'kg';
                      
                      const displayKgVal  = parseDisplayWeight(kgVal, prefUnit);
                      const displayPrevKg = parseDisplayWeight(prevKg, prefUnit);

                      // Avance por 1RM estimado: comparar (peso+reps actuales) vs (peso+reps prev)
                      const avancePct = calcularAvance(kgVal, repVal, prevKg, prevReps);
                      const isSetPR = exPR.isPR && exPR.bestSetIdx === si;

                      return (
                        <div key={si} className="flex flex-col mb-3">
                          <div className="flex gap-2 items-center">
                            <div className="w-8 text-center text-xs font-mono text-[#0B1929] font-bold">
                              {si + 1}
                            </div>

                            <div className="flex-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder={prevReps}
                                value={repVal}
                                disabled={isLocked}
                                onFocus={() => setFocusedInput({ exId: ex.id, wi, si })}
                                onBlur={() => setTimeout(() => setFocusedInput(null), 150)}
                                onChange={(e) => onProgressChange(ex.id, wi, si,"reps", e.target.value, activeVarId)}
                                className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                              />
                            </div>

                            <div className="flex-1 relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={displayPrevKg}
                                value={localWeightInputs[kgKey] !== undefined ? localWeightInputs[kgKey] : displayKgVal}
                                disabled={isLocked}
                                onFocus={() => {
                                  setFocusedInput({ exId: ex.id, wi, si });
                                  // Seed local state with current display value so user starts from what they see
                                  setLocalWeightInputs(prev => ({ ...prev, [kgKey]: displayKgVal || "" }));
                                }}
                                onBlur={() => {
                                  setTimeout(() => setFocusedInput(null), 150);
                                  const raw = localWeightInputs[kgKey];
                                  if (raw !== undefined) {
                                    // On blur, commit final conversion to progreso
                                    const dbVal = parseDBWeight(raw, prefUnit);
                                    onProgressChange(ex.id, wi, si, "peso", dbVal, activeVarId);
                                    // Clear local state so value is driven by progreso again
                                    setLocalWeightInputs(prev => {
                                      const next = { ...prev };
                                      delete next[kgKey];
                                      return next;
                                    });
                                  }
                                }}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  // Only allow digits, dot, and minus
                                  if (!/^-?\d*\.?\d*$/.test(raw) && raw !== "") return;
                                  // Update local display immediately — no conversion during typing
                                  setLocalWeightInputs(prev => ({ ...prev, [kgKey]: raw }));
                                  // Also save to progreso so debounce works (skip conversion for partial values)
                                  if (!raw.endsWith('.')) {
                                    const dbVal = parseDBWeight(raw, prefUnit);
                                    onProgressChange(ex.id, wi, si, "peso", dbVal, activeVarId);
                                  }
                                }}
                                className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-2 pr-6 text-center text-[15px] font-semibold text-[#0B1929] placeholder-[#9BA5B0] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] outline-none transition-shadow"
                              />
                              <button 
                                onClick={() => setUnitPrefs(s => ({ ...s, [`${ex.id}_${activeVarId}`]: prefUnit === 'kg' ? 'lb' : 'kg' }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#6B7A8D] uppercase hover:text-[var(--brand-primary)]"
                              >
                                {prefUnit}
                              </button>
                            </div>

                            <div className="w-14 flex flex-col justify-center items-center">
                              {isSetPR ? (
                                <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  <Trophy size={10} className="text-amber-500" /> PR
                                </span>
                              ) : avancePct !== null ? (
                                <div className="flex items-center gap-0.5">
                                  {avancePct === 0
                                    ? <Minus size={12} className="text-[#9BA5B0]" />
                                    : avancePct > 0
                                      ? <TrendingUp size={12} className="text-emerald-500" />
                                      : <TrendingDown size={12} className="text-red-400" />
                                  }
                                  {avancePct !== 0 && (
                                    <span className={`text-[10px] font-bold font-mono ${avancePct > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                      {Math.abs(avancePct).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-[10px] text-[#CBD5E1] font-mono">-</span>}
                            </div>
                          </div>
                          
                          {focusedInput?.exId === ex.id && focusedInput?.wi === wi && focusedInput?.si === si && (
                            <div className="flex gap-2 mt-1 pl-10 pr-14 animate-in fade-in slide-in-from-top-1 duration-200">
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  onProgressChange(ex.id, wi, si,"reps","Falta", activeVarId);
                                  onProgressChange(ex.id, wi, si,"peso","0", activeVarId);
                                  setFocusedInput(null);
                                }}
                                className="flex-1 bg-[#FEE2E2] text-[#EF4444] text-[10px] font-bold py-1.5 rounded-md hover:bg-[#FCA5A5] transition-colors"
                              >
                                Falté
                              </button>
                              {ultimoPeso && (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    onProgressChange(ex.id, wi, si,"peso", ultimoPeso.toString(), activeVarId);
                                    setFocusedInput(null);
                                  }}
                                  className="flex-1 bg-[#E0E7FF] text-[#4F46E5] text-[10px] font-bold py-1.5 rounded-md hover:bg-[#C7D2FE] transition-colors"
                                >
                                  Corporal ({ultimoPeso}kg)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const exGraphData = getExerciseGraphData(ex, activeObj, activeVarId);
                    if (!exGraphData || exGraphData.length === 0) return null;
                    const exNumSeries = parseInt(activeObj?.num_series || ex.num_series) || 4;
                    const seriesColors = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];
                    return (
                      <div className="mt-4 pt-4 border-t border-[#F0F4FA]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1929]">
                            <TrendingUp size={14} className="text-[var(--brand-primary)]" />
                            <span>Progresión de 1RM Estimado</span>
                          </div>
                          <span className="text-[10px] text-[#6B7A8D] font-mono">Por serie (kg)</span>
                        </div>
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] h-[160px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={exGraphData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                              <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} axisLine={false} tickLine={false} />
                              <Tooltip
                                contentStyle={{
                                  fontFamily: "JetBrains Mono",
                                  fontSize: 11,
                                  border: "1px solid #E2E8F0",
                                  borderRadius: 8,
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                                }}
                                formatter={(value, name) => [`${value} kg`, name]}
                              />
                              {Array.from({ length: exNumSeries }).map((_, s) => (
                                <Line
                                  key={s}
                                  type="monotone"
                                  dataKey={`serie_${s}`}
                                  stroke={seriesColors[s % seriesColors.length]}
                                  strokeWidth={2}
                                  dot={{ fill: seriesColors[s % seriesColors.length], r: 3 }}
                                  name={`Serie ${s + 1}`}
                                  connectNulls={false}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-end gap-1.5 mt-4 text-[11px] font-medium text-[#6B7A8D]">
                    {syncStatus ==="saving" && <RotateCcw size={14} className="animate-spin text-[var(--brand-primary)]" />}
                    {syncStatus ==="local" && <Check size={14} />}
                    {syncStatus ==="synced" && <CheckCheck size={14} className="text-[var(--brand-primary)]" />}
                    <span>
                      {syncStatus ==="saving" ?"Guardando..." : syncStatus ==="local" ?"Guardado localmente" :"Sincronizado"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botón para abrir Resumen y Recompensas del Entrenamiento */}
        {completedSetsDay > 0 && (
          <div className="pt-3">
            <button
              onClick={() => setShowResumen(true)}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              style={{
                background:
                  completionPct === 100
                    ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                    : "var(--brand-primary)",
              }}
            >
              <Trophy size={18} />
              <span>
                {completionPct === 100
                  ? "¡Entrenamiento Completado! Ver Resumen y Recompensas"
                  : "Ver Resumen de Sesión y Récords (PR)"}
              </span>
            </button>
          </div>
        )}

        {/* Espaciador inferior para navegación móvil */}
        <div className="h-28 md:h-0 shrink-0" aria-hidden="true" />
      </div>

      {/* Modal de Recompensa al Terminar de Entrenar */}
      {showResumen && (
        <div
          onClick={() => setShowResumen(false)}
          className="fixed inset-0 bg-[#0B1929]/55 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 md:p-7 border border-[#E2E8F0] shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setShowResumen(false)}
              className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Trophy size={32} />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-primary)] font-bold">
                Semana {semanaActualCiclo} • Resumen de Sesión
              </p>
              <h2 className="text-2xl font-bold text-[#0B1929] mt-1" style={{ fontFamily: "DM Sans" }}>
                {completionPct === 100 ? "¡Sesión Completada!" : "Avance de Entrenamiento"}
              </h2>
              <p className="text-xs text-[#6B7A8D] mt-1">
                Cada serie registrada suma puntos de experiencia (XP) a tu mapa muscular.
              </p>
            </div>

            {/* KPIs de la sesión */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 text-center">
                <p className="text-[10px] font-bold text-[#6B7A8D] uppercase">Series</p>
                <p className="text-lg font-bold text-[#0B1929] mt-0.5">
                  {completedSetsDay}/{totalSetsDay}
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 text-center">
                <p className="text-[10px] font-bold text-[#6B7A8D] uppercase">Volumen</p>
                <p className="text-lg font-bold text-[var(--brand-primary)] mt-0.5">
                  {Math.round(totalVolumeKg).toLocaleString("es-MX")}{" "}
                  <span className="text-[10px] text-[#6B7A8D]">kg</span>
                </p>
              </div>
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 text-center">
                <p className="text-[10px] font-bold text-amber-700 uppercase">Nuevos PR</p>
                <p className="text-lg font-bold text-amber-600 mt-0.5">{sessionPRs.length} 🏆</p>
              </div>
            </div>

            {/* Nuevos Récords Personales */}
            {sessionPRs.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-bold text-[#0B1929] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" /> Nuevos Récords Personales (1RM)
                </p>
                <div className="space-y-2">
                  {sessionPRs.map((pr) => (
                    <div
                      key={pr.id}
                      className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0B1929] truncate">{pr.nombre}</p>
                        <p className="text-[11px] text-[#6B7A8D] mt-0.5">
                          Mejor serie: <strong>{pr.bestWeight} kg × {pr.bestReps} reps</strong>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                          +{pr.gainPct.toFixed(1)}% 1RM
                        </span>
                        <p className="text-[10px] font-mono text-[#6B7A8D] mt-1">
                          {pr.bestHistorical1RM.toFixed(1)} →{" "}
                          <strong className="text-[#0B1929]">{pr.bestCurrent1RM.toFixed(1)} kg</strong>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recompensa XP por grupo muscular */}
            {Object.keys(musclesTrainedMap).length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-bold text-[#0B1929] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Flame size={14} className="text-[var(--brand-primary)]" /> XP Muscular Ganado Hoy
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(musclesTrainedMap).map(([grp, xp]) => (
                    <div
                      key={grp}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 flex items-center gap-2"
                    >
                      <span className="text-xs font-semibold text-[#0B1929] capitalize">
                        {grp.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600">
                        +{xp.baseXP + xp.bonusXP} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowResumen(false)}
              className="w-full py-3 rounded-xl bg-[#0B1929] text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    
      {/* Modal preview */}
      {previewEx && (
        <div 
          onClick={() => setPreviewEx(null)} 
          className="fixed inset-0 bg-[#0B1929]/40 backdrop-blur-sm z-[200] flex items-center justify-center p-5"
        >
          <div 
            className="animate-in bg-white rounded-2xl p-6 max-w-[440px] w-full text-center border border-[#E2E8F0] shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setPreviewEx(null)} className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20}/></button>
            {previewEx.gif_url ? (
              <img src={previewEx.gif_url} alt={previewEx.nombre} className="w-full rounded-xl mb-4 shadow-sm bg-[#F8FAFC] border border-[#E2E8F0] object-contain max-h-[300px] mix-blend-multiply" />
            ) : (
              <div className="w-full h-[200px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl mb-4 flex items-center justify-center shadow-sm">
                <Dumbbell size={48} className="text-[#CBD5E1]" />
              </div>
            )}
            <div className="font-bold text-[18px] text-[#0B1929] mb-2 font-['Space_Grotesk',sans-serif]">
              {previewEx.nombre}
            </div>
            <div className="flex gap-1.5 justify-center mb-4">
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600">
                {previewEx.grupo_muscular}
              </span>
            </div>
            <button
              onClick={() => setPreviewEx(null)}
              className="px-5 py-2 bg-[#F0F4FA] hover:bg-[#E2E8F0] text-[#0B1929] rounded-xl text-[13px] font-semibold transition-colors border border-[#E2E8F0]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
