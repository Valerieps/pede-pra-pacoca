// Media and the links people share (docs/spec/pedidos.md, docs/spec/app-e-instalacao.md).
export type MediaType = 'movie' | 'tv';

/** What a shared link points to. IMDb ids still need the TMDB lookup by external id. */
export type LinkTarget =
  | { readonly source: 'tmdb'; readonly type: MediaType; readonly tmdbId: number }
  | { readonly source: 'imdb'; readonly imdbId: string };

const URL_IN_TEXT = /\bhttps?:\/\/\S+/i;

/** The first http(s) link in a text, or null. */
export function findUrl(text: string): string | null {
  return URL_IN_TEXT.exec(text)?.[0] ?? null;
}

/**
 * Finds an IMDb or TMDB link in shared text. Android often sends the link inside `text`
 * ("Olha esse filme https://..."), so the whole text is searched.
 */
export function parseSharedLink(text: string): LinkTarget | null {
  const found = findUrl(text);
  if (!found) return null;
  let url: URL;
  try {
    url = new URL(found);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (host === 'imdb.com') {
    const imdb = /^\/(?:[a-z]{2}\/)?title\/(tt\d{5,10})/i.exec(url.pathname);
    return imdb ? { source: 'imdb', imdbId: imdb[1].toLowerCase() } : null;
  }
  if (host === 'themoviedb.org') {
    const tmdb = /^\/(movie|tv)\/(\d+)/.exec(url.pathname);
    return tmdb ? { source: 'tmdb', type: tmdb[1] as MediaType, tmdbId: Number(tmdb[2]) } : null;
  }
  return null;
}

/** The key for the duplicate check and Mídias conhecidas: the same TMDB id and type. */
export function mediaKey(type: MediaType, tmdbId: number): string {
  return `${type}:${tmdbId}`;
}

/** The film's page on Letterboxd, which redirects from the TMDB id. Letterboxd has no series. */
export function letterboxdUrl(type: MediaType, tmdbId: number): string | null {
  return type === 'movie' ? `https://letterboxd.com/tmdb/${tmdbId}/` : null;
}

/** Selo "Ainda não lançado": a release date in the future. Not a request status. */
export function isUnreleased(releaseDate: string | null, now: Date): boolean {
  if (!releaseDate) return false;
  return new Date(`${releaseDate}T00:00:00Z`).getTime() > now.getTime();
}

/** A TMDB image path such as "/abc123.jpg"; anything else is dropped before it is stored. */
export function isPosterPath(path: unknown): path is string {
  return typeof path === 'string' && /^\/[A-Za-z0-9_-]{1,100}\.(jpg|jpeg|png|webp)$/.test(path);
}

export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTE_LENGTH = 500;
export const MAX_LINK_LENGTH = 500;

/**
 * The optional link of a manual request: any http(s) URL, normalized so the same link typed twice
 * matches in the duplicate check. Null when it is not a usable URL.
 */
export function normalizeManualLink(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_LINK_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  url.hash = '';
  return url.href;
}
