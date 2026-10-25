import { describe, expect, it } from 'vitest';
import type { PetiscoBalanceView } from '../application/api-contract';
import { petiscoSlots, withNextSpent } from './petisco-row';

function balance(monthlyAvailable: number, monthlyQuota: number, extras: PetiscoBalanceView['extras'] = []): PetiscoBalanceView {
  return { total: monthlyAvailable + extras.length, monthlyAvailable, monthlyQuota, renewsAt: '2026-11-01', extras };
}

const bonus = { kind: 'bonus', expiresAt: '2027-01-01' } as const;

describe('petiscoSlots', () => {
  it('fills the petiscos I have and leaves the used ones empty', () => {
    expect(petiscoSlots(balance(2, 3))).toEqual(['full', 'full', 'empty']);
    expect(petiscoSlots(balance(0, 3))).toEqual(['empty', 'empty', 'empty']);
  });

  it('adds one full slot per bonus or cashback after the monthly ones', () => {
    expect(petiscoSlots(balance(1, 3, [bonus]))).toEqual(['full', 'empty', 'empty', 'full']);
  });

  it('gives up on the row when it would not fit, or has nothing to show', () => {
    expect(petiscoSlots(balance(5, 5))).toHaveLength(5);
    expect(petiscoSlots(balance(4, 5, [bonus]))).toBeNull();
    expect(petiscoSlots(balance(7, 10))).toBeNull();
    expect(petiscoSlots(balance(0, 0))).toBeNull();
  });
});

describe('withNextSpent', () => {
  it('marks the last full slot as the one about to be spent', () => {
    expect(withNextSpent(['full', 'full', 'empty'])).toEqual(['full', 'next', 'empty']);
  });

  it('leaves a row with nothing to spend alone', () => {
    expect(withNextSpent(['empty', 'empty'])).toEqual(['empty', 'empty']);
  });
});
