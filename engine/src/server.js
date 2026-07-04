import express from 'express';
import { generatePlan, budgetTrip } from './engine/aiPlanner.js';
import { maps, events as eventsProvider, stays as staysProvider, social } from './providers/index.js';
import * as store from './store.js';
import { DESTS, VENUES } from './data/seed.js';

const app = express();
app.use(express.json());

// CORS — let the deployed front end (Vercel) call this API (Railway).
// Set ALLOWED_ORIGIN in env to lock it to your domain; defaults to "*".
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-user');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (_req, res) => res.json({ app: 'Livo engine', ok: true }));

// tiny "auth": handle -> user. Real app: OAuth / magic link + JWT.
async function userFrom(req, res, next) {
  const handle = req.header('x-user') || req.query.user || req.body?.user;
  if (!handle) return res.status(401).json({ error: 'Provide a user handle via x-user header.' });
  req.user = await store.users.upsert(String(handle));
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, mode: process.env.DATABASE_URL ? 'pg' : 'memory' }));

// --- Planning ---
app.post('/api/plan', async (req, res) => {
  res.json(await generatePlan(req.body || {}));
});

app.post('/api/trips', (req, res) => {
  const { mood = 'any', nights = 5, tier = 'budget' } = req.body || {};
  let list = DESTS.filter(d => mood === 'any' || d.vibes.includes(mood));
  if (!list.length) list = DESTS;
  res.json(list.map(d => budgetTrip(d, nights, tier)).sort((a, b) => a.totalPerPerson - b.totalPerPerson));
});

// --- Group / office venue finder ---
app.post('/api/groups', (req, res) => {
  const { people = 10, occasion = 'office', vibe = 'any', maxPerHead = 999 } = req.body || {};
  let list = VENUES.filter(v => v.occ.includes(occasion) && v.head <= maxPerHead);
  if (vibe !== 'any') list = list.filter(v => v.vibes.includes(vibe));
  res.json(list.map(v => ({
    ...v, fits: people >= v.min && people <= v.max, total: v.head * people
  })).sort((a, b) => (b.fits - a.fits) || a.head - b.head));
});

// --- Eats / restaurants (live Google Places when PROVIDER_MAPS=live) ---
app.get('/api/eats', async (req, res) => {
  try {
    const near = req.query.near || 'Surrey, BC';
    const vibe = req.query.cuisine || undefined; // e.g. "Vietnamese", "Indian"
    const places = await maps.searchPlaces({ near, type: 'restaurant', vibe, lat: req.query.lat, lng: req.query.lng });
    res.json(places);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Photo proxy — streams a Google Places photo so the API key stays server-side.
app.get('/api/photo', async (req, res) => {
  const ref = req.query.ref, key = process.env.GOOGLE_PLACES_API_KEY;
  if (!ref || !key) return res.status(400).end();
  try {
    const url = 'https://places.googleapis.com/v1/' + ref + '/media?maxWidthPx=' + (req.query.w || 640) + '&key=' + key;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).end();
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=604800');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.status(502).end(); }
});

// --- Generic places (trails, cafes, parks, anything) — Google + Foursquare merged ---
app.get('/api/places', async (req, res) => {
  try {
    const near = req.query.near || 'Surrey, BC', type = req.query.type || 'restaurant', vibe = req.query.vibe;
    const lat = req.query.lat, lng = req.query.lng;
    const results = await Promise.allSettled([
      maps.searchPlaces({ near, type, vibe, lat, lng }),
      social.bestPlaces ? social.bestPlaces({ near, type, vibe }) : Promise.resolve([]),
    ]);
    const merged = [];
    const seen = new Set();
    for (const r of results) {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
      for (const p of r.value) {
        const key = (p.name || '').toLowerCase().slice(0, 24);
        if (seen.has(key)) continue; seen.add(key); merged.push(p);
      }
    }
    res.json(merged);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ===== Email accounts =====
async function hashPw(pw) { const { default: b } = await import('bcryptjs'); return b.hash(pw, 10); }
async function checkPw(pw, hash) { const { default: b } = await import('bcryptjs'); return b.compare(pw, hash); }
async function signToken(user) { const { default: jwt } = await import('jsonwebtoken'); return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '60d' }); }
async function verifyToken(req) {
  const h = req.header('authorization') || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : null; if (!t) return null;
  try { const { default: jwt } = await import('jsonwebtoken'); return jwt.verify(t, process.env.JWT_SECRET || 'dev-secret'); } catch { return null; }
}
const slug = (s) => (s || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'user';

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email and a 6+ char password required.' });
  if (await store.auth.findByEmail(email)) return res.status(409).json({ error: 'That email is already registered. Try logging in.' });
  const user = await store.auth.create({ email, passwordHash: await hashPw(password), handle: slug(email) });
  res.json({ token: await signToken(user), user: { id: user.id, email: user.email, handle: user.handle } });
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await store.auth.findByEmail(email || '');
  if (!user || !(await checkPw(password || '', user.password_hash))) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: await signToken(user), user: { id: user.id, email: user.email, handle: user.handle } });
});

// ===== Cross-device data sync (the whole app blob, per user) =====
app.get('/api/sync', async (req, res) => {
  const tok = await verifyToken(req); if (!tok) return res.status(401).json({ error: 'Sign in first.' });
  res.json({ blob: await store.data.get(tok.id) });
});
app.put('/api/sync', async (req, res) => {
  const tok = await verifyToken(req); if (!tok) return res.status(401).json({ error: 'Sign in first.' });
  await store.data.put(tok.id, req.body?.blob || {}); res.json({ ok: true });
});

// ===== Shared plans — "roam together" invites + RSVP =====
app.post('/api/plans', async (req, res) => {
  const { title, items, by } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  res.json(await store.plans.create({ title, items, by }));
});
app.get('/api/plans/:id', async (req, res) => {
  const p = await store.plans.get(req.params.id); if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});
app.post('/api/plans/:id/rsvp', async (req, res) => {
  res.json({ going: await store.plans.rsvp(req.params.id, (req.body && req.body.who) || 'someone') });
});

// --- AI planner assistant (Claude) ---
async function chatReply({ message = '', history = [], context = {} }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { reply: "The assistant needs ANTHROPIC_API_KEY set on the server to chat. (Your schedule parser still works in the app.)", schedule: [], _noKey: true };
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sys = "You are Livo — a warm, thoughtful personal life-guide who chats naturally, like a caring friend who happens to know the person's area really well. " +
    "Talk like a real person: friendly, genuine, encouraging, specific. Never robotic, never a bland bulleted list. Give real, useful guidance for their day and life — suggest concrete ideas, ask a gentle follow-up question when it would help, celebrate small wins, and keep it human and kind. " +
    "The person is around " + (context.loc || 'their city') + " and tends to enjoy " + ((context.interests || []).join(', ') || 'a mix of things') + " — weave that in when it makes a suggestion more concrete and local. " +
    "If they describe a routine or ask you to plan/schedule a day with times, ALSO build a schedule for them. " +
    "Respond ONLY as JSON: {\"reply\":\"<your natural, conversational reply — a few warm sentences, real advice>\",\"schedule\":[{\"time\":\"HH:MM\",\"title\":\"...\"}]}. " +
    "Put ALL of your conversational words in \"reply\". Use 24h HH:MM times. Leave \"schedule\" as [] when no timeline is needed.";
  const msgs = history.filter(h => h.role === 'user' || h.role === 'assistant').map(h => ({ role: h.role, content: String(h.content || '') }));
  msgs.push({ role: 'user', content: message });
  const out = await client.messages.create({ model: process.env.AI_MODEL || 'claude-opus-4-8', max_tokens: 1024, system: sys, messages: msgs });
  const text = out.content.map(b => b.text || '').join('');
  let parsed; try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); }
  catch { parsed = { reply: text.trim() || "Here's what I'd suggest.", schedule: [] }; }
  return { reply: parsed.reply || '', schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [], model: process.env.AI_MODEL || 'claude-opus-4-8' };
}
app.post('/api/chat', async (req, res) => {
  try { res.json(await chatReply(req.body || {})); }
  catch (e) { res.status(502).json({ reply: "Assistant error: " + e.message, schedule: [] }); }
});
// GET tester so you (and diagnostics) can verify Claude is live: /api/chat-test?q=hi
app.get('/api/chat-test', async (req, res) => {
  try { res.json(await chatReply({ message: req.query.q || "Say hi and suggest a relaxing Sunday.", context: { loc: req.query.near || 'Surrey, BC' } })); }
  catch (e) { res.status(502).json({ reply: "error: " + e.message, schedule: [] }); }
});

