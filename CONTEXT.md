# ReClue — Context

ReClue is a Chrome/Firefox browser extension that helps crossword solvers by
looking up a clue against a historical database of crossword clues and answers
(spanning 1993–2021) and returning either an alternative clue or the answer.

## Glossary

- **Clue**: The prompt text a crossword gives for an entry (e.g. "Capital of France").
  The user feeds a clue into ReClue. Used interchangeably with "hint" in casual
  speech, but the canonical term is **clue**.
- **Answer**: The solution word/phrase for a clue (e.g. "PARIS"). Always uppercase,
  no spaces in traditional grids (TBD — see open questions).
- **Re-clue**: An *alternative* clue for the same answer, drawn from a different
  puzzle in the database. Only exists when the answer appears with more than one
  distinct clue across the dataset.
- **Length**: Optional user-supplied number of letters in the answer, used to
  narrow candidate answers.
- **Known letters**: Optional user-supplied pattern of confirmed letters and blanks
  (e.g. `KE_P`), where `_` represents exactly one unknown letter. Takes precedence
  over **Length** when both are supplied — the pattern's character count is used as
  the effective length. Matching is case-insensitive.

## Architecture

- **Front-end**: Browser extension (Chrome + Firefox), Manifest V3.
  - Surface: **toolbar popup** (browser action). User types/pastes a clue and an
    optional length; results shown in the popup. Content-script/in-page overlay
    is explicitly deferred to a later enhancement.
  - Stack: **Vanilla TypeScript + Vite** (CRXJS plugin for MV3 + cross-browser
    build). No UI framework for the MVP given the small popup surface.
    **Tailwind CSS v4** for styling (via `@tailwindcss/vite`, zero-config).
  - Popup follows a **no-spoiler staged flow** (see below).
- **Back-end**: Supabase Edge Function (`supabase/functions/api/`) — a single Deno
  function routing `/lookup`, `/reclue`, and `/reveal`.
- **Database**: PostgreSQL, hosted via Supabase.

## Clue Matching

- **MVP: normalized exact match.** Normalize both the stored clue and the query
  (lowercase, trim, collapse internal whitespace, strip trailing punctuation),
  then match on equality. Optionally filter by answer length.
- A lookup returns a **ranked list of candidate answers** (not a single answer),
  because one clue string can map to multiple answers across puzzles. Ranking =
  frequency of the clue→answer pairing (occurrence count).
- **API contract (fixed now).** To honor the no-spoiler flow at the *network*
  layer (answer text must never reach the client until "reveal"), the lookup
  returns only non-spoiling metadata; clue/answer text is fetched on demand.
  - `POST /lookup { clue, length?, knownLetters? }` →
    `{ candidates: [{ id, length, occurrences, score, hasReclue }] }`
    - `id`: opaque server-issued token identifying the candidate answer.
    - `score`: 1.0-ish for exact match (frequency-derived); a future `pg_trgm`
      fuzzy upgrade repopulates it with real similarity — no front-end/contract
      change, just the one query + a trigram index migration.
    - `hasReclue`: whether an alternative clue exists for this candidate.
  - `POST /reclue { id }` → `{ clue }` (an alternative clue; no answer text).
  - `POST /reveal { id }` → `{ answer }`.

## Request Topology

Extension → **Supabase Edge Function** → Supabase Postgres. The extension knows
only one base URL (`VITE_API_BASE_URL`); DB credentials and all matching, ranking,
and normalization logic stay server-side. The extension never talks to Supabase
directly.

## Popup Flow (no-spoiler)

The re-clue feature only has value if the answer stays hidden until the user
explicitly asks for it. The popup therefore never renders candidate answer text
until "reveal" is pressed.

1. **Input** — clue field + optional length + optional known-letters pattern.
2. **Match summary** — show non-spoiling metadata only: how many candidate
   answers matched and their lengths (e.g. "Found 3 possible answers — lengths
   5, 5, 7"). No answer text. A supplied length usually collapses this to one.
3. **Per-candidate help**, each candidate an anonymous slot ("Answer 1 — 5 letters"):
   - **Give me another clue** → shows a re-clue (alternative clue for that
     candidate's answer). Still no answer text.
   - **Reveal answer** → shows the answer outright.

Rules:
- The **known-letters pattern is the strongest disambiguator**; length is secondary.
  If both are supplied, known letters win — the pattern's length is used.
- If a candidate answer has **no alternative clue** (appears once in the DB),
  the "Give me another clue" action is disabled/hidden for that candidate with a
  note that no alternative exists.

## Open Questions

- Answer normalization (case, spaces, punctuation) in the dataset — to resolve
  when the backend/data import is designed.
