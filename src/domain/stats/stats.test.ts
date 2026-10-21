import { describe, expect, it } from 'vitest';
import { periodBounds, recentMonths, sqlLocalModifier, toStatsFilter, toStatsGroupBy, toStatsSort, unavailableRate, utcOffsetMinutes } from './stats';

describe('statistics rules', () => {
  it('keeps only valid filters', () => {
    expect(
      toStatsFilter({ memberId: 'm1', from: '2026-10-01', to: '2026-02-30', type: 'tv', genre: 'Drama', status: 'fulfilled', origin: 'radio', attendantId: 7 }),
    ).toEqual({ memberId: 'm1', from: '2026-10-01', type: 'tv', genre: 'Drama', status: 'fulfilled' });
    expect(toStatsFilter(null)).toEqual({});
    expect(toStatsSort('likes')).toBe('likes');
    expect(toStatsSort('x')).toBe('newest');
    expect(toStatsGroupBy('genre')).toBe('genre');
    expect(toStatsGroupBy(undefined)).toBe('none');
  });

  it('turns a period of days into São Paulo instants, the last day included', () => {
    expect(periodBounds({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ start: '2026-10-01T03:00:00.000Z', end: '2026-11-01T03:00:00.000Z' });
    expect(periodBounds({ to: '2026-12-31' })).toEqual({ start: null, end: '2027-01-01T03:00:00.000Z' });
  });

  it('knows São Paulo runs three hours behind UTC', () => {
    expect(utcOffsetMinutes(new Date('2026-10-21T15:00:00Z'))).toBe(-180);
    expect(sqlLocalModifier(new Date('2026-01-01T00:00:00Z'))).toBe('-180 minutes');
  });

  it('lists the recent months across a year', () => {
    expect(recentMonths(new Date('2026-02-10T12:00:00Z'), 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    // Still January in São Paulo.
    expect(recentMonths(new Date('2026-02-01T01:00:00Z'), 1)).toEqual(['2026-01']);
  });

  it('rates Não foi possível among the closed requests', () => {
    expect(unavailableRate(3, 1)).toBe(0.25);
    expect(unavailableRate(0, 0)).toBeNull();
  });
});
