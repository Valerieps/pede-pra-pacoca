import { beforeEach, describe, expect, it } from 'vitest';
import { parseSharedLink } from '../domain/media/media';
import { captureShare, clearPendingShare, MAX_SHARED_LENGTH, pendingShare, sharedTextFrom, type ShareEnvironment } from './share-target';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function env(pathname: string, search: string, storage = fakeStorage()) {
  const replaced: string[] = [];
  const e: ShareEnvironment = { location: { pathname, search }, replaceUrl: (p) => replaced.push(p), storage };
  return { env: e, replaced, storage };
}

describe('sharedTextFrom', () => {
  it('keeps the link Android puts inside text', () => {
    const text = sharedTextFrom('?text=' + encodeURIComponent('Olha esse https://www.imdb.com/title/tt15239678/'));
    expect(text).toBe('Olha esse https://www.imdb.com/title/tt15239678/');
    expect(parseSharedLink(text!)).toEqual({ source: 'imdb', imdbId: 'tt15239678' });
  });

  it('puts url first and drops repeated fields', () => {
    const link = 'https://www.themoviedb.org/movie/693134';
    const search = new URLSearchParams({ url: link, text: link, title: 'Duna' }).toString();
    expect(sharedTextFrom(search)).toBe(`${link} Duna`);
  });

  it('is null for an empty share and cuts long text', () => {
    expect(sharedTextFrom('?title=%20&text=')).toBeNull();
    expect(sharedTextFrom('?text=' + 'a'.repeat(5000))!.length).toBe(MAX_SHARED_LENGTH);
  });
});

describe('captureShare', () => {
  beforeEach(() => clearPendingShare({ storage: null }));

  it('ignores every other path', () => {
    const { env: e, replaced } = env('/pedir', '?text=x');
    expect(captureShare(e)).toBe(false);
    expect(replaced).toEqual([]);
    expect(pendingShare(e)).toBeNull();
  });

  it('keeps the text and clears it from the address bar', () => {
    const { env: e, replaced, storage } = env('/compartilhar', '?text=https%3A%2F%2Fimdb.com%2Ftitle%2Ftt0111161');
    expect(captureShare(e)).toBe(true);
    expect(replaced).toEqual(['/pedir']);
    expect(pendingShare(e)).toBe('https://imdb.com/title/tt0111161');
    expect([...storage.data.values()]).toEqual(['https://imdb.com/title/tt0111161']);
  });

  it('survives a reload through the tab storage, until cleared', () => {
    const storage = fakeStorage();
    captureShare(env('/compartilhar', '?url=https%3A%2F%2Fexample.com', storage).env);
    clearPendingShare({ storage: null }); // a reload forgets the memory, not the tab storage
    storage.data.set('pending-share', 'https://example.com');
    expect(pendingShare({ storage })).toBe('https://example.com');
    clearPendingShare({ storage });
    expect(pendingShare({ storage })).toBeNull();
  });

  it('keeps an empty share, so Pedir can say it found no link', () => {
    const { env: e } = env('/compartilhar', '');
    expect(captureShare(e)).toBe(true);
    expect(pendingShare(e)).toBe('');
  });

  it('works without storage', () => {
    const { env: e } = env('/compartilhar', '?text=oi', null as never);
    expect(captureShare({ ...e, storage: null })).toBe(true);
    expect(pendingShare({ storage: null })).toBe('oi');
  });
});
