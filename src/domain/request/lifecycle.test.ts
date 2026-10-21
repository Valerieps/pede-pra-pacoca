import { describe, expect, it } from 'vitest';
import { initialStatus, transition, type Actor, type RequestState } from './lifecycle';

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

  it('manual requests skip No Jellyseerr', () => {
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

  it('only the requester cancels, and only before No Jellyseerr', () => {
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
