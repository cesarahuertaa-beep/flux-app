import fs from 'fs';

let lines = fs.readFileSync('src/pages/Cliente.jsx', 'utf8').split(/\\r?\\n/);

// 1. Update signature
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles }) {')) {
    lines[i] = 'export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles, isEmbedded, embeddedTab }) {';
    break;
  }
}

// 2. Tab state
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('const [tab, setTab] = useState(() => {')) {
    lines[i] = '  const [tabState, setTab] = useState(() => {';
    // skip to end of useState
    while (!lines[i].includes('});')) i++;
    lines.splice(i+1, 0, '  const tab = isEmbedded ? embeddedTab : tabState;');
    break;
  }
}

// 3. AppLayout rendering
const startLayoutIdx = lines.findIndex(l => l.includes('<AppLayout'));
if (startLayoutIdx !== -1) {
  // Replace `return (` with `const innerContent = (`
  lines[startLayoutIdx - 1] = '  const innerContent = (';
  lines[startLayoutIdx] = '    <>';
  // Remove the props of AppLayout
  let i = startLayoutIdx + 1;
  while (!lines[i].includes('>')) {
    lines[i] = ''; // clear line
    i++;
  }
  lines[i] = ''; // clear the line with `>`

  // Find closing `</AppLayout>`
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

fs.writeFileSync('src/pages/Cliente.jsx', lines.filter(l => l !== '').join('\n'));
console.log('Patched Cliente.jsx');
