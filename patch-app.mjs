import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add nutriologo_estudiante to the whitelist in restore()
content = content.replace(
  '["superadmin", "nutriologo", "administrativo", "staff"].includes(role)',
  '["superadmin", "nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(role)'
);
content = content.replace(
  '["nutriologo", "administrativo", "staff"].includes(role)',
  '["nutriologo", "nutriologo_estudiante", "administrativo", "staff"].includes(role)'
);

// 2. Remove the kick-out logic for orphaned civiles in MainApp
const kickOutRegex = /if \(session\.role === "cliente" && !session\.data\?\.nutriologo_id && !atletaData\) \{[\s\S]*?return <Navigate to=\{isAppMode \? "\/login" : "\/"\} replace \/>;\s*\}/;
content = content.replace(kickOutRegex, '');

// 3. Map nutriologo_estudiante to the Admin layout
content = content.replace(
  'if (session.role==="superadmin" || session.role==="nutriologo" || session.role==="administrativo" || session.role==="staff")',
  'if (session.role==="superadmin" || session.role==="nutriologo" || session.role==="nutriologo_estudiante" || session.role==="administrativo" || session.role==="staff")'
);

fs.writeFileSync('src/App.jsx', content);
