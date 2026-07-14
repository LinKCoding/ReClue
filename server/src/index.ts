import express from 'express';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json());

// Normalize a clue for matching: lowercase, trim, collapse whitespace, strip trailing punctuation
function normalizeClue(clue: string): string {
  return clue.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?,;]+$/, '');
}

// Encode/decode the candidate id — base64url of the word (opaque to client, doesn't spoil)
function encodeId(word: string): string {
  return Buffer.from(word).toString('base64url');
}
function decodeId(id: string): string {
  return Buffer.from(id, 'base64url').toString('utf8');
}

// POST /lookup { clue, length? } → { candidates }
app.post('/lookup', async (req, res) => {
  const { clue, length } = req.body as { clue?: string; length?: number };
  if (!clue || typeof clue !== 'string') {
    res.status(400).json({ error: 'clue is required' });
    return;
  }

  const normalized = normalizeClue(clue);

  const result = await pool.query<{
    word: string;
    occurrences: string;
    has_reclue: boolean;
  }>(
    `SELECT
       word,
       COUNT(*) AS occurrences,
       COUNT(DISTINCT clue) > 1 AS has_reclue
     FROM crossword_clues
     WHERE LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(clue, '[.!?,;]+$', ''), '\\s+', ' ', 'g'))) = $1
       AND ($2::int IS NULL OR LENGTH(word) = $2)
     GROUP BY word
     ORDER BY occurrences DESC`,
    [normalized, length ?? null],
  );

  const candidates = result.rows.map((row) => ({
    id: encodeId(row.word),
    length: row.word.length,
    occurrences: parseInt(row.occurrences, 10),
    score: 1.0,
    hasReclue: row.has_reclue,
  }));

  res.json({ candidates });
});

// POST /reclue { id } → { clue }
app.post('/reclue', async (req, res) => {
  const { id } = req.body as { id?: string };
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const word = decodeId(id);
  const result = await pool.query<{ clue: string }>(
    `SELECT clue FROM crossword_clues WHERE word = $1 ORDER BY RANDOM() LIMIT 1`,
    [word],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'No clue found' });
    return;
  }

  res.json({ clue: result.rows[0].clue });
});

// POST /reveal { id } → { answer }
app.post('/reveal', async (req, res) => {
  const { id } = req.body as { id?: string };
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  res.json({ answer: decodeId(id) });
});

const port = process.env.PORT ?? 5555;
app.listen(port, () => {
  console.log(`ReClue server running on http://localhost:${port}`);
});
