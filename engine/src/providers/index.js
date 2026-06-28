// Provider registry.
// Each provider exposes the SAME interface whether it's mock or live, so the
// rest of the app never changes when you flip PROVIDER_* env vars to "live".
//
// Interfaces:
//   maps.searchPlaces({ near, type, vibe, radiusKm }) -> [Place]
//   stays.search({ near, checkin, checkout, guests, maxNightly }) -> [Stay]
//   events.search({ near, from, to, vibe }) -> [Event]
//   social.bestPlaces({ near, vibe }) -> [Place]      // "Instagram best spots"-style
//
// Place  { id, name, category, vibes[], lat, lng, area, priceLevel(0-3), rating, url, source }
// Stay   { id, name, type, nightly, area, rating, url, source }
// Event  { id, title, startsAt, area, vibes[], url, source }

import * as mock from './mock.js';
import * as live from './live.js';

function pick(kind) {
  const mode = (process.env['PROVIDER_' + kind.toUpperCase()] || 'mock').toLowerCase();
  if (mode === 'live') {
    if (live[kind]) {
      console.log(`[providers] ${kind}=live`);
      return live[kind];
    }
    console.warn(`[providers] ${kind}=live requested but no live adapter yet; using mock.`);
  }
  return mock[kind];
}

export const maps = pick('maps');
export const stays = pick('stays');
export const events = pick('events');
export const social = pick('social');
