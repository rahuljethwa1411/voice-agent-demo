/**
 * ╔══════════════════════════════════════════════════════╗
 * ║     🔌 LiveKit SIP Setup — Twilio Bridge Script     ║
 * ╠══════════════════════════════════════════════════════╣
 * ║  Run ONCE to wire your Twilio number to LiveKit.    ║
 * ║                                                      ║
 * ║  Usage:                                              ║
 * ║    npx tsx src/scripts/setup_sip.ts                 ║
 * ╚══════════════════════════════════════════════════════╝
 */
import { SipClient } from 'livekit-server-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const LIVEKIT_URL    = process.env.LIVEKIT_URL        || '';
const LIVEKIT_KEY    = process.env.LIVEKIT_API_KEY    || '';
const LIVEKIT_SECRET = process.env.LIVEKIT_API_SECRET || '';

// The Twilio number being integrated
const TWILIO_NUMBER = '+12185683431';

// Twilio Elastic SIP Trunking IP ranges — whitelist these on the inbound trunk
const TWILIO_SIP_IPS = [
  '54.172.60.0/23',
  '54.244.51.0/24',
  '54.171.127.192/26',
  '35.156.191.128/25',
  '35.254.145.0/24',
  '52.215.127.0/24',
  '54.65.63.192/26',
  '54.169.127.128/26',
  '54.252.254.64/26',
  '177.71.206.192/26',
];

async function main() {
  console.log('\n' + '═'.repeat(55));
  console.log('  🔌  LiveKit SIP Setup for Twilio');
  console.log('═'.repeat(55));

  if (!LIVEKIT_URL || !LIVEKIT_KEY || !LIVEKIT_SECRET) {
    console.error('\n❌ Missing LiveKit credentials in .env.local');
    console.error('   Required: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET\n');
    process.exit(1);
  }

  // Strip wss:// → https:// for the SipClient HTTP API
  const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
  const sip = new SipClient(httpUrl, LIVEKIT_KEY, LIVEKIT_SECRET);

  // ─── STEP 1: Check existing inbound trunks ───────────────────────────────
  console.log('\n📋 Checking existing SIP Inbound Trunks...');
  const existingTrunks = await sip.listSipInboundTrunk();

  const alreadySetup = existingTrunks.find(t => t.name === 'twilio-inbound-trunk');
  let trunkId: string;

  if (alreadySetup) {
    console.log(`✅ Trunk already exists!`);
    console.log(`   ID:   ${alreadySetup.sipTrunkId}`);
    console.log(`   Name: ${alreadySetup.name}`);
    trunkId = alreadySetup.sipTrunkId;
  } else {
    // createSipInboundTrunk(name, numbers, opts)
    console.log('\n🏗️  Creating Inbound SIP Trunk...');
    const trunk = await sip.createSipInboundTrunk(
      'twilio-inbound-trunk',           // name
      [TWILIO_NUMBER],                   // numbers this trunk accepts calls from
      {
        allowedAddresses: TWILIO_SIP_IPS, // only accept SIP INVITE from Twilio IPs
      }
    );

    trunkId = trunk.sipTrunkId;
    console.log(`✅ Trunk created!`);
    console.log(`   ID:   ${trunkId}`);
    console.log(`   Name: twilio-inbound-trunk`);
  }

  // ─── STEP 2: Check existing dispatch rules ───────────────────────────────
  console.log('\n📋 Checking existing Dispatch Rules...');
  const existingRules = await sip.listSipDispatchRule();
  const alreadyDispatched = existingRules.find(r => r.name === 'twilio-dispatch-rule');

  if (alreadyDispatched) {
    console.log(`✅ Dispatch Rule already exists!`);
    console.log(`   ID: ${alreadyDispatched.sipDispatchRuleId}`);
  } else {
    // ─── STEP 3: Create Dispatch Rule ────────────────────────────────────
    // "individual" = each call gets its own unique room, so callers are isolated
    console.log('\n🏗️  Creating SIP Dispatch Rule...');
    const rule = await sip.createSipDispatchRule(
      {
        type: 'individual',  // Each caller → unique room (call-<uuid>)
        roomPrefix: 'call-',
      },
      {
        name: 'twilio-dispatch-rule',
        trunkIds: [trunkId],
        metadata: JSON.stringify({ source: 'twilio', number: TWILIO_NUMBER }),
      }
    );

    console.log(`✅ Dispatch Rule created!`);
    console.log(`   ID:   ${rule.sipDispatchRuleId}`);
    console.log(`   Name: twilio-dispatch-rule`);
  }

  // ─── STEP 4: Print Twilio Dashboard configuration instructions ───────────
  console.log('\n' + '═'.repeat(55));
  console.log('  🎉  LiveKit Side — DONE!');
  console.log('═'.repeat(55));
  console.log(`
📞 Now configure Twilio (takes ~3 minutes):

  1. Go to: https://console.twilio.com
     → Voice → Manage → TwiML Apps  (or use Elastic SIP Trunking)

  ─── OPTION A: Elastic SIP Trunk (Recommended) ─────────
  2. Voice → Trunking → Trunks → Create new Trunk
  3. Origination → Add Origination URI:

     ┌──────────────────────────────────────────────────┐
     │  sip:sip.livekit.cloud                           │
     │  Priority: 1 | Weight: 1                         │
     └──────────────────────────────────────────────────┘

  4. Numbers → Add → assign: ${TWILIO_NUMBER}

  ─── OPTION B: TwiML (Simpler, less features) ───────────
  2. Phone Numbers → ${TWILIO_NUMBER} → Voice config
  3. Set "A call comes in" → Webhook → POST to your server
     OR use a TwiML Bin with:
     <Response>
       <Dial>
         <Sip>sip:livekit@sip.livekit.cloud</Sip>
       </Dial>
     </Response>

✅ Once configured, calls to ${TWILIO_NUMBER} will route:
   Twilio → SIP → LiveKit → Your Voice Agent 🚀
`);

  console.log('─'.repeat(55));
  console.log('💡 Next: Register your Twilio number in Supabase:');
  console.log(`   npx tsx src/scripts/sync_prompt.ts src/prompts/twilio_demo.txt \\`);
  console.log(`     --name "XYZ Coaching (Demo)" --phone "${TWILIO_NUMBER}"`);
  console.log('─'.repeat(55) + '\n');
}

main().catch(err => {
  console.error('\n💥 Setup failed:', err?.message || err);
  process.exit(1);
});
