import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('hantaran_hasil')
    .select('no_resit, no_nota_hantaran');
    
  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  data.forEach(row => {
    if (row.no_resit && row.no_nota_hantaran) {
      const resit = row.no_resit.trim().toLowerCase();
      const nota = row.no_nota_hantaran.trim().toLowerCase();
      
      if (resit === nota) {
        console.log('Exact match:', row);
      } else if (resit.includes(nota) || nota.includes(resit)) {
        console.log('Substring match:', row);
      }
    }
  });
}

checkDuplicates();
