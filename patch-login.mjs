import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

const filterLogic = `
      let multiRoles = availableRoles.map(r => ({ role: r.role, data: r.data }));
      const hasPro = multiRoles.some(r => ["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(r.role));
      if (hasPro) {
        multiRoles = multiRoles.filter(r => r.role !== 'cliente');
      }

      if (multiRoles.length === 0) {
        setAuthToken(null); setProfileId(null);
        setErr("No se encontró tu cuenta activa.");
        setLoading(false); return;
      }

      const sorted = multiRoles.sort((a, b) => a.role === 'cliente' ? 1 : -1);

      if (sorted.length === 1) {
        onLogin({ role: sorted[0].role, data: sorted[0].data, token: data.access_token, profileId: data.user.id });
      } else {
        onLogin({ 
          role: sorted[0].role, 
          data: sorted[0].data, 
          token: data.access_token, 
          profileId: data.user.id,
          multiRoles: sorted 
        });
      }
`;

content = content.replace(
  /if \(availableRoles\.length === 1\) \{[\s\S]*?\}\s*\} catch\(e\) \{/g,
  filterLogic + '} catch(e) {'
);

fs.writeFileSync('src/pages/Login.jsx', content);
