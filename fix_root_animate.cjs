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
    
    // Specifically remove "animate-in w-full"
    content = content.replace(/className="animate-in w-full"/g, 'className="w-full"');
    
    // Remove "animate-in" from root wrappers but DO NOT remove "animate-in fade-in" from modals.
    // To do this safely, we replace ONLY the root "return (\n <div className..."
    content = content.replace(/return \(\s*<div className="animate-in"/g, 'return (\n    <div className=""');
    content = content.replace(/return \(\s*<div className="animate-in w-full"/g, 'return (\n    <div className="w-full"');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed animate-in in:', file);
    }
});
