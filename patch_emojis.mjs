import fs from 'fs';

const files = [
  'src/components/admin/ProgresoCliente.jsx',
  'src/components/admin/ProgramarCliente.jsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace ❌ Error...
  content = content.replace(/setMsg\\("❌ (.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> $1</div>)');
  content = content.replace(/setMsg\\("❌ " \\+ (.*?)\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {"" + $1}</div>)');
  
  // Replace ✅ Success...
  content = content.replace(/setMsg\\("✅ (.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> $1</div>)');
  content = content.replace(/setMsg\\(\`✅ (.*?)\`\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> {$1}</div>)');

  // Replace 🗑️ Trash...
  content = content.replace(/setMsg\\("🗑️ (.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> $1</div>)');

  fs.writeFileSync(file, content);
}

console.log("Emojis replaced in setMsg");
