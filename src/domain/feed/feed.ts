// The feed's paging and filters (docs/spec/feed.md). Shared by the app and the server.

import { strings } from '../strings';

export const FEED_PAGE_SIZE = 30;

/** The chips, in screen order: Tudo, Pedidos, Atendidos, Meus. */
export const FEED_FILTERS = ['all', 'requests', 'fulfilled', 'mine'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

/** Anything that is not a known filter means Tudo. */
export function toFeedFilter(value: unknown): FeedFilter {
  return FEED_FILTERS.find((filter) => filter === value) ?? 'all';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago an event happened, short as feeds show it: "agora", "5 min", "3 h", "2 d",
 * then the day ("21 de out."), with the year only when it is not this year.
 */
export function feedAge(at: string, now: Date): string {
  const then = new Date(at);
  const elapsed = Math.max(0, now.getTime() - then.getTime());
  if (elapsed < MINUTE) return strings.feed.age.now;
  if (elapsed < HOUR) return strings.feed.age.minutes(Math.floor(elapsed / MINUTE));
  if (elapsed < DAY) return strings.feed.age.hours(Math.floor(elapsed / HOUR));
  if (elapsed < 7 * DAY) return strings.feed.age.days(Math.floor(elapsed / DAY));
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
