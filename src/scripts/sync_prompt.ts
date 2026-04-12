import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

async function sync() {
  const [,, filePath, ownerId] = process.argv;

  if (!filePath || !ownerId) {
    console.log('❌ Missing arguments!');
    console.log('Usage: npx tsx src/scripts/sync_prompt.ts <file_path> <owner_id>');
    console.log('Example: npx tsx src/scripts/sync_prompt.ts src/prompts/xyz_coaching.txt 79ec46f9-611f-457e-b88c-149226960520');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');

  console.log(`🔄 Syncing "${path.basename(filePath)}" to database...`);
  
  const { error } = await supabase
    .from('clients')
    .update({ system_prompt: content })
    .eq('owner_id', ownerId);

  if (error) {
    console.error('❌ Sync failed:', error.message);
  } else {
    console.log(`✅ Success! Updated prompt for owner ${ownerId} (${content.length} characters)`);
  }
}

sync();
