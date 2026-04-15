import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

(async () => {
  const { data } = await sb.from('clients').select('system_prompt').eq('phone_number', '+919999999999').single();
  if (data) {
    let prompt = data.system_prompt;
    prompt = prompt.replace('  WRONG: "<function=save_lead>{\\"name\\":\\"Rahul\\"}</function>"\\n', '');
    prompt = prompt.replace('  RIGHT: "Rahul ji, aapki seat book ho gayi hai!"\\n', '');
    const { error } = await sb.from('clients').update({ system_prompt: prompt }).eq('phone_number', '+919999999999');
    console.log('Prompt updated:', error ? error.message : 'Success');
  } else {
    console.log('Client not found');
  }
})();
