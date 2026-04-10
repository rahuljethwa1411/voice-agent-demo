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

export default defineAgent({
  entry: async (ctx: JobContext) => {
    try {
      const vad = await silero.VAD.load();
      
      const instructions = getInstructions();
      const tools = getTools(supabase);
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

      const handle = session.say(
        'Namaste! XYZ Coaching Institute mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?',
        { allowInterruptions: true }
      );

      await handle.waitForPlayout();
      console.log("✅ Greeting playback finished.");
    } catch (error) {
      console.error('Fatal error in agent session:', error);
    }
  },
});

cli.runApp(new WorkerOptions({ agent: __filename }));
