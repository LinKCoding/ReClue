# ReClue — Supabase

This directory contains the Supabase Edge Function that serves as ReClue's API layer.

## Why Edge Functions

The extension cannot query Supabase directly — DB credentials must stay server-side
and the no-spoiler contract requires the answer to never reach the client until
explicitly requested. An Edge Function sits between the extension and the database,
handling all matching, ranking, and normalization logic.

Edge Functions run on Deno at the edge, co-located with the Supabase Postgres
database. No separate server to maintain, and they're free within Supabase's free
tier (500k invocations/month).

## Structure

```
functions/
  api/
    index.ts    Single Deno function routing all three endpoints
config.toml     Project config — sets verify_jwt = false for the api function
```

## API Routes

All routes are handled by the single `api` function. JWT verification is disabled
(`verify_jwt = false` in `config.toml`) so the extension doesn't need an API key.

| Route | Body | Response |
|---|---|---|
| `POST /api/lookup` | `{ clue, length?, knownLetters? }` | `{ candidates: [{ id, length, occurrences, score, hasReclue }] }` |
| `POST /api/reclue` | `{ id, exclude? }` | `{ clue }` |
| `POST /api/reveal` | `{ id }` | `{ answer }` |

`id` is a base64url-encoded answer token — opaque to the client, decoded server-side
on `/reclue` and `/reveal`. This enforces the no-spoiler contract at the network
layer: the answer never appears in any response until `/reveal` is called.

## Deployment

```sh
# First-time setup
supabase login
supabase link --project-ref amxfasifudmulzizpbhx
supabase secrets set DATABASE_URL="<your-connection-string>"

# Deploy (or from repo root: bun run deploy)
supabase functions deploy api --project-ref amxfasifudmulzizpbhx
```

## Environment Variables

| Variable | Where to set | Description |
|---|---|---|
| `DATABASE_URL` | `supabase secrets set` | Postgres connection string |

## Local Development

Supabase Edge Functions run on Deno — there's no local emulator wired up in this
project. During development, point the extension at the deployed function by setting
`VITE_API_BASE_URL` in `extension/.env`. See the extension README for details.
