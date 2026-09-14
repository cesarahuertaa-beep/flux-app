import fs from 'fs';
let file = 'src/pages/Admin.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const activarModoAtleta = async \(\) => {[\s\S]*?onModoAtleta\(clienteRecord\);[\s\S]*?};/;

const replacement = `const activarModoAtleta = async () => {
    if (myShadowClient) {
      onModoAtleta(myShadowClient);
      return;
    }
  };`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
