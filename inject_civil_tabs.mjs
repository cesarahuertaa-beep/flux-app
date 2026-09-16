import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

const civilTabsBlock = `
      {/* ════════════ CIVIL PREMIUM TABS ════════════ */}
      {isCivil && tab === "mi_plan" && (
        <SubComponentWrapper
          title="Mi Plan"
          action={
            clienteData ? (
              <button
                onClick={() => onModoAtleta(clienteData)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[var(--brand-primary)] hover:bg-[#F0F4FA] transition-colors shadow-sm"
              >
                <Dumbbell size={14} />
                <span>Modo Atleta</span>
              </button>
            ) : null
          }
        >
          {clienteData ? (
            <ProgramarCliente
              clientes={[clienteData]}
              selected={clienteData}
              setSelected={() => {}}
              setMsg={setMsg}
              biblioteca={biblioteca}
              isMiPlan={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-[#6B7A8D]">Cargando...</div>
          )}
        </SubComponentWrapper>
      )}

      {isCivil && tab === "progreso" && (
        <SubComponentWrapper title="Progreso">
          <ProgresoCliente selected={clienteData} setMsg={setMsg} />
        </SubComponentWrapper>
      )}

      {isCivil && tab === "membresia" && (
        <SubComponentWrapper title="Mi Membresía">
          <MiMembresiaCivil clienteData={clienteData} setMsg={setMsg} />
        </SubComponentWrapper>
      )}

      {isCivil && tab === "perfil" && (
        <SubComponentWrapper title="Mi Perfil">
          <UserProfile
            session={{ role: "cliente", data: clienteData }}
            onLogout={onLogout}
            onChangeRole={null}
            multiRoles={null}
          />
        </SubComponentWrapper>
      )}
      {/* ════════════ END CIVIL PREMIUM TABS ════════════ */}
`;

content = content.replace(/<\/AppLayout>\s*\);\s*}\s*$/g, civilTabsBlock + "\n    </AppLayout>\n  );\n}\n");

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log("Admin.jsx patched correctly.");
