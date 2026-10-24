// The request lifecycle (docs/spec/pedidos.md). Display names: approved is Solicitado,
// in_jellyseerr is Farejando, partially_available is Parcialmente disponível, fulfilled is Cãopleto. A pure state machine: given a request, an action
// and who does it, it returns the next state and the effects the server must apply in the same
// transaction (petisco movements, feed events, notifications). It never touches storage.
import type { MediaType } from '../media/media';

export type RequestStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'in_jellyseerr'
  | 'partially_available'
  | 'fulfilled'
  | 'rejected'
  | 'unavailable'
  | 'canceled';

export type RequestOrigin = 'tmdb' | 'manual';

export const ACTIVE_STATUSES: readonly RequestStatus[] = ['awaiting_approval', 'approved', 'in_jellyseerr', 'partially_available'];

export type ReasonCode = 'not_found' | 'bad_quality' | 'try_later' | 'server_failure' | 'other';

export interface Reason {
  readonly code: ReasonCode;
  readonly text?: string;
}

export interface RequestState {
  readonly status: RequestStatus;
  readonly origin: RequestOrigin;
  readonly mediaType: MediaType;
  readonly requesterId: string;
  readonly assigneeId: string | null;
  /** The petisco lot reserved at creation; null for attendants' requests and approvals without petisco. */
  readonly petiscoLot: string | null;
  readonly coRequesterIds: readonly string[];
}

export type Actor =
  | { readonly kind: 'member'; readonly id: string; readonly canAttend: boolean }
  | { readonly kind: 'jellyseerr' };

export type RequestAction =
  | { readonly type: 'approve' }
  | { readonly type: 'reject'; readonly reason: Reason }
  | { readonly type: 'assign' }
  | { readonly type: 'mark_sent' }
  | { readonly type: 'mark_partial' }
  | { readonly type: 'mark_fulfilled'; readonly note?: string }
  | { readonly type: 'mark_unavailable'; readonly reason: Reason }
  | { readonly type: 'cancel' };

export type NotificationTrigger =
  | 'request_awaiting_approval'
  | 'request_new'
  | 'request_approved'
  | 'request_rejected'
  | 'request_unavailable'
  | 'request_fulfilled'
  | 'request_partially_available'
  | 'webhook_failure'
  | 'inheritance_offer';

export type Effect =
  | { readonly type: 'petisco'; readonly operation: 'reserve' | 'debit' | 'refund'; readonly lot: string }
  | { readonly type: 'feed'; readonly event: 'request_created' | 'request_fulfilled' }
  | { readonly type: 'notify'; readonly trigger: NotificationTrigger }
  | { readonly type: 'evaluate_cashback' }
  | { readonly type: 'offer_to_co_requesters' };

export type TransitionError = 'forbidden' | 'invalid_transition' | 'reason_required';

export type TransitionResult =
  | { readonly ok: true; readonly next: RequestState; readonly effects: readonly Effect[] }
  | { readonly ok: false; readonly error: TransitionError };

