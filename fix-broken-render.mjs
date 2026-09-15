import fs from 'fs';
let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// The broken block:
/*
      <div className={tab === "aprobaciones" && (isSuperadmin || role === "staff") && (
          <SubComponentWrapper title="Aprobaciones"><Aprobaciones setMsg={setMsg} /></SubComponentWrapper>
        )}
        {tab === "membresia" ? "block" : "hidden"}>
        <SubComponentWrapper title="Mi Membresía"><MiMembresia clientes={clientes} profileId={myId} setMsg={setMsg} /></SubComponentWrapper>
      </div>
*/

// I will use regex to find this entire messy block and replace it cleanly.
const regex = /<div className=\{tab === "aprobaciones"[\s\S]*?MiMembresia[\s\S]*?<\/div>/;

const cleanBlock = `
      <div className={tab === "aprobaciones" && (isSuperadmin || role === "staff") ? "block" : "hidden"}>
        <SubComponentWrapper title="Aprobaciones"><Aprobaciones setMsg={setMsg} /></SubComponentWrapper>
      </div>

      <div className={tab === "membresia" ? "block" : "hidden"}>
        <SubComponentWrapper title="Mi Membresía"><MiMembresia clientes={clientes} profileId={myId} setMsg={setMsg} /></SubComponentWrapper>
      </div>`;

content = content.replace(regex, cleanBlock.trim());

fs.writeFileSync('src/pages/Admin.jsx', content);
