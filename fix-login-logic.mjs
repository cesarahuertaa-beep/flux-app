import fs from 'fs';
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// Inject state variables
content = content.replace(
  'const [confirmPass, setConfirmPass] = useState("");',
  `const [confirmPass, setConfirmPass] = useState("");
  const [signupType, setSignupType] = useState("civil");
  const [docUrl, setDocUrl] = useState("");`
);

// Inject submitProRequest
const submitProStr = `
  const submitProRequest = async () => {
    if (!nombre || !email || !docUrl) {
      setErr("Todos los campos son obligatorios");
      return;
    }
    setLoading(true); setErr(""); setInfo("");
    try {
      await dbPost("solicitudes_profesionales", {
        nombre: nombre.trim(),
        email: email.trim(),
        tipo: signupType,
        documentacion_url: docUrl.trim(),
        estado: 'pendiente'
      });
      setInfo("Solicitud enviada con éxito. Nuestro equipo la revisará pronto.");
      setMode("login");
    } catch (e) {
      setErr("Error al enviar solicitud: " + e.message);
    }
    setLoading(false);
  };
`;

content = content.replace(
  'const signUpSubmit = async () => {',
  submitProStr + '\n  const signUpSubmit = async () => {'
);

fs.writeFileSync('src/pages/Login.jsx', content);
