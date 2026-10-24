import { describe, expect, it } from 'vitest';
import { fulfillingAttendant, inheritedStatus, initialStatus, isRating, requesterRemoved, transition, type Actor, type RequestState } from './lifecycle';

const ana: Actor = { kind: 'member', id: 'ana', canAttend: false };
const bia: Actor = { kind: 'member', id: 'bia', canAttend: false };
const cesar: Actor = { kind: 'member', id: 'cesar', canAttend: true };
const jellyseerr: Actor = { kind: 'jellyseerr' };

const approved: RequestState = {
  status: 'approved',
  origin: 'tmdb',
  mediaType: 'movie',
  requesterId: 'ana',
  assigneeId: null,
  petiscoLot: 'monthly:2026-10',
  coRequesterIds: [],
};

describe('initialStatus', () => {
  it('with a petisco: approved and reserved', () => {
    const r = initialStatus({ requesterIsAttendant: false, reservedLot: 'monthly:2026-10' });
    expect(r.status).toBe('approved');
    expect(r.effects).toContainEqual({ type: 'petisco', operation: 'reserve', lot: 'monthly:2026-10' });
  });

  it('without a petisco: awaiting approval, attendants told at once', () => {
    const r = initialStatus({ requesterIsAttendant: false, reservedLot: null });
    expect(r.status).toBe('awaiting_approval');
    expect(r.effects).toContainEqual({ type: 'notify', trigger: 'request_awaiting_approval' });
  });

  it("an attendant's request reserves nothing and is approved", () => {
    const r = initialStatus({ requesterIsAttendant: true, reservedLot: null });
    expect(r.status).toBe('approved');
    expect(r.effects.some((e) => e.type === 'petisco')).toBe(false);
  });
});

describe('transition', () => {
  it('approving a request without petisco consumes none', () => {
    const r = transition({ ...approved, status: 'awaiting_approval', petiscoLot: null }, { type: 'approve' }, cesar);
    expect(r.ok && r.next.status).toBe('approved');
    expect(r.ok && r.effects.some((e) => e.type === 'petisco')).toBe(false);
  });

  it('only attendants approve', () => {
    expect(transition({ ...approved, status: 'awaiting_approval' }, { type: 'approve' }, ana)).toEqual({ ok: false, error: 'forbidden' });
  });

  it('rejecting needs a reason', () => {
    const state = { ...approved, status: 'awaiting_approval' as const, petiscoLot: null };
    expect(transition(state, { type: 'reject', reason: { code: 'not_found' } }, cesar).ok).toBe(true);
    expect(transition(state, { type: 'reject', reason: { code: '' as never } }, cesar)).toEqual({ ok: false, error: 'reason_required' });
  });

  it('TMDB: approved → sent → fulfilled, debiting the reservation', () => {
    const sent = transition(approved, { type: 'mark_sent' }, cesar);
    expect(sent.ok && sent.next.status).toBe('in_jellyseerr');
    const done = sent.ok ? transition(sent.next, { type: 'mark_fulfilled' }, jellyseerr) : sent;
    expect(done.ok && done.next.status).toBe('fulfilled');
    expect(done.ok && done.effects).toContainEqual({ type: 'petisco', operation: 'debit', lot: 'monthly:2026-10' });
    expect(done.ok && done.effects).toContainEqual({ type: 'evaluate_cashback' });
  });

  it('the Jellyseerr marks a series partially available, which can still close', () => {
    const series: RequestState = { ...approved, mediaType: 'tv', status: 'in_jellyseerr' };
    const partial = transition(series, { type: 'mark_partial' }, jellyseerr);
    expect(partial.ok && partial.next.status).toBe('partially_available');
    expect(partial.ok && partial.effects).toEqual([{ type: 'notify', trigger: 'request_partially_available' }]);
    const done = partial.ok ? transition(partial.next, { type: 'mark_fulfilled' }, jellyseerr) : partial;
    expect(done.ok && done.effects).toContainEqual({ type: 'petisco', operation: 'debit', lot: 'monthly:2026-10' });
  });

  it('only the Jellyseerr marks partial, and only on a TMDB series', () => {
    expect(transition({ ...approved, mediaType: 'tv' }, { type: 'mark_partial' }, cesar)).toEqual({ ok: false, error: 'forbidden' });
    expect(transition(approved, { type: 'mark_partial' }, jellyseerr)).toEqual({ ok: false, error: 'invalid_transition' });
  });

  it('the Jellyseerr may mark a request sent', () => {
    const r = transition(approved, { type: 'mark_sent' }, jellyseerr);
    expect(r.ok && r.next.status).toBe('in_jellyseerr');
  });

  it('manual requests skip Farejando', () => {
    const manual = { ...approved, origin: 'manual' as const };
    expect(transition(manual, { type: 'mark_sent' }, cesar)).toEqual({ ok: false, error: 'invalid_transition' });
    expect(transition(manual, { type: 'mark_fulfilled' }, cesar).ok).toBe(true);
  });

  it('a webhook failure refunds and warns the attendants', () => {
    const r = transition({ ...approved, status: 'in_jellyseerr' }, { type: 'mark_unavailable', reason: { code: 'server_failure' } }, jellyseerr);
    expect(r.ok && r.next.status).toBe('unavailable');
    expect(r.ok && r.effects).toContainEqual({ type: 'petisco', operation: 'refund', lot: 'monthly:2026-10' });
    expect(r.ok && r.effects).toContainEqual({ type: 'notify', trigger: 'webhook_failure' });
  });

  it('only the requester cancels, and only before Farejando', () => {
    expect(transition(approved, { type: 'cancel' }, bia)).toEqual({ ok: false, error: 'forbidden' });
    expect(transition({ ...approved, status: 'in_jellyseerr' }, { type: 'cancel' }, ana)).toEqual({ ok: false, error: 'invalid_transition' });
    const r = transition(approved, { type: 'cancel' }, ana);
    expect(r.ok && r.next.status).toBe('canceled');
    expect(r.ok && r.effects).toContainEqual({ type: 'petisco', operation: 'refund', lot: 'monthly:2026-10' });
  });

  it('canceling with co-requesters offers the request instead of closing it', () => {
    const r = transition({ ...approved, coRequesterIds: ['bia'] }, { type: 'cancel' }, ana);
    expect(r.ok && r.next.status).toBe('approved');
    expect(r.ok && r.next.petiscoLot).toBeNull();
    expect(r.ok && r.effects).toContainEqual({ type: 'offer_to_co_requesters' });
  });

  it('Eu pego esse sets the assignee', () => {
    const r = transition(approved, { type: 'assign' }, cesar);
    expect(r.ok && r.next.assigneeId).toBe('cesar');
  });

  it('closed requests do not move', () => {
    expect(transition({ ...approved, status: 'fulfilled' }, { type: 'mark_fulfilled' }, cesar)).toEqual({ ok: false, error: 'invalid_transition' });
  });
});

