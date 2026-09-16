import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

// 1. Signature
content = content.replace(
  'export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles }) {',
  'export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles, isEmbedded, embeddedTab }) {'
);

// 2. Tab state
const oldTabState = `  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem("flux_cliente_tab");
    return saved ? saved : "nutricion";
  });`;
const newTabState = `  const [tabState, setTab] = useState(() => {
    const saved = localStorage.getItem("flux_cliente_tab");
    return saved ? saved : "nutricion";
  });
  const tab = isEmbedded ? embeddedTab : tabState;`;
content = content.replace(oldTabState, newTabState);

// 3. Layout start
const oldReturnStart = `  return (
    <AppLayout 
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      session={session}
      onLogout={onLogout}
    >
      {isAtletaMode && (`;

const newReturnStart = `  const innerContent = (
    <>
      {isAtletaMode && !isEmbedded && (`;

content = content.replace(oldReturnStart, newReturnStart);

// 4. Layout end
const oldReturnEnd = `        </>
      )}
    </AppLayout>
  );
}`;

const newReturnEnd = `        </>
      )}
    </>
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
    </AppLayout>
  );
}`;

content = content.replace(oldReturnEnd, newReturnEnd);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Layout in Cliente.jsx via safe string replace');
