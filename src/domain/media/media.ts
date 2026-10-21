// Media and the links people share (docs/spec/pedidos.md, docs/spec/app-e-instalacao.md).
export type MediaType = 'movie' | 'tv';

/** What a shared link points to. IMDb ids still need the TMDB lookup by external id. */
export type LinkTarget =
  | { readonly source: 'tmdb'; readonly type: MediaType; readonly tmdbId: number }
  | { readonly source: 'imdb'; readonly imdbId: string };

const URL_IN_TEXT = /\bhttps?:\/\/\S+/i;

/**
 * Finds an IMDb or TMDB link in shared text. Android often sends the link inside `text`
 * ("Olha esse filme https://..."), so the whole text is searched.
 */
export function parseSharedLink(text: string): LinkTarget | null {
  const match = URL_IN_TEXT.exec(text);
  if (!match) return null;
  let url: URL;
  try {
    url = new URL(match[0]);
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

/** Selo "Ainda não lançado": a release date in the future. Not a request status. */
export function isUnreleased(releaseDate: string | null, now: Date): boolean {
  if (!releaseDate) return false;
  return new Date(`${releaseDate}T00:00:00Z`).getTime() > now.getTime();
}
