import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, User } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// ═══════════════════════════════════════════════════════
// SUPABASE CLIENT (Service Role — backend only, NEVER exposed)
// ═══════════════════════════════════════════════════════════
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

const app = express();
const PORT = 3000;

// ═══════════════════════════════════════════════════════
// SECURITY: Infrastructure Config
// ═══════════════════════════════════════════════════════════

// Trust proxy (required for accurate rate limiting behind Railway/Render)
app.set('trust proxy', 1);

// Basic HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY'); // Prevent Clickjacking
  res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME sniffing
  next();
});

// Parse JSON bodies for auth routes
app.use(express.json());

// ═══════════════════════════════════════════════════════
// SECURITY: Rate limiting (prevent brute force attacks)
// ═══════════════════════════════════════════════════════════
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // max 10 attempts per window

function rateLimitCheck(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.lastAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true; // allowed
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false; // blocked
  }

  record.count++;
  record.lastAttempt = now;
  return true; // allowed
}

// ═══════════════════════════════════════════════════════
// SECURITY: JWT Token Extraction & Verification Middleware
// ═══════════════════════════════════════════════════════════
interface AuthRequest extends Request {
  user?: User;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed token' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer '

  // Empty token check
  if (!token || token.length < 10) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Supabase verifies the JWT signature, expiry, and integrity
    // This uses the service_role key to validate the token server-side
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach verified user to request object
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

// ═══════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════

// POST /api/auth/signup — Create new account
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!rateLimitCheck(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { email, password, name } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input types' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const authClient = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '', { auth: { persistSession: false, autoRefreshToken: false } });
  
  const { data, error } = await authClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name: (name || email.split('@')[0]).substring(0, 100) }
    }
  });

  if (error) return res.status(400).json({ error: error.message });

  // If Supabase returns a session (email confirmation disabled)
  if (data.session) {
    return res.json({
      access_token: data.session.access_token,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.user_metadata?.name || email
      }
    });
  }

  // If email confirmation is enabled
  return res.json({
    access_token: null,
    message: 'Check your email to confirm your account',
    user: { id: data.user?.id, email: data.user?.email, name }
  });
});

// POST /api/auth/login — Sign in, get JWT
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!rateLimitCheck(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input types' });
  }

  const authClient = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '', { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await authClient.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    // Generic error message to prevent user enumeration
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({
    access_token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || data.user.email
    }
  });
});

// GET /api/auth/me — Verify token and return user info
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email
  });
});

// ═══════════════════════════════════════════════════════
// LEADS API (Protected — requires valid JWT)
// ═══════════════════════════════════════════════════════════

// GET /api/leads — Returns ONLY the authenticated user's leads
app.get('/api/leads', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  console.log('API /leads called for user:', user.id);
  console.log('Result count:', data?.length);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ═══════════════════════════════════════════════════════
// ANALYTICS API (Protected — requires valid JWT)
// ═══════════════════════════════════════════════════════════

app.get('/api/analytics', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  const { data: leads, error } = await supabase
    .from('leads')
    .select('status, course, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const allLeads = leads || [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // --- Daily Leads (last 14 days) ---
  const dailyMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  allLeads.forEach(l => {
    const day = l.created_at?.slice(0, 10);
    if (day && day in dailyMap) dailyMap[day]++;
  });
  const dailyLeads = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  // --- Hourly Distribution ---
  const hourly = new Array(24).fill(0);
  allLeads.forEach(l => {
    if (l.created_at) {
      const h = new Date(l.created_at).getHours();
      hourly[h]++;
    }
  });
  const hourlyDistribution = hourly.map((count, hour) => ({ hour, count }));

  // --- Course Breakdown ---
  const courseMap: Record<string, number> = {};
  allLeads.forEach(l => {
    const c = l.course || 'Other';
    courseMap[c] = (courseMap[c] || 0) + 1;
  });
  const courseBreakdown = Object.entries(courseMap)
    .map(([course, count]) => ({ course, count }))
    .sort((a, b) => b.count - a.count);

  // --- Funnel ---
  const total = allLeads.length;
  const warm = allLeads.filter(l => l.status === 'warm' || l.status === 'hot').length;
  const hot = allLeads.filter(l => l.status === 'hot').length;
  const funnel = { total, warm, hot };

  // --- Today Count ---
  const todayCount = allLeads.filter(l => l.created_at?.slice(0, 10) === todayStr).length;

  // --- Conversion Rate ---
  const conversionRate = total > 0 ? Math.round((hot / total) * 100) : 0;

  console.log(`API /analytics called for user: ${user.id} | ${total} leads`);
  res.json({ dailyLeads, hourlyDistribution, courseBreakdown, funnel, todayCount, conversionRate });
});

// ═══════════════════════════════════════════════════════
// DEMO SANDBOX API (Optional, no auth needed to test)
// ═══════════════════════════════════════════════════════════

app.get('/api/demo/token', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { data: client } = await supabase
      .from('clients')
      .select('phone_number')
      .eq('owner_id', user.id)
      .single();

    const userPhone = client?.phone_number ? client.phone_number.replace('+', '') : '9999999999';
    
    // Add the "web-demo-" prefix so agent.ts knows to use the mock Twilio parsing
    const roomName = `web-demo-${userPhone}-${Math.floor(Math.random() * 10000)}`;
    const participantName = `guest-${Math.floor(Math.random() * 10000)}`;
    
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wssUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wssUrl) {
      return res.status(500).json({ success: false, error: 'LiveKit credentials missing' });
    }

    const { AccessToken, AgentDispatchClient } = require('livekit-server-sdk');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    
    const token = await at.toJwt();
    
    // EXPLICITLY dispatch an agent to this room so the per-job worker joins
    const httpUrl = wssUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    const dispatchClient = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    await dispatchClient.createDispatch(roomName, '');

    res.json({ success: true, url: wssUrl, token });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// ═══════════════════════════════════════════════════════
// STATIC FILES & ROUTES
// ═══════════════════════════════════════════════════════════

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Pricing page
app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

// Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Dashboard live at http://localhost:${PORT}`);
});
