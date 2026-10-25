import { useState, useEffect, useRef } from "react";
import { Square, X } from "lucide-react";
import { timerStore } from "../../lib/timerStore";

export default function FloatingTimerBubble() {
  const [timerState, setTimerState] = useState(() => timerStore.getState());
  const [pos, setPos] = useState({ x: 16, y: 92 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 16, origY: 92, moved: false });

  useEffect(() => {
    return timerStore.subscribe(setTimerState);
  }, []);

  const { status, seconds, inTrainingView, brandColor } = timerState;

  // Only show the in-app floating pill when timer is active (RUNNING or ALARMING)
  // AND the user is NOT currently looking at the Training tab
  if (inTrainingView || (status !== "RUNNING" && status !== "ALARMING")) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const mins = pad(Math.floor(seconds / 60));
  const secs = pad(seconds % 60);
  const isAlarm = status === "ALARMING";

  const onPointerDown = (e) => {
    if (e.target.closest("button[data-stop-btn]")) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const maxW = typeof window !== "undefined" ? window.innerWidth - 150 : 220;
    const maxH = typeof window !== "undefined" ? window.innerHeight - 80 : 600;
    setPos({
      x: Math.max(8, Math.min(maxW, dragRef.current.origX + dx)),
      y: Math.max(12, Math.min(maxH, dragRef.current.origY + dy)),
    });
  };

  const onPointerUp = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    // Snap to nearest horizontal screen edge like DiDi bubble
    if (typeof window !== "undefined") {
      const mid = window.innerWidth / 2;
      const snapX = pos.x + 70 < mid ? 12 : Math.max(12, window.innerWidth - 156);
      setPos((p) => ({ ...p, x: snapX }));
    }
  };

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: "none",
      }}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      className={`fixed z-[9999] select-none cursor-grab active:cursor-grabbing flex items-center gap-2.5 px-3.5 py-2 rounded-full shadow-2xl border transition-colors ${
        isAlarm
          ? "bg-red-600 border-red-400 text-white animate-pulse"
          : "bg-[#0B1929]/95 border-white/15 text-white backdrop-blur-md"
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 animate-ping"
        style={{ background: isAlarm ? "#ffffff" : brandColor || "var(--brand-primary)" }}
      />
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-75">
          {isAlarm ? "¡TIEMPO!" : "Descanso"}
        </span>
        <span className="text-sm font-mono font-extrabold tracking-tight mt-0.5">
          {mins}:{secs}
        </span>
      </div>
      <button
        data-stop-btn="true"
        onClick={(e) => {
          e.stopPropagation();
          timerStore.stopAndReset();
        }}
        className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors ml-0.5"
        title="Detener cronómetro"
      >
        {isAlarm ? <X size={13} /> : <Square size={10} className="fill-current" />}
      </button>
    </div>
  );
}
