const fs = require('fs');
let content = fs.readFileSync('src/components/ui/AppLayout.jsx', 'utf8');

if (!content.includes('useNavigate')) {
    content = content.replace(/import { Menu, X, ArrowLeft, LogOut, ChevronLeft, ChevronRight, User } from "lucide-react";/, 'import { Menu, X, ArrowLeft, LogOut, ChevronLeft, ChevronRight, User } from "lucide-react";\nimport { useNavigate } from "react-router-dom";');
    content = content.replace(/export default function AppLayout\([^)]*\)\s*\{/, '$&\n  const navigate = useNavigate();');
}

// Replace the two occurrences of tienda_link click handler
content = content.replace(/if \(id === "tienda_link"\) \{[\s\S]*?\} else \{/g, 'if (id === "tienda_link") {\n  navigate("/tienda");\n} else {');

fs.writeFileSync('src/components/ui/AppLayout.jsx', content, 'utf8');
