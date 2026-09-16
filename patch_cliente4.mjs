import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

content = content.replace(
  'export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles }) {',
  'export default function ClienteView({ session, onLogout, isAtletaMode, onBackToAdmin, onChangeRole, multiRoles, isEmbedded, embeddedTab }) {'
);

content = content.replace(
  'const [tab, setTab] = useState(() => {',
  `const [tabState, setTab] = useState(() => {`
);

content = content.replace(
  'const tab = isEmbedded ? embeddedTab : tabState;',
  '' // Just in case it's there
);

const insertAfter = `  const [tabState, setTab] = useState(() => {\n    const saved = localStorage.getItem("flux_cliente_tab");\n    return saved ? saved : "nutricion";\n  });`;
content = content.replace(insertAfter, insertAfter + `\n  const tab = isEmbedded ? embeddedTab : tabState;`);

const returnLayout = `  return (
    <AppLayout 
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      session={session}
      onLogout={onLogout}
    >
      {isAtletaMode && (`;

const newReturnLayout = `  const innerContent = (
    <>
      {isAtletaMode && (`;

content = content.replace(returnLayout, newReturnLayout);

// Find the last closing tag for AppLayout
const endAppLayout = `            </>
          )}
        </>
      )}
    </AppLayout>
  );
}`;

const newEndAppLayout = `            </>
          )}
        </>
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

content = content.replace(endAppLayout, newEndAppLayout);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Cliente.jsx to support isEmbedded');
