import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupNumbersView, StatsPeriod } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import type { Sql } from './ports';

const people = {
  cesar: { sub: 'g-cesar', email: 'cesar@example.com', name: 'Cesar', picture: null },
  ana: { sub: 'g-ana', email: 'ana@example.com', name: 'Ana', picture: null },
  bia: { sub: 'g-bia', email: 'bia@example.com', name: 'Bia', picture: null },
  caio: { sub: 'g-caio', email: 'caio@example.com', name: 'Caio', picture: null },
};
type Person = keyof typeof people;

let sql: Sql;
let service: GroupService;
const ids: Record<Person, string> = { cesar: '', ana: '', bia: '', caio: '' };

const HOUR = 60 * 60 * 1000;
const NOW = '2026-10-21T15:00:00.000Z';
const RECENT = '2026-10-10T12:00:00.000Z';
const OLD = '2026-08-01T12:00:00.000Z';

function join(person: Person) {
  if (person !== 'cesar') service.command('session-cesar', 'invite.create', { email: people[person].email });
  expect(service.signIn(people[person], `session-${person}`, ['cesar@example.com'])).toMatchObject({ ok: true });
  ids[person] = sql.all<{ id: string }>('SELECT id FROM members WHERE email = ?', people[person].email)[0].id;
}

interface Seed {
  requester: Person;
  createdAt: string;
  status?: string;
  mediaKey?: string;
  title?: string;
  genres?: string[];
}

function addRequest(id: string, seed: Seed): void {
  sql.run(
    `INSERT INTO requests (id, origin, media_type, media_key, title, genres, requester_id, status, created_at, updated_at)
     VALUES (?, 'tmdb', 'movie', ?, ?, ?, ?, ?, ?, ?)`,
    id,
    seed.mediaKey ?? null,
    seed.title ?? id,
    JSON.stringify(seed.genres ?? []),
    ids[seed.requester],
    seed.status ?? 'approved',
    seed.createdAt,
    seed.createdAt,
  );
}

function addCoRequest(requestId: string, member: Person, at: string): void {
  sql.run('INSERT INTO co_requests (request_id, member_id, at) VALUES (?, ?, ?)', requestId, ids[member], at);
}

function addThanks(requestId: string, member: Person, at: string): void {
  sql.run('INSERT INTO feedback (request_id, member_id, thanked_at) VALUES (?, ?, ?)', requestId, ids[member], at);
}

function addMovement(id: string, member: Person, kind: string, operation: string, requestId: string | null, at: string, lot = `lot-${id}`): void {
  sql.run(
    'INSERT INTO petisco_movements (id, member_id, kind, operation, lot, request_id, actor, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ids[member],
    kind,
    operation,
    lot,
    requestId,
    ids.cesar,
    at,
  );
}

function addTransition(requestId: string, from: string | null, to: string, at: string): void {
  sql.run('INSERT INTO request_transitions (request_id, from_status, to_status, actor, at) VALUES (?, ?, ?, ?, ?)', requestId, from, to, ids.cesar, at);
}

function numbers(period: StatsPeriod = 'all'): GroupNumbersView {
  const result = service.query('session-bia', 'stats.numbers', { period });
  if (!result.ok) throw new Error(result.error);
  return result.value as GroupNumbersView;
}

const names = (ranked: GroupNumbersView['topRequesters']) => ranked.map((r) => `${r.member.name} ${r.count}`);

beforeEach(() => {
  sql = memorySql();
  service = new GroupService(sql, fixedClock(NOW), sequentialIds());
  service.migrate();
  for (const person of Object.keys(people) as Person[]) join(person);
});

describe('Quem mais pediu', () => {
  it('counts the requests each person opened, not the ones they canceled', () => {
    addRequest('a1', { requester: 'ana', createdAt: OLD });
    addRequest('a2', { requester: 'ana', createdAt: RECENT });
    addRequest('a3', { requester: 'ana', createdAt: RECENT, status: 'canceled' });
    addRequest('b1', { requester: 'bia', createdAt: RECENT, status: 'rejected' });
    expect(names(numbers().topRequesters)).toEqual(['Ana 2', 'Bia 1']);
    expect(names(numbers('last30').topRequesters)).toEqual(['Ana 1', 'Bia 1']);
  });

  it('breaks a tie by who got there first, and keeps at most three places', () => {
    addRequest('c1', { requester: 'caio', createdAt: '2026-10-03T00:00:00.000Z' });
    addRequest('b1', { requester: 'bia', createdAt: '2026-10-02T00:00:00.000Z' });
    addRequest('a1', { requester: 'ana', createdAt: '2026-10-04T00:00:00.000Z' });
    addRequest('a2', { requester: 'ana', createdAt: '2026-10-05T00:00:00.000Z' });
    addRequest('x1', { requester: 'cesar', createdAt: '2026-10-06T00:00:00.000Z' });
    expect(names(numbers().topRequesters)).toEqual(['Ana 2', 'Bia 1', 'Caio 1']);
  });

  it('keeps people who left the group', () => {
    addRequest('a1', { requester: 'ana', createdAt: RECENT });
    sql.run('UPDATE members SET removed_at = ? WHERE id = ?', NOW, ids.ana);
    expect(names(numbers().topRequesters)).toEqual(['Ana 1']);
  });
});

