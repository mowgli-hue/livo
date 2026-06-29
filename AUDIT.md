# 🔎 Livo — app audit

Automated audit run on the current build. Status: **PASS**, with notes for the App Store phase.

## Code health ✅
- JavaScript parses cleanly (no syntax errors).
- 92 element references checked — **0 missing/null** targets.
- **0 duplicate element IDs.**
- All main sections present: Today, Assistant, Plan (Weekend/Trips/Stays/Eats/Group/Events/Explore), Feed, Calendar, Profile, Search, Notifications.
- All interactive handlers wired: chat, save-schedule, guide picker, explore/stays/eats filters, save-to-calendar, like, follow, quick-actions.
- Engine boots cleanly; routes verified: `/`, `/health`, `/api/plan`, `/api/trips`, `/api/groups`, `/api/eats`, `/api/places`, `/api/events`, `/api/chat`, `/api/calendar`, `/api/meetups`.

## Feature inventory ✅
- **Today**: greeting, daily spark with character guide, For-You personalization, mood check-in + 7-day strip, habit tracker with streaks, day planner (morning/evening aware).
- **Assistant (new)**: chat planner — describe your day in words → schedule built and saved. Claude-backed via engine, with an offline parser fallback.
- **Plan**: weekend, lazy night (movies), trips (full budget), stays (Canada-wide + Airbnb), eats (live Google), group/office, events (live Ticketmaster), explore (gems/scenic/campfire/waterfalls/road trips, live + curated).
- **Live data**: Google Places (eats + places, paginated to 60), Ticketmaster (events), via the engine.
- **Personal**: profile, calendar (persisted), photo memories (private/shared), roamies feed with comments, goals, habits, moods.
- **Platform**: installable PWA, location access, travel-mode directions, offline support.

## Known limitations (by design, for a prototype)
1. **Data is per-device.** Profiles, calendar, memories, habits live in browser localStorage — they don't sync across devices yet. Cross-device needs accounts + the engine's Postgres (schema is ready, not wired to the UI).
2. **Followers/feed are local/simulated.** Real social needs the backend + auth.
3. **Live data requires keys** (Google, Ticketmaster, Anthropic) set on the engine; without them the app uses curated lists (graceful).
4. **No automated tests** beyond this smoke audit. Recommend adding before scaling.

## Before App Store submission — checklist
- [ ] Decide final name + bundle ID (lock before first submit).
- [ ] 1024×1024 app icon + screenshots for store listings.
- [ ] Privacy policy URL (Apple/Google require one — you collect location + store data locally).
- [ ] Location-use description strings (iOS `NSLocationWhenInUseUsageDescription`).
- [ ] Test the wrapped app on a real device (Capacitor).
- [ ] Confirm engine keys are set in Railway (Google, Ticketmaster, Anthropic).
- [ ] Decide data model: keep on-device for v1, or add accounts/sync.

## Recommendation
The app is **solid and shippable as a v1** — installable, fast, with real live data. The biggest product decision before scaling is **accounts + cross-device sync** (so a user's data follows them). Everything else is polish.
