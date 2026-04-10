/**
 * Diagnostic: Tests Supabase insert AND Groq tool-calling independently.
 * Run: npx tsx src/tests/diagnose.ts
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function testSupabase() {
  console.log('\n========== TEST 1: SUPABASE INSERT ==========');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  console.log(`URL: ${url}`);
  console.log(`Key prefix: ${key?.substring(0, 10)}...`);

  const supabase = createClient(url || '', key || '');

  const { data, error } = await supabase
    .from('leads')
    .insert([{ name: 'DiagnosticBot', course: 'JEE', status: 'new' }])
    .select();

  if (error) {
    console.error('❌ SUPABASE FAILED:', error.message);
    console.error('   Full error:', JSON.stringify(error));
  } else {
    console.log('✅ SUPABASE OK! Inserted row:', JSON.stringify(data));
  }
}

async function testGroqToolCall() {
  console.log('\n========== TEST 2: GROQ TOOL CALLING ==========');
  const apiKey = process.env.GROQ_API_KEY;
  console.log(`Groq Key prefix: ${apiKey?.substring(0, 10)}...`);

  const groq = new Groq({ apiKey });

  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'save_lead',
        description: 'Save a student lead to the database.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Student name' },
            course: { type: 'string', description: 'Course interested in' },
          },
          required: ['name', 'course'],
        },
      },
    },
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a receptionist. When a user gives their name and course, you MUST call the save_lead tool.' },
      { role: 'user', content: 'Mera naam Rahul hai aur main NEET course lena chahta hoon.' },
    ],
    tools,
    tool_choice: 'auto',
  });

  const choice = response.choices[0];
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    console.log('✅ GROQ TOOL CALL OK!');
    for (const tc of choice.message.tool_calls) {
      console.log(`   Function: ${tc.function.name}`);
      console.log(`   Args: ${tc.function.arguments}`);
    }
  } else {
    console.log('❌ GROQ DID NOT CALL THE TOOL. It replied with text instead:');
    console.log(`   "${choice.message.content}"`);
  }
}

async function main() {
  console.log('🔍 Running Voice AI Diagnostics...\n');
  await testSupabase();
  await testGroqToolCall();
  console.log('\n========== DONE ==========');
}

main().catch(console.error);
