// The Tmdb port over TMDB's API v3 (in SERVER_ORIGINS). The key never leaves the Worker. It is
// either a v3 API key or a v4 read access token (a JWT); both work against v3.
import type { MediaView, SearchType } from '../../src/application/api-contract';
import { isPosterPath, MAX_TITLE_LENGTH, type MediaType } from '../../src/domain/media/media';
import type { Tmdb } from '../application/tmdb';

const API = 'https://api.themoviedb.org/3';
const LANGUAGE = 'pt-BR';
const TIMEOUT_MS = 5000;
const MAX_RESULTS = 20;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface TmdbItem {
  id?: unknown;
  media_type?: unknown;
  title?: unknown;
  name?: unknown;
  poster_path?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  genres?: unknown;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** TMDB's answer, checked field by field: only plain, bounded values reach the database. */
export function toMediaView(item: TmdbItem, type: MediaType): MediaView | null {
  const rawTitle = type === 'movie' ? item.title : item.name;
  if (typeof item.id !== 'number' || !Number.isInteger(item.id) || typeof rawTitle !== 'string' || !rawTitle.trim()) return null;
  const rawDate = type === 'movie' ? item.release_date : item.first_air_date;
  const releaseDate = typeof rawDate === 'string' && DATE.test(rawDate) ? rawDate : null;
  const genres = Array.isArray(item.genres)
    ? item.genres
        .map((g: unknown) => (typeof g === 'object' && g !== null ? (g as { name?: unknown }).name : null))
        .filter((name): name is string => typeof name === 'string')
        .map((name) => name.slice(0, 50))
        .slice(0, 10)
    : [];
  return {
    type,
    tmdbId: item.id,
    title: rawTitle.trim().slice(0, MAX_TITLE_LENGTH),
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    posterPath: isPosterPath(item.poster_path) ? item.poster_path : null,
    releaseDate,
    genres,
  };
}

export function tmdbClient(key: string, fetchFn: Fetch = (url, init) => fetch(url, init)): Tmdb {
  const bearer = key.includes('.');

  async function get(path: string, params: Record<string, string>): Promise<unknown | null> {
    const query = new URLSearchParams({ language: LANGUAGE, ...params, ...(bearer ? {} : { api_key: key }) });
    const response = await fetchFn(`${API}${path}?${query}`, {
      headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${key}` } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`TMDB ${response.status}`);
    return response.json();
  }

  const resultsOf = (body: unknown): TmdbItem[] => {
    const results = (body as { results?: unknown } | null)?.results;
    return Array.isArray(results) ? (results as TmdbItem[]) : [];
  };

  return {
    async search(query: string, type: SearchType) {
      const path = type === 'all' ? '/search/multi' : `/search/${type}`;
      const body = await get(path, { query, include_adult: 'false' });
      return resultsOf(body)
        .map((item) => {
          const itemType = type === 'all' ? item.media_type : type;
          return itemType === 'movie' || itemType === 'tv' ? toMediaView(item, itemType) : null;
        })
        .filter((m): m is MediaView => m !== null)
        .slice(0, MAX_RESULTS);
    },

    async details(type: MediaType, tmdbId: number) {
      const body = await get(`/${type}/${tmdbId}`, {});
      return body ? toMediaView(body as TmdbItem, type) : null;
    },

    async findByImdbId(imdbId: string) {
      if (!/^tt\d{5,10}$/.test(imdbId)) return null;
      const body = (await get(`/find/${imdbId}`, { external_source: 'imdb_id' })) as { movie_results?: unknown; tv_results?: unknown } | null;
      const first = (list: unknown) => (Array.isArray(list) ? (list[0] as TmdbItem | undefined) : undefined);
      const movie = first(body?.movie_results);
      if (movie && typeof movie.id === 'number') return { type: 'movie', tmdbId: movie.id };
      const tv = first(body?.tv_results);
      if (tv && typeof tv.id === 'number') return { type: 'tv', tmdbId: tv.id };
      return null;
    },
  };
}
