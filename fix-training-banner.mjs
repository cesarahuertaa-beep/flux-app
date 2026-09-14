import fs from 'fs';

let file = 'src/components/cliente/Training.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="flex flex-col md:flex-row h-full">/;

const replacement = `<div className="flex flex-col md:flex-row h-full">
      {isLocked && (
        <div className="absolute top-0 left-0 w-full z-10 bg-yellow-100 text-yellow-800 px-4 py-2 text-center text-xs font-semibold shadow-sm">
          Este plan arranca en el futuro. Puedes ver tu rutina, pero aún no puedes registrar progreso.
        </div>
      )}`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
