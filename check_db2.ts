import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
async function check() {
  const { data, error } = await supabase.from('hantaran_hasil').select('id, tarikh, no_resit, kpg');
  console.log(data);
}
check();
