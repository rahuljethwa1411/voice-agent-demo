# Voice AI Receptionist Project - Context & History

This document serves as a complete memory bank of the project from concept to its current state.

## 🚀 The Vision
To build a scalable, lightning-fast Voice AI Receptionist SaaS for Indian Coaching Institutes. The agent acts as a full admissions counselor—answering queries about fees, batches, faculty, and demo classes, while capturing high-quality leads.

## 🛠️ Architecture Evolution
1. **Core Transport:** [LiveKit (WebRTC)](https://livekit.io) to handle ultra-low latency real-time bidirectional audio.
2. **STT & TTS (Ears & Mouth):** [Sarvam AI](https://sarvam.ai). Selected for superior **Hinglish** support (saaras:v3 and bulbul:v3 models).
3. **The Brain (LLM):** 
    * *Latest:* **Groq (Llama-3.3-70b-versatile)**. Optimized with a heavy system prompt for brevity and sales-driven conversation flows.
4. **Database & Dashboard:** 
    * Backend: **Supabase (PostgreSQL)**. 
    * Dashboard: **Express.js** server serving a minimal, shadcn-style UI with real-time polling.
    * Features: Lead interest tagging (🔥 Hot, 🟡 Warm, 🔵 Cold), AI summaries (notes), and CSV export.

## 🧠 Current Capabilities (Admissions Counselor v2)
*   **Rich Knowledge Base:** Complete course catalog for JEE, NEET, Boards, and Crash Courses with specific fees and timings.
*   **Sales Strategy:** Follows a 6-step funnel (Greet → Details → Pitch Demo → Gauge Interest → Collect Info → Close).
*   **Intelligent Logging:** Captures not just names, but also the student's interest level and a concise summary of the call.
*   **Brevity Optimized:** Aggressive constraints to keep responses short and punchy (15 words max).
*   **Zero-Trust Dashboard:** Supabase keys are kept strictly on the backend; the frontend polls a secure JSON API.

## 🎯 Competitive Roadmap
*   **Bypassing the "Middleware Tax":** We use raw APIs (Groq/Sarvam) and LiveKit directly, achieving cost of ~$0.02/min vs. competitors' $0.15/min.
*   **Next Phase Goals:**
    1.  **Telephony Integration:** Connect Exotel/Twilio SIP to LiveKit for real 10-digit number calls.
    2.  **Call Recordings:** Implement LiveKit Egress to save audio files and show a playback UI.
    3.  **WhatsApp Automation:** Auto-send marketing brochures after successful lead capture.
    4.  **Multi-tenancy:** Scale to support multiple coaching institutes on one server.

## 📁 Repository Structure
*   `src/agent/agent.ts`: Core LiveKit worker handling WebRTC and orchestration.
*   `src/dashboard/main.ts`: Express backend for the secure dashboard.
*   `src/dashboard/index.html`: Minimal Shadcn-style lead management UI.
*   `src/dashboard/pricing.html`: Public pricing page for SaaS offerings.
*   `src/services/intelligence_service.ts`: Admissions Counselor logic and the `save_lead` tool.
*   `src/services/sarvam_service.ts`: STT/TTS configuration for Hinglish.
*   `.env.local`: Environment secrets (LiveKit, Sarvam, Groq, Supabase).
