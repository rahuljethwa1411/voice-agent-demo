import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// --- Services ---
import { getLLM, getInstructions, getTools } from '../services/intelligence_service.js';
import { getSTT, getTTS } from '../services/sarvam_service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

/**
 * PRODUCTION HEALTH CHECK
 * Ensures all required environment keys are present before starting any session.
 */
function checkEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_KEY', 'GROQ_API_KEY', 'SARVAM_API_KEY', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('\n' + '█'.repeat(50));
    console.error('🛑 CRITICAL CONFIG ERROR: Missing Env Variables');
    console.error('The following keys must be set in .env.local:');
    missing.forEach(k => console.error(` - ${k}`));
    console.error('█'.repeat(50) + '\n');
    return false;
  }
  return true;
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    try {
      if (!checkEnv()) return;

      const vad = await silero.VAD.load();
      
      // Get the dialed number (hardcoded fallback for web testing until SIP is connected)
      // In production, this will use ctx.participant.metadata['sip.to']
      const dialedNumber = '+919999999999';
      
      console.log(`[ROUTING] Looking up client for number: ${dialedNumber}`);
      const { data: client, error: dbError } = await supabase
        .from('clients')
        .select('system_prompt, owner_id, company_name')
        .eq('phone_number', dialedNumber)
        .single();
        
      let instructions = '';
      let tools = {};
      let greeting = '';

      if (dbError || !client) {
        console.warn(`⚠️ Routing failed for ${dialedNumber}. Using fallback persona.`);
        instructions = `
          You are a helpful automated assistant for a business. 
          There is currently a technical issue connecting to the specific business records.
          Be extremely polite. Apologize for the inconvenience. 
          Ask for the caller's name and message, and tell them an agent will call them back.
        `;
        tools = getTools(supabase, '79ec46f9-611f-457e-b88c-149226960520'); // Use admin ID for fallback
        greeting = "Hello! I am sorry, but we are experiencing a temporary technical issue. How can I help you by taking a message?";
      } else {
        console.log(`✅ Loaded brain for: ${client.company_name}`);
        instructions = client.system_prompt;
        tools = getTools(supabase, client.owner_id);
        greeting = `Namaste! ${client.company_name} mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?`;
      }
      const chatContext = new llm.ChatContext();

      const session = new voice.AgentSession({
        llm: getLLM(),
        stt: getSTT(),
        tts: getTTS(),
        vad,
        turnHandling: {
          turnDetection: 'vad',
          endpointing: { minDelay: 250 },
        },
      });

      // Observability & Telemetry
      let lastSTTTime = 0;
      let ttff_recorded = false;

      session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
        lastSTTTime = Date.now();
        ttff_recorded = false;
        console.log(`[USER] ${ev.transcript}`);
      });

      session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
        if (ev.newState === 'speaking' && !ttff_recorded && lastSTTTime > 0) {
          console.log(`[PERF] Time to First Word: ${Date.now() - lastSTTTime}ms ⚡`);
          ttff_recorded = true;
        }
        console.log(`[STATE] ${ev.newState}`);
      });

      session.on(voice.AgentSessionEventTypes.Error, (ev) => console.error(`[ERROR] `, ev.error));

      const agent = new voice.Agent({
        instructions,
        chatCtx: chatContext,
        tools,
      });

      console.log(`🚀 Connecting to room: ${ctx.room.name}`);
      await ctx.connect();

      console.log("🔊 Starting audio session...");
      await session.start({ room: ctx.room, agent });

      const handle = session.say(greeting, { allowInterruptions: true });

      await handle.waitForPlayout();
      console.log("✅ Greeting playback finished.");
    } catch (error) {
      console.error('Fatal error in agent session:', error);
    }
  },
});

cli.runApp(new WorkerOptions({ agent: __filename }));
