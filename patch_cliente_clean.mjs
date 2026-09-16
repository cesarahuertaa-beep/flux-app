import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

const tabStateRegex = /const \[tab, setTab\] = useState\(\(\) => \{\s*const saved = localStorage\.getItem\("flux_cliente_tab"\);\s*return saved \? saved : "perfil";\s*\}\);/;
const newTabState = `const [tabState, setTab] = useState(() => {
    const saved = localStorage.getItem("flux_cliente_tab");
    return saved ? saved : "perfil";
  });
  const tab = isEmbedded ? embeddedTab : tabState;`;

content = content.replace(tabStateRegex, newTabState);

const layoutRegex = /<AppLayout\s*nav=\{SIDEBAR_ITEMS\}\s*active=\{tab\}\s*setActive=\{setTab\}\s*brand=\{brand\}\s*session=\{session\}\s*onLogout=\{onLogout\}\s*>/;
const newLayout = `const innerContent = (
    <>`;
content = content.replace(layoutRegex, newLayout);

const endLayoutRegex = /<\/AppLayout>\s*\)\;\s*\}/;
const newEndLayout = `    </>
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
content = content.replace(endLayoutRegex, newEndLayout);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched layout in Cliente.jsx via Regex');
