// Automatic cashback (docs/spec/petiscos.md): a list of criteria the attendant turns on or off.
// At most one cashback per request, only for requests that debited a petisco.

export interface CashbackContext {
  readonly coRequesterCount: number;
  readonly debitedPetisco: boolean;
  readonly alreadyGotCashback: boolean;
}

export interface CashbackCriterion {
  readonly id: string;
  readonly enabled: boolean;
  readonly matches: (context: CashbackContext) => boolean;
}

export interface CashbackSettings {
  readonly coRequesters: { readonly enabled: boolean; readonly threshold: number };
}

export const DEFAULT_CASHBACK_SETTINGS: CashbackSettings = { coRequesters: { enabled: true, threshold: 2 } };

export function cashbackCriteria(settings: CashbackSettings): CashbackCriterion[] {
  return [
    {
      id: 'co-requesters',
      enabled: settings.coRequesters.enabled,
      matches: (c) => c.coRequesterCount >= settings.coRequesters.threshold,
    },
  ];
}

/** The id of the first enabled criterion that grants cashback, or null. */
export function automaticCashback(context: CashbackContext, criteria: readonly CashbackCriterion[]): string | null {
  if (!context.debitedPetisco || context.alreadyGotCashback) return null;
  return criteria.find((c) => c.enabled && c.matches(context))?.id ?? null;
}

/** The attendant's manual cashback follows the same one-per-request limit. */
export function canGiveManualCashback(context: CashbackContext): boolean {
  return context.debitedPetisco && !context.alreadyGotCashback;
}