describe('troféus', () => {
  it('ranks the cashback petiscos received, used or expired, by when they were given', () => {
    addRequest('r1', { requester: 'bia', createdAt: RECENT });
    addMovement('m1', 'ana', 'cashback', 'credit', null, OLD);
    addMovement('m2', 'bia', 'cashback', 'credit', null, RECENT);
    addMovement('m3', 'bia', 'cashback', 'reserve', 'r1', RECENT, 'lot-m2');
    addMovement('m4', 'caio', 'bonus', 'credit', null, RECENT);
    expect(names(numbers().topCashback)).toEqual(['Ana 1', 'Bia 1']);
    expect(names(numbers('last30').topCashback)).toEqual(['Bia 1']);
  });

  it('ranks who thanked the Paçoca the most, and counts every thanks of the group', () => {
    addRequest('r1', { requester: 'cesar', createdAt: OLD, status: 'fulfilled' });
    addRequest('r2', { requester: 'cesar', createdAt: OLD, status: 'fulfilled' });
    addThanks('r1', 'bia', OLD);
    addThanks('r2', 'bia', RECENT);
    addThanks('r1', 'ana', RECENT);
    sql.run('INSERT INTO feedback (request_id, member_id, rating) VALUES (?, ?, 5)', 'r2', ids.caio);
    const all = numbers();
    expect(names(all.topThanks)).toEqual(['Bia 2', 'Ana 1']);
    expect(all.thanksReceived).toBe(3);
    expect(numbers('last30').thanksReceived).toBe(2);
  });
});

describe('Todo mundo também quer', () => {
  beforeEach(() => {
    addRequest('dune1', { requester: 'ana', createdAt: OLD, mediaKey: 'movie:1', title: 'Duna', genres: ['Ficção'] });
    addRequest('dune2', { requester: 'bia', createdAt: RECENT, mediaKey: 'movie:1', title: 'Duna', genres: ['Ficção'] });
    addCoRequest('dune2', 'caio', RECENT);
    addRequest('up', { requester: 'caio', createdAt: RECENT, mediaKey: 'movie:2', title: 'Up', genres: ['Animação', 'Comédia'] });
    addCoRequest('up', 'ana', '2026-10-11T12:00:00.000Z');
    addRequest('gone', { requester: 'ana', createdAt: RECENT, mediaKey: 'movie:3', title: 'Cancelado', genres: ['Terror'], status: 'canceled' });
    addCoRequest('gone', 'bia', RECENT);
    addRequest('hand', { requester: 'bia', createdAt: RECENT, title: 'Manual', genres: [] });
  });

  it('sums everyone who wants a media across its requests, canceled ones left out', () => {
    expect(numbers().mostWanted).toEqual([
      { requestId: 'dune2', title: 'Duna', posterPath: null, count: 3 },
      { requestId: 'up', title: 'Up', posterPath: null, count: 2 },
      { requestId: 'hand', title: 'Manual', posterPath: null, count: 1 },
    ]);
  });

  it('counts by the day each person said they want it', () => {
    expect(numbers('last30').mostWanted.map((m) => `${m.title} ${m.count}`)).toEqual(['Duna 2', 'Up 2', 'Manual 1']);
  });

  it('lists the genres most people want', () => {
    expect(numbers().trendingGenres).toEqual(['Ficção', 'Animação', 'Comédia']);
  });
});

describe('Métricas da Paçoca', () => {
  beforeEach(() => {
    for (const id of ['r1', 'r2', 'r3']) addRequest(id, { requester: 'ana', createdAt: OLD });
  });

  it('counts the petiscos reserved and not refunded, cashback aside', () => {
    addMovement('m1', 'ana', 'monthly', 'reserve', 'r1', OLD, 'monthly:2026-08');
    addMovement('m2', 'ana', 'monthly', 'debit', 'r1', OLD, 'monthly:2026-08');
    addMovement('m3', 'bia', 'monthly', 'reserve', 'r2', RECENT, 'monthly:2026-10');
    addMovement('m4', 'bia', 'monthly', 'reserve', 'r3', RECENT, 'monthly:2026-10');
    addMovement('m5', 'bia', 'monthly', 'refund', 'r3', RECENT, 'monthly:2026-10');
    addMovement('m6', 'ana', 'cashback', 'credit', 'r1', RECENT);
    expect(numbers().petiscosConsumed).toBe(2);
    expect(numbers('last30').petiscosConsumed).toBe(1);
  });

  it('adds the time in Farejando, up to now for a request still in it', () => {
    addTransition('r1', 'approved', 'in_jellyseerr', '2026-10-10T00:00:00.000Z');
    addTransition('r1', 'in_jellyseerr', 'fulfilled', '2026-10-10T02:00:00.000Z');
    addTransition('r2', 'approved', 'in_jellyseerr', '2026-10-21T14:00:00.000Z');
    addTransition('r3', 'approved', 'in_jellyseerr', OLD);
    addTransition('r3', 'in_jellyseerr', 'fulfilled', '2026-08-01T13:00:00.000Z');
    expect(numbers().farejandoMs).toBe(4 * HOUR);
    expect(numbers('last30').farejandoMs).toBe(3 * HOUR);
  });

  it('has nothing to say about an empty group', () => {
    sql.run('DELETE FROM requests');
    expect(numbers()).toEqual({
      topRequesters: [],
      topCashback: [],
      topThanks: [],
      mostWanted: [],
      trendingGenres: [],
      petiscosConsumed: 0,
      thanksReceived: 0,
      farejandoMs: 0,
    });
  });
});
