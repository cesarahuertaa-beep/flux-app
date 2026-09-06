const fs = require('fs');
const content = fs.readFileSync('src/lib/supabase.js', 'utf8');
const supaUrl = content.match(/SUPA_URL = "([^"]+)"/)?.[1] || content.match(/SUPA_URL = '([^']+)'/)?.[1];
const supaKey = content.match(/SUPA_KEY = "([^"]+)"/)?.[1] || content.match(/SUPA_KEY = '([^']+)'/)?.[1];

fetch(supaUrl + '?apikey=' + supaKey)
  .then(r => r.json())
  .then(j => {
    console.log(JSON.stringify(j.definitions.profiles, null, 2));
  })
  .catch(console.error);
