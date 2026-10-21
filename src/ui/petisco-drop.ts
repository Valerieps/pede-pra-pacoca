import type { PetiscoBalanceView } from '../application/api-contract';

const cashbacks = (balance: PetiscoBalanceView) => balance.extras.filter((e) => e.kind === 'cashback').length;

/**
 * Whether a cashback arrived between two loads of my balance, so a petisco drops into the header
 * counter. Only cashback: a bonus, the monthly renewal or the first load drop nothing.
 */
export function cashbackArrived(before: PetiscoBalanceView | undefined, after: PetiscoBalanceView): boolean {
  return before !== undefined && cashbacks(after) > cashbacks(before);
}
