import { describe, expect, it } from 'vitest';
import { automaticCashback, canGiveManualCashback, cashbackCriteria, DEFAULT_CASHBACK_SETTINGS } from './cashback';
import { balanceOf, expiringSoon, extraPetiscoExpiry, pickLotToReserve, type PetiscoMovement } from './ledger';
import { isBonusAmount, isMonthlyNumber, normalizeReason, parseCashbackSettings } from './settings';

const now = new Date('2026-10-21T15:00:00Z');
const october = 'monthly:2026-10';

function reserve(lot: string, requestId = 'r'): PetiscoMovement {
  return { kind: 'monthly', operation: 'reserve', lot, requestId, expiresAt: null, at: now.toISOString() };
}
function refund(lot: string): PetiscoMovement {
  return { kind: 'monthly', operation: 'refund', lot, requestId: 'r', expiresAt: null, at: now.toISOString() };
}
function bonus(lot: string, expiresAt: string): PetiscoMovement {
  return { kind: 'bonus', operation: 'credit', lot, requestId: null, expiresAt, at: now.toISOString() };
}

describe('monthly petiscos', () => {
  it('someone with no movements has the whole month', () => {
    const b = balanceOf([], 3, now);
    expect(b.monthly.available).toBe(3);
    expect(b.total).toBe(3);
    expect(b.monthly.renewsAt).toBe('2026-11-01T03:00:00.000Z');
  });

  it('reservations count as used; refunds give them back', () => {
    expect(balanceOf([reserve(october), reserve(october)], 3, now).monthly.available).toBe(1);
    expect(balanceOf([reserve(october), reserve(october), refund(october)], 3, now).monthly.available).toBe(2);
  });

  it('a debit only confirms the reservation', () => {
    const debit: PetiscoMovement = { ...reserve(october), operation: 'debit' };
    expect(balanceOf([reserve(october), debit], 3, now).monthly.available).toBe(2);
  });

  it('a new number applies at once: 5 with 2 used, changed to 9, leaves 7', () => {
    const used = [reserve(october), reserve(october)];
    expect(balanceOf(used, 5, now).monthly.available).toBe(3);
    expect(balanceOf(used, 9, now).monthly.available).toBe(7);
  });

  it('never goes negative when the number drops below what was used', () => {
    expect(balanceOf([reserve(october), reserve(october), reserve(october)], 2, now).monthly.available).toBe(0);
  });

  it('last month does not carry over', () => {
    expect(balanceOf([reserve('monthly:2026-09')], 3, now).monthly.available).toBe(3);
  });
});

describe('bonus and cashback', () => {
  it('counts unexpired, unused extras', () => {
    const b = balanceOf([bonus('b1', '2026-12-01T00:00:00Z'), bonus('b2', '2026-10-01T00:00:00Z')], 0, now);
    expect(b.extras.map((e) => e.lot)).toEqual(['b1']);
    expect(b.total).toBe(1);
  });

  it('a reserved extra is no longer available', () => {
    const b = balanceOf([bonus('b1', '2026-12-01T00:00:00Z'), { ...reserve('b1'), kind: 'bonus' }], 0, now);
    expect(b.total).toBe(0);
  });

  it('expires 90 days after it is granted', () => {
    expect(extraPetiscoExpiry(new Date('2026-10-01T00:00:00Z'))).toBe('2026-12-30T00:00:00.000Z');
  });
});

describe('pickLotToReserve', () => {
  it('uses the petisco that expires first', () => {
    const soon = balanceOf([bonus('b1', '2026-10-25T00:00:00Z')], 3, now);
    expect(pickLotToReserve(soon)).toEqual({ lot: 'b1', kind: 'bonus' });
    const later = balanceOf([bonus('b1', '2026-12-25T00:00:00Z')], 3, now);
    expect(pickLotToReserve(later)).toEqual({ lot: october, kind: 'monthly' });
  });

  it('returns null without petiscos', () => {
    expect(pickLotToReserve(balanceOf([], 0, now))).toBeNull();
  });
});

describe('cashback', () => {
  const criteria = cashbackCriteria(DEFAULT_CASHBACK_SETTINGS);
  const base = { coRequesterCount: 2, debitedPetisco: true, alreadyGotCashback: false };

  it('2 co-requesters give one cashback', () => {
    expect(automaticCashback(base, criteria)).toBe('co-requesters');
    expect(automaticCashback({ ...base, coRequesterCount: 1 }, criteria)).toBeNull();
  });

  it('only once, and only when a petisco was debited', () => {
    expect(automaticCashback({ ...base, alreadyGotCashback: true }, criteria)).toBeNull();
    expect(automaticCashback({ ...base, debitedPetisco: false }, criteria)).toBeNull();
    expect(canGiveManualCashback({ ...base, alreadyGotCashback: true })).toBe(false);
  });

  it('respects a disabled criterion and a custom threshold', () => {
    expect(automaticCashback(base, cashbackCriteria({ coRequesters: { enabled: false, threshold: 2 } }))).toBeNull();
    expect(automaticCashback(base, cashbackCriteria({ coRequesters: { enabled: true, threshold: 3 } }))).toBeNull();
  });
});

describe('expiringSoon', () => {
  it('finds the extras that expire within 7 days', () => {
    const b = balanceOf([bonus('soon', '2026-10-28T15:00:00Z'), bonus('later', '2026-10-28T15:00:01Z')], 3, now);
    expect(expiringSoon(b, now).map((e) => e.lot)).toEqual(['soon']);
  });
});

describe('settings', () => {
  it('accepts whole numbers in range', () => {
    expect(isMonthlyNumber(0)).toBe(true);
    expect(isMonthlyNumber(99)).toBe(true);
    expect(isMonthlyNumber(100)).toBe(false);
    expect(isMonthlyNumber(2.5)).toBe(false);
    expect(isMonthlyNumber('3')).toBe(false);
    expect(isBonusAmount(0)).toBe(false);
    expect(isBonusAmount(10)).toBe(true);
  });

  it('parses the cashback settings', () => {
    expect(parseCashbackSettings({ coRequesters: { enabled: false, threshold: 3 } })).toEqual({ coRequesters: { enabled: false, threshold: 3 } });
    expect(parseCashbackSettings({ coRequesters: { enabled: true, threshold: 0 } })).toBeNull();
    expect(parseCashbackSettings({})).toBeNull();
  });

  it('normalizes the reason', () => {
    expect(normalizeReason('  pelo  aniversário ')).toBe('pelo aniversário');
    expect(normalizeReason('   ')).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
    expect(normalizeReason('x'.repeat(201))).toBeUndefined();
    expect(normalizeReason(3)).toBeUndefined();
  });
});
