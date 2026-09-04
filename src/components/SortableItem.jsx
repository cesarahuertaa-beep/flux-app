import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export const DragHandle = ({ listeners, attributes }) => (
  <span
    {...listeners}
    {...attributes}
    title="Arrastra para reordenar"
    className="cursor-grab flex items-center justify-center p-1.5 rounded-md text-[#9BA5B0] hover:text-[var(--brand-primary)] hover:bg-[#F0F4FA] transition-colors shrink-0 touch-none select-none"
  >
    <GripVertical size={18} strokeWidth={1.5} />
  </span>
);

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
    opacity: isDragging ? 0.9 : 1,
    position: "relative",
  };

  const dragHandle = <DragHandle listeners={listeners} attributes={attributes} />;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={isDragging ? "shadow-2xl ring-2 ring-[var(--brand-primary)] ring-opacity-50 rounded-xl" : ""}
    >
      {children({ dragHandle, isDragging })}
    </div>
  );
};
