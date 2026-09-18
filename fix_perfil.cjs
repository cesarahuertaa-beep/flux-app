const fs = require('fs');
let content = fs.readFileSync('src/components/admin/PerfilNutriologo.jsx', 'utf8');

if (!content.includes('useNavigate')) {
    content = content.replace(/import { useState, useEffect, useCallback } from "react";/, 'import { useState, useEffect, useCallback } from "react";\nimport { useNavigate } from "react-router-dom";');
    content = content.replace(/export default function PerfilNutriologo\([^)]*\)\s*\{/, '$&\n  const navigate = useNavigate();');
}
content = content.replace(/const handleStore = \(\) => window\.open\([^)]*\);/, 'const handleStore = () => navigate("/tienda");');

fs.writeFileSync('src/components/admin/PerfilNutriologo.jsx', content, 'utf8');
