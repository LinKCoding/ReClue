# ReClue

ReClue is a Chrome/Firefox extension that helps crossword solvers by providing an
**alternative clue** (a "re-clue") for the entry you're stuck on — or, if you'd
rather, the answer outright.

It works against a database of NYT crossword clues and answers spanning **1993–2021**
(~780k entries). Because the same answer has been clued many different ways over the
years, ReClue can hand you a *different* clue for the same answer to jog your memory
without spoiling it.

## How to use it

1. Type the clue you're stuck on into the popup, optionally including the answer
   length (this narrows things down when a clue matches more than one answer).
2. If a match is found, for each candidate answer you can ask for:
   - **a re-clue** — an alternative clue for the same answer (when one exists), or
   - **the answer** outright.

## No spoilers by design

The answer stays hidden until you explicitly ask for it — enforced at the network
layer, not just in the UI. A lookup returns only non-spoiling metadata (letter count,
how often the answer appeared in the dataset, whether a re-clue is available). The
actual clue or answer text is fetched only when you press "Give me another clue" or
"Reveal answer".

See [`docs/adr/0001-no-spoiler-lookup-contract.md`](docs/adr/0001-no-spoiler-lookup-contract.md)
for the full reasoning and API contract.

## Architecture

```
Browser extension (popup)  →  Supabase Edge Function (/api)  →  Supabase PostgreSQL
```

- **Extension** — MV3 toolbar popup for Chrome & Firefox. Vanilla TypeScript + Vite
  (CRXJS) + Tailwind v4. Lives in [`extension/`](extension/).
- **API** — Supabase Edge Function (`supabase/functions/api/`) exposing `/lookup`,
  `/reclue`, and `/reveal`. All matching, ranking, normalization, and DB credentials
  stay server-side; the extension only knows one base URL.
- **Database** — PostgreSQL hosted on Supabase, ~780k rows of historical NYT clues.

## Setup

### Prerequisites

- [Bun](https://bun.sh)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- [psql](https://www.postgresql.org/docs/current/app-psql.html) (`brew install libpq && brew link --force libpq`)
- A [Supabase](https://supabase.com) project

### 1. Database

Create the table and import the dataset:

```sh
# Create the table
psql "$DATABASE_URL" -c "
CREATE TABLE IF NOT EXISTS crossword_clues (
  id BIGSERIAL PRIMARY KEY,
  date DATE,
  word TEXT NOT NULL,
  clue TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crossword_clues_word ON crossword_clues (word);"

# Convert CSV encoding then import (~780k rows, takes ~30s)
iconv -f LATIN1 -t UTF-8 nytcrosswords.csv > nytcrosswords_utf8.csv

psql "$DATABASE_URL" -c "
CREATE TEMP TABLE clues_import (date TEXT, word TEXT, clue TEXT);
" -c "\COPY clues_import FROM 'nytcrosswords_utf8.csv' CSV HEADER;" -c "
INSERT INTO crossword_clues (date, word, clue)
SELECT TO_DATE(date, 'MM/DD/YYYY'), word, clue FROM clues_import;"
```

### 2. Edge Function

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set DATABASE_URL="<your-database-url>"
supabase functions deploy api --project-ref <your-project-ref>
```

To redeploy after changes:

```sh
bun run deploy
```

### 3. Extension (local dev against localhost)

```sh
cd extension
bun install
bun run dev
```

Load the unpacked extension:
- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → select `dist/chrome`
- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on → pick `dist/firefox/manifest.json`

The extension defaults to `http://localhost:5555` when no `.env` is present. For
development against the live Supabase function, follow step 4 below instead.

### 4. Extension (production build against Supabase)

```sh
cd extension
cp .env.example .env   # VITE_API_BASE_URL is pre-filled with the Supabase functions URL
bun run build
```

## Project docs

- [`CONTEXT.md`](CONTEXT.md) — domain glossary, terminology, and architecture.
