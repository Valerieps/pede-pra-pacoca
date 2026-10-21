// What the attendant can set and give (docs/spec/petiscos.md, docs/spec/atendente.md).
import type { CashbackSettings } from './cashback';

export const MAX_MONTHLY_PETISCOS = 99;
export const MAX_BONUS_PER_GRANT = 10;
export const MAX_CASHBACK_THRESHOLD = 20;
export const REASON_MAX_LENGTH = 200;

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** The global number, or a person's fixed number: 0 to 99. */
export function isMonthlyNumber(value: unknown): value is number {
  return isIntegerIn(value, 0, MAX_MONTHLY_PETISCOS);
}

/** How many bonus petiscos one grant gives: 1 to 10. */
export function isBonusAmount(value: unknown): value is number {
  return isIntegerIn(value, 1, MAX_BONUS_PER_GRANT);
}

export function parseCashbackSettings(value: unknown): CashbackSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const co = (value as { coRequesters?: unknown }).coRequesters;
  if (typeof co !== 'object' || co === null) return null;
  const { enabled, threshold } = co as { enabled?: unknown; threshold?: unknown };
  if (typeof enabled !== 'boolean' || !isIntegerIn(threshold, 1, MAX_CASHBACK_THRESHOLD)) return null;
  return { coRequesters: { enabled, threshold } };
}

/** The optional reason of a bonus or manual cashback: trimmed, empty means none; undefined when too long or not text. */
export function normalizeReason(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const reason = value.trim().replace(/\s+/g, ' ');
  if (reason.length > REASON_MAX_LENGTH) return undefined;
  return reason === '' ? null : reason;
}
