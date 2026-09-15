import fs from 'fs';
let content = fs.readFileSync('src/pages/Login.jsx', 'utf8');

content = content.replace(
  '          )}\n          </div>\n          <button onClick={submitProRequest}',
  '          )}\n          <button onClick={submitProRequest}'
);

fs.writeFileSync('src/pages/Login.jsx', content);
