# ReClue

ReClue is a Chrome/Firefox extension that helps crossword solvers by providing an
**alternative clue** (a "re-clue") for the entry you're stuck on — or, if you'd
rather, the answer outright.

It works against a database of crossword clues and answers spanning **1993–2021**.
Because the same answer has been clued many different ways over the years, ReClue
can hand you a *different* clue for the same answer to jog your memory without
spoiling it.

## How to use it

1. Feed the clue to the extension, optionally including the number of letters the
   answer has (this narrows things down when a clue matches more than one answer).
2. If a match is found, you can ask for:
   - **a) a re-clue** — an alternative clue for the answer (when one exists), or
   - **b) the answer** outright.

## No spoilers by design

The whole point of a re-clue is to help *without* giving the answer away, so
ReClue keeps the answer hidden until you explicitly ask to reveal it — and it
does so at the network layer, not just in the UI.

A lookup returns only **non-spoiling metadata** about each candidate answer (how
many letters it has, how often that clue→answer pairing occurs, and whether a
re-clue is available). The actual clue or answer text is fetched only when you
press "Give me another clue" or "Reveal answer". This means the answer never even
reaches your browser until you choose to see it.

When a clue matches several possible answers, each is shown as an anonymous slot
("Answer 1 — 5 letters"); entering the letter count usually collapses this to one.
If an answer only appears once in the database, no re-clue exists for it, so that
option is disabled.

See [`docs/adr/0001-no-spoiler-lookup-contract.md`](docs/adr/0001-no-spoiler-lookup-contract.md)
for the reasoning and the exact API contract.

## Architecture

```
Browser extension (popup)  ->  Node API (:5555)  ->  Supabase (PostgreSQL)
```

- **Front-end** — MV3 toolbar popup for Chrome & Firefox. Vanilla TypeScript +
  Vite (CRXJS) + Tailwind v4. See [`extension/`](extension/) and its README.
- **Back-end** — Node API exposing `/lookup`, `/reclue`, and `/reveal`. The
  extension knows only one base URL; all matching, ranking, normalization, and
  database credentials stay server-side. *(Not yet scaffolded.)*
- **Database** — PostgreSQL hosted on Supabase, holding the historical
  clue/answer dataset. *(Not yet scaffolded.)*

### Clue matching

The MVP uses **normalized exact matching**: both the stored clue and your query
are lowercased, trimmed, whitespace-collapsed, and stripped of trailing
punctuation before comparison, optionally filtered by answer length. The API
contract returns a ranked list of candidates with a `score` field, so upgrading
to fuzzy matching (Postgres `pg_trgm` trigram similarity) later is a
server-side-only change — no front-end or contract changes required.

## Project docs

- [`CONTEXT.md`](CONTEXT.md) — domain glossary, terminology, and architecture of record.
- [`docs/adr/`](docs/adr/) — architectural decision records.
