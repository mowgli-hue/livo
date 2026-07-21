// Livo v2 social layer — public profiles, follow graph, experience/workout posts,
// feed, discovery search, and moderation (report/block).
//
// In-memory for now (same async API as store.js) so it runs with zero setup.
// Before public launch, back these with Postgres tables (profiles, follows, posts,
// reports, blocks) — the async API here is designed so that swap is drop-in.

const mem = {
  profiles: new Map(), // userId -> { userId, handle, name, bio, avatar, city }
  follows: new Set(),  // "followerId>followeeId"
  posts: new Map(),    // postId -> post
  reports: [],         // { by, targetType, targetId, reason, ts }
  blocks: new Set(),   // "userId>blockedUserId"
};
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const profiles = {
  async upsert(userId, handle, patch = {}) {
    const cur = mem.profiles.get(userId) || { userId, handle, name: '', bio: '', avatar: '', city: '' };
    const p = { ...cur, ...patch, userId, handle: handle || cur.handle };
    mem.profiles.set(userId, p); return p;
  },
  async get(userId) { return mem.profiles.get(userId) || null; },
  async byHandle(handle) { return [...mem.profiles.values()].find(p => p.handle === handle) || null; },
  async search(q) {
    q = (q || '').toLowerCase().trim(); if (!q) return [];
    return [...mem.profiles.values()]
      .filter(p => (p.handle + ' ' + (p.name || '')).toLowerCase().includes(q))
      .slice(0, 25);
  },
  async counts(userId) {
    let followers = 0, following = 0;
    for (const k of mem.follows) { const [a, b] = k.split('>'); if (b === userId) followers++; if (a === userId) following++; }
    return { followers, following };
  },
};

export const follows = {
  async follow(a, b) { if (a && b && a !== b) mem.follows.add(a + '>' + b); return true; },
  async unfollow(a, b) { mem.follows.delete(a + '>' + b); return true; },
  async isFollowing(a, b) { return mem.follows.has(a + '>' + b); },
  async following(a) { const out = []; for (const k of mem.follows) { const [x, y] = k.split('>'); if (x === a) out.push(y); } return out; },
  async followers(a) { const out = []; for (const k of mem.follows) { const [x, y] = k.split('>'); if (y === a) out.push(x); } return out; },
};

export const posts = {
  async create(userId, d = {}) {
    const p = {
      id: uid('p'), userId,
      type: d.type === 'workout' ? 'workout' : 'experience',
      text: String(d.text || '').slice(0, 2000),
      place: String(d.place || '').slice(0, 120),
      lat: d.lat ?? null, lng: d.lng ?? null,
      photo: d.photo || '', meta: d.meta || {}, ts: Date.now(),
    };
    mem.posts.set(p.id, p); return p;
  },
  async byUser(userId) { return [...mem.posts.values()].filter(p => p.userId === userId).sort((a, b) => b.ts - a.ts); },
  async feed(userId, followingIds) {
    const set = new Set([...(followingIds || []), userId]);
    const blocked = new Set([...mem.blocks].filter(k => k.startsWith(userId + '>')).map(k => k.split('>')[1]));
    return [...mem.posts.values()].filter(p => set.has(p.userId) && !blocked.has(p.userId)).sort((a, b) => b.ts - a.ts).slice(0, 100);
  },
  async get(id) { return mem.posts.get(id) || null; },
  async remove(userId, id) { const p = mem.posts.get(id); if (p && p.userId === userId) mem.posts.delete(id); return true; },
};

export const moderation = {
  async report(by, targetType, targetId, reason) { mem.reports.push({ by, targetType, targetId, reason: String(reason || '').slice(0, 500), ts: Date.now() }); return true; },
  async block(a, b) { if (a && b && a !== b) { mem.blocks.add(a + '>' + b); mem.follows.delete(a + '>' + b); mem.follows.delete(b + '>' + a); } return true; },
  async unblock(a, b) { mem.blocks.delete(a + '>' + b); return true; },
  async blocked(a) { return [...mem.blocks].filter(k => k.startsWith(a + '>')).map(k => k.split('>')[1]); },
};
