const fs = require('fs');

async function check() {
  const envFile = fs.readFileSync('.env.development', 'utf8');
  const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL\s*=\s*(.*)/)[1].trim().replace(/['"]/g, '');
  const SUPABASE_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/)[1].trim().replace(/['"]/g, '');

  const url = SUPABASE_URL + '/rest/v1/recibos_pago_civil?select=*';
  
  const res = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }});
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
