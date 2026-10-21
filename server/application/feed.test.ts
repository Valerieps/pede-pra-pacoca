import { beforeEach, describe, expect, it } from 'vitest';
import type { FeedEventView, MemberView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { FEED_PAGE_SIZE } from '../../src/domain/feed/feed';
import { GroupService } from './group-service';
import type { Sql } from './ports';

const people = {
  cesar: { sub: 'g-cesar', email: 'cesar@example.com', name: 'Cesar', picture: null },
  ana: { sub: 'g-ana', email: 'ana@example.com', name: 'Ana', picture: null },
  bia: { sub: 'g-bia', email: 'bia@example.com', name: 'Bia', picture: null },
};
type Person = keyof typeof people;

let sql: Sql;
let clock: ReturnType<typeof fixedClock>;
let service: GroupService;
const ids: Record<Person, string> = { cesar: '', ana: '', bia: '' };

function at(minute: number): string {
  return new Date(Date.UTC(2026, 9, 21, 15, minute)).toISOString();
}

function join(person: Person, minute: number) {
  clock.set(at(minute));
  if (person !== 'cesar') service.command('session-cesar', 'invite.create', { email: people[person].email });
  expect(service.signIn(people[person], `session-${person}`, ['cesar@example.com'])).toMatchObject({ ok: true });
  ids[person] = sql.all<{ id: string }>('SELECT id FROM members WHERE email = ?', people[person].email)[0].id;
}

function feed(person: Person, input: object = {}): FeedEventView[] {
  const result = service.query(`session-${person}`, 'feed', input);
  if (!result.ok) throw new Error(result.error);
  return result.value as FeedEventView[];
}

function like(person: Person, eventId: string) {
  return service.command(`session-${person}`, 'feed.toggleLike', { eventId });
}

function likers(person: Person, eventId: string): string[] {
  const result = service.query(`session-${person}`, 'feed.likes', { eventId });
  if (!result.ok) throw new Error(result.error);
  return (result.value as MemberView[]).map((m) => m.name);
}

function addRequest(id: string, requester: Person): void {
  sql.run(
    `INSERT INTO requests (id, origin, media_type, title, requester_id, status, created_at, updated_at)
     VALUES (?, 'search', 'movie', 'Duna', ?, 'approved', ?, ?)`,
    id,
    ids[requester],
    at(30),
    at(30),
  );
}

function addEvent(id: string, type: string, actor: Person, requestId: string | null, minute: number): void {
  sql.run('INSERT INTO feed_events (id, type, actor_id, request_id, at) VALUES (?, ?, ?, ?, ?)', id, type, ids[actor], requestId, at(minute));
}

const idsOf = (events: FeedEventView[]) => events.map((e) => e.id);

beforeEach(() => {
  sql = memorySql();
  clock = fixedClock(at(0));
  service = new GroupService(sql, clock, sequentialIds());
  service.migrate();
  join('cesar', 0);
  join('ana', 1);
  join('bia', 2);
});

describe('likes', () => {
  it('counts one like per person and undoes it on the second tap', () => {
    const [event] = feed('ana');
    expect(event).toMatchObject({ actor: { name: 'Bia' }, likeCount: 0, likedByMe: false });

    expect(like('ana', event.id)).toEqual({ ok: true, value: { liked: true, likeCount: 1 }, changed: ['feed', 'notifications'] });
    expect(like('cesar', event.id)).toMatchObject({ ok: true, value: { liked: true, likeCount: 2 } });
    expect(feed('ana')[0]).toMatchObject({ likeCount: 2, likedByMe: true });
    expect(feed('bia')[0]).toMatchObject({ likeCount: 2, likedByMe: false });

    expect(like('ana', event.id)).toMatchObject({ ok: true, value: { liked: false, likeCount: 1 } });
    expect(feed('ana')[0]).toMatchObject({ likeCount: 1, likedByMe: false });
    expect(sql.all('SELECT member_id FROM likes')).toEqual([{ member_id: ids.cesar }]);
  });

  it('tells the author, grouped, and not when liking my own event or undoing', () => {
    const [event] = feed('ana');
    like('ana', event.id);
    like('cesar', event.id);
    like('ana', event.id);
    expect(like('bia', event.id)).toMatchObject({ changed: ['feed'] });
    const inbox = service.query('session-bia', 'notifications.inbox', {});
    expect(inbox).toMatchObject({ ok: true, value: { unread: 1, items: [{ type: 'likes', body: 'Ana e Cesar curtiram sua novidade no feed.' }] } });
  });

  it('lists who liked, first like first', () => {
    const [event] = feed('ana');
    clock.set(at(10));
    like('cesar', event.id);
    clock.set(at(11));
    like('bia', event.id);
    expect(likers('ana', event.id)).toEqual(['Cesar', 'Bia']);
    expect(likers('ana', 'nope')).toEqual([]);
  });

  it('lets me like my own event', () => {
    const [event] = feed('bia');
    expect(like('bia', event.id)).toMatchObject({ ok: true, value: { liked: true, likeCount: 1 } });
  });

  it('turns down an unknown event or a missing id', () => {
    expect(like('ana', 'nope')).toEqual({ ok: false, error: 'not_found' });
    expect(service.command('session-ana', 'feed.toggleLike', {})).toEqual({ ok: false, error: 'invalid' });
  });

  it('never subscribes anyone to the request', () => {
    addRequest('r1', 'ana');
    addEvent('e1', 'request_created', 'ana', 'r1', 30);
    like('bia', 'e1');
    expect(sql.all('SELECT * FROM co_requests')).toEqual([]);
  });
});

describe('filters', () => {
  beforeEach(() => {
    addRequest('r-ana', 'ana');
    addRequest('r-cesar', 'cesar');
    addEvent('e-ana-asks', 'request_created', 'ana', 'r-ana', 31);
    addEvent('e-bia-too', 'co_request', 'bia', 'r-ana', 32);
    addEvent('e-cesar-asks', 'request_created', 'cesar', 'r-cesar', 33);
    addEvent('e-ana-done', 'request_fulfilled', 'cesar', 'r-ana', 34);
    addEvent('e-cesar-done', 'request_fulfilled', 'cesar', 'r-cesar', 35);
    sql.run('INSERT INTO co_requests (request_id, member_id, at) VALUES (?, ?, ?)', 'r-ana', ids.bia, at(32));
  });

  it('Tudo shows every event, and so does an unknown filter', () => {
    expect(feed('ana', { filter: 'all' })).toHaveLength(8);
    expect(feed('ana', { filter: 'whatever' })).toHaveLength(8);
  });

  it('Pedidos shows new requests and co-requests', () => {
    expect(idsOf(feed('ana', { filter: 'requests' }))).toEqual(['e-cesar-asks', 'e-bia-too', 'e-ana-asks']);
  });

  it('Atendidos shows fulfilled requests', () => {
    expect(idsOf(feed('ana', { filter: 'fulfilled' }))).toEqual(['e-cesar-done', 'e-ana-done']);
  });

  it('Meus shows what I did and what happened to the requests I asked for or also want', () => {
    const ana = feed('ana', { filter: 'mine' });
    expect(idsOf(ana).slice(0, 3)).toEqual(['e-ana-done', 'e-bia-too', 'e-ana-asks']);
    expect(ana.slice(3)).toMatchObject([{ type: 'member_joined', actor: { name: 'Ana' } }]);
    const bia = feed('bia', { filter: 'mine' });
    expect(idsOf(bia).slice(0, 3)).toEqual(['e-ana-done', 'e-bia-too', 'e-ana-asks']);
    expect(bia.slice(3)).toMatchObject([{ type: 'member_joined', actor: { name: 'Bia' } }]);
  });
});

describe('pagination', () => {
  it('pages with before and beforeId, without skipping events recorded in the same instant', () => {
    for (let i = 0; i < FEED_PAGE_SIZE + 5; i++) addEvent(`e-${String(i).padStart(2, '0')}`, 'thanked', 'ana', null, 40);
    const first = feed('ana');
    expect(first).toHaveLength(FEED_PAGE_SIZE);
    const last = first[first.length - 1];
    const all = [...first, ...feed('ana', { before: last.at, beforeId: last.id })];
    expect(all).toHaveLength(FEED_PAGE_SIZE + 5 + 3);
    expect(new Set(idsOf(all)).size).toBe(all.length);
    expect(feed('ana', { before: at(40) }).map((e) => e.type)).toEqual(['member_joined', 'member_joined', 'member_joined']);
  });
});
