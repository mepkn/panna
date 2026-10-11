# Panna

A private notepad: one plain-text box per account that syncs live between an Android
phone and the web at <https://panna.pknspace.com>. Only allowlisted emails can sign in.

Platforms: web (a Vite SPA in `web/`, on the VPS) and Android (Expo, sideloaded APK).

## Features

- One page. After signing in you see your own text and nothing else.
- Plain text in a full-screen monospace editor. No Markdown, no rich text.
- Live sync, last write wins. Saves about 500 ms after typing stops; changes from other devices arrive instantly.
- A small Saving… / Saved / Offline label, and a size counter near the 100 KB limit.
- Copy all, and Clear (with a confirmation).
- Light, dark or system theme.

## Stack

Android: Expo (SDK 57) · Expo Router · NativeWind + React Native Reusables ·
Web: React 19 · Vite · Tailwind CSS v4 · shadcn/ui (Base UI) ·
TypeScript · Convex (database, auth) · Convex Auth (password).

## Development

Requires Node 22.18+ (`.nvmrc` pins 22).

### 1. Install and run Convex locally

```sh
npm install
npm run web:install     # the web app has its own node_modules
npx convex dev            # first run: choose a local deployment (no account needed)
```

This writes `EXPO_PUBLIC_CONVEX_URL` to `.env.local`. Keep it running; it redeploys whenever `convex/` changes.

> **Phone vs. local backend:** `127.0.0.1` on a phone is the phone itself.
> - **Android emulator:** set `EXPO_PUBLIC_CONVEX_URL=http://10.0.2.2:3210`.
> - **USB device:** run `adb reverse tcp:3210 tcp:3210` and `adb reverse tcp:3211 tcp:3211`.
> - **Device on the same Wi-Fi:** use your computer's LAN IP.
>
> Restart Metro after changing `.env.local`.

### 2. Configure Convex Auth (once per deployment)

```sh
npx @convex-dev/auth      # interactive: generates JWT_PRIVATE_KEY + JWKS
npx convex env set SITE_URL http://localhost:5173
npx convex env set ALLOWED_EMAILS you@example.com   # comma-separated; nobody else can sign up or sign in
```

`ALLOWED_EMAILS` fails closed: if it's unset, every sign-up, sign-in and API call is refused.

### 3. Run the app

```sh
npm run web:dev                  # web app on http://localhost:5173
npm run android                  # build and install a development build on a USB phone
npx expo start --dev-client      # Metro for the development build
```

## Scripts

| Command | What it does |
|---|---|
| `npx convex dev` | Local Convex backend with hot reload |
| `npm run web:install` | Install the web app's dependencies (`web/node_modules`) |
| `npm run web:dev` | Vite dev server for the web app |
| `npm run android` | Build and install the development build on a USB phone |
| `npm run typecheck` | App and `convex/` typecheck |
| `npm run lint` | ESLint (Expo config) |
| `npm test` | convex-test: allowlist, per-user isolation, size cap, versions |
| `npm run check` | Typecheck, lint and tests, for the Android app and `web/` |
| `npm run icons` | Regenerate the app icon and splash images |
| `npm run deploy:backend` | Checks, then deploys `convex/` to production |
| `npm run deploy:web` | Checks, builds `web/`, rsyncs `web/dist/` to the VPS |
| `npm run deploy:web:dry` | The same, but rsync only shows what would change |
| `npm run build:android:preview` | Installable APK, built on EAS cloud |
| `npm run build:android:preview:local` | The same APK, built on this Mac into `dist/` |
| `npm run build:android:production` | Play Store AAB on EAS cloud |
| `npm run build:android:production:local` | The same AAB, built locally into `dist/` |
| `npm run eas -- <args>` | Any other `eas` command as the personal account |

## Deployment

Three parts: the Convex production deployment `insightful-chickadee-479`
(`https://insightful-chickadee-479.convex.cloud`, project `panna`), the static web app on
the VPS, and the Android app built with EAS (`@mepkn/panna`).

### One-time setup (done, except the VPS)

- `.env.prod.local` (git-ignored) holds `CONVEX_DEPLOY_KEY`, the production `EXPO_PUBLIC_CONVEX_URL`
  and `DEPLOY_HOST` / `DEPLOY_PORT` / `DEPLOY_DIR`. See `.env.example`. The scripts read it
  line by line as literal `KEY=VALUE`; it is never sourced.
- `.eas-token` (git-ignored) holds `export EXPO_TOKEN=...` for the personal Expo account. The scripts read it, so the global `eas` login is never used or changed.
- On the production Convex deployment: `JWT_PRIVATE_KEY`, `JWKS` (`npx @convex-dev/auth --prod`),
  `SITE_URL=https://panna.pknspace.com` and `ALLOWED_EMAILS`.
- The EAS environments `preview` and `production` have `EXPO_PUBLIC_CONVEX_URL` set to the production URL.
- VPS: `DEPLOY_DIR=/var/www/panna`, owned by the deploy user. System Caddy block:

  ```caddy
  http://panna.pknspace.com:8080 {
        root * /var/www/panna
        try_files {path} /index.html
        encode gzip
        file_server
  }
  ```

  A cloudflared Public Hostname maps `panna.pknspace.com` → `http://localhost:8080`.

### Backend

```sh
npm run deploy:backend    # checks, then npx convex deploy to production
```

### Web

```sh
npm run deploy:web:dry    # see what would change
npm run deploy:web        # checks, vite build, rsync --delete; Caddy serves it immediately
```

### Android

```sh
npm run build:android:preview:local
adb install -r dist/panna-preview-*.apk
```

## How it works

- **The web app** (`web/`) is a separate Vite + React + shadcn/ui app with its own `package.json`. It imports the backend from `../convex` through the `@convex` alias (`web/vite.config.ts` dedupes `convex` and `react` so `../convex` uses the web copies). In dev it reads `EXPO_PUBLIC_CONVEX_URL` from the root `.env.local`; `deploy:web` passes the production URL as `VITE_CONVEX_URL`. The sync logic in `web/src/lib/use-pad.ts` mirrors the Android one.
- **The Android app** (`src/`) uses Expo Router, NativeWind and React Native Reusables. The RNR primitives live in `src/components/ui/`, and screens only use the app's own wrappers in `src/components/cmp/cmp-*.tsx`. All strings are in `src/lib/strings.ts`.
- **Convex** (`convex/`) is the entire backend.
  - `schema.ts`: `pads` (one row per user, `by_user` index), plus the Convex Auth tables.
  - `auth.ts`: Convex Auth with the Password provider. `profile()` runs for sign-up and sign-in before anything is stored and refuses emails not in `ALLOWED_EMAILS` with a generic `notAllowed`. `lib/access.ts` `requireUserId` re-checks the list on every call, so removing an email also ends that user's sessions.
  - `pad.ts`: `get` and `save`. The row is always found from `getAuthUserId`; the client never sends a user or document id. `save` checks the 100 KB (UTF-8 bytes) cap, upserts and bumps `version`. A save based on an older version still wins.
  - `users.ts`: `me`, for the email in Settings.
- **Sync** (`src/lib/use-pad.ts`). Edits are saved 500 ms after typing stops. A subscription result is applied only while there are no unsaved or in-flight local edits, so the cursor doesn't jump; results older than the last saved version are ignored. The label shows Offline while the Convex websocket is disconnected; Convex queues the save and sends it on reconnect.
- **Auth tokens** are kept in `expo-secure-store` on Android and `localStorage` in the web app.
