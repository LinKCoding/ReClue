# ADR 0001 — No-spoiler lookup contract

- Status: Accepted
- Date: 2026-07-08

## Context

ReClue's core value is helping a solver *without* spoiling the answer: the
primary feature is handing back an **alternative clue** ("re-clue"), with
revealing the answer as a deliberate second step. A clue lookup can match
multiple candidate answers, disambiguated by answer length.

The obvious/naive API would have `POST /lookup` return the candidate answers
directly (e.g. `{ candidates: [{ answer, occurrences }] }`). This is simpler —
one round-trip — but it puts every matched answer on the wire and in the
browser's memory/devtools *before* the user chooses to see it. That defeats the
no-spoiler premise at the network layer even if the UI hides the text.

## Decision

`/lookup` returns **non-spoiling metadata only**; answer and clue text are
fetched on explicit user action via separate endpoints.

- `POST /lookup { clue, length? }`
  → `{ candidates: [{ id, length, occurrences, hasReclue }] }`
  - `id` is an opaque server-issued token for a candidate answer.
  - No `answer` and no alternative-clue text is included.
- `POST /reclue { id }` → `{ clue }` (an alternative clue; still no answer text).
- `POST /reveal { id }` → `{ answer }` (only here does answer text reach the client).

## Consequences

- The front-end renders candidates as anonymous slots ("Answer 1 — 5 letters")
  and only shows text after re-clue/reveal. Spoiler-safety holds at the network
  layer, not just the UI.
- Cost: two extra endpoints and additional round-trips; the server must maintain
  a mapping from opaque `id` → candidate answer for the follow-up calls.

## Alternatives considered

- **Return answers in `/lookup` and hide them in the UI.** Rejected: answers
  leak via devtools/network, defeating the premise; the simplicity is not worth
  breaking the product's core promise.
