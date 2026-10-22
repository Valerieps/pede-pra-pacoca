// The Ratings port over OMDb (in SERVER_ORIGINS): TMDB has no IMDb or Rotten Tomatoes scores. The
// key never leaves the Worker. Without a key every score is unknown and the app simply shows none.
import type { Ratings, Scores } from '../application/tmdb';

const API = 'https://www.omdbapi.com/';
const TIMEOUT_MS = 5000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const NONE: Scores = { imdb: null, critics: null, audience: null };

/** A number from OMDb's text ("8.6", "90%"), or null for "N/A" and anything out of range. */
function score(value: unknown, max: number): number | null {
  if (typeof value !== 'string') return null;
  const n = Number(value.replace('%', ''));
  return value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

export function omdbClient(key: string, fetchFn: Fetch = (url, init) => fetch(url, init)): Ratings {
  return {
    async scores(imdbId: string) {
      if (!key || !/^tt\d{5,10}$/.test(imdbId)) return NONE;
      const response = await fetchFn(`${API}?${new URLSearchParams({ i: imdbId, apikey: key, tomatoes: 'true' })}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`OMDb ${response.status}`);
      const body = (await response.json()) as { imdbRating?: unknown; tomatoMeter?: unknown; tomatoUserMeter?: unknown; Ratings?: unknown };
      const rotten = Array.isArray(body.Ratings)
        ? (body.Ratings as { Source?: unknown; Value?: unknown }[]).find((r) => r.Source === 'Rotten Tomatoes')?.Value
        : undefined;
      return {
        imdb: score(body.imdbRating, 10),
        critics: score(rotten, 100) ?? score(body.tomatoMeter, 100),
        audience: score(body.tomatoUserMeter, 100),
      };
    },
  };
}
