# Scratch — Build Spec

A private scratchpad: one plain-text box that syncs live between my Android phone and the
web at `https://panna.pknspace.com`. Not public. Only allowlisted emails can sign in.

Sister project of `../yaad-dila` (Expo + Convex). **Copy its structure, scripts and
conventions** wherever this spec doesn't say otherwise. Read its README, `convex/auth.ts`,
`convex/lib/allowlist.ts`, `convex/lib/access.ts`, `scripts/` and `src/components/cmp/`
before starting.

## Product

- **One URL, no sub-pages.** `panna.pknspace.com` is the only page (plus sign-in).
  No `/name` routes, no pad list, no pad names, no random-pad button.
- **One document per user.** After signing in you see your own text and nothing else.
  The account decides which text you get, the same way gmail.com shows your own inbox.
- **Plain text only.** A full-screen multiline input in a monospace font. No Markdown, no rich text.
- **Live sync, last write wins.** Save about 500 ms after typing stops. Remote changes
  arrive through the Convex subscription.
  - Apply a remote change only while the local editor is idle (no unsaved local edits), so the cursor doesn't jump.
  - Keep a `version` number. If a save is based on an older version than the server has,
    the save still wins (last write wins) and does not error.
- **Size cap:** 100 KB of text per user, enforced on the server. The UI shows a counter
  near the limit and refuses input past it.
- **Status indicator:** a small Saving… / Saved / Offline label.
- **Not in v1:** sub-pads, read-only links, version history, sharing, per-pad passwords,
  rate limiting, Markdown.

## Access control (most important part)

- Convex Auth with the **Password** provider (email + password), as in yaad-dila.
- **`ALLOWED_EMAILS`**, a Convex env var: a comma-separated list, case-insensitive, trimmed.
  - Checked in the Password provider's `profile()`, which runs for **both sign-up and
    sign-in, before anything is stored**. A non-allowlisted email never gets a user row.
  - Checked **again on every query and mutation** in `requireUserId`, so removing an email
    ends that user's existing sessions.
  - **Fails closed:** if the variable is unset or empty, nobody can sign in.
  - The error is a generic `ConvexError("notAllowed")`, shown as "This account isn't allowed
    to use this app." It must not reveal which emails are on the list.
  - Copy `isAllowedEmail` from `../yaad-dila/convex/lib/allowlist.ts`. It reads `process.env`
    through `globalThis` so that the app typecheck, which has no Node types, passes.
- Set the variable on **every** deployment (local dev and prod) before using it:
  `npx convex env set ALLOWED_EMAILS <my email>`. Ask me which email to use; don't put it in the repo.
- The sign-up screen exists, because the first account must be created, but it only
  succeeds for allowlisted emails.
- Never trust a client-supplied user or document id. The server finds the document from `getAuthUserId`.

## Data model

```ts
scratches: defineTable({
  userId: v.id("users"),
  text: v.string(),
  version: v.number(),     // increments on each save
  updatedAt: v.number(),   // UTC ms
}).index("by_user", ["userId"])
```
- At most one row per user. The row is created on the first save. `get` returns an empty text if there's no row.
- Use `_id` and `_creationTime`. Index every query; no table scans.

## Convex API

- `scratch.get()` query → `{ text, version, updatedAt } | null` for the signed-in user.
- `scratch.save({ text, baseVersion })` mutation: validates size, upserts the user's row, bumps `version`, returns the new version.
- `users.me()` query → `{ email }`, used in Settings.
- Error codes are plain-string `ConvexError`s (`notAuthenticated`, `notAllowed`,
  `textTooLong`), translated in the client like yaad-dila's `src/lib/errors.ts`.
- **Read `convex/_generated/ai/guidelines.md` before writing Convex code.**

## Screens (Expo Router)

- `(auth)/sign-in`, `(auth)/sign-up`: same form component as yaad-dila.
- `(app)/index`: the scratchpad. Full-height text input, status label, size counter.
  Header buttons: **Copy all** and **Clear** (with a confirm dialog).
- `(app)/settings`:
  - signed-in email
  - log out
  - theme: light / dark / system
- English only. No i18n library needed, but keep strings in one `src/lib/strings.ts`.
- Android: **share text into Scratch** (Android share target) appends the shared text to the end of the pad.
  It's optional, so build it last.