// --- Events feed (provider-backed) ---
app.get('/api/events', async (req, res) => {
  try { res.json(await eventsProvider.search({ near: req.query.near, vibe: req.query.vibe })); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

// --- "Best places" (social/curated) ---
app.get('/api/best', async (req, res) => {
  res.json(await social.bestPlaces({ vibe: req.query.vibe }));
});

// --- Stays ---
app.get('/api/stays', async (req, res) => {
  res.json(await staysProvider.search({ guests: +(req.query.guests || 2), maxNightly: +(req.query.maxNightly || 9999) }));
});

// --- Community meetups (AI-drafted, joinable) ---
app.post('/api/meetups', userFrom, async (req, res) => {
  const { idea = 'a casual hangout', vibe = 'calm' } = req.body || {};
  const best = (await social.bestPlaces({ vibe }))[0];
  const wantSun = vibe === 'calm' || vibe === 'nature';
  const d = new Date(); d.setDate(d.getDate() + ((wantSun ? 0 : 6) - d.getDay() + 7) % 7 || 7);
  const m = await store.meetups.create({
    title: `${vibe} meetup — ${idea}`.slice(0, 120),
    venue: best ? best.name : 'TBD', startsAt: d.toISOString(),
    vibe, createdBy: req.user.id,
  });
  res.json(m);
});
app.get('/api/meetups', async (_req, res) => res.json(await store.meetups.list()));
app.post('/api/meetups/:id/rsvp', userFrom, async (req, res) => {
  res.json({ interested: await store.meetups.rsvp(req.params.id, req.user.id) });
});

// --- Personal calendar ---
app.get('/api/calendar', userFrom, async (req, res) => res.json(await store.calendar.list(req.user.id)));
app.post('/api/calendar', userFrom, async (req, res) => res.json(await store.calendar.add(req.user.id, req.body)));
app.delete('/api/calendar/:id', userFrom, async (req, res) => { await store.calendar.remove(req.user.id, req.params.id); res.json({ ok: true }); });

const PORT = process.env.PORT || 8787;
store.init().then(() => app.listen(PORT, () => console.log(`LocalEscape engine on :${PORT}`)));

export default app;
