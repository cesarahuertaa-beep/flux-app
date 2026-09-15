import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.jsx')) results.push(file);
  });
  return results;
}

const files = walk('src');
files.forEach(file => {
  try {
    execSync(`npx esbuild "${file}"`);
  } catch (e) {
    console.error(`SYNTAX ERROR IN: ${file}`);
  }
});
console.log("Done checking");
