import { describe, expect, it } from 'vitest';
import { addDays, localToInstant, monthKey, nextMonthStart } from './time';

describe('group calendar', () => {
  it('uses São Paulo for the month, not UTC', () => {
    // 2026-11-01 01:00 UTC is still October 31, 22:00 in São Paulo.
    expect(monthKey(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10');
    expect(monthKey(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11');
  });

  it('finds the next renewal at local midnight of day 1', () => {
    expect(nextMonthStart(new Date('2026-10-21T12:00:00Z')).toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(nextMonthStart(new Date('2026-12-31T12:00:00Z')).toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('converts local wall-clock time to an instant', () => {
    expect(localToInstant(2026, 10, 21, 8, 30).toISOString()).toBe('2026-10-21T11:30:00.000Z');
  });

  it('adds days', () => {
    expect(addDays(new Date('2026-10-01T00:00:00Z'), 90).toISOString()).toBe('2026-12-30T00:00:00.000Z');
  });
});
