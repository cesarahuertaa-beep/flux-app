import { AlertTriangle, Trash2, X } from "lucide-react";
import { useBackButton, registerBackAction } from "../../lib/backButtonHandler";

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "¿Estás seguro?",
  description = "Esta acción no se puede deshacer.",
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  danger = true,
  loading = false,
  icon = "trash",
  hideCancel = false,
}) {
  useBackButton(isOpen, () => {
    if (!loading && onClose) onClose();
  }, 60);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E2E8F0] p-6 text-center animate-in zoom-in-95 duration-150 relative"
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3.5 ${
            danger ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
          }`}
        >
          {icon === "trash" ? (
            <Trash2 className="w-6 h-6" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>

        <h3 className="text-base font-bold text-[#0B1929] mb-1.5 px-2">
          {title}
        </h3>

        {description && (
          <p className="text-xs text-[#6B7A8D] mb-5 leading-relaxed px-1 break-words">
            {description}
          </p>
        )}

        <div className="flex gap-2.5">
          {!hideCancel && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#E2E8F0] text-[#6B7A8D] font-semibold text-xs hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (onConfirm) await onConfirm();
              else if (onClose) onClose();
            }}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 text-white ${
              danger
                ? "bg-red-500 hover:bg-red-600 disabled:bg-red-300"
                : "bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-50"
            }`}
          >
            {loading ? "Procesando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Muestra un modal de aviso con el diseño propio de FLUX (en vez del alert() nativo de Android/navegador)
 */
export function showFluxAlert(title, description = "") {
  if (typeof document === "undefined") return;

  const existing = document.getElementById("flux-custom-alert-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "flux-custom-alert-modal";
  overlay.className =
    "fixed inset-0 z-[250] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150";

  const card = document.createElement("div");
  card.className =
    "bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E2E8F0] p-6 text-center animate-in zoom-in-95 duration-150 relative font-['Inter',sans-serif]";
  card.addEventListener("click", (e) => e.stopPropagation());

  const iconWrap = document.createElement("div");
  iconWrap.className =
    "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3.5 bg-amber-50 text-amber-500";
  iconWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

  const h3 = document.createElement("h3");
  h3.className = "text-base font-bold text-[#0B1929] mb-1.5 px-2";
  h3.textContent = title || "Aviso";

  const p = document.createElement("p");
  p.className = "text-xs text-[#6B7A8D] mb-5 leading-relaxed px-1 break-words";
  p.textContent = description || "";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 text-white bg-[var(--brand-primary)] hover:opacity-90 cursor-pointer";
  btn.textContent = "Entendido";

  let unregisterBack = null;
  const close = () => {
    if (unregisterBack) {
      const fn = unregisterBack;
      unregisterBack = null;
      fn();
    }
    overlay.remove();
  };

  unregisterBack = registerBackAction(close, 85);
  btn.addEventListener("click", close);
  overlay.addEventListener("click", close);

  card.appendChild(iconWrap);
  card.appendChild(h3);
  if (description) card.appendChild(p);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export default ConfirmModal;
