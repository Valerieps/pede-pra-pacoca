import { describe, expect, it } from 'vitest';
import { localDateKey } from '../time';
import { groupSleep, isOnVacation, isValidReturnDate } from './vacation';

// 21 Oct 2026, 23:30 in São Paulo (UTC-3).
const now = new Date('2026-10-22T02:30:00Z');

describe('vacation', () => {
  it('uses the group calendar for today', () => {
    expect(localDateKey(now)).toBe('2026-10-21');
  });

  it('ends at 00:00 of the return date', () => {
    expect(isOnVacation({ onVacation: true, until: '2026-10-22' }, now)).toBe(true);
    expect(isOnVacation({ onVacation: true, until: '2026-10-21' }, now)).toBe(false);
    expect(isOnVacation({ onVacation: true, until: null }, now)).toBe(true);
    expect(isOnVacation({ onVacation: false, until: null }, now)).toBe(false);
  });

  it('accepts no return date or a real day after today', () => {
    expect(isValidReturnDate(null, now)).toBe(true);
    expect(isValidReturnDate('2026-10-22', now)).toBe(true);
    expect(isValidReturnDate('2026-10-21', now)).toBe(false);
    expect(isValidReturnDate('2026-02-30', now)).toBe(false);
    expect(isValidReturnDate('amanhã', now)).toBe(false);
  });

  it('the Paçoca sleeps only when every attendant is on vacation', () => {
    const away = { onVacation: true, until: '2026-11-10' };
    const back = { onVacation: false, until: null };
    expect(groupSleep([away, back], now)).toEqual({ sleeping: false, returnsOn: null });
    expect(groupSleep([away, { onVacation: true, until: '2026-11-02' }], now)).toEqual({ sleeping: true, returnsOn: '2026-11-02' });
    expect(groupSleep([{ onVacation: true, until: null }], now)).toEqual({ sleeping: true, returnsOn: null });
    expect(groupSleep([], now).sleeping).toBe(false);
  });
});
