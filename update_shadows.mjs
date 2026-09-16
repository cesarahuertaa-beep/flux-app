import fs from 'fs';

let content = fs.readFileSync('src/components/ui/AppLayout.jsx', 'utf8');

// Update Left Indicator
content = content.replace(
  /className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none transition-opacity duration-300 z-10"\s*style=\{\{\s*background: "linear-gradient\(to right, var\(--brand-primary\), transparent\)",\s*opacity: canScrollLeft \? 0\.15 : 0\s*\}\}/,
  `className="absolute left-0 top-0 bottom-0 w-10 pointer-events-none transition-opacity duration-300 z-10" 
          style={{ 
            background: "linear-gradient(to right, var(--brand-primary), transparent)", 
            opacity: canScrollLeft ? 0.35 : 0 
          }}`
);

// Update Right Indicator
content = content.replace(
  /className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none transition-opacity duration-300 z-10"\s*style=\{\{\s*background: "linear-gradient\(to left, var\(--brand-primary\), transparent\)",\s*opacity: canScrollRight \? 0\.15 : 0\s*\}\}/,
  `className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none transition-opacity duration-300 z-10" 
          style={{ 
            background: "linear-gradient(to left, var(--brand-primary), transparent)", 
            opacity: canScrollRight ? 0.35 : 0 
          }}`
);

fs.writeFileSync('src/components/ui/AppLayout.jsx', content);
console.log("Updated opacities and widths in AppLayout.jsx");
