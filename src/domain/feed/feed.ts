// The feed's paging and filters (docs/spec/feed.md). Shared by the app and the server.

export const FEED_PAGE_SIZE = 30;

/** The chips, in screen order: Tudo, Pedidos, Atendidos, Meus. */
export const FEED_FILTERS = ['all', 'requests', 'fulfilled', 'mine'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

/** Anything that is not a known filter means Tudo. */
export function toFeedFilter(value: unknown): FeedFilter {
  return FEED_FILTERS.find((filter) => filter === value) ?? 'all';
}
