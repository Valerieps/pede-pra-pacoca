// The Catálogo (docs/spec/catalogo.md): what is already in the attendant's library, searched,
// filtered, sorted and grouped on the phone. The server sends the whole list; it is small enough.
import type { MediaType } from '../media/media';

export interface CatalogItem {
  readonly type: MediaType;
  readonly tmdbId: number;
  readonly title: string;
  readonly year: number | null;
  readonly posterPath: string | null;
  readonly genres: readonly string[];
  /** Series only, when known. */
  readonly seasons: number | null;
  /** IMDb 0-10, TMDB 0-10, Rotten Tomatoes critics 0-100; null when unknown. */
  readonly imdbRating: number | null;
  readonly tmdbRating: number | null;
  readonly criticsScore: number | null;
}

export type CatalogType = 'all' | MediaType;
export const CATALOG_TYPES: readonly CatalogType[] = ['all', 'movie', 'tv'];

export type CatalogSort = 'title' | 'imdb' | 'release';
export const CATALOG_SORTS: readonly CatalogSort[] = ['title', 'imdb', 'release'];

/** Release periods: everything up to 1979, then one per decade. */
export type Decade = 'old' | '1980' | '1990' | '2000' | '2010' | '2020';
export const DECADES: readonly Decade[] = ['old', '1980', '1990', '2000', '2010', '2020'];

export interface CatalogFilters {
  readonly type: CatalogType;
  readonly query: string;
  /** Any of them; empty means every genre. */
  readonly genres: readonly string[];
  /** Any of them; empty means every period. */
  readonly decades: readonly Decade[];
  readonly sort: CatalogSort;
  /** Only for the release sort; A–Z goes up and the IMDb rating goes down. */
  readonly newestFirst: boolean;
  readonly groupByGenre: boolean;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  type: 'all',
  query: '',
  genres: [],
  decades: [],
  sort: 'title',
  newestFirst: true,
  groupByGenre: false,
};

/** The period a year falls in; null without a year. 2030 and later stay in the 2020s for now. */
export function decadeOf(year: number | null): Decade | null {
  if (year === null) return null;
  if (year < 1980) return 'old';
  return String(Math.min(Math.floor(year / 10) * 10, 2020)) as Decade;
}

/** Case and accents do not matter: "acao" finds "Ação". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** How many choices the filter sheet holds: the badge on "Filtros". */
export function activeFilterCount(filters: CatalogFilters): number {
  return filters.genres.length + filters.decades.length + (filters.groupByGenre ? 1 : 0);
}

/** Every genre in the catalog, A–Z, for the filter sheet. */
export function catalogGenres(items: readonly CatalogItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.genres))].sort(compareText);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

/** Nulls go last whatever the direction. */
function compareNullable(a: number | null, b: number | null, descending: boolean): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return descending ? b - a : a - b;
}

export function filterCatalog<T extends CatalogItem>(items: readonly T[], filters: CatalogFilters): T[] {
  const query = normalizeSearch(filters.query);
  return items.filter(
    (item) =>
      (filters.type === 'all' || item.type === filters.type) &&
      (query === '' || normalizeSearch(item.title).includes(query)) &&
      (filters.genres.length === 0 || item.genres.some((g) => filters.genres.includes(g))) &&
      (filters.decades.length === 0 || filters.decades.includes(decadeOf(item.year) as Decade)),
  );
}

/** The chosen order; ties fall back to the title, A–Z. */
export function sortCatalog<T extends CatalogItem>(items: readonly T[], sort: CatalogSort, newestFirst = true): T[] {
  return [...items].sort((a, b) => {
    const primary = sort === 'imdb' ? compareNullable(a.imdbRating, b.imdbRating, true) : sort === 'release' ? compareNullable(a.year, b.year, newestFirst) : 0;
    return primary || compareText(a.title, b.title);
  });
}

export interface CatalogGroup<T extends CatalogItem = CatalogItem> {
  /** Null: the items without a genre, last. */
  readonly genre: string | null;
  readonly items: readonly T[];
}

/** One group per genre, A–Z; a title with two genres shows in both. Order inside is kept. */
export function groupByGenre<T extends CatalogItem>(items: readonly T[]): CatalogGroup<T>[] {
  const groups = new Map<string, T[]>();
  const none: T[] = [];
  for (const item of items) {
    if (item.genres.length === 0) none.push(item);
    for (const genre of item.genres) groups.set(genre, [...(groups.get(genre) ?? []), item]);
  }
  const named = [...groups.keys()].sort(compareText).map((genre) => ({ genre, items: groups.get(genre)! }));
  return none.length > 0 ? [...named, { genre: null, items: none }] : named;
}

/** What the screen shows: filtered, sorted and, when asked, grouped by genre. */
export function arrangeCatalog<T extends CatalogItem>(items: readonly T[], filters: CatalogFilters): { count: number; groups: CatalogGroup<T>[] } {
  const shown = sortCatalog(filterCatalog(items, filters), filters.sort, filters.newestFirst);
  return { count: shown.length, groups: filters.groupByGenre ? groupByGenre(shown) : [{ genre: null, items: shown }] };
}

export const MAX_PROBLEM_LENGTH = 300;

/** What can be wrong with a title, as chips in the report sheet; "Outro" needs the text. */
export type ProblemReason = 'wont_play' | 'no_subtitles' | 'wrong_audio' | 'bad_quality' | 'missing_episode' | 'other';
export const PROBLEM_REASONS: readonly ProblemReason[] = ['wont_play', 'no_subtitles', 'wrong_audio', 'bad_quality', 'missing_episode', 'other'];

/** A movie has no episodes to miss. */
export function problemReasonsFor(type: MediaType): ProblemReason[] {
  return PROBLEM_REASONS.filter((r) => type === 'tv' || r !== 'missing_episode');
}

/** A reason that fits the title, and a text within the limit; "Outro" without a text says nothing. */
export function isValidProblem(type: MediaType, reason: unknown, description: string): reason is ProblemReason {
  if (!problemReasonsFor(type).includes(reason as ProblemReason)) return false;
  if (description.length > MAX_PROBLEM_LENGTH) return false;
  return reason !== 'other' || description !== '';
}
