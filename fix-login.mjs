import fs from 'fs';

let file = 'src/pages/Login.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports for Eye and EyeOff
if (!content.includes('Eye,') && !content.includes('EyeOff')) {
  content = content.replace('import { Mail, Lock, CheckCircle2, RefreshCw } from "lucide-react";', 'import { Mail, Lock, CheckCircle2, RefreshCw, Eye, EyeOff } from "lucide-react";');
}

// 2. Add showPass state
if (!content.includes('const [showPass')) {
  content = content.replace('const [loading, setLoading] = useState(false);', 'const [loading, setLoading] = useState(false);\n  const [showPass, setShowPass] = useState(false);');
}

// 3. Update the inputs and add the toggle button.
// For the LOGIN and SIGNUP password inputs, they are identical except for the placeholder/onChange, but they have the same class structure.
const oldLoginPassRegex = /<input\s*type="password"\s*value=\{pass\}\s*onChange=\{e => setPass\(e\.target\.value\)\}\s*onKeyDown=\{e => e\.key === "Enter" && submit\(\)\}\s*placeholder="\s*"\s*className="bg-\[\#F0F4FA\] border border-transparent focus:border-\[var\(--brand-primary\)\] text-\[\#0B1929\] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"\s*\/>/;

const newLoginPass = `<input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="        "
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm"
              />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>`;

content = content.replace(oldLoginPassRegex, newLoginPass);

const oldSignupPassRegex = /<input\s*type="password"\s*value=\{pass\}\s*onChange=\{e => setPass\(e\.target\.value\)\}\s*onKeyDown=\{e => e\.key === "Enter" && signUpSubmit\(\)\}\s*placeholder="\s*"\s*className="bg-\[\#F0F4FA\] border border-transparent focus:border-\[var\(--brand-primary\)\] text-\[\#0B1929\] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm"\s*\/>/;

const newSignupPass = `<input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && signUpSubmit()}
                placeholder="        "
                className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm"
              />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>`;

content = content.replace(oldSignupPassRegex, newSignupPass);

const oldSetPass1Regex = /<input type="password" value=\{newPass\} onChange=\{e => setNewPass\(e\.target\.value\)\} placeholder="M.nimo 6 caracteres" className="bg-\[\#F0F4FA\] border border-transparent focus:border-\[var\(--brand-primary\)\] text-\[\#0B1929\] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" \/>/;

const newSetPass1 = `<input type={showPass ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>`;

content = content.replace(oldSetPass1Regex, newSetPass1);


const oldSetPass2Regex = /<input type="password" value=\{confirmPass\} onChange=\{e => setConfirmPass\(e\.target\.value\)\} onKeyDown=\{e => e\.key === "Enter" && setPassword\(\)\} placeholder="Repite tu contrase.a" className="bg-\[\#F0F4FA\] border border-transparent focus:border-\[var\(--brand-primary\)\] text-\[\#0B1929\] rounded-xl pl-10 pr-4 py-3 w-full outline-none transition-all text-sm" \/>/;

const newSetPass2 = `<input type={showPass ? "text" : "password"} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => e.key === "Enter" && setPassword()} placeholder="Repite tu contraseña" className="bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-12 py-3 w-full outline-none transition-all text-sm" />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>`;

content = content.replace(oldSetPass2Regex, newSetPass2);

fs.writeFileSync(file, content);
