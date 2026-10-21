import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupExport, PetiscoSettingsView, PetiscoStatementView, VacationView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import type { Sql } from './ports';
import { GroupService } from './group-service';
import { evaluateAutomaticCashback } from './petiscos';

const cesar = { sub: 'g-cesar', email: 'cesar@example.com', name: 'Cesar', picture: null };
const carla = { sub: 'g-carla', email: 'carla@example.com', name: 'Carla', picture: null };
const bia = { sub: 'g-bia', email: 'bia@example.com', name: 'Bia', picture: null };

let sql: Sql;
let service: GroupService;
let clock: ReturnType<typeof fixedClock>;
let ids: { cesar: string; carla: string; bia: string };

function value<T>(result: { ok: boolean; value?: unknown; error?: unknown }): T {
  expect(result).toMatchObject({ ok: true });
  return result.value as T;
}

function idOf(session: string): string {
  return value<{ id: string }>(service.query(session, 'me', {})).id;
}

/** Cesar is admin and attendant; Carla and Bia are requesters. */
beforeEach(() => {
  sql = memorySql();
  clock = fixedClock('2026-10-21T15:00:00Z');
  service = new GroupService(sql, clock, sequentialIds());
  service.migrate();
  service.signIn(cesar, 's-cesar', ['cesar@example.com']);
  service.command('s-cesar', 'invite.create', { email: carla.email });
  service.command('s-cesar', 'invite.create', { email: bia.email });
  service.signIn(carla, 's-carla', []);
  service.signIn(bia, 's-bia', []);
  ids = { cesar: idOf('s-cesar'), carla: idOf('s-carla'), bia: idOf('s-bia') };
  service.command('s-cesar', 'member.setRoles', { memberId: ids.cesar, roles: ['admin', 'attendant'] });
});

function inbox(memberId: string) {
  return sql.all<{ type: string; data: string }>('SELECT type, data FROM inbox WHERE member_id = ? ORDER BY rowid', memberId).map((r) => ({ type: r.type, data: JSON.parse(r.data) as unknown }));
}

function balance(session: string) {
  return value<{ petiscos: { total: number; monthlyAvailable: number; extras: unknown[] } }>(service.query(session, 'me', {})).petiscos;
}

/** A request of Carla's, as the requests slice will leave it: reserved from the monthly quota and, if fulfilled, debited. */
function carlasRequest(id: string, status: 'fulfilled' | 'approved', debited = true) {
  const at = clock.now().toISOString();
  sql.run(
    "INSERT INTO requests (id, origin, media_type, title, requester_id, status, created_at, updated_at) VALUES (?, 'manual', 'movie', ?, ?, ?, ?, ?)",
    id,
    `Filme ${id}`,
    ids.carla,
    status,
    at,
    at,
  );
  const move = (op: string) =>
    sql.run(
      "INSERT INTO petisco_movements (id, member_id, kind, operation, lot, request_id, actor, at) VALUES (?, ?, 'monthly', ?, 'monthly:2026-10', ?, ?, ?)",
      `${id}-${op}`,
      ids.carla,
      op,
      id,
      ids.carla,
      at,
    );
  move('reserve');
  if (debited) move('debit');
}

