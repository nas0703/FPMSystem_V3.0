import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function deleteReceipts() {
  const receipts = ['A00013891', 'A00013939', 'A00013885'];
  
  for (const r of receipts) {
    const { data, error } = await supabase.from('hantaran_hasil').delete().eq('no_resit', r);
    if (error) {
      console.error(`Error deleting ${r}:`, error);
    } else {
      console.log(`Deleted ${r}`);
    }
  }
}

deleteReceipts();
