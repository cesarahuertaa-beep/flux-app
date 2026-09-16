import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// Replace Error
content = content.replace(/setMsg\\("❌ (.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> $1</div>)');
content = content.replace(/setMsg\\("❌ " \\+ (.*?)\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {"" + $1}</div>)');

// Replace Success
content = content.replace(/setMsg\\("✅ (.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> $1</div>)');
content = content.replace(/setMsg\\(\`✅ (.*?)\`\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> {$1}</div>)');
content = content.replace(/setMsg\\(\`✓ (.*?)\`\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> {$1}</div>)');

// Replace Warning
content = content.split('⚠️ Tu suscripción vence pronto').join('<AlertCircle className="w-4 h-4 shrink-0 text-yellow-600" /> Tu suscripción vence pronto');

// Fix imports in Admin.jsx if needed.
fs.writeFileSync('src/pages/Admin.jsx', content);
console.log("Admin.jsx emojis patched");
