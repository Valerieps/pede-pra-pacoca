// Petiscos (docs/spec/petiscos.md). The balance is never stored: it is computed from immutable
// movements. Monthly petiscos are a quota per month, not credited lots, so changing the number
// takes effect at once and someone who joins mid-month gets the whole month.
import { addDays, monthKey, nextMonthStart } from '../time';

export type PetiscoKind = 'monthly' | 'bonus' | 'cashback';
export type PetiscoOperation = 'credit' | 'reserve' | 'debit' | 'refund';

export const DEFAULT_MONTHLY_PETISCOS = 3;
export const EXTRA_PETISCO_VALIDITY_DAYS = 90;

/**
 * One immutable ledger line. `lot` says which petisco it touches:
 * "monthly:YYYY-MM" for the monthly quota, or the id of the bonus/cashback credit.
 */
export interface PetiscoMovement {
  readonly kind: PetiscoKind;
  readonly operation: PetiscoOperation;
  readonly lot: string;
  readonly requestId: string | null;
  /** Only on bonus and cashback credits. ISO instant. */
  readonly expiresAt: string | null;
  readonly at: string;
}

export interface ExtraLot {
  readonly lot: string;
  readonly kind: 'bonus' | 'cashback';
  readonly available: number;
  readonly expiresAt: string;
}

export interface PetiscoBalance {
  readonly monthly: {
    readonly quota: number;
    readonly used: number;
    readonly available: number;
    readonly lot: string;
    readonly renewsAt: string;
  };
  readonly extras: readonly ExtraLot[];
  readonly total: number;
}

export function monthlyLot(now: Date): string {
  return `monthly:${monthKey(now)}`;
}

/** Reserved or debited and not refunded, per lot. A debit only confirms a reservation. */
function usedByLot(movements: readonly PetiscoMovement[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const m of movements) {
    const delta = m.operation === 'reserve' ? 1 : m.operation === 'refund' ? -1 : 0;
    if (delta !== 0) used.set(m.lot, (used.get(m.lot) ?? 0) + delta);
  }
  return used;
}

export function balanceOf(movements: readonly PetiscoMovement[], monthlyQuota: number, now: Date): PetiscoBalance {
  const used = usedByLot(movements);
  const lot = monthlyLot(now);
  const monthlyUsed = used.get(lot) ?? 0;
  const monthlyAvailable = Math.max(0, monthlyQuota - monthlyUsed);

  const extras: ExtraLot[] = [];
  for (const m of movements) {
    if (m.operation !== 'credit' || m.kind === 'monthly' || !m.expiresAt) continue;
    if (new Date(m.expiresAt).getTime() <= now.getTime()) continue;
    const available = 1 - (used.get(m.lot) ?? 0);
    if (available > 0) extras.push({ lot: m.lot, kind: m.kind, available, expiresAt: m.expiresAt });
  }
  extras.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  return {
    monthly: {
      quota: monthlyQuota,
      used: monthlyUsed,
      available: monthlyAvailable,
      lot,
      renewsAt: nextMonthStart(now).toISOString(),
    },
    extras,
    total: monthlyAvailable + extras.reduce((sum, e) => sum + e.available, 0),
  };
}

/** "Vence primeiro, sai primeiro": the available petisco that expires soonest, or null. */
export function pickLotToReserve(balance: PetiscoBalance): { lot: string; kind: PetiscoKind } | null {
  const candidates: { lot: string; kind: PetiscoKind; expiresAt: string }[] = balance.extras.map((e) => ({
    lot: e.lot,
    kind: e.kind,
    expiresAt: e.expiresAt,
  }));
  if (balance.monthly.available > 0) {
    candidates.push({ lot: balance.monthly.lot, kind: 'monthly', expiresAt: balance.monthly.renewsAt });
  }
  candidates.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return candidates[0] ? { lot: candidates[0].lot, kind: candidates[0].kind } : null;
}

export function extraPetiscoExpiry(grantedAt: Date): string {
  return addDays(grantedAt, EXTRA_PETISCO_VALIDITY_DAYS).toISOString();
}
