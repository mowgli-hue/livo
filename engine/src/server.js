import express from 'express';
import { generatePlan, budgetTrip } from './engine/aiPlanner.js';
import { events as eventsProvider, stays as staysProvider, social } from './providers/index.js';
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

// --- Events feed (provider-backed) ---
app.get('/api/events', async (req, res) => {
  res.json(await eventsProvider.search({ vibe: req.query.vibe }));
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
