import fs from 'fs';

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const { from, to } of replacements) {
        if (typeof from === 'string') {
            content = content.split(from).join(to);
        } else {
            content = content.replace(from, to);
        }
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated \${filePath}`);
    }
}

// 1. App.jsx
replaceInFile('src/App.jsx', [
    { from: 's.role === "client"', to: 's.role === "cliente"' },
    { from: 'savedRole === "client"', to: 'savedRole === "cliente"' },
    { from: 'role: "client"', to: 'role: "cliente"' },
    { from: 'role: role === "admin" ? "admin" : role', to: 'role' },
    { from: '["admin", "superadmin", "nutriologo", "administrativo", "staff"]', to: '["superadmin", "nutriologo", "administrativo", "staff"]' },
    { from: 'session.role === "client"', to: 'session.role === "cliente"' },
    { from: 'session.role==="admin" || session.role==="superadmin"', to: 'session.role==="superadmin"' }
]);

// 2. Login.jsx
replaceInFile('src/pages/Login.jsx', [
    { from: '["admin", "superadmin", "nutriologo", "administrativo", "staff"]', to: '["superadmin", "nutriologo", "administrativo", "staff"]' },
    { from: 'role: adminRole === "admin" ? "admin" : adminRole', to: 'role: adminRole' },
    { from: 'role: "client"', to: 'role: "cliente"' },
    { from: "a.role === 'client'", to: "a.role === 'cliente'" }
]);

// 3. UserProfile.jsx
replaceInFile('src/components/UserProfile.jsx', [
    { from: 'session?.role === "client"', to: 'session?.role === "cliente"' },
    { from: '(session.role === "admin" ? "admin" : session.role) === (r.role === "admin" ? "admin" : r.role)', to: 'session.role === r.role' },
    { from: 'r.role === "client"', to: 'r.role === "cliente"' }
]);

// 4. Admin.jsx
replaceInFile('src/pages/Admin.jsx', [
    // Remove admin completely if there's any stray checks (usually it's superadmin or admin)
]);

// 5. PerfilNutriologo.jsx
replaceInFile('src/components/admin/PerfilNutriologo.jsx', [
    { from: "(role === 'admin' ? 'admin' : role) === (r.role === 'admin' ? 'admin' : r.role)", to: "role === r.role" },
    { from: '(role === "admin" ? "admin" : role) === (r.role === "admin" ? "admin" : r.role)', to: "role === r.role" },
    { from: "r.role !== 'client'", to: "r.role !== 'cliente'" },
    { from: 'r.role === "client"', to: 'r.role === "cliente"' }
]);

// 6. BrandContext.jsx
replaceInFile('src/components/BrandContext.jsx', [
    { from: 'session.role === "superadmin" || session.role === "admin"', to: 'session.role === "superadmin"' },
    { from: 'session.role === "client"', to: 'session.role === "cliente"' }
]);

// 7. AppLayout.jsx
replaceInFile('src/components/ui/AppLayout.jsx', [
    { from: 'session?.role === "client"', to: 'session?.role === "cliente"' }
]);

// 8. index.jsx (UI)
replaceInFile('src/components/ui/index.jsx', [
    { from: '{role==="admin"&&<div style={{ fontSize:11,fontWeight:700,letterSpacing:"1px",padding:"4px 12px",borderRadius:20,background:"rgba(46,92,184,0.12)",border:"1px solid rgba(46,92,184,0.25)",color:"var(--brand-accent,#2e5cb8)",fontFamily:"\'Inter\',sans-serif" }}>⚡ ADMIN</div>}', to: '' },
    { from: '{role === "admin" && <div style={{ fontSize: 10, color: "var(--brand-accent,#2e5cb8)", fontWeight: 700, letterSpacing: "0.5px" }}>⚡ ADMIN</div>}', to: '' }
]);

// 9. Landing.jsx
replaceInFile('src/pages/Landing.jsx', [
    { from: "session.role !== 'client'", to: "session.role !== 'cliente'" }
]);

// 10. DirectorioSuperadmin.jsx
replaceInFile('src/components/admin/DirectorioSuperadmin.jsx', [
    { from: 'setConflictType("client")', to: 'setConflictType("cliente")' },
    { from: 'conflictType === "client"', to: 'conflictType === "cliente"' }
]);
