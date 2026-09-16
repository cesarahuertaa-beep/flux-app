import fs from 'fs';

let lines = fs.readFileSync('src/pages/Cliente.jsx', 'utf8').split(/\\r?\\n/);

// 1. Signature is already updated, but check anyway
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles }) {')) {
    lines[i] = 'export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles, isEmbedded, embeddedTab }) {';
    break;
  }
}

// 2. Tab state
let tabStateFound = false;
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('const [tab, setTab] = useState(() => {')) {
    lines[i] = '  const [tabState, setTab] = useState(() => {';
    let j = i;
    while (!lines[j].includes('});')) j++;
    lines.splice(j+1, 0, '  const tab = isEmbedded ? embeddedTab : tabState;');
    tabStateFound = true;
    break;
  }
}

// 3. AppLayout rendering
const startLayoutIdx = lines.findIndex(l => l.includes('<AppLayout'));
if (startLayoutIdx !== -1) {
  // Go back to the 'return (' line
  let returnLine = startLayoutIdx - 1;
  while (!lines[returnLine].includes('return (')) {
    returnLine--;
  }
  
  lines[returnLine] = '  const innerContent = (\\n    <>';
  lines[startLayoutIdx] = ''; // clear <AppLayout
  
  // clear all props of AppLayout until `>`
  let k = startLayoutIdx + 1;
  while (!lines[k].includes('>')) {
    lines[k] = '';
    k++;
  }
  lines[k] = ''; // clear the `>`

  const endLayoutIdx = lines.findIndex(l => l.includes('</AppLayout>'));
  if (endLayoutIdx !== -1) {
    lines[endLayoutIdx] = `    </>
  );

  if (isEmbedded) return innerContent;

  return (
    <AppLayout 
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      session={session}
      onLogout={onLogout}
    >
      {innerContent}
    </AppLayout>`;
  }
}

fs.writeFileSync('src/pages/Cliente.jsx', lines.filter(l => l !== '').join('\\n'));
console.log('Patched Cliente.jsx (the real fix)');
