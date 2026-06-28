// Static reference data for trips & group venues (mirrors the prototype).
// In production, DESTS come from a flight/hotel pricing service; VENUES from your
// places DB + partner inventory.

export const DESTS = [
  { n: 'Cancún / Tulum', flag: '🇲🇽', flight: 380, hb: 40, hm: 95, daily: 55, vibes: ['water','party','calm'], best: 'Beach + nightlife on a budget' },
  { n: 'Mexico City', flag: '🇲🇽', flight: 300, hb: 55, hm: 115, daily: 45, vibes: ['cozy','party'], best: 'Food, culture, great value' },
  { n: 'Tokyo', flag: '🇯🇵', flight: 680, hb: 75, hm: 140, daily: 70, vibes: ['cozy','party','calm'], best: 'Cozy + electric in one' },
  { n: 'Bali', flag: '🇮🇩', flight: 720, hb: 35, hm: 100, daily: 40, vibes: ['nature','water','calm','cozy'], best: 'Nature + cheap once there' },
  { n: 'Lisbon', flag: '🇵🇹', flight: 680, hb: 75, hm: 120, daily: 60, vibes: ['cozy','party','water'], best: 'Walkable, cozy, lively nights' },
  { n: 'Reykjavik / Iceland', flag: '🇮🇸', flight: 620, hb: 130, hm: 200, daily: 90, vibes: ['nature','calm'], best: 'Raw nature & calm' },
  { n: 'Bangkok', flag: '🇹🇭', flight: 760, hb: 30, hm: 85, daily: 35, vibes: ['party','cozy'], best: 'Lively + ultra-affordable' },
  { n: 'Banff, Canada', flag: '🏔️', flight: 230, hb: 120, hm: 200, daily: 70, vibes: ['nature','calm'], best: 'Mountain calm, short flight' },
];

export const VENUES = [
  { n: 'Central City Brew Pub', area: 'Surrey Central', min: 15, max: 80, head: 45, vibes: ['party','cozy'], occ: ['office','friends','birthday'] },
  { n: 'Atlas Steak + Fish (private room)', area: 'Langley', min: 10, max: 30, head: 80, vibes: ['cozy','party'], occ: ['office','birthday'] },
  { n: 'REVS Bowling + Arcade', area: 'Langley', min: 10, max: 40, head: 32, vibes: ['party'], occ: ['office','friends','birthday','family'] },
  { n: 'Grand banquet hall + catering', area: 'Surrey', min: 50, max: 300, head: 42, vibes: ['party','calm'], occ: ['office','family','birthday'] },
  { n: 'Township 7 Winery', area: 'Langley', min: 12, max: 40, head: 55, vibes: ['cozy','calm'], occ: ['office','birthday','friends'] },
  { n: 'Tynehead picnic shelter', area: 'North Surrey', min: 15, max: 60, head: 12, vibes: ['nature','calm'], occ: ['family','friends','office'] },
  { n: 'Community centre hall rental', area: 'Surrey', min: 20, max: 120, head: 16, vibes: ['calm','party'], occ: ['family','office','birthday'] },
  { n: 'Harrison resort group retreat', area: 'Harrison', min: 20, max: 80, head: 185, vibes: ['calm','water'], occ: ['office'] },
];