describe('petisco settings', () => {
  it('a new global number applies at once to everyone without a fixed number', () => {
    carlasRequest('r1', 'fulfilled');
    expect(service.command('s-cesar', 'petiscos.setMonthly', { petiscos: 9 })).toMatchObject({ ok: true, changed: ['me', 'petiscos'] });
    expect(balance('s-carla').monthlyAvailable).toBe(8);
    expect(balance('s-bia').monthlyAvailable).toBe(9);
    service.command('s-cesar', 'petiscos.setMonthly', { petiscos: 0 });
    expect(balance('s-carla').monthlyAvailable).toBe(0);
  });

  it('a fixed number for one person wins over the global one, and null goes back to it', () => {
    service.command('s-cesar', 'petiscos.setMemberMonthly', { memberId: ids.bia, petiscos: 5 });
    expect(balance('s-bia').monthlyAvailable).toBe(5);
    expect(balance('s-carla').monthlyAvailable).toBe(3);
    const settings = value<PetiscoSettingsView>(service.query('s-cesar', 'petiscos.settings', {}));
    expect(settings.members.find((m) => m.id === ids.bia)?.monthlyPetiscos).toBe(5);
    service.command('s-cesar', 'petiscos.setMemberMonthly', { memberId: ids.bia, petiscos: null });
    expect(balance('s-bia').monthlyAvailable).toBe(3);
  });

  it('turns the cashback criterion off and changes the threshold', () => {
    service.command('s-cesar', 'petiscos.setCashback', { coRequesters: { enabled: false, threshold: 4 } });
    const settings = value<PetiscoSettingsView>(service.query('s-cesar', 'petiscos.settings', {}));
    expect(settings.cashback).toEqual({ coRequesters: { enabled: false, threshold: 4 } });
    expect(service.command('s-cesar', 'petiscos.setCashback', { coRequesters: { enabled: true, threshold: 0 } })).toEqual({ ok: false, error: 'invalid' });
  });

  it('only attendants and admins see and change them', () => {
    expect(service.query('s-carla', 'petiscos.settings', {})).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('s-carla', 'petiscos.setMonthly', { petiscos: 99 })).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('s-carla', 'petiscos.giveBonus', { memberId: ids.carla, amount: 1 })).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('s-cesar', 'petiscos.setMonthly', { petiscos: 100 })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('bonus', () => {
  it('gives petiscos valid for 90 days, with a reason, and writes no feed event', () => {
    const feedBefore = value<unknown[]>(service.query('s-carla', 'feed', {})).length;
    expect(service.command('s-cesar', 'petiscos.giveBonus', { memberId: ids.carla, amount: 2, reason: ' aniversário ' })).toMatchObject({ ok: true });
    expect(balance('s-carla')).toMatchObject({ total: 5, extras: [{ kind: 'bonus', expiresAt: '2027-01-19T15:00:00.000Z' }, { kind: 'bonus' }] });
    const statement = value<PetiscoStatementView>(service.query('s-carla', 'petiscos.statement', {}));
    expect(statement.movements).toMatchObject([
      { kind: 'bonus', operation: 'credit', reason: 'aniversário' },
      { kind: 'bonus', operation: 'credit', reason: 'aniversário' },
    ]);
    expect(value<unknown[]>(service.query('s-carla', 'feed', {})).length).toBe(feedBefore);
    expect(inbox(ids.carla)).toEqual([{ type: 'petisco_received', data: { kind: 'bonus', amount: 2 } }]);
  });

  it('accepts 1 to 10 at a time and a reason up to 200 characters', () => {
    expect(service.command('s-cesar', 'petiscos.giveBonus', { memberId: ids.carla, amount: 11 })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('s-cesar', 'petiscos.giveBonus', { memberId: ids.carla, amount: 1, reason: 'x'.repeat(201) })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('s-cesar', 'petiscos.giveBonus', { memberId: 'nobody', amount: 1 })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('manual cashback', () => {
  it('goes to the requester of a fulfilled request that debited a petisco, once, with a feed event', () => {
    carlasRequest('r1', 'fulfilled');
    const before = value<PetiscoSettingsView>(service.query('s-cesar', 'petiscos.settings', {}));
    expect(before.cashbackCandidates).toMatchObject([{ requestId: 'r1', title: 'Filme r1', requester: { name: 'Carla' } }]);

    expect(service.command('s-cesar', 'petiscos.giveCashback', { requestId: 'r1', reason: 'capricho' })).toMatchObject({ ok: true, changed: ['me', 'petiscos', 'feed', 'notifications'] });
    expect(balance('s-carla')).toMatchObject({ total: 3, monthlyAvailable: 2, extras: [{ kind: 'cashback' }] });
    expect(value<unknown[]>(service.query('s-carla', 'feed', {}))[0]).toMatchObject({ type: 'cashback', actor: { name: 'Carla' }, requestId: 'r1' });
    const statement = value<PetiscoStatementView>(service.query('s-carla', 'petiscos.statement', {}));
    expect(statement.movements[0]).toMatchObject({ kind: 'cashback', operation: 'credit', requestTitle: 'Filme r1', reason: 'capricho' });

    expect(inbox(ids.carla)).toEqual([{ type: 'petisco_received', data: { kind: 'cashback', amount: 1 } }]);
    expect(service.command('s-cesar', 'petiscos.giveCashback', { requestId: 'r1' })).toEqual({ ok: false, error: 'conflict' });
    expect(value<PetiscoSettingsView>(service.query('s-cesar', 'petiscos.settings', {})).cashbackCandidates).toEqual([]);
  });

  it('is refused for requests not fulfilled or that did not debit a petisco', () => {
    carlasRequest('open', 'approved', false);
    carlasRequest('free', 'fulfilled', false);
    expect(service.command('s-cesar', 'petiscos.giveCashback', { requestId: 'open' })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-cesar', 'petiscos.giveCashback', { requestId: 'free' })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-cesar', 'petiscos.giveCashback', { requestId: 'none' })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('automatic cashback', () => {
  let n = 0;
  const ctx = () => ({ sql, clock, ids: { next: () => `auto-${++n}` } });
  const coRequest = (requestId: string, memberId: string) =>
    sql.run('INSERT INTO co_requests (request_id, member_id, at) VALUES (?, ?, ?)', requestId, memberId, clock.now().toISOString());

  it('gives one cashback when the request reaches the co-requester threshold', () => {
    carlasRequest('r1', 'fulfilled');
    coRequest('r1', ids.bia);
    expect(evaluateAutomaticCashback(ctx(), 'r1')).toBe(false);
    coRequest('r1', ids.cesar);
    clock.set('2026-10-21T16:00:00Z');
    expect(evaluateAutomaticCashback(ctx(), 'r1')).toBe(true);
    expect(evaluateAutomaticCashback(ctx(), 'r1')).toBe(false);
    expect(balance('s-carla').extras).toMatchObject([{ kind: 'cashback' }]);
    expect(value<unknown[]>(service.query('s-carla', 'feed', {}))[0]).toMatchObject({ type: 'cashback', requestId: 'r1' });
  });

  it('follows the attendant settings', () => {
    carlasRequest('r1', 'fulfilled');
    coRequest('r1', ids.bia);
    coRequest('r1', ids.cesar);
    service.command('s-cesar', 'petiscos.setCashback', { coRequesters: { enabled: false, threshold: 2 } });
    expect(evaluateAutomaticCashback(ctx(), 'r1')).toBe(false);
  });
});

describe('statement', () => {
  it('lists the movements newest first, with the request', () => {
    carlasRequest('r1', 'fulfilled');
    const statement = value<PetiscoStatementView>(service.query('s-carla', 'petiscos.statement', {}));
    expect(statement.balance).toMatchObject({ total: 2, renewsAt: '2026-11-01T03:00:00.000Z' });
    expect(statement.movements.map((m) => m.operation)).toEqual(['debit', 'reserve']); // same instant: last written first
    expect(statement.movements[0]).toMatchObject({ requestId: 'r1', requestTitle: 'Filme r1', kind: 'monthly' });
  });

  it('shows only my own movements', () => {
    carlasRequest('r1', 'fulfilled');
    expect(value<PetiscoStatementView>(service.query('s-bia', 'petiscos.statement', {})).movements).toEqual([]);
  });
});

describe('7-day expiry notice', () => {
  const notices = () => sql.all<{ member_id: string }>('SELECT member_id FROM petisco_expiry_notices');

  it('warns once per lot when a bonus is 7 days from expiring', () => {
    service.command('s-cesar', 'petiscos.giveBonus', { memberId: ids.carla, amount: 2 });
    service.tick();
    expect(notices()).toEqual([]);
    clock.set('2027-01-12T15:00:00Z');
    expect(service.tick()).toEqual(['notifications']);
    expect(notices()).toEqual([{ member_id: ids.carla }, { member_id: ids.carla }]);
    expect(inbox(ids.carla).filter((n) => n.type === 'petisco_expiring')).toEqual([
      { type: 'petisco_expiring', data: { amount: 2, expiresAt: '2027-01-19T15:00:00.000Z' } },
    ]);
    clock.set('2027-01-13T15:00:00Z');
    service.tick();
    expect(notices()).toHaveLength(2);
  });

  it('does not warn about a petisco already reserved, or already expired', () => {
    service.command('s-cesar', 'petiscos.giveBonus', { memberId: ids.carla, amount: 1 });
    const [{ lot }] = sql.all<{ lot: string }>("SELECT lot FROM petisco_movements WHERE kind = 'bonus'");
    sql.run(
      "INSERT INTO petisco_movements (id, member_id, kind, operation, lot, actor, at) VALUES ('x', ?, 'bonus', 'reserve', ?, ?, '2026-10-22T00:00:00Z')",
      ids.carla,
      lot,
      ids.carla,
    );
    clock.set('2027-01-12T15:00:00Z');
    service.tick();
    clock.set('2027-02-12T15:00:00Z');
    service.tick();
    expect(notices()).toEqual([]);
  });
});

describe('vacation', () => {
  const vacation = (session: string) => value<VacationView>(service.query(session, 'vacation', {}));

  it('the Paçoca sleeps when the only attendant is on vacation, until the return date', () => {
    expect(vacation('s-carla')).toEqual({ sleeping: false, returnsOn: null, mine: null });
    expect(service.command('s-cesar', 'vacation.set', { onVacation: true, until: '2026-11-02' })).toMatchObject({
      ok: true,
      value: { sleeping: true, returnsOn: '2026-11-02', mine: { onVacation: true, until: '2026-11-02' } },
      changed: ['vacation'],
    });
    expect(vacation('s-carla')).toEqual({ sleeping: true, returnsOn: '2026-11-02', mine: null });

    clock.set('2026-11-02T03:00:00Z'); // 00:00 in São Paulo
    expect(vacation('s-carla').sleeping).toBe(false);
    expect(service.tick()).toEqual(['vacation']);
    expect(sql.all('SELECT vacation, vacation_until FROM members WHERE id = ?', ids.cesar)).toEqual([{ vacation: 0, vacation_until: null }]);
    expect(service.tick()).toEqual([]);
  });

  it('with more attendants, sleeps only when all of them are on vacation', () => {
    service.command('s-cesar', 'member.setRoles', { memberId: ids.bia, roles: ['attendant'] });
    service.command('s-cesar', 'vacation.set', { onVacation: true, until: null });
    expect(vacation('s-carla').sleeping).toBe(false);
    service.command('s-bia', 'vacation.set', { onVacation: true, until: '2026-12-01' });
    expect(vacation('s-carla')).toEqual({ sleeping: true, returnsOn: '2026-12-01', mine: null });
    service.command('s-bia', 'vacation.set', { onVacation: false, until: null });
    expect(vacation('s-bia')).toEqual({ sleeping: false, returnsOn: null, mine: { onVacation: false, until: null } });
  });

  it('only attendants go on vacation, and the return date must be after today', () => {
    expect(service.command('s-carla', 'vacation.set', { onVacation: true, until: null })).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('s-cesar', 'vacation.set', { onVacation: true, until: '2026-10-21' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('s-cesar', 'vacation.set', { onVacation: 'sim' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('export', () => {
  it('gives an admin every table except sessions, push keys and secrets', () => {
    sql.run("INSERT INTO config (key, value) VALUES ('webhookSecret', '\"s3cr3t\"'), ('jellyseerrBaseUrl', '\"https://j\"')");
    const data = value<GroupExport>(service.query('s-cesar', 'group.export', {}));
    expect(data.schemaVersion).toBe(3);
    expect(Object.keys(data.tables)).toEqual(expect.arrayContaining(['members', 'requests', 'petisco_movements', 'feed_events', 'invites', 'config']));
    expect(Object.keys(data.tables)).not.toContain('sessions');
    expect(Object.keys(data.tables)).not.toContain('push_subscriptions');
    expect(data.tables.members).toHaveLength(3);
    expect(data.tables.config).toEqual([{ key: 'jellyseerrBaseUrl', value: '"https://j"' }]);
    expect(JSON.stringify(data)).not.toContain('s-cesar');
  });

  it('is only for admins', () => {
    expect(service.query('s-carla', 'group.export', {})).toEqual({ ok: false, error: 'forbidden' });
  });
});
