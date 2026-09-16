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
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
// We search for the unicode replacement character \uFFFD (which displays as )
const badChars = ['\uFFFD', 'Ã³', 'Ã¡', 'Ã©', 'Ã±', 'Ã', 'Ã\xad', 'Ã\xba'];
let foundAny = false;

files.forEach(f => {
  const txt = fs.readFileSync(f, 'utf8');
  let hasBad = false;
  for (const char of badChars) {
    if (txt.includes(char)) {
      hasBad = true;
      break;
    }
  }
  if (hasBad) {
    console.log('Corrupted text found in: ' + f);
    foundAny = true;
  }
});

if (!foundAny) {
  console.log('No corrupted text found in src.');
}
