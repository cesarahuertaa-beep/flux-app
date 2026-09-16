import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

const regex = /const userId = data\?\.user\?\.id \|\| data\?\.id;\s*if \(!userId\) \{\s*throw new Error\("No se pudo crear el usuario en Auth\. " \+ JSON\.stringify\(data\)\);\s*\}/;

const injection = `const userId = data?.user?.id || data?.id;
        
        if (!data.session) {
          setErr("DEPURACIÓN: La sesión es NULA. Confirmación de email está encendida en Supabase.");
          setLoading(false);
          return;
        }

        if (!userId) {
          throw new Error("No se pudo crear el usuario en Auth. " + JSON.stringify(data));
        }`;

content = content.replace(regex, injection);
fs.writeFileSync('src/pages/Login.jsx', content);
console.log("Login.jsx debug injected.");
