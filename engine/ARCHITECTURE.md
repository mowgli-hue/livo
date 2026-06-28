# LocalEscape — Architecture & build plan

## The vision in one line
Open the app and your life is planned: weekends, lazy nights, big trips, office
parties, what's-on-near-me, and community meetups — matched to your mood and budget,
with a calendar that's yours.

## How the pieces fit

```
                ┌────────────────────────────────────────────┐
   Frontend  →  │  API (Express)                              │
  (the .html)   │  /plan /trips /groups /events /best         │
                │  /meetups /calendar                         │
                └───────────────┬─────────────┬──────────────┘
                                │             │
                     ┌──────────▼───┐   ┌─────▼────────┐
                     │ AI Planner   │   │   Store      │
                     │ engine       │   │ (PG/memory)  │
                     └──────┬───────┘   └──────────────┘
                            │  gathers candidates
            ┌───────────────┼───────────────┬───────────────┐
            ▼               ▼               ▼               ▼
        maps()          stays()         events()        social()
   Google/Apple      Airbnb/Booking   TM/Eventbrite   Instagram/curation
   (mock today)        (mock)            (mock)           (mock)
```

The **provider interface** is the key idea: the planner and API only ever see the
mock/live switch through `providers/index.js`. Swapping a mock for a real API is a
localized change — the rest of the system is untouched.

## The three things a single HTML file can't do (now solved here)

1. **Live API connections** → `providers/*` adapters (maps, stays, events, social),
   each behind one stable interface with a `mock | live` switch.
2. **An AI engine making the calls** → `engine/aiPlanner.js` gathers real candidates
   from providers and has an LLM assemble a coherent, budget-bound itinerary
   (deterministic fallback when no key is set).
3. **A backend + database for community events** → `store.js` + `db/schema.sql`:
   users, personal calendars, AI-drafted community events, and RSVPs.

## Data contracts (so live adapters drop in cleanly)

```
Place { id, name, category, vibes[], area, priceLevel(0-3), rating, url, source }
Stay  { id, name, type, nightly, area, rating, url, source }
Event { id, title, startsAt, area, vibes[], url, source }
```

## Suggested build phases

**Phase 1 — Demo (done):** mock providers + rule-based planner + in-memory store.
Ship the HTML frontend against this API; prove the UX end-to-end.

**Phase 2 — Real data, read-only:** wire `maps` (Google Places) and `events`
(Eventbrite/Ticketmaster + city feeds). Add the `provider_cache` table to control
cost/latency. Turn on the LLM planner.

**Phase 3 — Accounts + calendar:** replace handle auth with magic-link/OAuth + JWT;
move to Postgres; sync the frontend calendar to `/api/calendar`.

**Phase 4 — Stays & booking:** integrate Airbnb/Booking inventory and deep links;
add price alerts so users book the overnight weeks ahead (kills the "no BnBs left"
problem).

**Phase 5 — Community layer:** make meetups truly social — RSVPs, group chat,
map pins, moderation/safety, and a "the city's calendar fills itself" feed.

## Safety / trust notes for the community layer
- Identity verification + reporting before strangers meet in person.
- Public venues only for new-people meetups; no private addresses.
- Moderation queue for AI-drafted events; rate-limit creation.
- Clear data/consent model for location and social signals.

## Cost levers
- Cache provider responses (`provider_cache`) aggressively; geo+vibe keys.
- Use the rule-based planner for cold/cheap requests; reserve the LLM for
  "make it nice" / ambiguous requests.
