import { beforeEach, describe, expect, it } from 'vitest';
import type { FeedEventView, MediaView, RequestDetailView, RequestView } from '../../src/application/api-contract';
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
  service.signIn({ sub: `g-${name}`, email, name, picture: null }, `s-${name}`, ['cesar@example.com']);
  const me = service.query(`s-${name}`, 'me', {});
  if (!me.ok) throw new Error('not signed in');
  ids[name] = (me.value as { id: string }).id;
}

function create(session: string): RequestView {
  const result = service.command(session, 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: dune.tmdbId }, { media: dune });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestView;
}

const act = (session: string, id: string, type: string) => service.command(session, 'request.act', { ids: [id], action: { type } });

function viewer(session: string, id: string): RequestDetailView['viewer'] {
  const result = service.query(session, 'request.detail', { id });
  if (!result.ok) throw new Error(result.error);
  return (result.value as RequestDetailView).viewer;
}

function feed(): FeedEventView[] {
  const result = service.query('s-cesar', 'feed', {});
  return result.ok ? (result.value as FeedEventView[]) : [];
}

const thanksFor = (memberId: string) =>
  sql.all<{ data: string }>("SELECT data FROM inbox WHERE member_id = ? AND type = 'thanked'", memberId).map((r) => JSON.parse(r.data) as unknown);

/** Cesar is admin and attendant, Dani attendant, Ana and Bia requesters. */
beforeEach(() => {
  sql = memorySql();
  service = new GroupService(sql, fixedClock('2026-10-21T15:00:00Z'), sequentialIds());
  service.migrate();
  ids = {};
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.cesar, roles: ['admin', 'attendant'] });
  signIn('dani');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.dani, roles: ['attendant'] });
  signIn('ana');
  signIn('bia');
});

describe('Dar retorno', () => {
  it('only on Atendido requests', () => {
    const request = create('s-ana');
    expect(viewer('s-bia', request.id)).toMatchObject({ canGiveFeedback: false, feedback: { watched: false, rating: null, thanked: false } });
    expect(service.command('s-ana', 'request.watched', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-ana', 'request.thank', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-ana', 'request.thank', { id: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('"Assisti" with a rating: one feed event per member, and the rating can change', () => {
    const request = create('s-ana');
    act('s-cesar', request.id, 'mark_fulfilled');
    expect(viewer('s-bia', request.id).canGiveFeedback).toBe(true);
    expect(service.command('s-bia', 'request.watched', { id: request.id, rating: 6 })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('s-bia', 'request.watched', { id: request.id, rating: 4 })).toEqual({
      ok: true,
      value: { watched: true, rating: 4, thanked: false },
      changed: ['requests', 'feed'],
    });
    expect(feed().find((e) => e.type === 'watched')).toMatchObject({ type: 'watched', actor: { name: 'bia' }, requestTitle: 'Duna', rating: 4 });

    service.command('s-bia', 'request.watched', { id: request.id, rating: 5 });
    service.command('s-bia', 'request.watched', { id: request.id });
    const watched = feed().filter((e) => e.type === 'watched');
    expect(watched).toHaveLength(1);
    expect(watched[0].rating).toBe(5);
    expect(viewer('s-bia', request.id).feedback).toEqual({ watched: true, rating: 5, thanked: false });

    service.command('s-ana', 'request.watched', { id: request.id });
    expect(feed().find((e) => e.type === 'watched' && e.actor.name === 'ana')?.rating).toBeNull();
  });

  it('"Obrigada" goes once, to the attendant who took the request', () => {
    const request = create('s-ana');
    act('s-dani', request.id, 'assign');
    act('s-cesar', request.id, 'mark_sent');
    act('s-cesar', request.id, 'mark_fulfilled');
    expect(service.command('s-bia', 'request.thank', { id: request.id })).toMatchObject({
      ok: true,
      value: { thanked: true },
      changed: ['requests', 'feed', 'notifications'],
    });
    expect(service.command('s-bia', 'request.thank', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    expect(feed().find((e) => e.type === 'thanked')).toMatchObject({ type: 'thanked', actor: { name: 'bia' }, requestId: request.id });
    expect(thanksFor(ids.dani)).toEqual([{ requestId: request.id, title: 'Duna', memberName: 'bia' }]);
    expect(thanksFor(ids.cesar)).toEqual([]);
  });

  it('without an assignee, whoever marked Enviado; straight to Atendido, whoever marked it', () => {
    const sent = create('s-ana');
    act('s-dani', sent.id, 'mark_sent');
    act('s-cesar', sent.id, 'mark_fulfilled');
    service.command('s-ana', 'request.thank', { id: sent.id });
    expect(thanksFor(ids.dani)).toHaveLength(1);

    const manual = service.command('s-bia', 'request.create', { origin: 'manual', type: 'movie', title: 'Raro' });
    const id = manual.ok ? (manual.value as RequestView).id : '';
    act('s-cesar', id, 'mark_fulfilled');
    service.command('s-ana', 'request.thank', { id });
    expect(thanksFor(ids.cesar)).toHaveLength(1);
  });

  it('the attendant is not notified of her own thanks', () => {
    const request = create('s-ana');
    act('s-cesar', request.id, 'mark_fulfilled');
    expect(service.command('s-cesar', 'request.thank', { id: request.id })).toMatchObject({ ok: true });
    expect(thanksFor(ids.cesar)).toEqual([]);
  });
});
