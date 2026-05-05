import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPA_URL, SUPA_KEY);

async function check() {
  const { data, error } = await supabase.from('profiles').select('id, email, role');
  if (error) console.error(error);
  console.log(data);
}

check();
