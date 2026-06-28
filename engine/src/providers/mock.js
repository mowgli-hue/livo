// Mock providers — return data shaped like the live APIs.
// Seed data is Surrey, BC area (mirrors the prototype). Swap for live adapters later.

const PLACES = [
  { id: 'p1', name: 'Crescent Beach Walk', category: 'trail', vibes: ['water','calm','nature'], area: 'South Surrey', priceLevel: 0, rating: 4.7, url: '', source: 'mock' },
  { id: 'p2', name: 'Tynehead Regional Park', category: 'trail', vibes: ['nature','calm'], area: 'North Surrey', priceLevel: 0, rating: 4.6, url: '', source: 'mock' },
  { id: 'p3', name: 'Serpentine Fen Trail', category: 'trail', vibes: ['nature','calm','water'], area: 'South Surrey', priceLevel: 0, rating: 4.5, url: '', source: 'mock' },
  { id: 'p4', name: 'Redwood Park', category: 'trail', vibes: ['nature','cozy','calm'], area: 'South Surrey', priceLevel: 0, rating: 4.7, url: '', source: 'mock' },
  { id: 'p5', name: 'Golden Ears — Alouette Lake', category: 'trail', vibes: ['nature','water'], area: 'Maple Ridge', priceLevel: 0, rating: 4.8, url: '', source: 'mock' },
  { id: 'f1', name: 'Galini (Greek)', category: 'food', vibes: ['cozy'], area: 'Langley', priceLevel: 2, rating: 4.6, url: '', source: 'mock' },
  { id: 'f2', name: 'Ban Chok Dee (Thai)', category: 'food', vibes: ['cozy'], area: 'Langley', priceLevel: 1, rating: 4.5, url: '', source: 'mock' },
  { id: 'f3', name: 'White Rock Waterfront', category: 'food', vibes: ['water','party','cozy'], area: 'White Rock', priceLevel: 2, rating: 4.3, url: '', source: 'mock' },
  { id: 'r1', name: 'Grandview Aquatic Centre', category: 'rec', vibes: ['water','party'], area: 'South Surrey', priceLevel: 1, rating: 4.6, url: '', source: 'mock' },
  { id: 'e1', name: 'Surrey City Centre Library', category: 'easy', vibes: ['easy','calm','cozy'], area: 'Surrey Central', priceLevel: 0, rating: 4.7, url: '', source: 'mock' },
  { id: 'e2', name: 'Museum of Surrey', category: 'easy', vibes: ['easy','cozy','calm'], area: 'Cloverdale', priceLevel: 0, rating: 4.6, url: '', source: 'mock' },
];

const STAYS = [
  { id: 's1', name: 'Harrison Hot Springs lakeside B&B', type: 'bnb', nightly: 160, area: 'Harrison', rating: 4.7, url: '', source: 'mock' },
  { id: 's2', name: 'Fort Langley heritage B&B', type: 'bnb', nightly: 130, area: 'Fort Langley', rating: 4.6, url: '', source: 'mock' },
  { id: 's3', name: 'Squamish adventure cabin', type: 'cabin', nightly: 150, area: 'Squamish', rating: 4.5, url: '', source: 'mock' },
  { id: 's4', name: 'White Rock cozy suite', type: 'suite', nightly: 110, area: 'White Rock', rating: 4.8, url: '', source: 'mock' },
];

const EVENTS = [
  { id: 'v1', title: 'Fusion Newton Street Festival', startsAt: '2026-06-06T11:00:00', area: 'Newton', vibes: ['party','cozy'], url: '', source: 'mock' },
  { id: 'v2', title: 'Surrey Pride', startsAt: '2026-06-20T12:00:00', area: 'Surrey Central', vibes: ['party'], url: '', source: 'mock' },
  { id: 'v3', title: 'Canada Day @ Bill Reid Amphitheatre', startsAt: '2026-07-01T16:00:00', area: 'Cloverdale', vibes: ['party'], url: '', source: 'mock' },
  { id: 'v4', title: 'Greek Festival (North Surrey)', startsAt: '2026-08-15T17:00:00', area: 'North Surrey', vibes: ['cozy','party'], url: '', source: 'mock' },
];

const wait = (ms = 30) => new Promise(r => setTimeout(r, ms));
const byVibe = (arr, vibe) => (!vibe || vibe === 'any') ? arr : arr.filter(x => x.vibes?.includes(vibe));

export const maps = {
  async searchPlaces({ type, vibe } = {}) {
    await wait();
    let r = PLACES;
    if (type) r = r.filter(p => p.category === type);
    return byVibe(r, vibe);
  }
};

export const stays = {
  async search({ guests = 2, maxNightly = 9999 } = {}) {
    await wait();
    return STAYS.filter(s => s.nightly <= maxNightly).sort((a, b) => a.nightly - b.nightly);
  }
};

export const events = {
  async search({ vibe } = {}) {
    await wait();
    return byVibe(EVENTS, vibe);
  }
};

export const social = {
  // "Instagram best places"-style ranked spots
  async bestPlaces({ vibe } = {}) {
    await wait();
    return byVibe(PLACES, vibe).slice().sort((a, b) => b.rating - a.rating).slice(0, 6);
  }
};
