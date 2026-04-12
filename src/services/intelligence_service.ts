import * as openai from '@livekit/agents-plugin-openai';
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export function getLLM() {
  return openai.LLM.withGroq({
    model: 'llama-3.3-70b-versatile',
  });
}

// system_prompt is now fetched from Supabase directly in agent.ts


export function getTools(supabase: SupabaseClient, ownerId: string) {
  const save_lead = llm.tool({
    description: 'Save a student lead to the database. Call this IMMEDIATELY when you have their name and course. Do not delay.',
    parameters: z.object({
      name: z.string().describe('Full name of the student or parent'),
      course: z.string().describe('Course interested in: JEE, NEET, Boards-10, Boards-11, Boards-12, or Crash-Course'),
      interest_level: z.enum(['hot', 'warm', 'cold']).describe('hot = asking about payment/admission, warm = wants demo, cold = just browsing'),
      notes: z.string().describe('Brief 1-line summary of what the caller asked about. Example: "Asked about NEET evening batch fees, wants demo on Sunday"'),
    }),
    execute: async ({ name, course, interest_level, notes }) => {
      // Guard: Don't save leads with empty or placeholder names
      if (!name || name.trim().length < 2) {
        console.log(`[TOOL] ⚠️ Rejected save_lead — name is empty. Ask for name first.`);
        return "You don't have the student's name yet. Ask for their name before saving.";
      }
      console.log(`[TOOL] 💾 Saving lead: ${name} | ${course} | ${interest_level} | ${notes}`);
      try {
        const { error } = await supabase.from('leads').insert([
          { 
            name: name.trim(), 
            course: course || 'General Inquiry', 
            status: interest_level || 'warm', 
            notes: notes || 'No additional notes',
            owner_id: ownerId 
          }
        ]);
        if (error) {
          console.error('[TOOL] Supabase insert error:', error.message);
          return "Failed to save lead. Continue the conversation normally.";
        }
        console.log(`[TOOL] ✅ Lead saved successfully: ${name} (${interest_level})`);
        return `Lead saved successfully. The student's demo seat is reserved. Acknowledge warmly by name and confirm the demo schedule for their course.`;
      } catch (e) {
        console.error('[TOOL] System error:', e);
        return "Failed to save lead. Continue the conversation normally.";
      }
    },
  });

  return { save_lead };
}
