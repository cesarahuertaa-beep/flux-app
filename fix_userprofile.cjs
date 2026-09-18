const fs = require('fs');
let content = fs.readFileSync('src/components/UserProfile.jsx', 'utf8');

if (!content.includes('useNavigate')) {
    content = content.replace(/import { useState, useEffect } from "react";/, 'import { useState, useEffect } from "react";\nimport { useNavigate } from "react-router-dom";');
    content = content.replace(/export default function UserProfile\([^)]*\)\s*\{/, '$&\n  const navigate = useNavigate();');
}
content = content.replace(/const handleStore = \(\) => \{[\s\S]*?\};/, 'const handleStore = () => navigate("/tienda");');

fs.writeFileSync('src/components/UserProfile.jsx', content, 'utf8');
