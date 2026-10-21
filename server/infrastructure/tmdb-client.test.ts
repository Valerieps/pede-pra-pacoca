import { describe, expect, it } from 'vitest';
import { tmdbClient, toMediaView } from './tmdb-client';

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify(body), { status });
  };
  return { fn, calls };
}

describe('toMediaView', () => {
  it('reads a movie and a series', () => {
    expect(
      toMediaView({ id: 1, title: ' Duna ', poster_path: '/a.jpg', release_date: '2024-02-27', genres: [{ id: 1, name: 'Drama' }] }, 'movie'),
    ).toEqual({ type: 'movie', tmdbId: 1, title: 'Duna', year: 2024, posterPath: '/a.jpg', releaseDate: '2024-02-27', genres: ['Drama'] });
    expect(toMediaView({ id: 2, name: 'Dark', first_air_date: '' }, 'tv')).toMatchObject({ title: 'Dark', year: null, releaseDate: null, genres: [] });
  });

  it('drops what is not plain data', () => {
    expect(toMediaView({ id: 1, title: 'x', poster_path: 'https://evil.example/a.jpg' }, 'movie')?.posterPath).toBeNull();
    expect(toMediaView({ id: 1, title: 'x', poster_path: '/../a.jpg' }, 'movie')?.posterPath).toBeNull();
    expect(toMediaView({ id: '1', title: 'x' }, 'movie')).toBeNull();
    expect(toMediaView({ id: 1, name: 'x' }, 'movie')).toBeNull();
    expect(toMediaView({ id: 1, title: 'x'.repeat(300) }, 'movie')?.title).toHaveLength(200);
  });
});

describe('tmdbClient', () => {
  it('a v3 key goes in the query string, in Portuguese', async () => {
    const fake = fakeFetch({ results: [{ id: 1, media_type: 'movie', title: 'Duna' }, { id: 2, media_type: 'person', name: 'X' }, { id: 3, media_type: 'tv', name: 'Dark' }] });
    const results = await tmdbClient('abc', fake.fn).search('duna', 'all');
    expect(results.map((r) => [r.type, r.title])).toEqual([
      ['movie', 'Duna'],
      ['tv', 'Dark'],
    ]);
    const { url } = fake.calls[0];
    expect(url.origin + url.pathname).toBe('https://api.themoviedb.org/3/search/multi');
    expect(Object.fromEntries(url.searchParams)).toEqual({ language: 'pt-BR', query: 'duna', include_adult: 'false', api_key: 'abc' });
  });

  it('a v4 token goes in the Authorization header', async () => {
    const fake = fakeFetch({ id: 1, name: 'Dark' });
    expect(await tmdbClient('eyJ.payload.sig', fake.fn).details('tv', 1)).toMatchObject({ type: 'tv', title: 'Dark' });
    expect(fake.calls[0].url.pathname).toBe('/3/tv/1');
    expect(fake.calls[0].url.searchParams.has('api_key')).toBe(false);
    expect((fake.calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer eyJ.payload.sig');
  });

  it('not found is null, other errors throw', async () => {
    expect(await tmdbClient('k', fakeFetch({}, 404).fn).details('movie', 1)).toBeNull();
    await expect(tmdbClient('k', fakeFetch({}, 500).fn).details('movie', 1)).rejects.toThrow();
  });

  it('finds by IMDb id, movies first', async () => {
    const fake = fakeFetch({ movie_results: [], tv_results: [{ id: 1399 }] });
    expect(await tmdbClient('k', fake.fn).findByImdbId('tt0944947')).toEqual({ type: 'tv', tmdbId: 1399 });
    expect(fake.calls[0].url.pathname).toBe('/3/find/tt0944947');
    expect(fake.calls[0].url.searchParams.get('external_source')).toBe('imdb_id');
    expect(await tmdbClient('k', fake.fn).findByImdbId('../x')).toBeNull();
  });
});
