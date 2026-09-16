import fs from 'fs';

const files = [
  'src/components/admin/ProgresoCliente.jsx',
  'src/components/admin/ProgramarCliente.jsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // \\u274c is cross
  // \\u2705 is check
  // \\ud83d\\uddd1(\\ufe0f)? is trash

  // Error messages
  content = content.replace(/setMsg\\("(\\u274c|\\u274C)\\s*(.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> $3</div>)');
  content = content.replace(/setMsg\\("(\\u274c|\\u274C)\\s*" \\+ (.*?)\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {"" + $3}</div>)');
  
  // Success messages
  content = content.replace(/setMsg\\("(\\u2705)\\s*(.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> $3</div>)');
  content = content.replace(/setMsg\\(\`(\\u2705)\\s*(.*?)\`\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> {$3}</div>)');

  // Trash messages
  content = content.replace(/setMsg\\("(?:\\ud83d\\uddd1\\ufe0f?)\\s*(.*?)"\\)/g, 'setMsg(<div className="flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> $1</div>)');

  fs.writeFileSync(file, content);
}

console.log("Emojis replaced using unicode escapes");
