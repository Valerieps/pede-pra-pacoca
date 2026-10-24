import { describe, expect, it } from 'vitest';
import { actionFor, isJellyseerrState } from './jellyseerr';
import type { RequestState } from './lifecycle';

const movie: RequestState = {
  status: 'approved',
  origin: 'tmdb',
  mediaType: 'movie',
  requesterId: 'ana',
  assigneeId: null,
  petiscoLot: 'monthly:2026-10',
  coRequesterIds: [],
};
const series: RequestState = { ...movie, mediaType: 'tv' };

describe('actionFor', () => {
  it('Requested and Processing: Solicitado becomes Farejando', () => {
    expect(actionFor(movie, 'requested')).toEqual({ type: 'mark_sent' });
    expect(actionFor(movie, 'processing')).toEqual({ type: 'mark_sent' });
    expect(actionFor({ ...movie, status: 'in_jellyseerr' }, 'processing')).toBeNull();
  });

  it('Partially Available: a series moves on, a movie is still on its way', () => {
    expect(actionFor(series, 'partially_available')).toEqual({ type: 'mark_partial' });
    expect(actionFor({ ...series, status: 'in_jellyseerr' }, 'partially_available')).toEqual({ type: 'mark_partial' });
    expect(actionFor({ ...series, status: 'partially_available' }, 'partially_available')).toBeNull();
    expect(actionFor(movie, 'partially_available')).toEqual({ type: 'mark_sent' });
    expect(actionFor({ ...movie, status: 'in_jellyseerr' }, 'partially_available')).toBeNull();
  });

  it('Available closes the request from any step before it', () => {
    for (const status of ['approved', 'in_jellyseerr', 'partially_available'] as const) {
      expect(actionFor({ ...series, status }, 'available')).toEqual({ type: 'mark_fulfilled' });
    }
    expect(actionFor({ ...series, status: 'fulfilled' }, 'available')).toBeNull();
  });

  it('a failure becomes Não foi possível, by the server', () => {
    expect(actionFor({ ...movie, status: 'in_jellyseerr' }, 'failed')).toEqual({ type: 'mark_unavailable', reason: { code: 'server_failure' } });
    expect(actionFor({ ...movie, status: 'canceled' }, 'failed')).toBeNull();
  });

  it('waiting for approval, closed or manual: nothing', () => {
    expect(actionFor({ ...movie, status: 'awaiting_approval' }, 'available')).toBeNull();
    expect(actionFor({ ...movie, origin: 'manual' }, 'available')).toBeNull();
  });
});

describe('isJellyseerrState', () => {
  it('accepts only the known names', () => {
    expect(isJellyseerrState('available')).toBe(true);
    expect(isJellyseerrState('deleted')).toBe(false);
    expect(isJellyseerrState(5)).toBe(false);
  });
});
