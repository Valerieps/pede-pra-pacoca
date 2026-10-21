import { describe, expect, it } from 'vitest';
import type { PetiscoBalanceView } from '../application/api-contract';
import { cashbackArrived } from './petisco-drop';

function balance(extras: PetiscoBalanceView['extras'], total = extras.length): PetiscoBalanceView {
  return { total, monthlyAvailable: 0, monthlyQuota: 4, renewsAt: '2026-11-01', extras };
}

const cashback = { kind: 'cashback', expiresAt: '2027-01-01' } as const;
const bonus = { kind: 'bonus', expiresAt: '2027-01-01' } as const;

describe('cashbackArrived', () => {
  it('drops a petisco when a cashback joins my balance', () => {
    expect(cashbackArrived(balance([]), balance([cashback]))).toBe(true);
    expect(cashbackArrived(balance([cashback]), balance([cashback, cashback]))).toBe(true);
  });

  it('drops nothing on the first load', () => {
    expect(cashbackArrived(undefined, balance([cashback]))).toBe(false);
  });

  it('drops nothing for a bonus, the monthly renewal or spending', () => {
    expect(cashbackArrived(balance([]), balance([bonus]))).toBe(false);
    expect(cashbackArrived(balance([], 0), balance([], 4))).toBe(false);
    expect(cashbackArrived(balance([cashback]), balance([]))).toBe(false);
  });
});
