import fs from 'fs';

let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// Find the start of the SIGNUP FORM block
const signupIndex = content.indexOf('SIGNUP FORM');
if (signupIndex === -1) throw new Error("Could not find SIGNUP FORM");

// Find the start of the block (the {/* comment)
const blockStart = content.lastIndexOf('{/*', signupIndex);

// Find the start of the RESET FORM block
const resetIndex = content.indexOf('RESET FORM');
if (resetIndex === -1) throw new Error("Could not find RESET FORM");
const blockEnd = content.lastIndexOf('{/*', resetIndex);

const newSignupBlocks = `
        {/* SIGNUP TYPE */}
        {mode === "signup_type" && <>
          <div className="mb-6 text-center">
            <h3 className="text-lg font-bold text-[#0B1929] mb-2">¿Cómo usarás Flux?</h3>
            <p className="text-xs text-[#6B7A8D]">Selecciona el tipo de cuenta que deseas crear.</p>
          </div>
          <div className="flex flex-col gap-3 mb-4">
            <button onClick={() => { setSignupType("civil"); setMode("signup_civil"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[var(--brand-primary)] shrink-0">
                <User size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Usuario Civil</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Entrena, sigue tu dieta y vincula a tu nutriólogo.</p>
              </div>
            </button>
            <button onClick={() => { setSignupType("nutriologo"); setMode("signup_pro"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-emerald-500 hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Nutriólogo</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Gestiona pacientes y crea planes personalizados.</p>
              </div>
            </button>
            <button onClick={() => { setSignupType("nutriologo_estudiante"); setMode("signup_pro"); }} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center gap-4 hover:border-amber-500 hover:shadow-md transition-all text-left">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1929]">Estudiante de Nutrición</p>
                <p className="text-xs text-[#6B7A8D] mt-0.5">Para estudiantes con credencial vigente.</p>
              </div>
            </button>
          </div>
        </>}

        {/* SIGNUP CIVIL */}
        {mode === "signup_civil" && <>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="Tu nombre" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></div>
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="tu@email.com" type="email" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Contraseña</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></div>
              <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && signUpSubmit()} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <button onClick={signUpSubmit} disabled={loading} className={\`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 \${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#2e5cb8] to-[#3d6fd0] text-white hover:opacity-90 cursor-pointer shadow-lg shadow-blue-500/30'}\`}>
            {loading ? "CREANDO..." : <>CREAR CUENTA <ArrowRight size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
        </>}

        {/* SIGNUP PRO */}
        {mode === "signup_pro" && <>
          <div className="mb-6 text-center">
            <h3 className="text-lg font-bold text-[#0B1929] mb-1">{signupType === 'nutriologo' ? 'Solicitud Nutriólogo' : 'Solicitud Estudiante de Nutrición'}</h3>
            <p className="text-xs text-[#6B7A8D]">Revisaremos tus datos para habilitar tu cuenta.</p>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Nombre Completo</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">Email</div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" type="email" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
          </div>
          <div className="mb-6">
            <div className="text-[11px] text-[#6B7A8D] mb-2 font-semibold uppercase tracking-[1px]">URL de Cédula o Credencial</div>
            <div className="relative">
              <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="Link a tu documento / Drive / Foto" type="text" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-3 w-full outline-none transition-all text-sm" />
            </div>
            <p className="text-[10px] text-[#6B7A8D] mt-2 leading-tight">Por ahora, pega un enlace donde podamos ver tu comprobante (ej. Google Drive público, Dropbox, o tu número de cédula).</p>
          </div>
          <button onClick={submitProRequest} disabled={loading} className={\`w-full p-3.5 rounded-xl font-extrabold text-sm mb-4 tracking-[1.5px] font-['Space_Grotesk',sans-serif] transition-all duration-300 flex items-center justify-center gap-2 \${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#10B981] text-white hover:bg-[#059669] cursor-pointer shadow-lg shadow-emerald-500/30'}\`}>
            {loading ? "ENVIANDO..." : <>ENVIAR SOLICITUD <CheckCircle size={16} /></>}
          </button>
          <div className="text-center">
            <button onClick={() => setMode("signup_type")} className="text-xs text-[#6B7A8D] hover:text-[#0B1929]">Volver</button>
          </div>
        </>}

`;

content = content.substring(0, blockStart) + newSignupBlocks + '\n        ' + content.substring(blockEnd);
fs.writeFileSync('src/pages/Login.jsx', content);
