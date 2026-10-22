import { describe, expect, it } from 'vitest';
import type { MediaView } from '../../src/application/api-contract';
import { lookup, needsTmdb, type Ratings, type Tmdb } from './tmdb';

const dune: MediaView = { type: 'movie', tmdbId: 693134, title: 'Duna', year: 2024, posterPath: null, releaseDate: '2024-02-27', genres: [] };

function fakeTmdb(overrides: Partial<Tmdb> = {}): Tmdb & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    search: async (query, type) => {
      calls.push(`search:${type}:${query}`);
      return [dune];
    },
    details: async (type, id) => {
      calls.push(`details:${type}:${id}`);
      return id === dune.tmdbId ? { ...dune, type } : null;
    },
    findByImdbId: async (imdbId) => {
      calls.push(`find:${imdbId}`);
      return imdbId === 'tt15239678' ? { type: 'movie', tmdbId: dune.tmdbId } : null;
    },
    imdbId: async (_type, id) => (id === dune.tmdbId ? 'tt15239678' : null),
    ...overrides,
  };
}

const noRatings: Ratings = { imdbRating: async () => null };

describe('TMDB lookups in the Worker', () => {
  it('only some queries and commands need TMDB', () => {
    expect(needsTmdb('query', 'media.search')).toBe(true);
    expect(needsTmdb('command', 'request.create')).toBe(true);
    expect(needsTmdb('query', 'feed')).toBe(false);
    expect(needsTmdb('query', 'constructor')).toBe(false);
  });

  it('a TMDB link goes straight to the details', async () => {
    const tmdb = fakeTmdb();
    expect(await lookup(tmdb, 'query', 'media.preview', { text: 'olha https://www.themoviedb.org/movie/693134-dune' }, noRatings)).toEqual({ ok: true, value: { media: dune } });
    expect(tmdb.calls).toEqual(['details:movie:693134']);
  });

  it('an IMDb link is converted by the lookup by external id', async () => {
    const tmdb = fakeTmdb();
    expect(await lookup(tmdb, 'query', 'media.preview', { text: 'https://m.imdb.com/title/tt15239678/' }, noRatings)).toMatchObject({ ok: true, value: { media: { tmdbId: 693134 } } });
    expect(tmdb.calls).toEqual(['find:tt15239678', 'details:movie:693134']);
    expect(await lookup(tmdb, 'query', 'media.preview', { text: 'https://www.imdb.com/title/tt0000001/' }, noRatings)).toEqual({ ok: false, error: 'not_found' });
  });

  it('a link the app does not know is unrecognized, a pick from the search is looked up', async () => {
    const tmdb = fakeTmdb();
    expect(await lookup(tmdb, 'query', 'media.preview', { text: 'https://letterboxd.com/film/dune' }, noRatings)).toEqual({ ok: false, error: 'unrecognized_link' });
    expect(await lookup(tmdb, 'query', 'media.preview', { type: 'tv', tmdbId: 693134 }, noRatings)).toMatchObject({ ok: true, value: { media: { type: 'tv' } } });
    expect(await lookup(tmdb, 'query', 'media.preview', { type: 'tv', tmdbId: 5 }, noRatings)).toEqual({ ok: false, error: 'not_found' });
    expect(await lookup(tmdb, 'query', 'media.preview', { type: 'book', tmdbId: 1 }, noRatings)).toEqual({ ok: false, error: 'invalid' });
  });

  it('search checks the text and the filter', async () => {
    const tmdb = fakeTmdb();
    expect(await lookup(tmdb, 'query', 'media.search', { query: ' duna ', type: 'movie' }, noRatings)).toEqual({ ok: true, value: { results: [dune] } });
    expect(tmdb.calls).toEqual(['search:movie:duna']);
    expect(await lookup(tmdb, 'query', 'media.search', { query: '   ', type: 'all' }, noRatings)).toEqual({ ok: false, error: 'invalid' });
    expect(await lookup(tmdb, 'query', 'media.search', { query: 'x'.repeat(101), type: 'all' }, noRatings)).toEqual({ ok: false, error: 'invalid' });
    expect(await lookup(tmdb, 'query', 'media.search', { query: 'duna', type: 'person' }, noRatings)).toEqual({ ok: false, error: 'invalid' });
  });

  it('creating a TMDB request fetches the details; a manual one needs nothing', async () => {
    const tmdb = fakeTmdb();
    expect(await lookup(tmdb, 'command', 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: 693134 }, noRatings)).toEqual({ ok: true, value: { media: dune } });
    expect(await lookup(tmdb, 'command', 'request.create', { origin: 'manual', title: 'x' }, noRatings)).toEqual({ ok: true, value: {} });
    expect(await lookup(tmdb, 'command', 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: -1 }, noRatings)).toEqual({ ok: false, error: 'invalid' });
  });

  it('a TMDB failure is unavailable', async () => {
    const tmdb = fakeTmdb({
      search: async () => {
        throw new Error('down');
      },
    });
    expect(await lookup(tmdb, 'query', 'media.search', { query: 'duna', type: 'all' }, noRatings)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('the IMDb id and rating come from TMDB and OMDb', async () => {
    const ratings: Ratings = { imdbRating: async () => 8.6 };
    expect(await lookup(fakeTmdb(), 'query', 'media.imdb', { type: 'movie', tmdbId: 693134 }, ratings)).toEqual({
      ok: true,
      value: { imdb: { imdbId: 'tt15239678', rating: 8.6 } },
    });
  });

  it('the IMDb link survives a failing rating lookup', async () => {
    const ratings: Ratings = { imdbRating: async () => Promise.reject(new Error('down')) };
    expect(await lookup(fakeTmdb(), 'query', 'media.imdb', { type: 'movie', tmdbId: 693134 }, ratings)).toEqual({
      ok: true,
      value: { imdb: { imdbId: 'tt15239678', rating: null } },
    });
    expect(await lookup(fakeTmdb(), 'query', 'media.imdb', { type: 'movie', tmdbId: 1 }, noRatings)).toEqual({
      ok: true,
      value: { imdb: { imdbId: null, rating: null } },
    });
    expect(await lookup(fakeTmdb(), 'query', 'media.imdb', { type: 'x', tmdbId: 1 }, noRatings)).toEqual({ ok: false, error: 'invalid' });
  });
});
