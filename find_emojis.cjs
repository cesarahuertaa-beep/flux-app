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
const emojiRegex = /\p{Emoji_Presentation}/gu;

files.forEach(f => {
  const txt = fs.readFileSync(f, 'utf8');
  const match = txt.match(emojiRegex);
  if (match) {
    console.log('Emojis found in ' + f + ': ' + Array.from(new Set(match)).join(' '));
  }
});
