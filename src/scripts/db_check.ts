import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function check() {
  // 1. Check existing leads and their columns
  const { data, error } = await sb.from('leads').select('*').limit(1);
  
  if (error) {
    console.log('❌ Error reading leads:', error.message);
    return;
  }

  if (data && data.length > 0) {
    const cols = Object.keys(data[0]);
    console.log('📋 Lead table columns:', cols.join(', '));
    console.log('📋 Has phone_number?', cols.includes('phone_number') ? '✅ YES' : '❌ NO — Run: ALTER TABLE leads ADD COLUMN phone_number TEXT;');
    console.log('📋 Sample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('📋 No leads in DB yet. Testing insert with phone_number...');
    const { error: insertErr } = await sb.from('leads').insert([{
      name: 'PhoneTest',
      course: 'TEST',
      status: 'warm',
      notes: 'Testing phone_number column',
      owner_id: '79ec46f9-611f-457e-b88c-149226960520',
      phone_number: '+911234567890'
    }]);
    if (insertErr) {
      console.log('❌ Insert failed:', insertErr.message);
      if (insertErr.message.includes('phone_number')) {
        console.log('🔧 FIX: Run this SQL in Supabase Dashboard:');
        console.log('   ALTER TABLE leads ADD COLUMN phone_number TEXT;');
      }
    } else {
      console.log('✅ Insert with phone_number succeeded!');
      // Clean up test row
      await sb.from('leads').delete().eq('name', 'PhoneTest').eq('course', 'TEST');
      console.log('🧹 Cleaned up test row.');
    }
  }

  // 2. Check clients table
  const { data: clients, error: clientErr } = await sb.from('clients').select('*').limit(5);
  if (clientErr) {
    console.log('❌ Error reading clients:', clientErr.message);
  } else {
    console.log('\n📋 Clients in DB:', clients?.length);
    clients?.forEach(c => console.log(`  → ${c.company_name} | ${c.phone_number} | owner: ${c.owner_id}`));
  }
}

check();
