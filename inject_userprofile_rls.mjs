import fs from 'fs';
let content = fs.readFileSync('src/components/UserProfile.jsx', 'utf8');

const oldCode = `        if (isCliente) {
          await dbPatch(\`clientes?id=eq.\${user.id}\`, { nombre, objetivo, telefono });
        } else {
          await dbPatch(\`profiles?id=eq.\${user.id}\`, { nombre });
        }`;

const newCode = `        let res;
        if (isCliente) {
          res = await dbPatch(\`clientes?id=eq.\${user.id}\`, { nombre, objetivo, telefono });
        } else {
          res = await dbPatch(\`profiles?id=eq.\${user.id}\`, { nombre });
        }
        
        if (Array.isArray(res) && res.length === 0) {
          throw new Error("No se pudo guardar en la base de datos (Posible bloqueo de RLS en Supabase).");
        }`;

content = content.replace(oldCode, newCode);

fs.writeFileSync('src/components/UserProfile.jsx', content);
