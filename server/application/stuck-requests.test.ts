import { beforeEach, describe, expect, it } from 'vitest';
import type { InboxItemView, InboxView, MediaView, PacocastReport, RequestView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

const dune: MediaView = { type: 'movie', tmdbId: 693134, title: 'Duna', year: 2024, posterPath: null, releaseDate: '2024-02-27', genres: [] };
const alien: MediaView = { type: 'movie', tmdbId: 348, title: 'Alien', year: 1979, posterPath: null, releaseDate: '1979-05-25', genres: [] };
const severance: MediaView = { type: 'tv', tmdbId: 95396, title: 'Ruptura', year: 2022, posterPath: null, releaseDate: '2022-02-17', genres: [] };

let service: GroupService;
let clock: ReturnType<typeof fixedClock>;

function signIn(name: string): string {
  const email = `${name}@example.com`;
  if (name !== 'cesar') service.command('s-cesar', 'invite.create', { email });
  service.signIn({ sub: `g-${name}`, email, name, picture: null }, `s-${name}`, ['cesar@example.com']);
  return `s-${name}`;
}

function create(session: string, media: MediaView): RequestView {
  const result = service.command(session, 'request.create', { origin: 'tmdb', type: media.type, tmdbId: media.tmdbId }, { media });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestView;
}

const report = (...reports: PacocastReport[]) => service.pacocastReport({ reports });
const inboxOf = (session: string): InboxView => (service.query(session, 'notifications.inbox', {}) as { value: InboxView }).value;
const stuck = (session: string): InboxItemView[] => inboxOf(session).items.filter((i) => i.type === 'request_stuck');

/** Local (America/Sao_Paulo, UTC-3) wall-clock time to an instant. */
const at = (day: string, time = '09:00') => clock.set(new Date(`${day}T${time}:00-03:00`).toISOString());

beforeEach(() => {
  clock = fixedClock('2026-10-01T15:00:00Z'); // 12:00 local
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: 'id-1', roles: ['admin', 'attendant'] });
  signIn('ana');
});

describe('the daily check', () => {
  it('tells the attendants about each media more than 3 days in Farejando, one notice each', () => {
    const a = create('s-ana', dune);
    const b = create('s-ana', alien);
    report({ requestId: a.id, state: 'requested' }, { requestId: b.id, state: 'requested' });

    at('2026-10-04', '11:00'); // 2 days and 23 hours: not yet, and today's check is done
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(0);

    at('2026-10-05');
    expect(service.tick()).toEqual(['notifications']);
    const items = stuck('s-cesar');
    expect(items.map((i) => i.body).sort()).toEqual([
      'A Paçoca fareja Alien há 3 dias e nada. Dá uma olhada no Jellyseerr?',
      'A Paçoca fareja Duna há 3 dias e nada. Dá uma olhada no Jellyseerr?',
    ]);
    expect(stuck('s-ana')).toHaveLength(0);
  });

  it('runs once a day, from 09:00', () => {
    const a = create('s-ana', dune);
    report({ requestId: a.id, state: 'requested' });

    at('2026-10-06', '08:55');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(0);
    at('2026-10-06', '09:05');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(1);
  });

  it('tells only once per stay in a status', () => {
    const a = create('s-ana', dune);
    report({ requestId: a.id, state: 'requested' });
    at('2026-10-05');
    service.tick();
    service.command('s-cesar', 'notifications.markRead', {});
    at('2026-10-06');
    service.tick();
    at('2026-10-20');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(0);
  });

  it('waits more than 5 days in Parcialmente disponível', () => {
    const s = create('s-ana', severance);
    report({ requestId: s.id, state: 'requested' }, { requestId: s.id, state: 'partially_available' });

    at('2026-10-06');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(0);
    at('2026-10-07');
    service.tick();
    expect(stuck('s-cesar').map((i) => i.body)).toEqual(['Ruptura está pela metade há 5 dias. Dá uma olhada no Jellyseerr?']);
  });

  it('does not tell about a request that left the stuck statuses', () => {
    const a = create('s-ana', dune);
    report({ requestId: a.id, state: 'requested' }, { requestId: a.id, state: 'available' });
    at('2026-10-10');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(0);
  });
});

describe('the snooze', () => {
  function stuckNotice(): InboxItemView {
    const a = create('s-ana', dune);
    report({ requestId: a.id, state: 'requested' });
    at('2026-10-05');
    service.tick();
    return stuck('s-cesar')[0];
  }

  it('takes the notice out of the inbox and tells again on its day if still stuck', () => {
    const item = stuckNotice();
    expect(service.command('s-cesar', 'notifications.snoozeStuck', { id: item.id, until: '2026-10-08' })).toMatchObject({ ok: true });
    expect(stuck('s-cesar')).toHaveLength(0);

    at('2026-10-07');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(0);
    at('2026-10-08');
    service.tick();
    expect(stuck('s-cesar').map((i) => i.body)).toEqual(['A Paçoca fareja Duna há 6 dias e nada. Dá uma olhada no Jellyseerr?']);
  });

  it('shows, in Vistos, the day it tells again, while the media is still stuck there', () => {
    const item = stuckNotice();
    const requestId = item.url.slice(item.url.lastIndexOf('/') + 1);
    service.command('s-cesar', 'notifications.snoozeStuck', { id: item.id, until: '2026-10-08' });
    const seen = () => inboxOf('s-cesar').seen.filter((i) => i.type === 'request_stuck');
    expect(seen()).toMatchObject([{ id: item.id, read: true, snoozedUntil: '2026-10-08' }]);

    report({ requestId, state: 'available' });
    expect(seen()[0].snoozedUntil).toBeUndefined();
  });

  it('can be cancelled by snoozing to tomorrow: the next check tells again', () => {
    const item = stuckNotice();
    service.command('s-cesar', 'notifications.snoozeStuck', { id: item.id, until: '2026-10-20' });
    expect(service.command('s-cesar', 'notifications.snoozeStuck', { id: item.id, until: '2026-10-06' })).toMatchObject({ ok: true });
    at('2026-10-06');
    service.tick();
    expect(stuck('s-cesar')).toHaveLength(1);
  });

  it('only for attendants, on their own notice, to a day after today and within a year', () => {
    const item = stuckNotice();
    expect(service.command('s-ana', 'notifications.snoozeStuck', { id: item.id, until: '2026-10-08' })).toMatchObject({ ok: false, error: 'forbidden' });
    expect(service.command('s-cesar', 'notifications.snoozeStuck', { id: 'nope', until: '2026-10-08' })).toMatchObject({ ok: false, error: 'not_found' });
    for (const until of ['2026-10-05', '2027-10-06', '2026-02-30', 'amanhã', null]) {
      expect(service.command('s-cesar', 'notifications.snoozeStuck', { id: item.id, until })).toMatchObject({ ok: false, error: 'invalid' });
    }
  });
});
