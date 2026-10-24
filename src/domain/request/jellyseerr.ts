// What the Paçocast reports about a request it sent to the Jellyseerr, and the lifecycle action it
// becomes (docs/spec/jellyseerr.md, "Status"). The Paçocast translates the Jellyseerr's numbers
// into these names; the rules for what each one does to the request live here, shared and tested.
import type { RequestAction, RequestState } from './lifecycle';

/**
 * - requested, processing: the Jellyseerr has the request ("Requested", "Processing")
 * - partially_available: some episodes are in the server ("Partially Available")
 * - available: the whole media is in the server ("Available")
 * - failed: the Jellyseerr refused the request, or Sonarr/Radarr failed to take it
 */
export type JellyseerrState = 'requested' | 'processing' | 'partially_available' | 'available' | 'failed';

export const JELLYSEERR_STATES: readonly JellyseerrState[] = ['requested', 'processing', 'partially_available', 'available', 'failed'];

export const isJellyseerrState = (value: unknown): value is JellyseerrState => JELLYSEERR_STATES.includes(value as JellyseerrState);

/**
 * The action a report asks for, or null when the request is already there (or past it). A movie
 * is never partially available: for a movie that report means it is still on its way.
 */
export function actionFor(state: RequestState, reported: JellyseerrState): RequestAction | null {
  if (state.origin !== 'tmdb') return null;
  const sent = state.status === 'in_jellyseerr' || state.status === 'partially_available';
  switch (reported) {
    case 'requested':
    case 'processing':
      return state.status === 'approved' ? { type: 'mark_sent' } : null;
    case 'partially_available':
      if (state.mediaType === 'movie') return state.status === 'approved' ? { type: 'mark_sent' } : null;
      return state.status === 'approved' || state.status === 'in_jellyseerr' ? { type: 'mark_partial' } : null;
    case 'available':
      return state.status === 'approved' || sent ? { type: 'mark_fulfilled' } : null;
    case 'failed':
      return state.status === 'approved' || sent ? { type: 'mark_unavailable', reason: { code: 'server_failure' } } : null;
  }
}
