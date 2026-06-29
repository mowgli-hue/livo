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
    const places = await maps.searchPlaces({ near, type: 'restaurant', vibe });
    res.json(places);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// --- Generic places (trails, cafes, parks, anything) ---
app.get('/api/places', async (req, res) => {
  try {
    const places = await maps.searchPlaces({ near: req.query.near || 'Surrey, BC', type: req.query.type || 'restaurant', vibe: req.query.vibe });
    res.json(places);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// --- AI planner assistant (Claude) ---
app.post('/api/chat', async (req, res) => {
  const { message = '', history = [], context = {} } = req.body || {};
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ reply: "The assistant needs ANTHROPIC_API_KEY set on the server to chat. (Your schedule parser still works in the app.)", schedule: [] });
  }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sys = "You are Livo's warm, concise planning assistant. The user may describe a daily routine, ask to plan a day/weekend, or chat. " +
      "When they describe activities or ask to schedule, ALWAYS return a schedule. " +
      "Their location is " + (context.loc || 'unknown') + " and their interests are " + ((context.interests || []).join(', ') || 'unknown') + ". " +
      "Reply with STRICT JSON only: {\"reply\":\"<friendly 1-3 sentence reply>\",\"schedule\":[{\"time\":\"HH:MM\",\"title\":\"...\"}]}. " +
      "Use 24h HH:MM times. If no scheduling is needed, return an empty schedule array.";
    const msgs = history.filter(h => h.role === 'user' || h.role === 'assistant')
      .map(h => ({ role: h.role, content: String(h.content || '') }));
    msgs.push({ role: 'user', content: message });
    const out = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-opus-4-8',
      max_tokens: 700, system: sys, messages: msgs,
    });
    const text = out.content.map(b => b.text || '').join('');
    let parsed; try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); }
    catch { parsed = { reply: text.trim() || "Here's what I'd suggest.", schedule: [] }; }
    res.json({ reply: parsed.reply || '', schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [] });
  } catch (e) {
    res.status(502).json({ reply: "Assistant error: " + e.message, schedule: [] });
  }
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
