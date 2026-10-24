// Who receives each notification (docs/spec/notificacoes.md, vacation in docs/spec/atendente.md).
import type { NotificationType } from './types';

/**
 * - attendants: members with the attendant role
 * - requester: whoever made the request
 * - requesters: the requester and the co-requesters
 * - subject: the one person the notice is about (event author, petisco owner, thanked attendant,
 *   co-requester offered the inheritance, member whose monthly petiscos renewed)
 */
export type Audience = 'attendants' | 'requester' | 'requesters' | 'subject';

export const AUDIENCE: Readonly<Record<NotificationType, Audience>> = {
  request_new: 'attendants',
  request_pending: 'attendants',
  request_approved: 'requester',
  request_closed: 'requesters',
  request_partially_available: 'requesters',
  request_fulfilled: 'requesters',
  co_request: 'requester',
  likes: 'subject',
  petisco_received: 'subject',
  petisco_expiring: 'subject',
  // One notice per member, each with her own number of petiscos.
  monthly_renewed: 'subject',
  thanked: 'subject',
  webhook_failed: 'attendants',
  inheritance_offer: 'subject',
  daily_digest: 'attendants',
};

export interface Attendant {
  readonly id: string;
  readonly onVacation: boolean;
}

/** The people around a notice; the server reads them from the database. */
export interface AudienceFacts {
  readonly attendants: readonly Attendant[];
  readonly activeMemberIds: readonly string[];
  readonly requesterId?: string | null;
  readonly coRequesterIds?: readonly string[];
  readonly subjectId?: string | null;
  /** Whoever caused the notice. Nobody is notified of their own action. */
  readonly actorId?: string | null;
}

/** New-request notices that someone on vacation does not get (docs/spec/atendente.md). */
const VACATION_SILENCED: readonly NotificationType[] = ['request_new', 'request_pending', 'daily_digest'];

function attendantsFor(type: NotificationType, attendants: readonly Attendant[]): string[] {
  if (!VACATION_SILENCED.includes(type)) return attendants.map((a) => a.id);
  const working = attendants.filter((a) => !a.onVacation);
  // With every attendant away, requests waiting for approval still reach them.
  if (working.length === 0 && type === 'request_pending') return attendants.map((a) => a.id);
  return working.map((a) => a.id);
}

export function recipients(type: NotificationType, facts: AudienceFacts): string[] {
  const active = new Set(facts.activeMemberIds);
  let ids: string[];
  switch (AUDIENCE[type]) {
    case 'attendants':
      ids = attendantsFor(type, facts.attendants);
      break;
    case 'requester':
      ids = facts.requesterId ? [facts.requesterId] : [];
      break;
    case 'requesters':
      ids = [...(facts.requesterId ? [facts.requesterId] : []), ...(facts.coRequesterIds ?? [])];
      break;
    case 'subject':
      ids = facts.subjectId ? [facts.subjectId] : [];
      break;
  }
  return [...new Set(ids)].filter((id) => active.has(id) && id !== facts.actorId);
}
