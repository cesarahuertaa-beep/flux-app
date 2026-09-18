const fs = require('fs');
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

content = content.replace(/const \[mode, setMode\]\s*=\s*useState\("login"\);/, 'const [mode, setMode] = useState(() => sessionStorage.getItem(\'flux_login_mode\') || "login");');
content = content.replace(/const \[signupType, setSignupType\]\s*=\s*useState\("civil"\);/, 'const [signupType, setSignupType] = useState(() => sessionStorage.getItem(\'flux_signupType\') || "civil");');
content = content.replace(/const \[nombre, setNombre\]\s*=\s*useState\(""\);/, 'const [nombre, setNombre] = useState(() => sessionStorage.getItem(\'flux_login_nombre\') || "");');
content = content.replace(/const \[email, setEmail\]\s*=\s*useState\(""\);/, 'const [email, setEmail] = useState(() => sessionStorage.getItem(\'flux_login_email\') || "");');
content = content.replace(/const \[cedula, setCedula\]\s*=\s*useState\(""\);/, 'const [cedula, setCedula] = useState(() => sessionStorage.getItem(\'flux_login_cedula\') || "");');

const useEffectHook = `
  useEffect(() => {
    sessionStorage.setItem('flux_login_mode', mode);
    sessionStorage.setItem('flux_signupType', signupType);
    sessionStorage.setItem('flux_login_nombre', nombre);
    sessionStorage.setItem('flux_login_email', email);
    sessionStorage.setItem('flux_login_cedula', cedula);
    sessionStorage.setItem('flux_aviso', avisoAceptado ? 'true' : 'false');
  }, [mode, signupType, nombre, email, cedula, avisoAceptado]);
`;

content = content.replace(/const \[avisoAceptado, setAvisoAceptado\] = useState\(false\);/, 'const [avisoAceptado, setAvisoAceptado] = useState(() => sessionStorage.getItem(\'flux_aviso\') === \'true\');\n' + useEffectHook);

content = content.replace(/<Link to="\/privacidad" target="_blank" rel="noopener noreferrer"/g, '<Link to="/privacidad"');

fs.writeFileSync('src/pages/Login.jsx', content, 'utf8');
