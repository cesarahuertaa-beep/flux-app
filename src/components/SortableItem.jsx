/**
 * SortableItem.jsx
 * Componente reutilizable de drag-and-drop para @dnd-kit.
 * Envuelve cualquier fila/card con el ícono de 6 puntos como asa de movimiento.
 * Compatible con mouse y touch (móvil).
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Ícono de 6 puntos — asa visual de arrastre */
export const DragHandle = ({ listeners, attributes }) => (
  <span
    {...listeners}
    {...attributes}
    title="Arrastra para reordenar"
    style={{
      cursor: "grab",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "4px 6px",
      borderRadius: 6,
      color: "rgba(100,116,139,0.6)",
      fontSize: 16,
      lineHeight: 1,
      flexShrink: 0,
      transition: "color 0.15s",
      touchAction: "none",
      userSelect: "none",
      WebkitUserSelect: "none",
    }}
    onMouseEnter={e => (e.currentTarget.style.color = "var(--brand-accent,#2e5cb8)")}
    onMouseLeave={e => (e.currentTarget.style.color = "rgba(100,116,139,0.6)")}
  >
    ⠿
  </span>
);

/**
 * SortableItem — envuelve un ítem con lógica de sorting.
 * @param {string|number} id  — id único del ítem
 * @param {function} children — render function: ({ dragHandle, isDragging }) => JSX
 */
export const SortableItem = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.85 : 1,
    boxShadow: isDragging
      ? "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(46,92,184,0.3)"
      : "none",
    position: "relative",
  };

  const dragHandle = <DragHandle listeners={listeners} attributes={attributes} />;

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandle, isDragging })}
    </div>
  );
};
