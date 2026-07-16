// Shared API types for the extension <-> Node backend contract.
// See CONTEXT.md ("Clue Matching" / "API contract") for the source of truth.

export interface LookupRequest {
  /** The clue text the user is stuck on. Sent raw; the backend normalizes it. */
  clue: string;
  /** Optional answer length; the primary disambiguator between candidates. */
  length?: number;
  /** Optional known letters, for unknowns, use _. */
  knownLetters?: string;
  /**
   * When true, match purely on knownLetters/length and skip clue matching.
   * Only used for the follow-up call after a fallback prompt is accepted.
   */
  patternOnly?: boolean;
}

/**
 * A candidate answer. Deliberately carries NO answer or clue text — only
 * non-spoiling metadata — so the answer never reaches the client until the
 * user explicitly reveals it (no-spoiler flow, see CONTEXT.md).
 */
export interface Candidate {
  /** Opaque server-issued token identifying this candidate answer. */
  id: string;
  /** Number of letters in the answer (safe to show — does not spoil). */
  length: number;
  /** How many times this clue -> answer pairing occurs in the dataset. */
  occurrences: number;
  /** Match confidence. 1.0-ish for exact match; real similarity once fuzzy lands. */
  score: number;
  /** Whether an alternative clue exists for this answer (enables "re-clue"). */
  hasReclue: boolean;
}

export interface LookupResponse {
  candidates: Candidate[];
  /**
   * Present only when candidates is empty and knownLetters was supplied: the
   * pattern alone has matches, offered without revealing them. See
   * LookupRequest.patternOnly for the follow-up call that fetches them.
   */
  fallback?: { count: number };
}

export interface ReclueResponse {
  /** An alternative clue for the candidate's answer. Never contains the answer. */
  clue: string;
}

export interface RevealResponse {
  /** The answer text, only returned on explicit reveal. */
  answer: string;
}
