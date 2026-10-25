import type { PetiscoBalanceView } from '../application/api-contract';

/** A slot in the petisco row: one I still have, one already used, or the one a request is about to spend. */
export type PetiscoSlot = 'full' | 'empty' | 'next';

/** Above this many slots the row becomes one petisco and the number (docs/spec/identidade.md). */
export const PETISCO_ROW_MAX = 5;

/**
 * The row in the pote: one slot per monthly petisco, full or used, then one full slot per bonus or
 * cashback (a used extra is gone, it never comes back next month). Null when the row would not fit.
 */
export function petiscoSlots(balance: PetiscoBalanceView): PetiscoSlot[] | null {
  const slots: PetiscoSlot[] = [];
  for (let i = 0; i < balance.monthlyQuota; i++) slots.push(i < balance.monthlyAvailable ? 'full' : 'empty');
  for (let i = 0; i < balance.extras.length; i++) slots.push('full');
  return slots.length > 0 && slots.length <= PETISCO_ROW_MAX ? slots : null;
}

/** The same row on the confirmation: the last full slot shows as the one this request spends. */
export function withNextSpent(slots: readonly PetiscoSlot[]): PetiscoSlot[] {
  const result = [...slots];
  const last = result.lastIndexOf('full');
  if (last >= 0) result[last] = 'next';
  return result;
}
