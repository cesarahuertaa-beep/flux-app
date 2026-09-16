import fs from 'fs';

let content = fs.readFileSync('src/pages/Cliente.jsx', 'utf8');

const returnStr = `  return (
    <AppLayout 
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      session={session}
      onLogout={onLogout}
    >
      {isAtletaMode && (`;

const innerContentStr = `  const innerContent = (
    <>
      {isAtletaMode && (`;

const endStr = `            </>
          )}
        </>
      )}
    </AppLayout>
  );
}`;

const newEndStr = `            </>
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

content = content.replace(returnStr, innerContentStr);
content = content.replace(endStr, newEndStr);

fs.writeFileSync('src/pages/Cliente.jsx', content);
console.log('Patched Layout in Cliente.jsx');
