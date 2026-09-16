import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// 1. In `submit` (login), if no clientData and no profiles, auto-create the Civil profile!
const loginRegex = /if \(clientData\.length > 0\) \{\s*availableRoles\.push\(\{ role: 'cliente', data: clientData\[0\] \}\);\s*\}/;

const loginInjection = `if (clientData.length > 0) {
          availableRoles.push({ role: 'cliente', data: clientData[0] });
        } else if (profiles.length === 0) {
          // Si confirmaron correo pero aún no tienen perfil en clientes (por seguridad RLS en el registro)
          // Lo creamos ahora que ya tienen su Token oficial de sesión.
          const nombreMeta = data.user?.user_metadata?.nombre || email.trim().split("@")[0];
          const newClient = await dbPost("clientes", {
             nombre: nombreMeta,
             email: email.trim(),
             auth_id: data.user.id,
             activo: true,
             nutriologo_id: null
          });
          
          if (newClient && newClient.length > 0) {
             availableRoles.push({ role: 'cliente', data: newClient[0] });
          } else {
             // Fallback si dbPost no devuelve el objeto
             const checkAgain = await dbGet(\`clientes?email=eq.\${email.trim()}&activo=eq.true\`);
             if (checkAgain.length > 0) {
                 availableRoles.push({ role: 'cliente', data: checkAgain[0] });
             }
          }
        }`;

content = content.replace(loginRegex, loginInjection);

// 2. In `signUpSubmit`, make the dbPost optional. If it fails due to RLS (Email Confirmations ON), we just ignore it!
const signupRegex = /await dbPost\("clientes", \{\s*nombre: nombre\.trim\(\),\s*email: email\.trim\(\),\s*auth_id: userId,\s*activo: true,\s*nutriologo_id: null\s*\}\);\s*await submit\(\);/g;

const signupInjection = `try {
          await dbPost("clientes", { 
            nombre: nombre.trim(), 
            email: email.trim(), 
            auth_id: userId, 
            activo: true, 
            nutriologo_id: null 
          });
          await submit(); // Intenta iniciar sesión si no hay confirmación de email
        } catch (postErr) {
          // Si la BD rebota el insert (por ejemplo, si "Confirmar Email" está activado en Supabase 
          // y el usuario aún no tiene Token), no es un error crítico. 
          // El perfil se creará cuando inicien sesión por primera vez.
          console.log("Perfil no insertado aún (posible Confirmación de Email pendiente):", postErr.message);
          setInfo("¡Cuenta creada! Por favor revisa tu bandeja de correo para confirmar tu email e iniciar sesión.");
          setMode("login");
        }`;

content = content.replace(signupRegex, signupInjection);

fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx adapted for Email Confirmations.");
