// Persistence layer. Uses Postgres when DATABASE_URL is set, otherwise an
// in-memory store so the scaffold runs with zero setup. Same async API either way.

const memory = { users: new Map(), items: new Map(), meetups: new Map(), rsvps: new Map() };
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
