# 🌿 Livo

Your colourful life planner — plan your day, weekends, trips, stays, eats, events and
hidden gems, and remember it all. Installable web app (PWA) + optional Node backend.

## Structure
```
web/      → the app (static PWA). Deploy to GitHub Pages / Vercel / Netlify.
engine/   → optional Node API (live Maps/data + accounts). Deploy to Railway.
```

## Quick deploy

### Option 1 — GitHub Pages (zero config, already wired)
This repo includes a GitHub Action that auto-publishes `web/` on every push.
1. Push to GitHub (commands below).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. Live at `https://mowgli-hue.github.io/livo/` in ~1 minute. Re-deploys on every push.

### Option 2 — Vercel (great for a custom domain)
Vercel → **Add New → Project → Import** this repo → set **Root Directory = `web`** →
Framework: Other → Deploy. Add your domain under Settings → Domains.

### Option 3 — Engine on Railway (when you want live data + accounts)
Railway → **New Project → Deploy from GitHub repo** → set **Root Directory = `engine`**.
It runs `npm install` + `npm start` automatically. Add variables:
```
PROVIDER_MAPS=live
GOOGLE_PLACES_API_KEY=AIza...
ALLOWED_ORIGIN=https://<your-app-domain>
DATABASE_URL=postgres://...    # optional (Railway Postgres)
ANTHROPIC_API_KEY=sk-ant-...   # optional (AI planner)
```
Then run the schema once: `psql "$DATABASE_URL" -f src/db/schema.sql`.

## Push this to GitHub
```bash
git init
git add .
git commit -m "Livo: app + engine"
git branch -M main
git remote add origin https://github.com/mowgli-hue/livo.git
git push -u origin main
```

The app works fully on its own; the engine is what makes data live & sync across devices.
