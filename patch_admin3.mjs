import fs from 'fs';

let txt = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

const views = `
      {isCivil && (tab === 'nutricion' || tab === 'entrenamiento' || tab === 'progreso_atleta') && clienteData && (
        <ClienteView 
          session={{ role:'cliente', data:clienteData, token:session?.token, profileId: session?.profileId, adminRole: session?.role }}
          isAtletaMode={false}
          isEmbedded={true}
          embeddedTab={tab === 'entrenamiento' ? 'deporte' : tab === 'progreso_atleta' ? 'progreso' : 'nutricion'}
          onLogout={onLogout}
        />
      )}
`;

const endIdx = txt.lastIndexOf('</div>\r\n    </div>\r\n  );\r\n}');
if (endIdx !== -1) {
    txt = txt.substring(0, endIdx) + views + txt.substring(endIdx);
} else {
    const endIdx2 = txt.lastIndexOf('</div>\n    </div>\n  );\n}');
    if (endIdx2 !== -1) {
        txt = txt.substring(0, endIdx2) + views + txt.substring(endIdx2);
    }
}

fs.writeFileSync('src/pages/Admin.jsx', txt);
console.log('Added execution views');
