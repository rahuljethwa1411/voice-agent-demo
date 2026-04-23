# Voice AI SaaS — Quick Reference Commands
═══════════════════════════════════════════════

## 🚀 Run the System
```bash
npm run voice        # Start the AI voice agent
npm run dashboard    # Start the lead dashboard (localhost:3000)
```

## 📞 Twilio SIP Setup (Run ONCE)
```bash
# Creates LiveKit SIP Trunk + Dispatch Rule for +12185683431
npx tsx src/scripts/setup_sip.ts
```

## 📋 Client Management
```bash
# List all clients
npx tsx src/scripts/sync_prompt.ts --list

# Create a NEW client + sync their prompt (one command)
npx tsx src/scripts/sync_prompt.ts src/prompts/new_client.txt --name "ABC Coaching" --phone "+919876543210"

# Update an EXISTING client's prompt
npx tsx src/scripts/sync_prompt.ts src/prompts/xyz_coaching.txt <owner_id>
```

## 🩺 Diagnostics
```bash
# Check database health
npx tsx src/scripts/db_check.ts
```

## 📂 New Client Onboarding (3 Steps)
1. Copy the template:
   ```bash
   copy src\prompts\_TEMPLATE.txt src\prompts\new_client.txt
   ```
2. Edit `new_client.txt` — replace all [BRACKETS] with client's real info.
3. Run:
   ```bash
   npx tsx src/scripts/sync_prompt.ts src/prompts/new_client.txt --name "Client Name" --phone "+91XXXXXXXXXX"
   ```

## 🔑 Current Clients
| Client | Phone | Owner ID |
|:---|:---|:---|
| XYZ Coaching Jaipur | +919999999999 | 79ec46f9-611f-457e-b88c-149226960520 |
| XYZ Coaching (Twilio Demo) | +12185683431 | 79ec46f9-611f-457e-b88c-149226960520 |