describe('inheritedStatus', () => {
  it('with a petisco or as an attendant: approved, even from awaiting approval', () => {
    expect(inheritedStatus({ status: 'awaiting_approval', heirIsAttendant: false, reservedLot: 'monthly:2026-10' })).toEqual({
      status: 'approved',
      effects: [{ type: 'petisco', operation: 'reserve', lot: 'monthly:2026-10' }],
    });
    expect(inheritedStatus({ status: 'approved', heirIsAttendant: true, reservedLot: null })).toEqual({ status: 'approved', effects: [] });
  });

  it('without a petisco: awaiting approval', () => {
    expect(inheritedStatus({ status: 'approved', heirIsAttendant: false, reservedLot: null }).status).toBe('awaiting_approval');
  });

  it('past Solicitado the status stays; her petisco is reserved if she has one', () => {
    expect(inheritedStatus({ status: 'in_jellyseerr', heirIsAttendant: false, reservedLot: null })).toEqual({ status: 'in_jellyseerr', effects: [] });
    expect(inheritedStatus({ status: 'in_jellyseerr', heirIsAttendant: false, reservedLot: 'b1' }).effects).toHaveLength(1);
  });
});

describe('requesterRemoved', () => {
  const refund = { type: 'petisco', operation: 'refund', lot: 'monthly:2026-10' };

  it('before Farejando, alone: cancelled with the petisco back', () => {
    expect(requesterRemoved(approved)).toEqual({ next: { ...approved, status: 'canceled', petiscoLot: null }, effects: [refund] });
  });

  it('with co-requesters: offered on, whatever the status', () => {
    const shared = { ...approved, status: 'in_jellyseerr' as const, coRequesterIds: ['bia'] };
    expect(requesterRemoved(shared)).toEqual({ next: { ...shared, petiscoLot: null }, effects: [refund, { type: 'offer_to_co_requesters' }] });
  });

  it("already sent, alone: keeps going on nobody's petisco", () => {
    const sent = { ...approved, status: 'in_jellyseerr' as const };
    expect(requesterRemoved(sent)).toEqual({ next: { ...sent, petiscoLot: null }, effects: [refund] });
  });

  it('a closed request stays as it is', () => {
    const done = { ...approved, status: 'fulfilled' as const };
    expect(requesterRemoved(done)).toEqual({ next: done, effects: [] });
  });
});

describe('Dar retorno', () => {
  it('ratings go from 1 to 5, whole numbers', () => {
    expect([0, 1, 5, 6, 2.5, '3', null].map(isRating)).toEqual([false, true, true, false, false, false, false]);
  });

  it('thanks go to the assignee, else who marked Enviado, else who marked Cãopleto', () => {
    const sent = [
      { to: 'approved' as const, actorId: 'ana' },
      { to: 'in_jellyseerr' as const, actorId: 'dani' },
      { to: 'fulfilled' as const, actorId: null },
    ];
    expect(fulfillingAttendant('cesar', sent)).toBe('cesar');
    expect(fulfillingAttendant(null, sent)).toBe('dani');
    expect(fulfillingAttendant(null, [{ to: 'fulfilled', actorId: 'cesar' }])).toBe('cesar');
    expect(fulfillingAttendant(null, [{ to: 'fulfilled', actorId: null }])).toBeNull();
  });
});
