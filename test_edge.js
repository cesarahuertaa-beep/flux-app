const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function test() {
  const r = await fetch(`${SUPA_URL}/functions/v1/invite-user`, {
    method:"POST",
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({email: "test_cliente_error@gmail.com"})
  });
  const d = await r.json();
  console.log("Status:", r.status);
  console.log("Response:", d);
}
test();
