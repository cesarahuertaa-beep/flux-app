import fs from 'fs';
let content = fs.readFileSync('src/components/ui/AppLayout.jsx', 'utf8');

// 1. Add hooks
content = content.replace(
  'import React, { useState } from "react";',
  'import React, { useState, useRef, useEffect } from "react";'
);

// 2. Add state and handlers
const stateCode = `  const [collapsed, setCollapsed] = useState(false);
  const brand = useBrand();

  const navRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [nav]);`;

content = content.replace(
  '  const [collapsed, setCollapsed] = useState(false);\r?\n  const brand = useBrand();',
  stateCode
);

// 3. Replace nav JSX
const oldNavRegex = /<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-\[\#E2E8F0\] flex items-stretch overflow-x-auto scroll-hide shadow-\[0_-2px_10px_rgba\(0,0,0,0\.02\)\]"[\s\S]*?style=\{\{ paddingBottom: "env\(safe-area-inset-bottom\)" \}\}>\r?\n(.*?)(\{nav\.map)/m;

const newNavCode = `<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E2E8F0] shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* Left Indicator */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none transition-opacity duration-300 z-10" 
          style={{ 
            background: "linear-gradient(to right, var(--brand-primary), transparent)", 
            opacity: canScrollLeft ? 0.15 : 0 
          }} 
        />
        
        {/* Right Indicator */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none transition-opacity duration-300 z-10" 
          style={{ 
            background: "linear-gradient(to left, var(--brand-primary), transparent)", 
            opacity: canScrollRight ? 0.15 : 0 
          }} 
        />

        <nav 
          ref={navRef}
          onScroll={checkScroll}
          className="flex items-stretch overflow-x-auto scroll-hide w-full relative z-20"
        >
        $2`;

content = content.replace(oldNavRegex, newNavCode);

// 4. Update the closing tag of the nav wrapper
const oldNavClosingRegex = /<\/nav>\r?\n\r?\n\s*<\/div>/;
content = content.replace(oldNavClosingRegex, '</nav>\n      </div>\n\n    </div>');

fs.writeFileSync('src/components/ui/AppLayout.jsx', content);
