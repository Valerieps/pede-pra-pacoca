import { describe, expect, it } from 'vitest';
import { isPosterPath, isUnreleased, mediaKey, normalizeManualLink, parseSharedLink } from './media';

describe('parseSharedLink', () => {
  it.each([
    ['https://www.themoviedb.org/movie/693134-dune-part-two', { source: 'tmdb', type: 'movie', tmdbId: 693134 }],
    ['https://www.themoviedb.org/tv/1399-game-of-thrones?language=pt-BR', { source: 'tmdb', type: 'tv', tmdbId: 1399 }],
    ['https://www.imdb.com/title/tt15239678/', { source: 'imdb', imdbId: 'tt15239678' }],
    ['https://m.imdb.com/title/tt15239678/?ref_=ext_shr', { source: 'imdb', imdbId: 'tt15239678' }],
    ['https://www.imdb.com/pt/title/tt0944947/', { source: 'imdb', imdbId: 'tt0944947' }],
    ['Olha esse: https://www.imdb.com/title/tt15239678/ bora?', { source: 'imdb', imdbId: 'tt15239678' }],
  ])('recognizes %s', (text, expected) => {
    expect(parseSharedLink(text)).toEqual(expected);
  });

  it.each([
    'Duna',
    'https://www.imdb.com/name/nm0000123/',
    'https://www.themoviedb.org/person/287',
    'https://imdb.com.evil.example/title/tt15239678/',
    'https://example.com/movie/1',
  ])('does not recognize %s', (text) => {
    expect(parseSharedLink(text)).toBeNull();
  });
});

describe('media', () => {
  it('builds the duplicate key from type and id', () => {
    expect(mediaKey('tv', 1399)).toBe('tv:1399');
  });

  it('marks a future release', () => {
    const now = new Date('2026-10-21T12:00:00Z');
    expect(isUnreleased('2027-03-01', now)).toBe(true);
    expect(isUnreleased('2024-03-01', now)).toBe(false);
    expect(isUnreleased(null, now)).toBe(false);
  });
});

describe('isPosterPath', () => {
  it.each([
    ['/abc123.jpg', true],
    ['/a_b-c.png', true],
    ['abc.jpg', false],
    ['/../x.jpg', false],
    ['https://image.tmdb.org/t/p/w342/abc.jpg', false],
    [null, false],
  ])('%s → %s', (path, expected) => {
    expect(isPosterPath(path)).toBe(expected);
  });
});

describe('normalizeManualLink', () => {
  it('keeps http(s) links, without the fragment', () => {
    expect(normalizeManualLink(' https://Example.com/a?b=1#c ')).toBe('https://example.com/a?b=1');
    expect(normalizeManualLink('http://example.com')).toBe('http://example.com/');
  });

  it.each(['', 'example.com', 'javascript:alert(1)', 'data:text/html,x', `https://example.com/${'a'.repeat(500)}`])('refuses %s', (text) => {
    expect(normalizeManualLink(text)).toBeNull();
  });
});
