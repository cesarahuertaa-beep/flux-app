import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

const regex = /if \(availableRoles\.length === 0\) \{\s*setAuthToken\(null\); setProfileId\(null\);\s*setErr\("No se encontr. tu cuenta activa\."\);\s*setLoading\(false\); return;\s*\}/;

const injection = `if (availableRoles.length === 0) {
        if (profiles.length === 0) {
          try {
            // Usuario verificó su email pero no tiene tabla clientes (Civil nuevo)
            const nombreMeta = data.user?.user_metadata?.nombre || email.trim().split("@")[0];
            const newClient = await dbPost("clientes", {
               nombre: nombreMeta,
               email: email.trim(),
               auth_id: data.user.id,
               activo: true,
               nutriologo_id: null
            });
            
            // Re-evaluar si se insertó bien
            const checkAgain = await dbGet(\`clientes?auth_id=eq.\${data.user.id}&activo=eq.true\`);
            if (checkAgain.length > 0) {
                availableRoles.push({ role: 'cliente', data: checkAgain[0] });
            } else {
                setAuthToken(null); setProfileId(null);
                setErr("No se pudo crear tu perfil de cliente. Contacta soporte.");
                setLoading(false); return;
            }
          } catch (postErr) {
            setAuthToken(null); setProfileId(null);
            setErr("Error creando perfil: " + postErr.message);
            setLoading(false); return;
          }
        } else {
          setAuthToken(null); setProfileId(null);
          setErr("No se encontro tu cuenta activa.");
          setLoading(false); return;
        }
      }`;

content = content.replace(regex, injection);
fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx fixed with encoding workaround.");
