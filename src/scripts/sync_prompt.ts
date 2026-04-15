import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

function parseArgs(args: string[]) {
  const result: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      result[key] = args[i + 1] || '';
      i++; // skip the value
    } else {
      positional.push(args[i]);
    }
  }

  return { flags: result, positional };
}

async function sync() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const filePath = positional[0];
  const ownerIdArg = positional[1];
  const clientName = flags['name'];
  const clientPhone = flags['phone'];

  // ═══════════════════════════════════════════
  // LIST MODE
  // ═══════════════════════════════════════════
  if (flags['list'] !== undefined || filePath === '--list') {
    const { data, error } = await supabase.from('clients').select('owner_id, company_name, phone_number');
    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
    console.log('\n📋 Registered Clients:\n');
    if (!data || data.length === 0) {
      console.log('  (none)');
    } else {
      data.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.company_name}`);
        console.log(`     Phone:    ${c.phone_number}`);
        console.log(`     Owner ID: ${c.owner_id}\n`);
      });
    }
    process.exit(0);
  }

  // ═══════════════════════════════════════════
  // HELP / USAGE
  // ═══════════════════════════════════════════
  if (!filePath) {
    console.log(`
╔══════════════════════════════════════════════════════╗
║         🧠 Voice AI — Client Sync Tool              ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  UPDATE existing client:                             ║
║  npx tsx src/scripts/sync_prompt.ts <file> <owner_id>║
║                                                      ║
║  CREATE new client + sync prompt:                    ║
║  npx tsx src/scripts/sync_prompt.ts <file>           ║
║    --name "ABC Coaching" --phone "+919876543210"      ║
║                                                      ║
║  LIST all clients:                                   ║
║  npx tsx src/scripts/sync_prompt.ts --list           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
    process.exit(0);
  }



  // ═══════════════════════════════════════════
  // READ THE PROMPT FILE
  // ═══════════════════════════════════════════
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${absolutePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(absolutePath, 'utf8');

  // ═══════════════════════════════════════════
  // MODE 1: CREATE NEW CLIENT
  // ═══════════════════════════════════════════
  if (clientName && clientPhone) {
    const ownerId = ownerIdArg || crypto.randomUUID();

    console.log(`\n🆕 Creating new client...`);
    console.log(`   Name:     ${clientName}`);
    console.log(`   Phone:    ${clientPhone}`);
    console.log(`   Owner ID: ${ownerId}`);

    // Check if phone already exists
    const { data: existing } = await supabase
      .from('clients')
      .select('owner_id, company_name')
      .eq('phone_number', clientPhone)
      .single();

    if (existing) {
      console.log(`\n⚠️  Phone ${clientPhone} already belongs to "${existing.company_name}"`);
      console.log(`   Updating their prompt instead...\n`);

      const { error } = await supabase
        .from('clients')
        .update({ system_prompt: content })
        .eq('owner_id', existing.owner_id);

      if (error) {
        console.error('❌ Update failed:', error.message);
      } else {
        console.log(`✅ Prompt updated for "${existing.company_name}" (${content.length} chars)`);
      }
      process.exit(0);
    }

    // Insert new client
    const { error } = await supabase.from('clients').insert([{
      owner_id: ownerId,
      company_name: clientName,
      phone_number: clientPhone,
      system_prompt: content,
    }]);

    if (error) {
      console.error('❌ Creation failed:', error.message);
    } else {
      console.log(`\n✅ Client created successfully!`);
      console.log(`   "${clientName}" is now LIVE on ${clientPhone}`);
      console.log(`   Prompt: ${content.length} characters synced`);
      console.log(`\n   📝 Save this Owner ID: ${ownerId}`);
      console.log(`   (You'll need it to update their prompt later)\n`);
    }
    process.exit(0);
  }

  // ═══════════════════════════════════════════
  // MODE 2: UPDATE EXISTING CLIENT
  // ═══════════════════════════════════════════
  if (!ownerIdArg) {
    console.error('❌ Missing owner_id! Usage:');
    console.error('   npx tsx src/scripts/sync_prompt.ts <file> <owner_id>');
    console.error('\n   Or create a new client with:');
    console.error('   npx tsx src/scripts/sync_prompt.ts <file> --name "Name" --phone "+91..."');
    process.exit(1);
  }

  console.log(`\n🔄 Syncing "${path.basename(filePath)}" to owner ${ownerIdArg}...`);

  const { error } = await supabase
    .from('clients')
    .update({ system_prompt: content })
    .eq('owner_id', ownerIdArg);

  if (error) {
    console.error('❌ Sync failed:', error.message);
  } else {
    console.log(`✅ Prompt updated! (${content.length} characters)\n`);
  }
}

sync();
