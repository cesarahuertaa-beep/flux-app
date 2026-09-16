import fs from 'fs';
import path from 'path';

function findIssues(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findIssues(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Check for U+FFFD (corrupted text)
                if (line.includes('\\uFFFD')) {
                    console.log(`CORRUPT_TEXT|${fullPath}|${i+1}|${line.trim()}`);
                }
                
                // Only check emojis in Civil Premium related files for now
                if (fullPath.includes('Admin.jsx') || fullPath.includes('ProgresoCliente') || fullPath.includes('ProgramarCliente') || fullPath.includes('MiMembresiaCivil')) {
                    const emojiMatch = line.match(/[\\u2600-\\u26FF\\u2700-\\u27BF\\u1F300-\\u1F9FF\\u1F600-\\u1F64F\\u1F680-\\u1F6FF]/);
                    if (emojiMatch) {
                        console.log(`EMOJI|${fullPath}|${i+1}|${line.trim()}`);
                    }
                }
            }
        }
    }
}

findIssues('src');
