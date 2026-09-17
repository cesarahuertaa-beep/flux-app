const fs = require('fs');
const code = fs.readFileSync('src/lib/supabase.js', 'utf8');
const u = code.split('SUPA_URL = \"')[1].split('\"')[0];
const k = code.split('SUPA_KEY = \"')[1].split('\"')[0];
fetch(u+'/rest/v1/profiles?email=eq.betopros54@gmail.com', {method:'PATCH', headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'}, body:JSON.stringify({avatar_url:'test'})}).then(r=>r.text()).then(t => console.log('profiles:', t));
fetch(u+'/rest/v1/clientes?email=eq.betopros54@gmail.com', {method:'PATCH', headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'}, body:JSON.stringify({avatar_url:'test'})}).then(r=>r.text()).then(t => console.log('clientes:', t));