## Stack and conventions (match the other repos)

- Expo (latest SDK; read the versioned docs, don't trust memory), Expo Router, TypeScript strict.
  - One codebase for Android and web. Web uses `"output": "static"`.
- NativeWind (Tailwind v3) + React Native Reusables.
  - RNR primitives live in `src/components/ui/`.
  - Screens only use app-owned wrappers in `src/components/cmp/cmp-*.tsx`.
- Keyboard: `react-native-keyboard-controller`, with `KeyboardProvider` at the root.
  - Form screens use `CmpKeyboardAwareScrollView`, which scrolls the focused field above the keyboard.
  - A full-height editor with a bottom bar uses `CmpKeyboardPadding`.
  - Dialogs rise by half the keyboard height (in `components/ui/dialog.tsx`).
  - Lists with a search box at the top, and screens without inputs, need nothing.
  - No fixed offsets such as `mb-[40vh]`, no RN `KeyboardAvoidingView`, no bottom sheets.
- `@/` → `src/`, and `@convex/` → `convex/`.
- Node 22.18+ (`.nvmrc` = 22).
- Scripts (copy them from yaad-dila):
  - `typecheck`, `lint` (ESLint, Expo config), `test` (Vitest + convex-test)
  - `check` runs all three
  - `deploy:backend` runs check, then `npx convex deploy`, reading `CONVEX_DEPLOY_KEY` from
    `.env.prod.local` with the shared literal read loop
  - `deploy:web` (rsync of the static export, see Deployment)
  - android build scripts
- **Tests (convex-test):**
  - non-allowlisted sign-in rejected
  - removed email loses access
  - user A can't read or overwrite user B's scratch
  - size cap enforced
  - version bumps
  - Stub `ALLOWED_EMAILS` with `vi.stubEnv` in the test helper.
- Repo files: README (same layout as yaad-dila), `.env.example` (lists `ALLOWED_EMAILS`
  under Convex-side vars), AGENTS.md, CLAUDE.md, LICENSE, `.gitignore` covering
  `.env*.local` and `.eas-token`.
- App id `com.pknspace.panna`, scheme `panna`.

## Deployment

- **Backend:** a new Convex project `scratch`.
  - Set `JWT_PRIVATE_KEY` and `JWKS` (`npx @convex-dev/auth`), `SITE_URL`, and `ALLOWED_EMAILS` on prod.
- **Web:** deploy the same way as `../akinator`, `../eliza`, `../class` and `../electricity-bill-calculator`:
  - `npx expo export -p web` produces `dist/`.
  - `scripts/deploy-web.sh` (copy `../akinator/scripts/deploy.sh`) runs check, export, then
    `rsync -avz --delete dist/` over SSH to `DEPLOY_DIR`. The system Caddy on the VPS serves that
    folder at `https://panna.pknspace.com`; no container and no restart.
  - `npm run deploy:web` and `deploy:web:dry` (`DRY_RUN=1`).
  - `DEPLOY_HOST`, `DEPLOY_PORT` and `DEPLOY_DIR` live in `.env.prod.local`, read with the shared
    literal loop. `.env.example` has placeholders only.
  - One-time VPS setup (done by me; needs sudo). `DEPLOY_DIR=/var/www/panna`, owned by the
    deploy user like the other sites. Block in `/etc/caddy/Caddyfile`:
    ```caddy
    http://panna.pknspace.com:8080 {
          root * /var/www/panna
          try_files {path} {path}.html /index.html
          encode gzip
          file_server
    }
    ```
    The block differs from the Vite sites: it adds `{path}.html` because Expo's static export
    writes routes as `sign-in.html` etc. Plus a cloudflared Public Hostname `panna.pknspace.com`
    → `http://localhost:8080`. Don't try to run sudo.
  - Never write the VPS host, IP or port into tracked files.
- **Android:** EAS under my personal Expo account. Run `source .eas-token` (git-ignored), which
  holds `export EXPO_TOKEN=...`. **Never log out or replace the global eas login** (a work account).
  Prefer local builds into `dist/`.

## Rules for the agent

- No AI attribution or Co-Authored-By lines in commits or PRs.
- Never print secrets: deploy keys, tokens, `.env.prod.local` values, VPS details.
- Commit, push or deploy only when I ask.
