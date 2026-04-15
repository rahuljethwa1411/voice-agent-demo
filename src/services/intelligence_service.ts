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


export function getTools(supabase: SupabaseClient, ownerId: string, callerId?: string) {
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
      console.log(`[TOOL] 💾 Saving lead: ${name} | ${course} | ${interest_level} | ${notes} | Phone: ${callerId || 'Unknown'}`);
      try {
        // DEDUP STRATEGY:
        // - If we have a real phone number: dedup by phone (unique per caller, even if names match)
        // - If anonymous (web test): dedup by name within a 30-min window (same session)
        let query = supabase
          .from('leads')
          .select('id')
          .eq('owner_id', ownerId);

        const hasRealPhone = callerId && callerId !== 'Anonymous' && callerId !== 'Unknown';

        if (hasRealPhone) {
          // Two different people (Rohan Sharma & Rohan Kumar) have different phone numbers → no collision
          query = query.eq('phone_number', callerId);
        } else {
          // Fallback for web testing: dedup by name within the current session (30 min)
          const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          query = query.ilike('name', name.trim()).gte('created_at', thirtyMinAgo);
        }

        const { data: existing } = await query.limit(1);

        if (existing && existing.length > 0) {
          // UPDATE the existing lead instead of creating a duplicate
          const { error: updateErr } = await supabase
            .from('leads')
            .update({
              name: name.trim(),
              course: course || 'General Inquiry',
              status: interest_level || 'warm',
              notes: notes || 'No additional notes',
              phone_number: callerId || null,
            })
            .eq('id', existing[0].id);

          if (updateErr) {
            console.error('[TOOL] Supabase update error:', updateErr.message);
            return "Failed to update lead. Continue the conversation normally.";
          }
          console.log(`[TOOL] 🔄 Lead updated (dedup): ${name} (${interest_level})`);
          return `Lead saved successfully. The student's demo seat is reserved. Acknowledge warmly by name and confirm the demo schedule for their course.`;
        }

        const { error } = await supabase.from('leads').insert([
          {
            name: name.trim(),
            course: course || 'General Inquiry',
            status: interest_level || 'warm',
            notes: notes || 'No additional notes',
            owner_id: ownerId,
            phone_number: callerId || null
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
