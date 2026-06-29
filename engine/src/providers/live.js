// LIVE provider adapters. Activate per-provider via env (e.g. PROVIDER_MAPS=live)
// and supply the matching API key. Each function returns the SAME shape as the
// mock provider, so nothing else in the app changes.
//
// Google Places API (New) setup — 5 minutes:
//   1. console.cloud.google.com  ->  create a project
//   2. APIs & Services -> Enable "Places API (New)"
//   3. Credentials -> Create API key -> restrict it to Places API
//   4. Put the key in .env:  GOOGLE_PLACES_API_KEY=AIza...
//   5. Set PROVIDER_MAPS=live  (and PROVIDER_EATS uses the same maps adapter)
// Pricing: Google gives a generous monthly free tier; cache results (see provider_cache).

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

// maps.searchPlaces({ near, type, vibe }) -> [Place]
const PRICE_MAP = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 3 };

export const maps = {
  // Paginates up to ~60 results (Google returns 20 per page, max 3 pages).
  async searchPlaces({ near = 'Surrey, BC', type = 'restaurant', vibe } = {}) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error('GOOGLE_PLACES_API_KEY missing');
    const query = `${vibe && vibe !== 'any' ? vibe + ' ' : ''}${type} in ${near}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.googleMapsUri,places.location,places.types,nextPageToken',
    };
    const out = [];
    let pageToken;
    for (let page = 0; page < 3; page++) {
      const body = { textQuery: query, maxResultCount: 20 };
      if (pageToken) body.pageToken = pageToken;
      const res = await fetch(PLACES_URL, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      for (const p of (data.places || [])) {
        out.push({
          id: 'g_' + out.length,
          name: p.displayName?.text || 'Unknown',
          category: type,
          vibes: vibe && vibe !== 'any' ? [vibe] : [],
          area: p.formattedAddress || near,
          priceLevel: PRICE_MAP[p.priceLevel] ?? 1,
          rating: p.rating || null,
          ratingCount: p.userRatingCount || 0,
          lat: p.location?.latitude, lng: p.location?.longitude,
          url: p.googleMapsUri || '',
          source: 'google-places',
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
      await new Promise((r) => setTimeout(r, 1200)); // token needs a moment to activate
    }
    return out;
  },
};

// Restaurants are just a Places search with type=restaurant; expose a convenience.
export const eats = {
  search: (opts) => maps.searchPlaces({ ...opts, type: 'restaurant' }),
};

// Events — Ticketmaster Discovery API (free key at developer.ticketmaster.com).
// Put TICKETMASTER_API_KEY in .env and set PROVIDER_EVENTS=live.
export const events = {
  async search({ near = 'Surrey, BC', vibe } = {}) {
    const key = process.env.TICKETMASTER_API_KEY;
    if (!key) throw new Error('TICKETMASTER_API_KEY missing');
    const city = String(near).split(',')[0].trim();
    const params = new URLSearchParams({ apikey: key, city, size: '20', sort: 'date,asc' });
    if (vibe && vibe !== 'any') params.set('keyword', vibe);
    const res = await fetch('https://app.ticketmaster.com/discovery/v2/events.json?' + params);
    if (!res.ok) throw new Error('Ticketmaster ' + res.status);
    const data = await res.json();
    return (data._embedded?.events || []).map((e, i) => ({
      id: e.id || ('tm_' + i),
      title: e.name,
      startsAt: e.dates?.start?.dateTime || e.dates?.start?.localDate || '',
      area: e._embedded?.venues?.[0]?.city?.name || city,
      vibes: vibe && vibe !== 'any' ? [vibe] : [],
      url: e.url || '',
      source: 'ticketmaster',
    }));
  },
};

// Stays / Social live adapters go here the same way when you add those keys.
// stays  -> Booking.com / Airbnb partner API
// social -> Instagram Graph + your own ranking
export const stays = null;
export const social = null;
