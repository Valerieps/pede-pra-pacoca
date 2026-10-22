import { describe, expect, it } from 'vitest';
import { feedAge, toFeedFilter } from './feed';

describe('toFeedFilter', () => {
  it('keeps a known filter and falls back to Tudo', () => {
    expect(toFeedFilter('mine')).toBe('mine');
    expect(toFeedFilter('fulfilled')).toBe('all');
    expect(toFeedFilter('nope')).toBe('all');
    expect(toFeedFilter(undefined)).toBe('all');
  });
});

describe('feedAge', () => {
  const now = new Date('2026-10-21T15:00:00');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('counts minutes, hours and days for the last week', () => {
    expect(feedAge(ago(20_000), now)).toBe('agora');
    expect(feedAge(ago(5 * 60_000), now)).toBe('5 min');
    expect(feedAge(ago(3 * 3_600_000), now)).toBe('3 h');
    expect(feedAge(ago(2 * 86_400_000), now)).toBe('2 d');
  });

  it('shows the day after a week, and the year only for another year', () => {
    expect(feedAge(new Date('2026-10-01T12:00:00').toISOString(), now)).toBe('1 de out.');
    expect(feedAge(new Date('2025-12-25T12:00:00').toISOString(), now)).toBe('25 de dez. de 2025');
  });

  it('treats a clock slightly ahead as now', () => {
    expect(feedAge(ago(-5_000), now)).toBe('agora');
  });
});
