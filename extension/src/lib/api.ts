import type {
  LookupRequest,
  LookupResponse,
  ReclueResponse,
  RevealResponse,
} from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5555').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the ReClue server. Is it running?');
  }

  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status}).`, res.status);
  }

  return (await res.json()) as T;
}

/** Look up a clue; returns non-spoiling candidate metadata only. */
export function lookup(req: LookupRequest): Promise<LookupResponse> {
  return post<LookupResponse>('/lookup', req);
}

/** Fetch an alternative clue for a candidate (does not reveal the answer). */
export function reclue(id: string, exclude: string[] = []): Promise<ReclueResponse> {
  return post<ReclueResponse>('/reclue', { id, exclude });
}

/** Reveal the answer for a candidate. */
export function reveal(id: string): Promise<RevealResponse> {
  return post<RevealResponse>('/reveal', { id });
}
