import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaView, RequestDetailView, RequestView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import type { Sql } from './ports';

const dune: MediaView = { type: 'movie', tmdbId: 693134, title: 'Duna', year: 2024, posterPath: null, releaseDate: '2024-02-27', genres: [] };

let service: GroupService;
let sql: Sql;
let ids: Record<string, string>;

function signIn(name: string): void {
  const email = `${name}@example.com`;
  if (name !== 'cesar') service.command('s-cesar', 'invite.create', { email });
  expect(service.signIn({ sub: `g-${name}`, email, name, picture: null }, `s-${name}`, ['cesar@example.com'])).toMatchObject({ ok: true });
  const me = service.query(`s-${name}`, 'me', {});
  if (!me.ok) throw new Error('not signed in');
  ids[name] = (me.value as { id: string }).id;
}

function create(session: string, tmdbId = dune.tmdbId): RequestView {
  const media = { ...dune, tmdbId, title: `Filme ${tmdbId}` };
  const result = service.command(session, 'request.create', { origin: 'tmdb', type: 'movie', tmdbId }, { media });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestView;
}

function detail(id: string): RequestDetailView {
  const result = service.query('s-cesar', 'request.detail', { id });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestDetailView;
}

function petiscos(session: string): number {
  const me = service.query(session, 'me', {});
  return me.ok ? (me.value as { petiscos: { total: number } }).petiscos.total : -1;
}

const remove = (session: string, name: string) => service.command(session, 'member.remove', { memberId: ids[name] });
const movements = (requestId: string) => sql.all('SELECT operation FROM petisco_movements WHERE request_id = ? ORDER BY rowid', requestId);

function feed(): string[] {
  const result = service.query('s-cesar', 'feed', {});
  return result.ok ? (result.value as { type: string; actor: { name: string } }[]).map((e) => `${e.actor.name}:${e.type}`) : [];
}

beforeEach(() => {
  sql = memorySql();
  service = new GroupService(sql, fixedClock('2026-10-21T15:00:00Z'), sequentialIds());
  service.migrate();
  ids = {};
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.cesar, roles: ['admin', 'attendant'] });
  signIn('ana');
  signIn('bia');
  signIn('vesper');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.vesper, roles: ['admin'] });
});

describe('removing a member', () => {
  it('admins only, never themselves, and only active members', () => {
    expect(remove('s-ana', 'bia')).toEqual({ ok: false, error: 'forbidden' });
    expect(remove('s-cesar', 'cesar')).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('s-cesar', 'member.remove', { memberId: 'nobody' })).toEqual({ ok: false, error: 'not_found' });
    expect(service.command('s-cesar', 'member.remove', {})).toEqual({ ok: false, error: 'invalid' });
    expect(remove('s-cesar', 'bia')).toMatchObject({ ok: true, disconnect: [ids.bia] });
    expect(remove('s-cesar', 'bia')).toEqual({ ok: false, error: 'not_found' });
  });

  it('another admin can be removed while one stays', () => {
    expect(remove('s-cesar', 'vesper')).toMatchObject({ ok: true });
    expect(remove('s-vesper', 'cesar')).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('ends access at once: sessions, push devices and the members list', () => {
    sql.run("INSERT INTO push_subscriptions (endpoint, member_id, p256dh, auth, created_at) VALUES ('https://push.example/x', ?, 'k', 'a', 'now')", ids.bia);
    remove('s-cesar', 'bia');
    expect(service.query('s-bia', 'me', {})).toEqual({ ok: false, error: 'unauthenticated' });
    expect(sql.all('SELECT * FROM sessions WHERE member_id = ?', ids.bia)).toEqual([]);
    expect(sql.all('SELECT * FROM push_subscriptions WHERE member_id = ?', ids.bia)).toEqual([]);
    const members = service.query('s-cesar', 'members', {});
    expect(members.ok && (members.value as { name: string }[]).map((m) => m.name)).toEqual(['ana', 'cesar', 'vesper']);
  });

  it('cancels her active requests as if she did: petisco back, feed events gone', () => {
    const request = create('s-bia');
    expect(petiscos('s-bia')).toBe(2);
    remove('s-cesar', 'bia');
    expect(detail(request.id).status).toBe('canceled');
    expect(detail(request.id).transitions.at(-1)).toMatchObject({ to: 'canceled', event: 'requester_removed' });
    expect(movements(request.id)).toEqual([{ operation: 'reserve' }, { operation: 'refund' }]);
    expect(feed()).not.toContain('bia:request_created');
  });

  it('offers her request to whoever also wanted it', () => {
    const request = create('s-bia');
    service.command('s-ana', 'request.join', { id: request.id });
    remove('s-cesar', 'bia');
    expect(detail(request.id)).toMatchObject({ status: 'approved', offer: { member: { name: 'ana' } } });
    expect(service.command('s-ana', 'request.answerOffer', { id: request.id, accept: true })).toMatchObject({ ok: true });
    expect(detail(request.id)).toMatchObject({ status: 'approved', requester: { name: 'ana' } });
  });

  it("a request already sent keeps going on nobody's petisco", () => {
    const request = create('s-bia');
    service.command('s-cesar', 'request.act', { ids: [request.id], action: { type: 'mark_sent' } });
    remove('s-cesar', 'bia');
    expect(detail(request.id).status).toBe('in_jellyseerr');
    service.command('s-cesar', 'request.act', { ids: [request.id], action: { type: 'mark_fulfilled' } });
    expect(detail(request.id).status).toBe('fulfilled');
    expect(movements(request.id)).toEqual([{ operation: 'reserve' }, { operation: 'refund' }]);
  });

  it('she leaves the requests she also wanted, and an offer made to her passes on', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    service.command('s-vesper', 'request.join', { id: request.id });
    service.command('s-ana', 'request.cancel', { id: request.id });
    expect(detail(request.id).offer?.member.name).toBe('bia');
    remove('s-cesar', 'bia');
    expect(detail(request.id)).toMatchObject({ offer: { member: { name: 'vesper' } }, coRequesters: [{ name: 'vesper' }] });
  });

  it('frees the requests an attendant had taken', () => {
    service.command('s-cesar', 'member.setRoles', { memberId: ids.ana, roles: ['attendant'] });
    const request = create('s-bia');
    service.command('s-ana', 'request.act', { ids: [request.id], action: { type: 'assign' } });
    remove('s-cesar', 'ana');
    expect(detail(request.id).assignee).toBeNull();
  });

  it('keeps her history, and a new invite brings her back with it', () => {
    const request = create('s-bia');
    service.command('s-cesar', 'request.act', { ids: [request.id], action: { type: 'mark_fulfilled' } });
    remove('s-cesar', 'bia');
    expect(detail(request.id)).toMatchObject({ status: 'fulfilled', requester: { name: 'bia' } });
    expect(feed()).toContain('bia:request_created');

    const bia = { sub: 'g-bia', email: 'bia@example.com', name: 'bia', picture: null };
    expect(service.signIn(bia, 's-bia2', [])).toEqual({ ok: false, error: 'no_invite' });
    service.command('s-cesar', 'invite.create', { email: 'bia@example.com' });
    expect(service.signIn(bia, 's-bia2', [])).toEqual({ ok: true, memberId: ids.bia });
    const mine = service.query('s-bia2', 'requests.mine', {});
    expect(mine.ok && (mine.value as RequestView[]).map((r) => r.id)).toEqual([request.id]);
  });
});
