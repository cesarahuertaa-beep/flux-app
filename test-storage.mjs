import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const bucket = 'progress-photos';
  const r = await fetch(url + '/storage/v1/object/list/' + bucket, {
    method:'POST',
    headers:{ apikey:key, Authorization:'Bearer ' + key, 'Content-Type':'application/json' },
    body: JSON.stringify({ prefix: '', limit: 10 })
  });
  console.log('Status:', r.status);
  const data = await r.json();
  console.log(data);
}
run();
