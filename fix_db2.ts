import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
async function fix() {
  const { data, error } = await supabase
    .from('hantaran_hasil')
    .update({ tarikh: '2026-04-02' })
    .eq('no_resit', 'A00010893');
  console.log('Update error:', error);
  console.log('Update data:', data);
}
fix();
