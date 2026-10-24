// The Paçoca animation for an Cãopleto plays once per request on each phone
// (docs/spec/identidade.md). This remembers, on this device only, which ones already played.
import type { RequestStatus } from '../domain/request/lifecycle';

/** Mine or one I said "Eu também quero" to, now Cãopleto. */
export function celebratesFulfilled(request: {
  readonly status: RequestStatus;
  readonly viewer: { readonly isRequester: boolean; readonly isCoRequester: boolean };
}): boolean {
  return request.status === 'fulfilled' && (request.viewer.isRequester || request.viewer.isCoRequester);
}

/** Enough for years of requests in a small group; the oldest are forgotten first. */
export const MAX_REMEMBERED = 200;

const SEEN_KEY = 'celebrated-fulfilled';

type Store = Pick<Storage, 'getItem' | 'setItem'> | null;

function read(storage: Store): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Marks the request as celebrated and says whether it was the first time on this phone.
 * Without storage it always answers true: an extra animation is better than none.
 */
export function firstCelebration(storage: Store, requestId: string): boolean {
  const seen = read(storage);
  if (seen.includes(requestId)) return false;
  try {
    storage?.setItem(SEEN_KEY, JSON.stringify([...seen, requestId].slice(-MAX_REMEMBERED)));
  } catch {
    // Blocked storage: it may play again next time.
  }
  return true;
}

export function browserCelebrationStore(): Store {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
