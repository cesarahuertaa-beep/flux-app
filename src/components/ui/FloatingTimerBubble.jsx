import { useState, useEffect, useRef } from "react";
import { Square, X, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { timerStore } from "../../lib/timerStore";

export default function FloatingTimerBubble() {
  const [timerState, setTimerState] = useState(() => timerStore.getState());
  const [pos, setPos] = useState({ x: 12, y: 110 });
  const [isDocked, setIsDocked] = useState(false);
  const [dockSide, setDockSide] = useState("left"); // "left" | "right"

  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    origX: 12,
    origY: 110,
    moved: false,
  });
  const autoDockTimerRef = useRef(null);

  useEffect(() => {
    return timerStore.subscribe(setTimerState);
  }, []);

  const { status, seconds, inTrainingView, brandColor } = timerState;
  const isAlarm = status === "ALARMING";

  // Auto-expand if the alarm triggers while docked
  useEffect(() => {
    if (isAlarm && isDocked) {
      setIsDocked(false);
      clearTimeout(autoDockTimerRef.current);
    }
  }, [isAlarm, isDocked]);

  // Schedule auto-dock after 4.5s of inactivity when snapped at edge
  const scheduleAutoDock = (side) => {
    clearTimeout(autoDockTimerRef.current);
    autoDockTimerRef.current = setTimeout(() => {
      setDockSide(side);
      setIsDocked(true);
    }, 4500);
  };

  useEffect(() => {
    return () => clearTimeout(autoDockTimerRef.current);
  }, []);

  // Only show the in-app floating pill when timer is active (RUNNING or ALARMING)
  // AND the user is NOT currently looking at the Training tab
  if (inTrainingView || (status !== "RUNNING" && status !== "ALARMING")) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const mins = pad(Math.floor(seconds / 60));
  const secs = pad(seconds % 60);

  const onPointerDown = (e) => {
    if (e.target.closest("button")) return;
    clearTimeout(autoDockTimerRef.current);

    // If currently docked, tapping expands it without dragging
    if (isDocked) {
      setIsDocked(false);
      scheduleAutoDock(dockSide);
      return;
    }

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
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
    }
    const maxW = typeof window !== "undefined" ? window.innerWidth - 180 : 200;
    const maxH = typeof window !== "undefined" ? window.innerHeight - 80 : 600;
    setPos({
      x: Math.max(6, Math.min(maxW, dragRef.current.origX + dx)),
      y: Math.max(12, Math.min(maxH, dragRef.current.origY + dy)),
    });
  };

  const onPointerUp = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;

    if (typeof window !== "undefined") {
      const screenW = window.innerWidth;
      const mid = screenW / 2;
      const isLeft = pos.x + 90 < mid;
      const targetSide = isLeft ? "left" : "right";
      const snapX = isLeft ? 12 : Math.max(12, screenW - 196);

      // If dragged aggressively into the margin, dock immediately
      if (pos.x <= 16 || pos.x >= screenW - 200) {
        setPos((p) => ({ ...p, x: snapX }));
        setDockSide(targetSide);
        setIsDocked(true);
      } else {
        setPos((p) => ({ ...p, x: snapX }));
        setDockSide(targetSide);
        scheduleAutoDock(targetSide);
      }
    }
  };

  const handlePillClick = (e) => {
    if (dragRef.current.moved) return;
    if (isDocked) {
      setIsDocked(false);
      scheduleAutoDock(dockSide);
      return;
    }
    // Navigate directly back to the workout view
    window.dispatchEvent(new CustomEvent("flux:navigate-tab", { detail: { tab: "deporte" } }));
  };

  const activeColor = brandColor || "var(--brand-primary, #00B4D8)";

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: "none",
        transform: isDocked
          ? dockSide === "left"
            ? "translateX(-66%)"
            : "translateX(66%)"
          : "translateX(0)",
      }}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onClick={handlePillClick}
      className={`fixed z-[9999] select-none cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl border transition-all duration-300 ease-out backdrop-blur-md ${
        isAlarm
          ? "bg-red-600 border-red-400 text-white animate-pulse"
          : "bg-[#0B1929]/95 border-[rgba(0,180,216,0.3)] text-white hover:border-[rgba(0,180,216,0.6)]"
      }`}
    >
      {/* Side dock indicator arrow when docked */}
      {isDocked && dockSide === "left" && (
        <ChevronRight size={14} className="text-white/80 animate-pulse ml-auto" />
      )}

      {/* Brand pulsing status dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 relative flex items-center justify-center"
      >
        <span
          className="w-full h-full rounded-full animate-ping opacity-75 absolute"
          style={{ background: isAlarm ? "#ffffff" : activeColor }}
        />
        <span
          className="w-2 h-2 rounded-full relative"
          style={{ background: isAlarm ? "#ffffff" : activeColor }}
        />
      </span>

      {/* Stacked label & countdown */}
      <div className="flex flex-col leading-none min-w-[54px]">
        <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#94A3B8]">
          {isAlarm ? "¡TIEMPO!" : "Descanso"}
        </span>
        <span className="text-sm font-mono font-black tracking-tight text-white mt-0.5">
          {mins}:{secs}
        </span>
      </div>

      {/* Quick action +30s chip (hidden when alarm is ringing or when docked) */}
      {!isAlarm && !isDocked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            timerStore.addSeconds(30);
          }}
          className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-[10.5px] font-bold text-[var(--brand-primary,#00B4D8)] border border-white/10 transition-transform flex items-center gap-0.5 cursor-pointer"
          title="Agregar 30 segundos"
        >
          <Plus size={10} strokeWidth={3} />
          <span>30s</span>
        </button>
      )}

      {/* Stop / Close button */}
      {!isDocked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            timerStore.stopAndReset();
          }}
          className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center transition-all ml-0.5 cursor-pointer"
          title="Detener cronómetro"
        >
          {isAlarm ? <X size={13} /> : <Square size={9} className="fill-current" />}
        </button>
      )}

      {/* Side dock indicator arrow when docked right */}
      {isDocked && dockSide === "right" && (
        <ChevronLeft size={14} className="text-white/80 animate-pulse mr-auto" />
      )}
    </div>
  );
}
