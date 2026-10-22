import { describe, expect, it } from 'vitest';
import { omdbClient } from './omdb-client';

const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

describe('omdbClient', () => {
  it('reads the IMDb rating', async () => {
    expect(await omdbClient('k', reply({ imdbRating: '8.6' })).imdbRating('tt15239678')).toBe(8.6);
  });

  it('treats N/A, a missing key and a bad id as unknown, without calling', async () => {
    expect(await omdbClient('k', reply({ imdbRating: 'N/A' })).imdbRating('tt15239678')).toBeNull();
    let called = false;
    const spy = async () => ((called = true), new Response('{}'));
    expect(await omdbClient('', spy).imdbRating('tt15239678')).toBeNull();
    expect(await omdbClient('k', spy).imdbRating('../x')).toBeNull();
    expect(called).toBe(false);
  });

  it('fails on a server error', async () => {
    await expect(omdbClient('k', reply({}, 500)).imdbRating('tt15239678')).rejects.toThrow();
  });
});
