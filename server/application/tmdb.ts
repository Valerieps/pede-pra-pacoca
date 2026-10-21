// TMDB lookups (docs/spec/pedidos.md). TMDB calls are asynchronous, so they run in the Worker
// before it calls the Group Durable Object, whose methods stay synchronous (ADR-006). The Worker
// hands the result to the Group as `Prefetched`, a separate argument the app can never fill in.
import type { ApiError, MediaView, PreviewInput, SearchType } from '../../src/application/api-contract';
import { parseSharedLink, type MediaType } from '../../src/domain/media/media';

/** The port; server/infrastructure/tmdb-client.ts implements it over api.themoviedb.org. */
export interface Tmdb {
  search(query: string, type: SearchType): Promise<MediaView[]>;
  details(type: MediaType, tmdbId: number): Promise<MediaView | null>;
  findByImdbId(imdbId: string): Promise<{ type: MediaType; tmdbId: number } | null>;
}

/** What the Worker looked up for the Group. Trusted: only the Worker sets it. */
export interface Prefetched {
  readonly media?: MediaView;
  readonly results?: readonly MediaView[];
}

export type LookupResult = { readonly ok: true; readonly value: Prefetched } | { readonly ok: false; readonly error: ApiError };

type Input = Record<string, unknown>;
type Lookup = (tmdb: Tmdb, input: Input) => Promise<LookupResult>;

export const MAX_QUERY_LENGTH = 100;
const MEDIA_TYPES: readonly unknown[] = ['movie', 'tv'];

const isMediaType = (value: unknown): value is MediaType => MEDIA_TYPES.includes(value);
const isTmdbId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

async function details(tmdb: Tmdb, type: MediaType, tmdbId: number): Promise<LookupResult> {
  const media = await tmdb.details(type, tmdbId);
  return media ? { ok: true, value: { media } } : { ok: false, error: 'not_found' };
}

async function preview(tmdb: Tmdb, input: Input): Promise<LookupResult> {
  const pick = input as Partial<Extract<PreviewInput, { type: MediaType }>> & { text?: unknown };
  if (isMediaType(pick.type) && isTmdbId(pick.tmdbId)) return details(tmdb, pick.type, pick.tmdbId);
  if (typeof pick.text !== 'string') return { ok: false, error: 'invalid' };
  const target = parseSharedLink(pick.text);
  if (!target) return { ok: false, error: 'unrecognized_link' };
  if (target.source === 'tmdb') return details(tmdb, target.type, target.tmdbId);
  // An IMDb id becomes a TMDB id through TMDB's lookup by external id.
  const found = await tmdb.findByImdbId(target.imdbId);
  return found ? details(tmdb, found.type, found.tmdbId) : { ok: false, error: 'not_found' };
}

async function search(tmdb: Tmdb, input: Input): Promise<LookupResult> {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const type = input.type === undefined ? 'all' : input.type;
  if (!query || query.length > MAX_QUERY_LENGTH || (type !== 'all' && !isMediaType(type))) return { ok: false, error: 'invalid' };
  return { ok: true, value: { results: await tmdb.search(query, type) } };
}

async function create(tmdb: Tmdb, input: Input): Promise<LookupResult> {
  if (input.origin !== 'tmdb') return { ok: true, value: {} };
  if (!isMediaType(input.type) || !isTmdbId(input.tmdbId)) return { ok: false, error: 'invalid' };
  return details(tmdb, input.type, input.tmdbId);
}

/** The queries and commands that need TMDB first, by "query:<name>" or "command:<name>". */
const LOOKUPS: Record<string, Lookup> = {
  'query:media.search': search,
  'query:media.preview': preview,
  'command:request.create': create,
};

export function needsTmdb(kind: 'query' | 'command', name: string): boolean {
  return Object.hasOwn(LOOKUPS, `${kind}:${name}`);
}

/** Runs the lookup a query or command needs. A TMDB failure is `unavailable`, never a crash. */
export async function lookup(tmdb: Tmdb, kind: 'query' | 'command', name: string, input: unknown): Promise<LookupResult> {
  const run = Object.hasOwn(LOOKUPS, `${kind}:${name}`) ? LOOKUPS[`${kind}:${name}`] : undefined;
  if (!run) return { ok: true, value: {} };
  const asInput = typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {};
  try {
    return await run(tmdb, asInput);
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
