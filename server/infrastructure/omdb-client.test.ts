import { describe, expect, it } from 'vitest';
import { omdbClient } from './omdb-client';

const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
const none = { imdb: null, critics: null, audience: null };

describe('omdbClient', () => {
  it('reads the IMDb rating and the Rotten Tomatoes scores', async () => {
    const body = { imdbRating: '8.6', tomatoUserMeter: '97', Ratings: [{ Source: 'Rotten Tomatoes', Value: '90%' }] };
    expect(await omdbClient('k', reply(body)).scores('tt15239678')).toEqual({ imdb: 8.6, critics: 90, audience: 97 });
  });

  it('treats N/A, a missing key and a bad id as unknown, without calling', async () => {
    expect(await omdbClient('k', reply({ imdbRating: 'N/A', tomatoUserMeter: 'N/A' })).scores('tt15239678')).toEqual(none);
    let called = false;
    const spy = async () => ((called = true), new Response('{}'));
    expect(await omdbClient('', spy).scores('tt15239678')).toEqual(none);
    expect(await omdbClient('k', spy).scores('../x')).toEqual(none);
    expect(called).toBe(false);
  });

  it('fails on a server error', async () => {
    await expect(omdbClient('k', reply({}, 500)).scores('tt15239678')).rejects.toThrow();
  });
});
