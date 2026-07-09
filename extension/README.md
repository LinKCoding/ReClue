# ReClue Extension (front-end)

Chrome/Firefox MV3 toolbar popup. Vanilla TypeScript + Vite (CRXJS) + Tailwind v4.
Talks to the ReClue Node API over one configurable base URL. See the repo-root
`CONTEXT.md` for domain terminology and `docs/adr/` for design decisions.

## Setup

```sh
bun install
cp .env.example .env   # set VITE_API_BASE_URL (default http://localhost:5555)
```

If you point the API at a non-localhost origin, also add that origin to
`host_permissions` in `src/manifest.ts` (MV3 blocks cross-origin fetch otherwise).

## Develop

```sh
bun run dev          # Vite dev server with HMR
```

Then load the unpacked extension:

- **Chrome**: `chrome://extensions` → enable Developer mode → "Load unpacked" →
  select the `dist/chrome` folder (created on build) — or point at the dev build.
- **Firefox**: `about:debugging` → This Firefox → "Load Temporary Add-on" →
  pick `dist/firefox/manifest.json`.

## Build

```sh
bun run build            # -> dist/chrome
bun run build:firefox    # -> dist/firefox
bun run typecheck        # tsc --noEmit
```

## Structure

```
src/
  manifest.ts        MV3 manifest (CRXJS defineManifest)
  vite-env.d.ts      typed import.meta.env
  lib/
    types.ts         API contract types (source of truth: CONTEXT.md)
    api.ts           typed client for /lookup, /reclue, /reveal
  popup/
    index.html       popup markup (Tailwind classes)
    popup.css        Tailwind entry
    popup.ts         staged no-spoiler UI logic
```
