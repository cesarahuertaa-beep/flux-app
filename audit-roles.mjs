import fs from 'fs';
import path from 'path';

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walkDir('src');
const patterns = ['"client"', "'client'", '"cliente"', "'cliente'", '"admin"', "'admin'", '"superadmin"', "'superadmin'", '"staff"', "'staff'", '"administrativo"', "'administrativo'", '"nutriologo"', "'nutriologo'"];

files.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
        if (patterns.some(p => line.includes(p))) {
            console.log(file + ':' + (idx + 1) + ': ' + line.trim());
        }
    });
});
