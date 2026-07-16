import pg from 'npm:pg';

interface ClueRow {
  word: string;
  occurrences: string;
  has_reclue: boolean;
}

const { Pool } = pg;
const pool = new Pool({ connectionString: Deno.env.get('DATABASE_URL'), max: 1 });

function normalizeClue(clue: string): string {
  return clue.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?,;]+$/, '');
}

function encodeId(word: string): string {
  return btoa(word).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeId(id: string): string {
  return atob(id.replace(/-/g, '+').replace(/_/g, '/'));
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const route = new URL(req.url).pathname.split('/').at(-1);
  const body = await req.json().catch(() => ({}));

  if (route === 'lookup') {
    const { clue, length, knownLetters, patternOnly } = body as {
      clue?: string;
      length?: number;
      knownLetters?: string;
      patternOnly?: boolean;
    };
    if (!clue || typeof clue !== 'string') return json({ error: 'clue is required' }, 400);

    const pattern = knownLetters ? knownLetters.replace(/%/g, '_') : null;
    const effectiveLength = pattern ? pattern.length : (length ?? null);

    // Follow-up call after the user opts into pattern-only suggestions (see
    // the fallback branch below): clue is still required on the request, but
    // this query matches purely on the known-letters pattern/length.
    if (patternOnly) {
      // The extension only ever sends patternOnly after the server already
      // offered a fallback count, which requires knownLetters to be set — so
      // this can't happen via the UI. It guards direct/malformed API calls:
      // without it, a null pattern makes `word ILIKE NULL` silently match zero
      // rows instead of surfacing a clear error.
      if (!pattern) return json({ error: 'knownLetters is required when patternOnly is set' }, 400);

      const result = await pool.query<ClueRow>(
        `SELECT
           c1.word,
           (SELECT COUNT(*) FROM crossword_clues c2 WHERE c2.word = c1.word) AS occurrences,
           (SELECT COUNT(DISTINCT clue) FROM crossword_clues c3 WHERE c3.word = c1.word) > 1 AS has_reclue
         FROM crossword_clues c1
         WHERE ($1::int IS NULL OR LENGTH(c1.word) = $1)
           AND c1.word ILIKE $2
         GROUP BY c1.word
         ORDER BY occurrences DESC
         LIMIT 25`,
        [effectiveLength, pattern],
      );

      return json({
        candidates: result.rows.map((row: ClueRow) => ({
          id: encodeId(row.word),
          length: row.word.length,
          occurrences: parseInt(row.occurrences, 10),
          score: 1.0,
          hasReclue: row.has_reclue,
        })),
      });
    }

    const normalized = normalizeClue(clue);
    const result = await pool.query<ClueRow>(
      `SELECT
         c1.word,
         (SELECT COUNT(*) FROM crossword_clues c2 WHERE c2.word = c1.word) AS occurrences,
         (SELECT COUNT(DISTINCT clue) FROM crossword_clues c3 WHERE c3.word = c1.word) > 1 AS has_reclue
       FROM crossword_clues c1
       WHERE LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(clue, '[.!?,;]+$', ''), '\\s+', ' ', 'g'))) = $1
         AND ($2::int IS NULL OR LENGTH(c1.word) = $2)
         AND ($3::text IS NULL OR c1.word ILIKE $3)
       GROUP BY c1.word
       ORDER BY occurrences DESC`,
      [normalized, effectiveLength, pattern],
    );

    if (result.rows.length > 0) {
      return json({
        candidates: result.rows.map((row: ClueRow) => ({
          id: encodeId(row.word),
          length: row.word.length,
          occurrences: parseInt(row.occurrences, 10),
          score: 1.0,
          hasReclue: row.has_reclue,
        })),
      });
    }

    // No direct clue match. If the user gave us known letters, tell them
    // whether the pattern alone has matches, without revealing them yet.
    if (pattern) {
      const fallback = await pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT word) AS count
         FROM crossword_clues
         WHERE ($1::int IS NULL OR LENGTH(word) = $1)
           AND word ILIKE $2`,
        [effectiveLength, pattern],
      );
      const count = parseInt(fallback.rows[0].count, 10);
      if (count > 0) {
        return json({ candidates: [], fallback: { count } });
      }
    }

    return json({ candidates: [] });
  }

  if (route === 'reclue') {
    const { id, exclude } = body as { id?: string; exclude?: string[] };
    if (!id || typeof id !== 'string') return json({ error: 'id is required' }, 400);

    const word = decodeId(id);
    const excluded = Array.isArray(exclude) ? exclude.map((c) => c.toLowerCase()) : [];
    const result = await pool.query<{ clue: string }>(
      `SELECT clue FROM crossword_clues WHERE word = $1 AND LOWER(clue) != ALL($2::text[]) ORDER BY RANDOM() LIMIT 1`,
      [word, excluded],
    );

    if (result.rows.length === 0) return json({ error: 'No alternative clue found' }, 404);
    return json({ clue: result.rows[0].clue });
  }

  if (route === 'reveal') {
    const { id } = body as { id?: string };
    if (!id || typeof id !== 'string') return json({ error: 'id is required' }, 400);
    return json({ answer: decodeId(id) });
  }

  return json({ error: 'Not found' }, 404);
});
