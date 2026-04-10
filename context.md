# Voice AI Receptionist Project - Context & History

This document serves as a complete memory bank of the project from concept to its current state.

## 🚀 The Vision
To build a scalable, lightning-fast Voice AI Receptionist SaaS for Indian Coaching Institutes (starting with "XYZ Coaching Institute"). The agent must handle inbound inquiries, answer FAQs (fees, batches), offer free demo classes, and collect lead data—sounding highly conversational and intelligent.

## 🛠️ Architecture Evolution
1. **Core Transport:** [LiveKit (WebRTC)](https://livekit.io) to handle ultra-low latency real-time bidirectional audio.
2. **STT & TTS (Ears & Mouth):** [Sarvam AI](https://sarvam.ai). We specifically selected Sarvam because its `saaras:v3` (codemix mode) and `bulbul:v3` are far superior at understanding and generating natural **Hinglish**, a massive advantage for the Indian market over generic western models.
3. **The Brain (LLM):** 
    * *Phase 1:* Started with Google **Gemini 1.5 Flash**. Encountered API versioning 404 errors.
    * *Phase 2:* Upgraded to **Gemini 2.5 Flash**, but immediately hit Google's strict Free Tier rate limits (429 errors), which ruined our latency by causing 20-second connection stalls.
    * *Phase 3 (Current):* Switched to **Groq (Llama-3.1-8b-instant)**. This solved the rate limits completely and dropped our "Time to First Token" to under 500ms.
4. **Database & Dashboard:** Implemented a full-stack dashboard (`index.html` via Express) powered by **Supabase PostgreSQL**. We built real-time WebSocket subscriptions so acquired leads appear on the receptionist's screen instantly. *(Note: Supabase tool integration is temporarily disabled in `agent.ts` to isolate core voice testing).*

## 🧠 Current Capabilites (Agent Logic)
*   **Latency Optimized:** Tuned LiveKit VAD (Voice Activity Detection) `minDelay` to 250ms for hyper-aggressive, instant conversational turn-taking.
*   **Session State Management:** The AI persona is instructed to track user sentiment. If a user is frustrated, it adopts a soothing tone.
*   **Adaptive Multilingualism:** Dynamically responds in Hindi, English, or Hinglish depending on what the user speaks.
*   **Contextual Memory:** Utilizing LiveKit's `ChatContext` so the AI remembers prior details (like the student's desired course) and does not awkwardly repeat questions.
*   **Observability:** Built custom millisecond-accurate `[PERF]` logging in the terminal to measure the exact latency of every call state.

## 🎯 Competitive Roadmap (vs. Vocal365)
We ran a deep analysis against a leading $499/mo competitor. 
*   **Where we win:** Response latency, Indian market localization (Hinglish), zero-cost serverless execution, and absolute data privacy.
*   **What we need to build next:**
    1.  Reconnect the Supabase `save_lead` tool.
    2.  Implement **SIP Trunking** (likely via Twilio) into LiveKit so the agent can answer an actual 10-digit PSTN phone number, moving the product from "web browser only" to a true telephone AI.
    3.  Implement LiveKit Room Handoff to transfer calls to a human manager.

## 📁 Repository Structure
*   `/src/agent.ts`: The core LiveKit WebRTC Node.js worker handling VAD, STT, LLM, and TTS orchestration.
*   `/src/server.ts`: Express server handling the frontend hosting.
*   `/src/index.html`: Tailwind-powered, Supabase-connected receptionist dashboard.
*   `.env.local`: Environment secrets (LiveKit, Sarvam, Groq, Supabase). *(Remember: LiveKit URL needs constant verifying if using ephemeral cloud demo server).*
