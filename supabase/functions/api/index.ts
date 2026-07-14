import pg from 'npm:pg';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const route = new URL(req.url).pathname.split('/').at(-1);
  const body = await req.json().catch(() => ({}));

  if (route === 'lookup') {
    const { clue, length, knownLetters } = body as { clue?: string; length?: number; knownLetters?: string };
    if (!clue || typeof clue !== 'string') return json({ error: 'clue is required' }, 400);

    const normalized = normalizeClue(clue);
    const pattern = knownLetters ? knownLetters.replace(/%/g, '_') : null;
    const effectiveLength = pattern ? pattern.length : (length ?? null);

    const result = await pool.query<{ word: string; occurrences: string; has_reclue: boolean }>(
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

    return json({
      candidates: result.rows.map((row) => ({
        id: encodeId(row.word),
        length: row.word.length,
        occurrences: parseInt(row.occurrences, 10),
        score: 1.0,
        hasReclue: row.has_reclue,
      })),
    });
  }

  if (route === 'reclue') {
    const { id, exclude } = body as { id?: string; exclude?: string[] };
    if (!id || typeof id !== 'string') return json({ error: 'id is required' }, 400);

    const word = decodeId(id);
    const excluded = Array.isArray(exclude) ? exclude : [];
    const result = await pool.query<{ clue: string }>(
      `SELECT clue FROM crossword_clues WHERE word = $1 AND clue != ALL($2::text[]) ORDER BY RANDOM() LIMIT 1`,
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
