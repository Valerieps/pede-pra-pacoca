// The feed's paging and filters (docs/spec/feed.md). Shared by the app and the server.

export const FEED_PAGE_SIZE = 30;

/** "A Paçoca achou" shows only with at least this many posts between it and its "pediu". */
export const FOUND_MIN_GAP = 5;

/** The chips, in screen order: Tudo, Pedidos, Cãopletos, Meus. */
export const FEED_FILTERS = ['all', 'requests', 'mine'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

/** Anything that is not a known filter means Tudo. */
export function toFeedFilter(value: unknown): FeedFilter {
  return FEED_FILTERS.find((filter) => filter === value) ?? 'all';
}

