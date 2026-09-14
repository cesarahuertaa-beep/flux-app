import fs from 'fs';

let file = 'src/components/cliente/Training.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="flex-1 flex flex-col">/;

const replacement = `<div className="flex-1 flex flex-col relative">
      {isLocked && (
        <div className="bg-amber-100 text-amber-800 px-4 py-2 text-center text-[11px] md:text-xs font-semibold">
          Este plan arranca en el futuro. Puedes ver tu rutina, pero aún no puedes registrar progreso.
        </div>
      )}`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
