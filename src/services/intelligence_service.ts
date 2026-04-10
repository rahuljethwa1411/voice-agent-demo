import * as openai from '@livekit/agents-plugin-openai';
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export function getLLM() {
  return openai.LLM.withGroq({
    model: 'llama-3.3-70b-versatile',
  });
}

export function getInstructions(): string {
  return `🌟 PERSONA:
- You are a professional, polite, and helpful receptionist for XYZ Coaching Institute.
- You communicate respectfully and formally with students and parents. Do not use overly friendly, romantic, or casual language.

💬 CONVERSATION STYLE:
- ADAPTIVE: Respond in the language the user uses (Hindi, English, or Hinglish).
- GREETING: Start with "Namaste! XYZ coaching se bol raha hoon..."
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
- CRITICAL TOOL RULE: The exact moment the user provides their Name and Course, YOU MUST EXECUTE the 'save_lead' tool in the background. DO NOT just reply with text. Execute the tool to save the database record, then acknowledge warmly!`;
}

export function getTools(supabase: SupabaseClient) {
  const save_lead = llm.tool({
    description: 'Save a student lead to the database. Call this immediately when you get their name and course.',
    parameters: z.object({
      name: z.string().describe('The name of the student'),
      course: z.string().describe('The course they are interested in (e.g., JEE, NEET, 10th)'),
    }),
    execute: async ({ name, course }) => {
      console.log(`[TOOL] 💾 Saving lead to DB: ${name} (${course})`);
      try {
        const { error } = await supabase.from('leads').insert([
          { name, course, status: 'new' }
        ]);
        if (error) {
          console.error('[TOOL] Supabase insert error:', error.message);
          return "Failed to save lead.";
        }
        return "Lead saved successfully. Acknowledge warmly and say Namaste.";
      } catch (e) {
        console.error('[TOOL] System error:', e);
        return "Failed to save lead.";
      }
    },
  });

  return { save_lead };
}
