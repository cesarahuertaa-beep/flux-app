const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'src/utils/pdf.js',
  'src/components/ui/index.jsx',
  'src/components/InstallPrompt.jsx',
  'src/pages/Login.jsx',
  'src/pages/Landing.jsx',
  'src/components/BrandContext.jsx',
  'vite.config.js'
];

files.forEach(f => {
  const fp = path.resolve(f);
  if (fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf-8');
    content = content.replace(/\/logo\.png/g, '/flux_logo.jpeg');
    content = content.replace(/logo\.png/g, 'flux_logo.jpeg');
    content = content.replace(/type="image\/png" href="\/flux_logo\.jpeg"/g, 'type="image/jpeg" href="/flux_logo.jpeg"');
    fs.writeFileSync(fp, content);
    console.log('Updated ' + f);
  }
});
