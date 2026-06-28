# LocalEscape — Engine

The backend that powers the LocalEscape app: AI-assisted planning, trip budgeting,
a group/office venue finder, an events feed, AI-drafted community meetups, and a
per-user calendar.

It **runs with zero credentials** (mock providers + in-memory store), so you can
demo the whole API today, then flip each piece to live as you add keys.

## Quick start

```bash
cd localescape-engine
npm install
npm start          # -> LocalEscape engine on :8787
```

```bash
# health
curl localhost:8787/health

# generate a weekend plan
curl -s localhost:8787/api/plan -H 'content-type: application/json' \
  -d '{"near":"Surrey, BC","mood":"calm","who":"couple","budget":"low"}'

# trips, sorted by per-person cost
curl -s localhost:8787/api/trips -H 'content-type: application/json' \
  -d '{"mood":"water","nights":5,"tier":"budget"}'

# office party of 30, up to $90/head
curl -s localhost:8787/api/groups -H 'content-type: application/json' \
  -d '{"people":30,"occasion":"office","vibe":"party","maxPerHead":90}'

# events feed + curated "best places"
curl -s localhost:8787/api/events
curl -s "localhost:8787/api/best?vibe=water"

# personal calendar (handle-based; swap for real auth)
curl -s localhost:8787/api/calendar -H 'x-user: mowgli'
curl -s localhost:8787/api/calendar -H 'x-user: mowgli' -H 'content-type: application/json' \
  -d '{"title":"Crescent Beach","sub":"Sunset walk","type":"plan","date":"2026-07-04"}'

# AI-drafted community meetup + RSVP
curl -s localhost:8787/api/meetups -H 'x-user: mowgli' -H 'content-type: application/json' \
  -d '{"idea":"sunset beach hang for new folks","vibe":"water"}'
curl -s localhost:8787/api/meetups/<id>/rsvp -X POST -H 'x-user: amy'
```

## Going live (one provider at a time)

Everything is mocked behind a stable interface. In `.env`, switch a provider to
`live` and add its key — nothing else in the codebase changes:

| Concern        | Mock today        | Live provider to wire in                         |
|----------------|-------------------|--------------------------------------------------|
| Places / Maps  | `providers/mock`  | Google Places / Apple MapKit (`PROVIDER_MAPS=live`) |
| Stays / BnBs   | `providers/mock`  | Airbnb partner / Booking / hotel APIs            |
| Events         | `providers/mock`  | Ticketmaster / Eventbrite / city open-data feeds |
| "Best places"  | `providers/mock`  | Instagram Graph + your curation/ranking          |
| AI planner     | rule-based        | set `ANTHROPIC_API_KEY` → LLM assembles itineraries |
| Database       | in-memory         | set `DATABASE_URL`, run `src/db/schema.sql`       |

The live adapter just needs to return the same shapes documented in
`src/providers/index.js`.

## Layout

```
src/
  server.js            REST API (Express)
  engine/aiPlanner.js  gathers candidates -> LLM or rule-based assembly
  providers/
    index.js           interface + mock/live switch
    mock.js            zero-credential mock data (Surrey, BC)
  store.js             in-memory OR Postgres (same async API)
  data/seed.js         trips + group-venue reference data
  db/schema.sql        Postgres schema (users, calendar, events, rsvps, cache)
```

See `ARCHITECTURE.md` for the full picture and build phases.
