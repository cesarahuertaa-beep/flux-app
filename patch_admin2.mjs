import fs from 'fs';

let lines = fs.readFileSync('src/pages/Admin.jsx', 'utf8').split(/\\r?\\n/);

// 1. Remove action from mi_plan wrapper
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('{/* ════════════ CIVIL PREMIUM TABS ════════════ */}')) {
    // Next few lines are mi_plan wrapper
    // We want to delete action={...}
    let foundAction = false;
    for (let j=i; j<i+20; j++) {
      if (lines[j].includes('action={')) {
        foundAction = true;
        // delete until }
        let k = j;
        while (!lines[k].includes('>')) {
          lines[k] = '';
          k++;
        }
        lines[k-1] = ''; // remove the } from action={}
        break;
      }
    }
    if (foundAction) break;
  }
}

// 2. Insert execution views after mi_plan wrapper closes
// Wait, the easiest is to just append them before the final closing tag of Admin.jsx component
let endIdx = lines.length - 1;
while (!lines[endIdx].includes('</AppLayout>')) {
  endIdx--;
}

const executionViews = `
      {isCivil && (tab === "nutricion" || tab === "entrenamiento" || tab === "progreso_atleta") && clienteData && (
        <ClienteView 
          session={{ role:"cliente", data:clienteData, token:session?.token, profileId: session?.profileId, adminRole: session?.role }}
          isAtletaMode={false}
          isEmbedded={true}
          embeddedTab={tab === "entrenamiento" ? "deporte" : tab === "progreso_atleta" ? "progreso" : "nutricion"}
          onLogout={onLogout}
        />
      )}`;

lines.splice(endIdx, 0, executionViews);

fs.writeFileSync('src/pages/Admin.jsx', lines.filter(l => l !== '').join('\n'));
console.log('Patched Admin.jsx safely');
