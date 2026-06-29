# 📱 Livo on the App Store — Capacitor + Capgo

You do **not** need to rewrite Livo in Next.js. Capacitor wraps the web app you
already have (`web/`) into real iOS + Android apps. Capgo then pushes live
JS/HTML updates over-the-air, so you keep improving without an App Store review
every time.

```
web/  (your app)  →  Capacitor wrapper  →  iOS + Android native apps  →  App Store / Play
                                   ↘  Capgo  →  instant OTA updates
```

## What you'll need first
- **A Mac with Xcode** — required to build & submit the iOS app (Apple's rule).
- **Apple Developer account** — US$99/year (developer.apple.com).
- **Android Studio** — free, for the Android/Play build (any OS).
- **Google Play Developer account** — one-time US$25.
- Node installed (you already have it).

## 1. Add Capacitor to the repo
From the repo root (where `web/` lives):
```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Livo world.junglelabs.livo --web-dir web
```
A `capacitor.config.json` is included in this repo already — keep it (it sets the
app id, name, splash colour, and turns on Capgo auto-update).

## 2. Add the native platforms
```bash
npx cap add ios
npx cap add android
npx cap sync
```
This generates `ios/` and `android/` native projects that load your `web/` app.

## 3. Run / build
```bash
npx cap open ios       # opens Xcode  -> press Run to test on simulator/device
npx cap open android   # opens Android Studio -> Run
```
Whenever you change files in `web/`, run `npx cap copy` to push them into the apps.

## 4. App icons & splash
Drop a 1024×1024 PNG icon in, then:
```bash
npm i -D @capacitor/assets
npx capacitor-assets generate     # generates all icon/splash sizes
```
(You can use the gradient Livo icon from `web/icon-512.png` upscaled, or a new 1024px one.)

## 5. Submit
- **iOS:** in Xcode → Product → Archive → Distribute App → App Store Connect →
  fill listing at appstoreconnect.apple.com → submit for review.
- **Android:** in Android Studio → Build → Generate Signed Bundle (.aab) →
  upload at play.google.com/console.

## 6. Capgo — over-the-air updates (the "keep improving" part)
```bash
npm i @capgo/capacitor-updater
npx cap sync
npx @capgo/cli init                 # sign up + link your app (free tier available)
```
Then to ship an update WITHOUT an app-store review:
```bash
# after editing web/ ...
npx @capgo/cli bundle upload --channel production
```
Users get the new version next time they open Livo. (Native changes — new plugins,
icons, permissions — still need a normal store release; JS/HTML/CSS go via Capgo.)

## 7. Push notifications
The config already enables the push plugin. To turn it on:
```bash
npm i @capacitor/push-notifications
npx cap sync
```
- **iOS:** enable Push Notifications capability in Xcode; create an APNs key in your Apple Developer account.
- **Android:** create a Firebase project, add `google-services.json` to `android/app/`.
- In your app code, register and handle the token (send it to your engine to target users).

> Push needs real Apple (APNs) / Firebase (FCM) credentials — there's no way around the platform setup. Once wired, your engine can send "Your meetup is happening!" or "Clear skies this weekend" nudges.

## How live data still works
Nothing changes: the wrapped app is still your `web/` app, so it keeps calling your
Railway engine (`LIVO_API`) for live Eats / Gems / Events. Capacitor just gives it a
native shell, push notifications, real geolocation, etc.

## Recommended order
1. Ship the **web app** (Vercel) first — it's already live and installable. ✅
2. Wrap with **Capacitor**, test on a simulator.
3. Get the **Apple Developer + Play** accounts.
4. Submit to both stores.
5. Wire **Capgo** so every future tweak ships instantly.

> Next.js later? Only worth it if you outgrow the single-file app and want
> components, SSR/SEO, and a team workflow. It's a refactor, not a requirement —
> and Capacitor + Capgo work the same way with a Next.js static export when you get there.
