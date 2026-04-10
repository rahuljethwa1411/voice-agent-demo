import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as sarvam from '@livekit/agents-plugin-sarvam';
import * as silero from '@livekit/agents-plugin-silero';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// --- SaaS Validation ---
const REQUIRED_ENV = ['SARVAM_API_KEY', 'GROQ_API_KEY', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Initialize Supabase Client (Disabled for now per user request)
/*
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);
*/

export default defineAgent({
  entry: async (ctx: JobContext) => {
    try {
      const vad = await silero.VAD.load();

      const instructions = `🌟 PERSONA:
- You are a human-like, warm receptionist for XYZ Coaching Institute.
- You speak like a trusted friend who understands a student's career goals.

💬 CONVERSATION STYLE:
- ADAPTIVE: Respond in the language the user uses (Hindi, English, or Hinglish).
- GREETING: Start with "Namaste! XYZ coaching se bol rahi hoon..."
- SNAPPY: Keep responses extremely concise (Max 10-12 words).
- CONTEXT: Remember chat history; never repeat questions if already answered.

📚 KNOWLEDGE BASE:
- JEE/NEET: ₹15,000. BOARDS (10/11/12): ₹12,000.
- BATCHES: Morning (8-11 AM), Evening (4-7 PM).
- DEMO: Free demo class available tomorrow (kal).

🎯 YOUR APPROACH:
- Provide course info first, then proactively offer the Free Demo.
- Give one piece of info at a time and wait for them to respond.

🗓️ SCHEDULING & DATA COLLECTION:
- If interest is shown in a demo, say: "Main aapki seat book kar deti hoon. Aapka Name aur Course kya hai?"
- Once they provide details, acknowledge warmly and say the team will call them.`;

      // const save_lead = llm.tool({ ... }) (Temporarily Disabled for Isolation Test)

      const chatContext = new llm.ChatContext();

      const session = new voice.AgentSession({
        llm: openai.LLM.withGroq({
          model: 'llama-3.1-8b-instant',
        }),
        stt: new sarvam.STT({
          languageCode: 'hi-IN',
          model: 'saaras:v3',
          mode: 'codemix', // Optimized for Hinglish (Hindi + English mix)
        }),
        tts: new sarvam.TTS({
          model: 'bulbul:v3',
          targetLanguageCode: 'hi-IN',
          speaker: 'anand',
        }),
        vad,
        turnHandling: {
          turnDetection: 'vad',
          endpointing: {
            minDelay: 250, // Ultra-fast turnaround for SaaS responsiveness
          },
        },
      });

      // --- SaaS Observability: Performance & UX Tracking ---
      let lastSTTTime = 0;
      let ttff_recorded = false;

      session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
        lastSTTTime = Date.now();
        ttff_recorded = false;
        console.log(`[USER] ${ev.transcript}`);
      });

      session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
        if (ev.newState === 'speaking' && !ttff_recorded && lastSTTTime > 0) {
          const diff = Date.now() - lastSTTTime;
          console.log(`[PERF] Time to First Word: ${diff}ms ⚡`);
          ttff_recorded = true;
        }
        console.log(`[STATE] ${ev.newState}`);
      });

      session.on(voice.AgentSessionEventTypes.Error, (ev) => {
        console.error(`[ERROR] Session Error:`, ev.error);
      });

      const agent = new voice.Agent({
        instructions,
        chatCtx: chatContext,
        // tools: { save_lead },
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

cli.runApp(new WorkerOptions({
  agent: __filename,
}));