export function isActive(status: RequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Where a new request starts: with a petisco or made by an attendant, it is approved at once. */
export function initialStatus(input: { requesterIsAttendant: boolean; reservedLot: string | null }): {
  status: RequestStatus;
  effects: Effect[];
} {
  if (input.requesterIsAttendant) {
    return { status: 'approved', effects: [{ type: 'feed', event: 'request_created' }, { type: 'notify', trigger: 'request_new' }] };
  }
  if (input.reservedLot) {
    return {
      status: 'approved',
      effects: [
        { type: 'petisco', operation: 'reserve', lot: input.reservedLot },
        { type: 'feed', event: 'request_created' },
        { type: 'notify', trigger: 'request_new' },
      ],
    };
  }
  return {
    status: 'awaiting_approval',
    effects: [{ type: 'feed', event: 'request_created' }, { type: 'notify', trigger: 'request_awaiting_approval' }],
  };
}

function refund(state: RequestState): Effect[] {
  return state.petiscoLot ? [{ type: 'petisco', operation: 'refund', lot: state.petiscoLot }] : [];
}

const ok = (next: RequestState, effects: Effect[]): TransitionResult => ({ ok: true, next, effects });
const fail = (error: TransitionError): TransitionResult => ({ ok: false, error });

/** Where each closing action may start from. A manual request skips Farejando. */
function canClose(state: RequestState): boolean {
  return state.status === 'approved' || (state.origin === 'tmdb' && (state.status === 'in_jellyseerr' || state.status === 'partially_available'));
}

export function transition(state: RequestState, action: RequestAction, actor: Actor): TransitionResult {
  const attendant = actor.kind === 'jellyseerr' || actor.canAttend;

  switch (action.type) {
    case 'approve':
      if (actor.kind !== 'member' || !actor.canAttend) return fail('forbidden');
      if (state.status !== 'awaiting_approval') return fail('invalid_transition');
      // Approved without a petisco: it consumes none (docs/spec/petiscos.md).
      return ok({ ...state, status: 'approved' }, [{ type: 'notify', trigger: 'request_approved' }]);

    case 'reject':
      if (actor.kind !== 'member' || !actor.canAttend) return fail('forbidden');
      if (state.status !== 'awaiting_approval') return fail('invalid_transition');
      if (!action.reason.code) return fail('reason_required');
      return ok({ ...state, status: 'rejected' }, [...refund(state), { type: 'notify', trigger: 'request_rejected' }]);

    case 'assign':
      if (actor.kind !== 'member' || !actor.canAttend) return fail('forbidden');
      if (!isActive(state.status)) return fail('invalid_transition');
      return ok({ ...state, assigneeId: actor.id }, []);

    case 'mark_sent':
      if (!attendant) return fail('forbidden');
      if (state.origin !== 'tmdb' || state.status !== 'approved') return fail('invalid_transition');
      return ok({ ...state, status: 'in_jellyseerr' }, []);

    case 'mark_partial':
      // Only the Jellyseerr knows that some episodes arrived (docs/spec/jellyseerr.md).
      if (actor.kind !== 'jellyseerr') return fail('forbidden');
      if (state.origin !== 'tmdb' || state.mediaType !== 'tv') return fail('invalid_transition');
      if (state.status !== 'approved' && state.status !== 'in_jellyseerr') return fail('invalid_transition');
      return ok({ ...state, status: 'partially_available' }, [{ type: 'notify', trigger: 'request_partially_available' }]);

    case 'mark_fulfilled': {
      if (!attendant) return fail('forbidden');
      if (!canClose(state)) return fail('invalid_transition');
      const debit: Effect[] = state.petiscoLot ? [{ type: 'petisco', operation: 'debit', lot: state.petiscoLot }] : [];
      return ok({ ...state, status: 'fulfilled' }, [
        ...debit,
        { type: 'feed', event: 'request_fulfilled' },
        { type: 'notify', trigger: 'request_fulfilled' },
        { type: 'evaluate_cashback' },
      ]);
    }

    case 'mark_unavailable': {
      if (!attendant) return fail('forbidden');
      if (!canClose(state)) return fail('invalid_transition');
      if (!action.reason.code) return fail('reason_required');
      const notices: Effect[] = [{ type: 'notify', trigger: 'request_unavailable' }];
      if (actor.kind === 'jellyseerr') notices.push({ type: 'notify', trigger: 'webhook_failure' });
      return ok({ ...state, status: 'unavailable' }, [...refund(state), ...notices]);
    }

    case 'cancel':
      if (actor.kind !== 'member' || actor.id !== state.requesterId) return fail('forbidden');
      if (state.status !== 'awaiting_approval' && state.status !== 'approved') return fail('invalid_transition');
      if (state.coRequesterIds.length > 0) {
        // The request stays alive while the co-requesters, oldest first, are offered it.
        return ok({ ...state, petiscoLot: null }, [...refund(state), { type: 'offer_to_co_requesters' }]);
      }
      return ok({ ...state, status: 'canceled' }, refund(state));
  }
}

/**
 * A co-requester accepts the request its requester cancelled and becomes the requester
 * (docs/spec/pedidos.md, "Meus pedidos"). Before Farejando the request starts over like a new
 * one: approved with her petisco or as an attendant, awaiting approval without. Past that point it
 * keeps going and only takes her petisco if she has one.
 */
export function inheritedStatus(input: { status: RequestStatus; heirIsAttendant: boolean; reservedLot: string | null }): {
  status: RequestStatus;
  effects: Effect[];
} {
  const reserve: Effect[] = input.reservedLot && !input.heirIsAttendant ? [{ type: 'petisco', operation: 'reserve', lot: input.reservedLot }] : [];
  if (input.status !== 'awaiting_approval' && input.status !== 'approved') return { status: input.status, effects: reserve };
  if (input.heirIsAttendant || input.reservedLot) return { status: 'approved', effects: reserve };
  return { status: 'awaiting_approval', effects: [{ type: 'notify', trigger: 'request_awaiting_approval' }] };
}

/**
 * The admin removed the requester (docs/spec/grupo-e-papeis.md): the request is handled as if she
 * cancelled it. Her petisco comes back and the co-requesters are offered it. Past Solicitado she
 * could not cancel, so without co-requesters it keeps going, on nobody's petisco.
 */
export function requesterRemoved(state: RequestState): { next: RequestState; effects: Effect[] } {
  if (!isActive(state.status)) return { next: state, effects: [] };
  if (state.coRequesterIds.length > 0) return { next: { ...state, petiscoLot: null }, effects: [...refund(state), { type: 'offer_to_co_requesters' }] };
  const beforeServer = state.status === 'awaiting_approval' || state.status === 'approved';
  return { next: { ...state, petiscoLot: null, status: beforeServer ? 'canceled' : state.status }, effects: refund(state) };
}

/**
 * Who receives "Obrigada, Paçoca": the request's assignee; without one, whoever marked Enviado;
 * when it went straight to Cãopleto, whoever marked it. Null when the Jellyseerr closed it alone.
 */
export function fulfillingAttendant(assigneeId: string | null, transitions: readonly { readonly to: RequestStatus; readonly actorId: string | null }[]): string | null {
  if (assigneeId) return assigneeId;
  const last = (to: RequestStatus) => [...transitions].reverse().find((t) => t.to === to && t.actorId !== null)?.actorId ?? null;
  return last('in_jellyseerr') ?? last('fulfilled');
}
