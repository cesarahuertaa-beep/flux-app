const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.jsx')) results.push(file);
        }
    });
    return results;
}
const files = walk('./src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Remove animate-in from known layout wrappers
    content = content.replace(/animate-in fade-in slide-in-from-bottom-4/g, '');
    content = content.replace(/<div className="animate-in">/g, '<div>');
    
    // Fix double spaces that might be left over
    content = content.replace(/className=" +/g, 'className="');
    content = content.replace(/ +"/g, '"');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed:', file);
    }
});
