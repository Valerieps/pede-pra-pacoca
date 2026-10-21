// The notifications and what each one carries (docs/spec/notificacoes.md). Each feature calls the
// server's `notify` with one of these; the data is stored as is and turned into text only when it
// is shown (render.ts), so the Paçoca's voice can change without touching stored rows.

/** What each trigger carries. Names are already display names; ids open the right screen. */
export interface NotificationData {
  /** A new request, approved with a petisco. Attendants; immediate or in the daily digest. */
  request_new: { requestId: string; title: string; requesterName: string };
  /** A request without petisco, waiting for approval. Attendants. */
  request_pending: { requestId: string; title: string; requesterName: string };
  request_approved: { requestId: string; title: string };
  /** Refused or "Não foi possível". `reason` is the display text of the reason. */
  request_closed: { requestId: string; title: string; outcome: 'refused' | 'unavailable'; reason: string };
  request_fulfilled: { requestId: string; title: string; note: string | null };
  /** Someone clicked "Eu também quero" on my request. */
  co_request: { requestId: string; title: string; memberName: string };
  /** Likes on my feed event, grouped. `names` are the likers; the caller passes one. */
  likes: { eventId: string; requestId: string | null; names: string[] };
  petisco_received: { kind: 'cashback' | 'bonus'; amount: number };
  petisco_expiring: { amount: number; expiresAt: string };
  monthly_renewed: { amount: number };
  /** "Obrigada, Paçoca", to the attendant who fulfilled the request. */
  thanked: { requestId: string; title: string; memberName: string };
  webhook_failed: { detail: string };
  inheritance_offer: { requestId: string; title: string; expiresAt: string };
  /** Built by the server from `request_new` for attendants who chose the digest. */
  daily_digest: { titles: string[] };
}

export type NotificationType = keyof NotificationData;

/** The types a member can switch off. The digest follows `request_new`. */
export const CONFIGURABLE_TYPES = [
  'request_new',
  'request_pending',
  'webhook_failed',
  'thanked',
  'request_approved',
  'request_closed',
  'request_fulfilled',
  'co_request',
  'likes',
  'petisco_received',
  'petisco_expiring',
  'monthly_renewed',
  'inheritance_offer',
] as const satisfies readonly NotificationType[];

export type ConfigurableType = (typeof CONFIGURABLE_TYPES)[number];

/** Types only attendants receive; the preferences screen shows them to attendants only. */
export const ATTENDANT_TYPES: readonly ConfigurableType[] = ['request_new', 'request_pending', 'webhook_failed', 'thanked'];

/** The switch that controls a type: the digest is the attendant's way of getting `request_new`. */
export function switchOf(type: NotificationType): ConfigurableType {
  return type === 'daily_digest' ? 'request_new' : type;
}
