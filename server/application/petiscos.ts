// Reads a member's petisco ledger and computes the balance with the domain rules.
import type { PetiscoBalanceView } from '../../src/application/api-contract';
import { balanceOf, DEFAULT_MONTHLY_PETISCOS, type PetiscoMovement } from '../../src/domain/petisco/ledger';
import { readConfig } from './config';
import type { Context } from './context';
import type { Member } from './members';

interface MovementRow {
  kind: PetiscoMovement['kind'];
  operation: PetiscoMovement['operation'];
  lot: string;
  request_id: string | null;
  expires_at: string | null;
  at: string;
}

export function movementsOf(ctx: Context, memberId: string): PetiscoMovement[] {
  return ctx.sql
    .all<MovementRow>('SELECT * FROM petisco_movements WHERE member_id = ? ORDER BY at', memberId)
    .map((r) => ({ kind: r.kind, operation: r.operation, lot: r.lot, requestId: r.request_id, expiresAt: r.expires_at, at: r.at }));
}

/** The member's own number when the attendant set one, the group's otherwise. */
export function monthlyQuotaOf(ctx: Context, member: Member): number {
  return member.monthlyPetiscos ?? readConfig(ctx, 'monthlyPetiscos', DEFAULT_MONTHLY_PETISCOS);
}

export function petiscoBalanceOf(ctx: Context, member: Member): PetiscoBalanceView {
  const balance = balanceOf(movementsOf(ctx, member.id), monthlyQuotaOf(ctx, member), ctx.clock.now());
  return {
    total: balance.total,
    monthlyAvailable: balance.monthly.available,
    monthlyQuota: balance.monthly.quota,
    renewsAt: balance.monthly.renewsAt,
    extras: balance.extras.map((e) => ({ kind: e.kind, expiresAt: e.expiresAt })),
  };
}
