// The attendant's queues (docs/spec/atendente.md, "Filas"): which requests each one holds, how
// they sort and group, and the "Abrir no Jellyseerr" link. Pure: the server picks the members,
// the app sorts and groups what it shows.
import type { MediaType } from '../media/media';
import type { RequestOrigin, RequestStatus } from './lifecycle';

export type QueueName = 'awaiting' | 'toSend' | 'inJellyseerr' | 'manual';

export const QUEUES: readonly QueueName[] = ['awaiting', 'toSend', 'inJellyseerr', 'manual'];

/** The queue a request sits in, or null once it left them all (closed or canceled). */
export function queueOf(request: { status: RequestStatus; origin: RequestOrigin }): QueueName | null {
  if (request.status === 'awaiting_approval') return 'awaiting';
  if (request.status === 'in_jellyseerr') return 'inJellyseerr';
  if (request.status === 'approved') return request.origin === 'tmdb' ? 'toSend' : 'manual';
  return null;
}

export type QueueSort = 'date' | 'coRequesters' | 'release';
export type QueueGrouping = 'none' | 'person' | 'type' | 'assignee';

interface Person {
  readonly id: string;
  readonly name: string;
}

/** What sorting and grouping need from a request. */
export interface QueueItem {
  readonly createdAt: string;
  readonly releaseDate: string | null;
  readonly mediaType: MediaType;
  readonly requester: Person;
  readonly assignee: Person | null;
  readonly coRequesters: readonly unknown[];
}

const byDate = (a: QueueItem, b: QueueItem) => a.createdAt.localeCompare(b.createdAt);

/**
 * Oldest request first; most co-requesters first; earliest release first, with no date (manual
 * requests) last. Ties keep the oldest request first.
 */
export function sortQueue<T extends QueueItem>(items: readonly T[], sort: QueueSort): T[] {
  const compare = (a: T, b: T): number => {
    if (sort === 'coRequesters') return b.coRequesters.length - a.coRequesters.length || byDate(a, b);
    if (sort === 'release') {
      if (a.releaseDate === b.releaseDate) return byDate(a, b);
      if (a.releaseDate === null) return 1;
      if (b.releaseDate === null) return -1;
      return a.releaseDate.localeCompare(b.releaseDate) || byDate(a, b);
    }
    return byDate(a, b);
  };
  return [...items].sort(compare);
}

export interface QueueGroup<T> {
  /** Stable key: a member id, a media type, or '' for "nobody took it" and for no grouping. */
  readonly key: string;
  /** A member's name or a media type; null for the no-grouping group and for "nobody took it". */
  readonly label: string | null;
  readonly items: T[];
}

/**
 * Groups already sorted items, keeping their order inside each group. Groups come in the order of
 * their first item; "nobody took it" comes last.
 */
export function groupQueue<T extends QueueItem>(items: readonly T[], grouping: QueueGrouping): QueueGroup<T>[] {
  if (grouping === 'none') return items.length ? [{ key: '', label: null, items: [...items] }] : [];
  const groups = new Map<string, QueueGroup<T>>();
  for (const item of items) {
    const [key, label] =
      grouping === 'person'
        ? [item.requester.id, item.requester.name]
        : grouping === 'type'
          ? [item.mediaType, item.mediaType]
          : item.assignee
            ? [item.assignee.id, item.assignee.name]
            : ['', null];
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.key !== ''), ...all.filter((g) => g.key === '')];
}

/**
 * The media's page on the attendant's Jellyseerr: base URL plus type and TMDB id. Null when the
 * base URL is unset or not http(s), or the request has no TMDB id.
 */
export function jellyseerrUrl(base: string | null, mediaType: MediaType, tmdbId: number | null): string | null {
  if (!base || tmdbId === null) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}/${mediaType}/${tmdbId}`;
}
