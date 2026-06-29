// Persistence layer. Uses Postgres when DATABASE_URL is set, otherwise an
// in-memory store so the scaffold runs with zero setup. Same async API either way.

const memory = { users: new Map(), items: new Map(), meetups: new Map(), rsvps: new Map(), data: new Map(), plans: new Map() };
let pg = null;

export async function init() {
  if (process.env.DATABASE_URL) {
    try {
      const { default: pkg } = await import('pg');
      pg = new pkg.Pool({ connectionString: process.env.DATABASE_URL });
      await pg.query('SELECT 1');
      console.log('[store] Postgres connected');
    } catch (e) {
      console.warn('[store] Postgres unavailable, using in-memory:', e.message);
      pg = null;
    }
  } else {
    console.log('[store] No DATABASE_URL — using in-memory store');
  }
}

const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const users = {
  async upsert(handle) {
    if (pg) { const r = await pg.query(
      'INSERT INTO users(handle) VALUES($1) ON CONFLICT(handle) DO UPDATE SET handle=EXCLUDED.handle RETURNING *', [handle]);
      return r.rows[0]; }
    if (![...memory.users.values()].find(u => u.handle === handle)) {
      const u = { id: uid('u'), handle }; memory.users.set(u.id, u);
    }
    return [...memory.users.values()].find(u => u.handle === handle);
  }
};

export const calendar = {
  async list(userId) {
    if (pg) return (await pg.query('SELECT * FROM calendar_items WHERE user_id=$1 ORDER BY date', [userId])).rows;
    return [...memory.items.values()].filter(i => i.user_id === userId).sort((a, b) => a.date < b.date ? -1 : 1);
  },
  async add(userId, { title, sub, type, date }) {
    if (pg) return (await pg.query(
      'INSERT INTO calendar_items(user_id,title,sub,type,date) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [userId, title, sub, type, date])).rows[0];
    const it = { id: uid('c'), user_id: userId, title, sub, type, date }; memory.items.set(it.id, it); return it;
  },
  async remove(userId, id) {
    if (pg) { await pg.query('DELETE FROM calendar_items WHERE id=$1 AND user_id=$2', [id, userId]); return; }
    const it = memory.items.get(id); if (it && it.user_id === userId) memory.items.delete(id);
  }
};

export const meetups = {
  async list() {
    if (pg) return (await pg.query('SELECT * FROM community_events ORDER BY starts_at')).rows;
    return [...memory.meetups.values()];
  },
  async create(data) {
    if (pg) return (await pg.query(
      'INSERT INTO community_events(title,venue,starts_at,vibe,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [data.title, data.venue, data.startsAt, data.vibe, data.createdBy || null])).rows[0];
    const m = { id: uid('m'), interested: 0, ...data }; memory.meetups.set(m.id, m); return m;
  },
  async rsvp(meetupId, userId) {
    if (pg) { await pg.query(
      'INSERT INTO rsvps(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [meetupId, userId]);
      return (await pg.query('SELECT count(*)::int AS c FROM rsvps WHERE event_id=$1', [meetupId])).rows[0].c; }
    const key = meetupId + ':' + userId; memory.rsvps.set(key, true);
    const m = memory.meetups.get(meetupId); if (m) m.interested = [...memory.rsvps.keys()].filter(k => k.startsWith(meetupId + ':')).length;
    return m ? m.interested : 0;
  }
};

// --- Email accounts ---
export const auth = {
  async findByEmail(email) {
    if (pg) return (await pg.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()])).rows[0] || null;
    return [...memory.users.values()].find(u => u.email === email.toLowerCase()) || null;
  },
  async create({ email, passwordHash, handle }) {
    email = email.toLowerCase();
    if (pg) return (await pg.query(
      'INSERT INTO users(handle,email,password_hash) VALUES($1,$2,$3) RETURNING *', [handle, email, passwordHash])).rows[0];
    const u = { id: uid('u'), handle, email, password_hash: passwordHash }; memory.users.set(u.id, u); return u;
  },
  async byId(id) {
    if (pg) return (await pg.query('SELECT * FROM users WHERE id=$1', [id])).rows[0] || null;
    return memory.users.get(id) || null;
  }
};

// --- Per-user data blob (cross-device sync) ---
export const data = {
  async get(userId) {
    if (pg) { const r = await pg.query('SELECT blob FROM user_data WHERE user_id=$1', [userId]); return r.rows[0]?.blob || null; }
    return memory.data.get(userId) || null;
  },
  async put(userId, blob) {
    if (pg) { await pg.query(
      'INSERT INTO user_data(user_id,blob,updated_at) VALUES($1,$2,now()) ON CONFLICT(user_id) DO UPDATE SET blob=$2,updated_at=now()',
      [userId, blob]); return true; }
    memory.data.set(userId, blob); return true;
  }
};

// --- Shared plans ("roam together" invites) ---
export const plans = {
  async create({ title, items, by }) {
    if (pg) return (await pg.query(
      'INSERT INTO shared_plans(title,items,created_by) VALUES($1,$2,$3) RETURNING *',
      [title, JSON.stringify(items || []), by || null])).rows[0];
    const p = { id: uid('p'), title, items: items || [], created_by: by || null, rsvps: [] }; memory.plans.set(p.id, p); return p;
  },
  async get(id) {
    if (pg) { const p = (await pg.query('SELECT * FROM shared_plans WHERE id=$1', [id])).rows[0]; if (!p) return null;
      const c = (await pg.query('SELECT count(*)::int AS c FROM plan_rsvps WHERE plan_id=$1', [id])).rows[0].c;
      return { ...p, items: typeof p.items === 'string' ? JSON.parse(p.items) : p.items, going: c }; }
    const p = memory.plans.get(id); return p ? { ...p, going: p.rsvps.length } : null;
  },
  async rsvp(id, who) {
    if (pg) { await pg.query('INSERT INTO plan_rsvps(plan_id,who) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, who]);
      return (await pg.query('SELECT count(*)::int AS c FROM plan_rsvps WHERE plan_id=$1', [id])).rows[0].c; }
    const p = memory.plans.get(id); if (!p) return 0; if (!p.rsvps.includes(who)) p.rsvps.push(who); return p.rsvps.length;
  }
};
