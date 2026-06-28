# 🚀 Launch Livo — go-live runbook

This folder (`livo-web/`) is a complete, installable web app (PWA). You can have it
live on a public URL in **about 5 minutes**, and on your own domain the same day.

```
livo-web/
  index.html              ← the app (with PWA tags wired in)
  manifest.webmanifest    ← makes it installable
  service-worker.js       ← offline support + "Add to Home Screen"
  icon-192.png / icon-512.png / icon-maskable-512.png / apple-touch-icon.png
  netlify.toml            ← optional config
```

> Nothing to build — it's static files. Any static host works.

---

## Step 1 — Put it online (pick ONE; all free)

### A. Netlify Drop — fastest, no account drama
1. Go to **https://app.netlify.com/drop**
2. Drag the whole **`livo-web`** folder onto the page.
3. Done — you get a live URL like `https://livo-xyz.netlify.app`. Share it, install it on your phone.

### B. Cloudflare Pages — fast global, great free tier
1. **https://dash.cloudflare.com** → Workers & Pages → Create → Pages → *Upload assets*.
2. Upload the `livo-web` folder → Deploy. URL: `https://livo.pages.dev`.

### C. Vercel
1. Install once: `npm i -g vercel`
2. In `livo-web/` run `vercel` and follow prompts → live URL.

### D. GitHub Pages (free, Git-based)
1. Create a repo, put these files in it, push.
2. Repo → Settings → Pages → Source: `main` / root → Save.
3. Live at `https://<you>.github.io/<repo>/`.

All four give **HTTPS automatically** — required for the install/offline features.

---

## Step 2 — Get a domain

Buy from any registrar (~CAD $10–20/year):
- **Cloudflare Registrar** (at cost, no markup) — easiest if you also use Cloudflare Pages.
- **Namecheap** or **Porkbun** — cheap and simple.

Name ideas to check for availability (pick what's free):
`livo.app` · `getlivo.com` · `livo.ca` · `heylivo.com` · `livo.life` · `trylivo.com`

> `.app` domains force HTTPS (nice for a PWA) but cost a bit more. `.com`/`.ca` are safe.

---

## Step 3 — Connect the domain to your host

Each host has a "Custom domain" / "Add domain" button. The pattern:

- **Apex** (`livo.com`): add an `A` record (host gives the IP) **or** use the host's name servers.
- **www** (`www.livo.com`): add a `CNAME` pointing to your host URL (e.g. `livo-xyz.netlify.app`).
- Click **"Verify / Provision certificate"** — HTTPS turns on automatically in a few minutes.

Netlify, Cloudflare Pages and Vercel all walk you through this in their dashboard.

---

## Step 4 — Install it like a real app

- **iPhone:** open the URL in Safari → Share → *Add to Home Screen*.
- **Android:** Chrome shows an *Install app* prompt, or menu → *Install app*.
- **Desktop:** Chrome/Edge show an install icon in the address bar.

It launches full-screen with the Livo icon, works offline, and remembers everything
on the device (profile, calendar, habits, memories live in local storage).

---

## Step 5 — (Later) Go from "on a device" to "real accounts + live data"

The app today is a complete front end. To sync across devices and pull **live**
Google Maps / events / stays data, deploy the backend (`../localescape-engine`):

1. Host it free on **Render**, **Railway**, or **Fly.io** (Node app, `npm start`).
2. Set env vars there: `GOOGLE_PLACES_API_KEY`, `PROVIDER_MAPS=live`, `DATABASE_URL` (free Postgres on Render/Neon), `ANTHROPIC_API_KEY` (optional, for the AI planner).
3. Run the schema once: `psql "$DATABASE_URL" -f src/db/schema.sql`.
4. Point the app's fetch calls at your API URL (e.g. `https://livo-api.onrender.com`).

The Google Places adapter is already written (`localescape-engine/src/providers/live.js`) —
add the key and live restaurant/place data flows in with no other code changes.

---

## Weekend launch checklist

- [ ] Deploy `livo-web` to Netlify/Cloudflare → get a live HTTPS URL
- [ ] Install it on your phone; click through every tab
- [ ] Buy a domain and connect it
- [ ] Share the link with a few friends for first feedback
- [ ] (Next) stand up the engine + Google Places key for live data & accounts

You're one drag-and-drop away from live. 🌿
