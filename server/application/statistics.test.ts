import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupStatsInput, GroupStatsView, ProfileStatsView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
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

const HOUR = 60 * 60 * 1000;
const NOW = '2026-10-21T15:00:00.000Z';

function join(person: Person) {
  if (person !== 'cesar') service.command('session-cesar', 'invite.create', { email: people[person].email });
  expect(service.signIn(people[person], `session-${person}`, ['cesar@example.com'])).toMatchObject({ ok: true });
  ids[person] = sql.all<{ id: string }>('SELECT id FROM members WHERE email = ?', people[person].email)[0].id;
}

interface Seed {
  requester: Person;
  createdAt: string;
  status?: string;
  title?: string;
  type?: 'movie' | 'tv';
  origin?: 'tmdb' | 'manual';
  genres?: string[];
  assignee?: Person;
  /** Hours from the request to Atendido; sets the status to fulfilled. */
  fulfilledAfter?: number;
}

function addRequest(id: string, seed: Seed): void {
  const status = seed.fulfilledAfter !== undefined ? 'fulfilled' : (seed.status ?? 'approved');
  sql.run(
    `INSERT INTO requests (id, origin, media_type, title, genres, requester_id, status, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    seed.origin ?? 'tmdb',
    seed.type ?? 'movie',
    seed.title ?? id,
    JSON.stringify(seed.genres ?? []),
    ids[seed.requester],
    status,
    seed.assignee ? ids[seed.assignee] : null,
    seed.createdAt,
    seed.createdAt,
  );
  sql.run(`INSERT INTO request_transitions (request_id, from_status, to_status, actor, at) VALUES (?, NULL, 'approved', ?, ?)`, id, ids[seed.requester], seed.createdAt);
  if (seed.fulfilledAfter !== undefined) {
    const at = new Date(new Date(seed.createdAt).getTime() + seed.fulfilledAfter * HOUR).toISOString();
    sql.run(`INSERT INTO request_transitions (request_id, from_status, to_status, actor, at) VALUES (?, 'approved', 'fulfilled', ?, ?)`, id, ids.cesar, at);
  }
}

function addEvent(id: string, actor: Person, requestId: string | null, likers: Person[]): void {
  sql.run('INSERT INTO feed_events (id, type, actor_id, request_id, like_count, at) VALUES (?, ?, ?, ?, ?, ?)', id, 'request_created', ids[actor], requestId, likers.length, NOW);
  for (const liker of likers) sql.run('INSERT INTO likes (event_id, member_id, at) VALUES (?, ?, ?)', id, ids[liker], NOW);
}

function addMovement(id: string, member: Person, kind: string, operation: string, requestId: string | null): void {
  sql.run(
    'INSERT INTO petisco_movements (id, member_id, kind, operation, lot, request_id, actor, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ids[member],
    kind,
    operation,
    `lot-${id}`,
    requestId,
    ids.cesar,
    NOW,
  );
}

function profile(viewer: Person, member: Person | string): ProfileStatsView {
  const result = service.query(`session-${viewer}`, 'stats.profile', { memberId: member in ids ? ids[member as Person] : member });
  if (!result.ok) throw new Error(result.error);
  return result.value as ProfileStatsView;
}

function stats(input: GroupStatsInput = {}): GroupStatsView {
  const result = service.query('session-bia', 'stats.group', input);
  if (!result.ok) throw new Error(result.error);
  return result.value as GroupStatsView;
}

const titles = (view: GroupStatsView) => view.groups.flatMap((g) => g.requests.map((r) => r.title));

beforeEach(() => {
  sql = memorySql();
  clock = fixedClock(NOW);
  service = new GroupService(sql, clock, sequentialIds());
  service.migrate();
  join('cesar');
  join('ana');
  join('bia');
});

describe('profile', () => {
  beforeEach(() => {
    addRequest('r1', { requester: 'ana', createdAt: '2026-10-01T12:00:00.000Z', genres: ['Drama', 'Ação'], fulfilledAfter: 2 });
    addRequest('r2', { requester: 'ana', createdAt: '2026-09-10T12:00:00.000Z', genres: ['Drama'], fulfilledAfter: 4 });
    addRequest('r3', { requester: 'ana', createdAt: '2026-09-15T12:00:00.000Z', genres: ['Comédia'] });
    addRequest('r4', { requester: 'ana', createdAt: '2026-09-16T12:00:00.000Z', genres: ['Terror'], status: 'canceled' });
    addRequest('r5', { requester: 'bia', createdAt: '2026-10-02T12:00:00.000Z', genres: ['Drama'] });
  });

  it('counts requests, fulfilled and the average time to Atendido, without canceled ones', () => {
    expect(profile('bia', 'ana')).toMatchObject({
      member: { name: 'Ana' },
      totalRequests: 3,
      fulfilled: 2,
      averageMsToFulfilled: 3 * HOUR,
    });
  });

  it('lists the most requested genres', () => {
    expect(profile('ana', 'ana').topGenres).toEqual([
      { genre: 'Drama', count: 2 },
      { genre: 'Ação', count: 1 },
      { genre: 'Comédia', count: 1 },
    ]);
  });

  it('counts requests per month in São Paulo, the last 12 months with zeros', () => {
    // 00:30 UTC on Nov 1st is still October 31st in São Paulo.
    clock.set('2026-11-05T12:00:00.000Z');
    addRequest('r6', { requester: 'ana', createdAt: '2026-11-01T00:30:00.000Z' });
    const { perMonth } = profile('ana', 'ana');
    expect(perMonth).toHaveLength(12);
    expect(perMonth[0]).toEqual({ month: '2025-12', count: 0 });
    expect(perMonth.slice(-3)).toEqual([
      { month: '2026-09', count: 2 },
      { month: '2026-10', count: 2 },
      { month: '2026-11', count: 0 },
    ]);
  });

  it('counts cashbacks and likes received from other people', () => {
    addMovement('m1', 'ana', 'cashback', 'credit', 'r1');
    addMovement('m2', 'ana', 'bonus', 'credit', null);
    addMovement('m3', 'ana', 'monthly', 'debit', 'r1');
    addEvent('e1', 'ana', 'r1', ['bia', 'cesar', 'ana']);
    addEvent('e2', 'bia', 'r5', ['ana']);
    expect(profile('cesar', 'ana')).toMatchObject({ cashbacks: 1, likesReceived: 2 });
  });

  it('starts at zero for someone who asked for nothing', () => {
    expect(profile('ana', 'cesar')).toMatchObject({ totalRequests: 0, fulfilled: 0, averageMsToFulfilled: null, topGenres: [], cashbacks: 0, likesReceived: 0 });
  });

  it('turns down an unknown member or a missing id', () => {
    expect(service.query('session-ana', 'stats.profile', { memberId: 'nope' })).toEqual({ ok: false, error: 'not_found' });
    expect(service.query('session-ana', 'stats.profile', {})).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('group statistics', () => {
  beforeEach(() => {
    addRequest('Duna', { requester: 'ana', createdAt: '2026-10-01T12:00:00.000Z', genres: ['Ficção'], assignee: 'cesar', fulfilledAfter: 10 });
    addRequest('Bluey', { requester: 'bia', createdAt: '2026-10-05T12:00:00.000Z', type: 'tv', genres: ['Animação'], assignee: 'cesar', fulfilledAfter: 2 });
    addRequest('Avatar', { requester: 'ana', createdAt: '2026-09-20T12:00:00.000Z', genres: ['Ficção', 'Ação'], assignee: 'cesar', status: 'unavailable' });
    addRequest('Filme raro', { requester: 'bia', createdAt: '2026-10-10T12:00:00.000Z', origin: 'manual', status: 'awaiting_approval' });
    addRequest('Cancelado', { requester: 'ana', createdAt: '2026-10-11T12:00:00.000Z', status: 'canceled' });
  });

  it('computes the metrics over every request but canceled ones', () => {
    addMovement('d1', 'ana', 'monthly', 'debit', 'Duna');
    addMovement('d2', 'bia', 'monthly', 'debit', 'Bluey');
    addMovement('c1', 'ana', 'cashback', 'credit', 'Duna');
    addMovement('x1', 'ana', 'monthly', 'refund', 'Cancelado');
    addEvent('e1', 'ana', 'Duna', ['bia', 'cesar']);
    addEvent('e2', 'bia', 'Bluey', ['ana']);
    addEvent('e3', 'cesar', 'Duna', ['bia']);
    const view = stats();
    expect(view.total).toBe(4);
    expect(view.metrics).toEqual({
      fulfilled: 2,
      perGenre: [
        { genre: 'Ficção', count: 2 },
        { genre: '', count: 1 },
        { genre: 'Animação', count: 1 },
        { genre: 'Ação', count: 1 },
      ],
      perPerson: [
        { member: expect.objectContaining({ name: 'Ana' }), count: 2 },
        { member: expect.objectContaining({ name: 'Bia' }), count: 2 },
      ],
      perAttendant: [{ member: expect.objectContaining({ name: 'Cesar' }), count: 3 }],
      averageMsToFulfilled: 6 * HOUR,
      unavailableRate: 1 / 3,
      petiscosConsumed: 2,
      petiscosReturned: 1,
      mostLiked: [
        { requestId: 'Duna', title: 'Duna', likes: 3 },
        { requestId: 'Bluey', title: 'Bluey', likes: 1 },
      ],
    });
    expect(view.groups).toHaveLength(1);
    expect(titles(view)).toEqual(['Filme raro', 'Bluey', 'Duna', 'Avatar']);
    expect(view.groups[0].requests.find((r) => r.id === 'Duna')).toMatchObject({ likes: 3, requester: { name: 'Ana' }, assignee: { name: 'Cesar' } });
  });

  it('filters by person, period, type, genre, status, origin and attendant', () => {
    expect(titles(stats({ filter: { memberId: ids.ana } }))).toEqual(['Duna', 'Avatar']);
    expect(titles(stats({ filter: { from: '2026-10-01', to: '2026-10-05' } }))).toEqual(['Bluey', 'Duna']);
    expect(titles(stats({ filter: { type: 'tv' } }))).toEqual(['Bluey']);
    expect(titles(stats({ filter: { genre: 'Ficção' } }))).toEqual(['Duna', 'Avatar']);
    expect(titles(stats({ filter: { status: 'canceled' } }))).toEqual(['Cancelado']);
    expect(titles(stats({ filter: { origin: 'manual' } }))).toEqual(['Filme raro']);
    expect(titles(stats({ filter: { attendantId: ids.cesar, status: 'fulfilled' } }))).toEqual(['Bluey', 'Duna']);
  });

  it('counts the genres of the filtered requests only', () => {
    expect(stats({ filter: { memberId: ids.ana } }).metrics.perGenre).toEqual([
      { genre: 'Ficção', count: 2 },
      { genre: 'Ação', count: 1 },
    ]);
  });

  it('reads the period in São Paulo: 01:00 UTC on Oct 6th is still Oct 5th', () => {
    addRequest('Tarde', { requester: 'bia', createdAt: '2026-10-06T01:00:00.000Z' });
    expect(titles(stats({ filter: { from: '2026-10-05', to: '2026-10-05' } }))).toEqual(['Tarde', 'Bluey']);
  });

  it('sorts by the same fields', () => {
    expect(titles(stats({ sort: 'oldest' }))).toEqual(['Avatar', 'Duna', 'Bluey', 'Filme raro']);
    expect(titles(stats({ sort: 'title' }))).toEqual(['Avatar', 'Bluey', 'Duna', 'Filme raro']);
    expect(titles(stats({ sort: 'person' }))).toEqual(['Duna', 'Avatar', 'Filme raro', 'Bluey']);
    expect(titles(stats({ sort: 'attendant' }))).toEqual(['Bluey', 'Duna', 'Avatar', 'Filme raro']);
    expect(titles(stats({ sort: 'bogus' as never }))).toEqual(['Filme raro', 'Bluey', 'Duna', 'Avatar']);
  });

  it('groups by person, month and genre, with counts', () => {
    const byPerson = stats({ groupBy: 'person' }).groups;
    expect(byPerson.map((g) => [g.member?.name, g.count, g.requests.map((r) => r.title)])).toEqual([
      ['Ana', 2, ['Duna', 'Avatar']],
      ['Bia', 2, ['Filme raro', 'Bluey']],
    ]);
    expect(stats({ groupBy: 'month' }).groups.map((g) => [g.key, g.count])).toEqual([
      ['2026-10', 3],
      ['2026-09', 1],
    ]);
    // A request counts in each of its genres; requests without genre sit under "".
    expect(stats({ groupBy: 'genre' }).groups.map((g) => [g.key, g.count])).toEqual([
      ['Ficção', 2],
      ['', 1],
      ['Animação', 1],
      ['Ação', 1],
    ]);
    expect(stats({ groupBy: 'attendant' }).groups.map((g) => [g.member?.name ?? null, g.count])).toEqual([
      ['Cesar', 3],
      [null, 1],
    ]);
  });

  it('offers the genres and attendants seen for the pickers', () => {
    expect(stats().options).toEqual({ genres: ['Animação', 'Ação', 'Ficção'], attendants: [expect.objectContaining({ name: 'Cesar' })] });
  });

  it('has nothing to say about an empty group', () => {
    sql.run('DELETE FROM request_transitions');
    sql.run('DELETE FROM requests');
    expect(stats()).toMatchObject({ total: 0, truncated: false, metrics: { averageMsToFulfilled: null, unavailableRate: null, mostLiked: [] } });
  });
});
