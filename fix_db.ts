import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function fixData() {
  const { data, error } = await supabase.from('hantaran_hasil').select('id, blok');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const row of data) {
    if (row.blok && row.blok.startsWith('0')) {
      const newBlok = parseInt(row.blok, 10).toString();
      console.log(`Updating ${row.id} from ${row.blok} to ${newBlok}`);
      await supabase.from('hantaran_hasil').update({ blok: newBlok }).eq('id', row.id);
    }
  }
  console.log('Done fixing data');
}
fixData();
