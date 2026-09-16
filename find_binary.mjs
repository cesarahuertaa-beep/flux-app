import fs from 'fs';
import path from 'path';

function findIssues(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findIssues(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            const buf = fs.readFileSync(fullPath);
            // Check for UTF-8 Replacement Character EF BF BD
            if (buf.includes(Buffer.from([0xEF, 0xBF, 0xBD]))) {
                console.log(`FFFD_FOUND|${fullPath}`);
            }
            // Check for double encoded utf-8 like C3 83
            if (buf.includes(Buffer.from([0xC3, 0x83]))) {
                console.log(`DOUBLE_UTF8_FOUND|${fullPath}`);
            }
            
            // Just for emojis in Civil components
            const basename = path.basename(fullPath);
            if (['ProgresoCliente.jsx', 'ProgramarCliente.jsx', 'MiMembresiaCivil.jsx'].includes(basename)) {
                const txt = buf.toString('utf8');
                const lines = txt.split('\\n');
                for (let i = 0; i < lines.length; i++) {
                    // looking for ✖, 🗑️, ✏️, etc.
                    if (lines[i].includes('✖') || lines[i].includes('🗑') || lines[i].includes('✏') || lines[i].includes('')) {
                        console.log(`EMOJI|${basename}|${i+1}|${lines[i].trim()}`);
                    }
                }
            }
        }
    }
}
findIssues('src');
