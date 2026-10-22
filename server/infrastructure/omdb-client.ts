// The Ratings port over OMDb (in SERVER_ORIGINS): TMDB has no IMDb rating. The key never leaves
// the Worker. Without a key every rating is unknown and the app simply shows none.
import type { Ratings } from '../application/tmdb';

const API = 'https://www.omdbapi.com/';
const TIMEOUT_MS = 5000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function omdbClient(key: string, fetchFn: Fetch = (url, init) => fetch(url, init)): Ratings {
  return {
    async imdbRating(imdbId: string) {
      if (!key || !/^tt\d{5,10}$/.test(imdbId)) return null;
      const response = await fetchFn(`${API}?${new URLSearchParams({ i: imdbId, apikey: key })}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`OMDb ${response.status}`);
      const body = (await response.json()) as { imdbRating?: unknown };
      const rating = typeof body.imdbRating === 'string' ? Number(body.imdbRating) : NaN;
      return Number.isFinite(rating) && rating >= 0 && rating <= 10 ? rating : null;
    },
  };
}
