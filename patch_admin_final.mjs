import fs from 'fs';

let lines = fs.readFileSync('src/pages/Admin.jsx', 'utf8').split(/\\r?\\n/);

// 1. Add lucide imports
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('from "lucide-react"')) {
    lines[i] = lines[i].replace('from "lucide-react"', ', UtensilsCrossed, Camera} from "lucide-react"');
    break;
  }
}

// 2. Add ClienteView import
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('import { AgendaAdmin } from "../components/admin/AgendaAdmin";')) {
    lines.splice(i+1, 0, 'import ClienteView from "./Cliente";');
    break;
  }
}

// 3. Update SIDEBAR_ITEMS
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('const SIDEBAR_ITEMS = isCivil ? [')) {
    // Delete until we hit ]
    let j = i + 1;
    while (!lines[j].includes(']')) {
      lines[j] = '';
      j++;
    }
    // Insert new items
    lines.splice(i+1, 0, 
      '    { id: "mi_plan",         label: "Mi Plan",       icon: <Activity size={18} strokeWidth={1.5} /> },',
      '    { id: "nutricion",       label: "Nutrición",     icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },',
      '    { id: "entrenamiento",   label: "Entrenamiento", icon: <Dumbbell size={18} strokeWidth={1.5} /> },',
      '    { id: "progreso_atleta", label: "Progreso",      icon: <Camera size={18} strokeWidth={1.5} /> },',
      '    { id: "membresia",       label: "Membresía",     icon: <CreditCard size={18} strokeWidth={1.5} /> },'
    );
    break;
  }
}

// 4. Remove action={...} from mi_plan
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('{/* ════════════ CIVIL PREMIUM TABS ════════════ */}')) {
    // Look for `action={` in the next few lines
    for (let j=i; j<i+15; j++) {
      if (lines[j] && lines[j].includes('action={')) {
        let k = j;
        while (!lines[k].includes(') : null')) {
          lines[k] = '';
          k++;
        }
        lines[k] = ''; // remove `) : null` line
        // remove the closing `}` line for action
        lines[k+1] = '';
        break;
      }
    }
    break;
  }
}

// 5. Add execution views at the end, right before `</AppLayout>`
for (let i=lines.length-1; i>=0; i--) {
  if (lines[i].includes('</AppLayout>')) {
    lines.splice(i, 0, `      {isCivil && (tab === 'nutricion' || tab === 'entrenamiento' || tab === 'progreso_atleta') && clienteData && (
        <ClienteView 
          session={{ role:'cliente', data:clienteData, token:session?.token, profileId: session?.profileId, adminRole: session?.role }}
          isAtletaMode={false}
          isEmbedded={true}
          embeddedTab={tab === 'entrenamiento' ? 'deporte' : tab === 'progreso_atleta' ? 'progreso' : 'nutricion'}
          onLogout={onLogout}
        />
      )}`);
    break;
  }
}

fs.writeFileSync('src/pages/Admin.jsx', lines.filter(l => l !== '').join('\n'));
console.log('Patched Admin.jsx successfully');
