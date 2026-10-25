import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  className = "",
  containerClassName = "",
  dropdownClassName = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);

  // Detect available space to open upward or downward
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If there's less than 230px below and more room above, flip upward
      setOpenUpward(spaceBelow < 230 && spaceAbove > spaceBelow);
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "object" && opt !== null
      ? { label: opt.label ?? opt.value, value: opt.value }
      : { label: String(opt), value: opt }
  );

  const selectedOpt = normalizedOptions.find((o) => o.value === value);
  const displayLabel = selectedOpt ? selectedOpt.label : (value || placeholder);

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-[13px] outline-none hover:border-[var(--brand-primary)] focus:border-[var(--brand-primary)] transition-all font-['Inter',sans-serif] ${className}`}
      >
        <span className="truncate text-left font-medium">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#6B7A8D] shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-[250] left-0 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-2xl py-1 max-h-56 overflow-y-auto scroll-hide overscroll-contain animate-in fade-in zoom-in-95 duration-100 ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${dropdownClassName}`}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center justify-between transition-colors ${
                  isSelected
                    ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold"
                    : "text-[#0B1929] hover:bg-gray-50"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
