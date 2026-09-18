import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(url + '/rest/v1/profiles?limit=1', {
    method:'GET',
    headers:{ apikey:key, Authorization:'Bearer ' + key }
  });
  const data = await r.json();
  console.log(data);
}
run();
