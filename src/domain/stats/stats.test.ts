import { describe, expect, it } from 'vitest';
import { strings } from '../strings';
import { farejandoMs, periodStart, toStatsPeriod, type Transition } from './stats';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-10-21T15:00:00Z');

describe('toStatsPeriod', () => {
  it('falls back to the last 30 days', () => {
    expect(toStatsPeriod('all')).toBe('all');
    expect(toStatsPeriod('last30')).toBe('last30');
    expect(toStatsPeriod('ever')).toBe('last30');
  });
});

describe('periodStart', () => {
  it('goes 30 days back from now, or nowhere', () => {
    expect(periodStart('last30', now)).toBe('2026-09-21T15:00:00.000Z');
    expect(periodStart('all', now)).toBeNull();
  });
});

describe('farejandoMs', () => {
  const t = (requestId: string, fromStatus: Transition['fromStatus'], toStatus: Transition['toStatus'], at: string): Transition => ({ requestId, fromStatus, toStatus, at });

  it('adds every stretch in Farejando, not Parcialmente disponível', () => {
    const transitions = [
      t('a', null, 'approved', '2026-10-01T00:00:00Z'),
      t('a', 'approved', 'in_jellyseerr', '2026-10-01T01:00:00Z'),
      t('a', 'in_jellyseerr', 'partially_available', '2026-10-01T03:00:00Z'),
      t('a', 'partially_available', 'fulfilled', '2026-10-02T03:00:00Z'),
      t('b', 'approved', 'in_jellyseerr', '2026-10-05T00:00:00Z'),
      t('b', 'in_jellyseerr', 'unavailable', '2026-10-05T00:30:00Z'),
    ];
    expect(farejandoMs(transitions, null, now)).toBe(2.5 * HOUR);
  });

  it('counts a request still in Farejando up to now', () => {
    expect(farejandoMs([t('a', 'approved', 'in_jellyseerr', '2026-10-21T10:00:00Z')], null, now)).toBe(5 * HOUR);
  });

  it('ignores rows that repeat the status', () => {
    const transitions = [
      t('a', 'approved', 'in_jellyseerr', '2026-10-21T10:00:00Z'),
      t('a', null, 'in_jellyseerr', '2026-10-21T12:00:00Z'),
      t('a', 'in_jellyseerr', 'fulfilled', '2026-10-21T13:00:00Z'),
    ];
    expect(farejandoMs(transitions, null, now)).toBe(3 * HOUR);
  });

  it('keeps only the time inside the period', () => {
    const transitions = [
      t('a', 'approved', 'in_jellyseerr', '2026-09-21T13:00:00Z'),
      t('a', 'in_jellyseerr', 'fulfilled', '2026-09-21T17:00:00Z'),
      t('b', 'approved', 'in_jellyseerr', '2026-09-01T00:00:00Z'),
      t('b', 'in_jellyseerr', 'fulfilled', '2026-09-02T00:00:00Z'),
    ];
    expect(farejandoMs(transitions, '2026-09-21T15:00:00.000Z', now)).toBe(2 * HOUR);
  });
});

describe('the time farejando', () => {
  it('shows hours and minutes, and days from 24 hours on', () => {
    expect(strings.stats.duration(0)).toBe('0min');
    expect(strings.stats.duration(20 * 60_000)).toBe('20min');
    expect(strings.stats.duration(14 * HOUR + 20 * 60_000)).toBe('14h 20min');
    expect(strings.stats.duration(51 * HOUR + 20 * 60_000)).toBe('2d 3h');
  });
});
