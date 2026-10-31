import { beforeEach, describe, expect, it } from 'vitest';
import type { InboxView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import type { Context } from './context';
import { GroupService } from './group-service';
import { INBOX_LIMIT, notify, SUBSCRIPTIONS_PER_MEMBER } from './notifications';
import type { Sql } from './ports';

// 15:00Z is 12:00 in São Paulo: outside the default quiet hours (23:00-08:00).
const NOON = '2026-10-21T15:00:00Z';
const P256DH = 'B'.repeat(87); // 65 bytes in base64url
const AUTH = 'A'.repeat(22); // 16 bytes

let sql: Sql;
let clock: ReturnType<typeof fixedClock>;
let ctx: Context;
let service: GroupService;

function member(id: string, roles: string[] = [], extra: { vacation?: boolean } = {}) {
  sql.run(
    'INSERT INTO members (id, email, name, roles, vacation, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    `${id}@example.com`,
    id,
    JSON.stringify(roles),
    extra.vacation ? 1 : 0,
    NOON,
  );
  sql.run("INSERT INTO sessions (token_hash, member_id, created_at, expires_at) VALUES (?, ?, ?, '2099-01-01T00:00:00Z')", `s-${id}`, id, NOON);
}

function subscribe(id: string, endpoint = `https://fcm.googleapis.com/fcm/send/${id}`) {
  return service.command(`s-${id}`, 'push.subscribe', { endpoint, p256dh: P256DH, auth: AUTH });
}

function inboxOf(id: string): InboxView {
  const result = service.query(`s-${id}`, 'notifications.inbox', {});
  if (!result.ok) throw new Error(result.error);
  return result.value as InboxView;
}

const approved = (requesterId: string) =>
  ({ type: 'request_approved', data: { requestId: 'r1', title: 'Duna' }, requesterId, actorId: 'cesar' }) as const;

function claim(max = 10) {
  return service.claimDuePushes(max);
}

beforeEach(() => {
  sql = memorySql();
  clock = fixedClock(NOON);
  const ids = sequentialIds();
  ctx = { sql, clock, ids };
  service = new GroupService(sql, clock, ids, { pushPublicKey: 'public-key' });
  service.migrate();
  member('cesar', ['attendant', 'admin']);
  member('ana');
  member('bia');
});

describe('notify', () => {
  it('puts the notice in the inbox and its push in the outbox, at once', () => {
    subscribe('ana');
    notify(ctx, approved('ana'));
    expect(inboxOf('ana')).toMatchObject({ unread: 1, items: [{ type: 'request_approved', body: 'A Paçoca aprovou Duna. Agora é com ela!', url: '/pedido/r1', read: false }] });
    const { jobs } = claim();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ endpoint: 'https://fcm.googleapis.com/fcm/send/ana', p256dh: P256DH, auth: AUTH });
    expect(JSON.parse(jobs[0].payload)).toMatchObject({ title: 'Pedido aprovado', url: '/pedido/r1' });
    // Claimed once: never sent twice.
    expect(claim().jobs).toEqual([]);
  });

  it('sends nothing for a switched-off type, not even to the inbox', () => {
    subscribe('ana');
    service.command('s-ana', 'notifications.setPrefs', { enabled: { request_approved: false } });
    notify(ctx, approved('ana'));
    expect(inboxOf('ana').items).toEqual([]);
    expect(claim().jobs).toEqual([]);
  });

  it('holds the push during quiet hours; the inbox gets it at once', () => {
    subscribe('ana');
    clock.set('2026-10-22T03:00:00Z'); // 00:00 local
    notify(ctx, approved('ana'));
    expect(inboxOf('ana').unread).toBe(1);
    expect(claim().jobs).toEqual([]);
    clock.set('2026-10-22T10:55:00Z'); // 07:55
    expect(claim().jobs).toEqual([]);
    clock.set('2026-10-22T11:00:00Z'); // 08:00
    expect(claim().jobs).toHaveLength(1);
  });

  it('holds a due push when the member turned quiet hours on later', () => {
    subscribe('ana');
    notify(ctx, approved('ana'));
    service.command('s-ana', 'notifications.setPrefs', { quietHours: { start: '11:00', end: '13:00' } });
    expect(claim().jobs).toEqual([]);
    clock.set('2026-10-21T16:00:00Z'); // 13:00
    expect(claim().jobs).toHaveLength(1);
  });

  it('sends to every device of the member and keeps the batch small', () => {
    subscribe('ana');
    subscribe('ana', 'https://web.push.apple.com/ana-iphone');
    for (let i = 0; i < 4; i++) notify(ctx, approved('ana'));
    expect(claim(3).jobs).toHaveLength(4); // whole notices: two of them, on two devices
    expect(claim(3).jobs).toHaveLength(4);
    expect(claim(3).jobs).toEqual([]);
  });

  it('marks pushes for members without a device as done', () => {
    notify(ctx, approved('ana'));
    expect(claim().jobs).toEqual([]);
    subscribe('ana');
    expect(claim().jobs).toEqual([]);
  });

  it('drops the push of someone removed meanwhile', () => {
    subscribe('ana');
    notify(ctx, approved('ana'));
    sql.run("UPDATE members SET active = 0 WHERE id = 'ana'");
    expect(claim().jobs).toEqual([]);
  });
});

describe('daily digest', () => {
  const newRequest = (title: string) =>
    ({ type: 'request_new', data: { requestId: title, title, requesterName: 'Ana' }, requesterId: 'ana', actorId: 'ana' }) as const;

  beforeEach(() => subscribe('cesar'));

  it('collects new requests into one notice at 20:00', () => {
    notify(ctx, newRequest('Duna'));
    notify(ctx, newRequest('Up'));
    expect(inboxOf('cesar').items).toEqual([]);
    expect(claim().jobs).toEqual([]);

    clock.set('2026-10-21T23:00:00Z'); // 20:00
    const { jobs, inboxChanged } = claim();
    expect(inboxChanged).toBe(true);
    expect(jobs).toHaveLength(1);
    expect(JSON.parse(jobs[0].payload)).toMatchObject({ title: 'Resumo do dia', body: '2 pedidos novos hoje: Duna e Up.' });
    expect(inboxOf('cesar').items).toMatchObject([{ type: 'daily_digest', body: '2 pedidos novos hoje: Duna e Up.' }]);

    // The next request starts tomorrow's digest.
    notify(ctx, newRequest('Her'));
    expect(claim().jobs).toEqual([]);
  });

  it('is immediate for an attendant who chose so', () => {
    service.command('s-cesar', 'notifications.setPrefs', { newRequests: 'immediate' });
    notify(ctx, newRequest('Duna'));
    expect(inboxOf('cesar').items).toMatchObject([{ type: 'request_new', body: 'Ana pediu Duna.' }]);
    expect(claim().jobs).toHaveLength(1);
  });

  it('follows the attendant digest time', () => {
    service.command('s-cesar', 'notifications.setPrefs', { digestTime: '13:00' });
    notify(ctx, newRequest('Duna'));
    clock.set('2026-10-21T16:00:00Z');
    expect(claim().jobs).toHaveLength(1);
  });

  it('skips attendants on vacation, also when they went on vacation after the request', () => {
    member('dani', ['attendant'], { vacation: true });
    subscribe('dani');
    notify(ctx, newRequest('Duna'));
    sql.run("UPDATE members SET vacation = 1 WHERE id = 'cesar'");
    clock.set('2026-10-21T23:00:00Z');
    expect(claim().jobs).toEqual([]);
    expect(inboxOf('cesar').items).toEqual([]);
    expect(inboxOf('dani').items).toEqual([]);
  });

  it('pending approvals still reach attendants when all are on vacation', () => {
    sql.run("UPDATE members SET vacation = 1 WHERE id = 'cesar'");
    notify(ctx, { type: 'request_pending', data: { requestId: 'r', title: 'Duna', requesterName: 'Ana' }, requesterId: 'ana', actorId: 'ana' });
    expect(claim().jobs).toHaveLength(1);
  });
});

describe('likes', () => {
  const like = (name: string) => notify(ctx, { type: 'likes', data: { eventId: 'e1', requestId: 'r1', names: [name] }, subjectId: 'ana', actorId: name });

  beforeEach(() => subscribe('ana'));

  it('the first goes out at once; the rest wait for the hour and go together', () => {
    like('bia');
    expect(JSON.parse(claim().jobs[0].payload)).toMatchObject({ body: 'bia curtiu seu pedido.', tag: 'likes:e1' });

    clock.set('2026-10-21T15:10:00Z');
    like('cesar');
    like('dani');
    expect(claim().jobs).toEqual([]);
    clock.set('2026-10-21T16:00:00Z');
    expect(JSON.parse(claim().jobs[0].payload)).toMatchObject({ body: 'cesar e dani curtiram seu pedido.' });

    // One inbox item per event, with everyone who liked it.
    expect(inboxOf('ana')).toMatchObject({ unread: 1, items: [{ type: 'likes', body: 'bia, cesar e dani curtiram seu pedido.' }] });
  });

  it('a seen likes notice leaves the inbox and comes back with the next like', () => {
    like('bia');
    service.command('s-ana', 'notifications.markRead', {});
    expect(inboxOf('ana').items).toEqual([]);
    like('cesar');
    expect(inboxOf('ana')).toMatchObject({ unread: 1, items: [{ type: 'likes' }] });
  });

  it('after a quiet hour, the next like goes out at once again', () => {
    like('bia');
    claim();
    clock.set('2026-10-21T16:30:00Z');
    like('cesar');
    expect(claim().jobs).toHaveLength(1);
  });
});

describe('inbox', () => {
  it('keeps the latest notices only', () => {
    for (let i = 0; i < INBOX_LIMIT + 5; i++) notify(ctx, approved('ana'));
    expect(inboxOf('ana').items).toHaveLength(INBOX_LIMIT);
  });

  it('keeps what I saw under Vistos, newest first, within the same latest notices', () => {
    notify(ctx, approved('ana'));
    clock.set('2026-10-21T16:00:00Z');
    notify(ctx, { ...approved('ana'), data: { requestId: 'r2', title: 'Alien' } });
    service.command('s-ana', 'notifications.markRead', {});
    expect(inboxOf('ana').seen.map((i) => i.body)).toEqual([expect.stringContaining('Alien'), expect.stringContaining('Duna')]);

    for (let i = 0; i < INBOX_LIMIT; i++) notify(ctx, approved('ana'));
    expect(inboxOf('ana').seen).toHaveLength(0);
  });

  it('marks some or all as read, mine only', () => {
    notify(ctx, approved('ana'));
    notify(ctx, approved('ana'));
    notify(ctx, approved('bia'));
    const [first] = inboxOf('ana').items;
    const bias = inboxOf('bia').items[0].id;
    expect(service.command('s-ana', 'notifications.markRead', { ids: [first.id, bias] })).toMatchObject({ ok: true, changed: ['notifications'] });
    expect(inboxOf('ana')).toMatchObject({ unread: 1, items: [{ read: false }] });
    expect(inboxOf('bia').unread).toBe(1);
    service.command('s-ana', 'notifications.markRead', {});
    expect(inboxOf('ana')).toMatchObject({ unread: 0, items: [] });
    expect(inboxOf('ana').seen.map((i) => i.read)).toEqual([true, true]);
    expect(service.command('s-ana', 'notifications.markRead', { ids: 'all' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('preferences', () => {
  it('shows the defaults, the push key and whether the attendant types apply', () => {
    expect(service.query('s-ana', 'notifications.settings', {})).toMatchObject({
      ok: true,
      value: { pushPublicKey: 'public-key', attendant: false, prefs: { newRequests: 'digest', digestTime: '20:00', quietHours: { start: '23:00', end: '08:00' } } },
    });
    expect(service.query('s-cesar', 'notifications.settings', {})).toMatchObject({ ok: true, value: { attendant: true } });
  });

  it('saves valid changes and refuses invalid ones', () => {
    expect(service.command('s-ana', 'notifications.setPrefs', { quietHours: null, enabled: { likes: false } })).toMatchObject({
      ok: true,
      value: { quietHours: null, enabled: { likes: false, request_approved: true } },
    });
    expect(service.command('s-ana', 'notifications.setPrefs', { digestTime: '25:00' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.query('s-ana', 'notifications.settings', {})).toMatchObject({ ok: true, value: { prefs: { quietHours: null } } });
  });
});

describe('push subscriptions', () => {
  it('accepts only the known push services and well-formed keys', () => {
    expect(subscribe('ana')).toMatchObject({ ok: true });
    expect(subscribe('ana', 'https://updates.push.services.mozilla.com/wpush/v2/x')).toMatchObject({ ok: true });
    for (const endpoint of ['https://evil.example/push', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.example/x', 'https://u:p@fcm.googleapis.com/x', 'nope']) {
      expect(subscribe('ana', endpoint)).toEqual({ ok: false, error: 'invalid' });
    }
    const bad = { endpoint: 'https://fcm.googleapis.com/x' };
    expect(service.command('s-ana', 'push.subscribe', { ...bad, p256dh: 'short', auth: AUTH })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('s-ana', 'push.subscribe', { ...bad, p256dh: P256DH, auth: 'A'.repeat(21) + '!' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('moves a device to whoever subscribed last and keeps a few per member', () => {
    subscribe('ana', 'https://fcm.googleapis.com/shared');
    subscribe('bia', 'https://fcm.googleapis.com/shared');
    notify(ctx, approved('ana'));
    expect(claim().jobs).toEqual([]);
    for (let i = 0; i < SUBSCRIPTIONS_PER_MEMBER + 2; i++) {
      clock.set(new Date(Date.parse(NOON) + i * 1000).toISOString());
      subscribe('ana', `https://fcm.googleapis.com/ana-${i}`);
    }
    expect(sql.all("SELECT endpoint FROM push_subscriptions WHERE member_id = 'ana'")).toHaveLength(SUBSCRIPTIONS_PER_MEMBER);
  });

  it('unsubscribes only my own device, and forgets devices that are gone', () => {
    subscribe('ana');
    expect(service.command('s-bia', 'push.unsubscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/ana' })).toMatchObject({ ok: true });
    notify(ctx, approved('ana'));
    expect(claim().jobs).toHaveLength(1);
    service.removePushSubscriptions(['https://fcm.googleapis.com/fcm/send/ana']);
    notify(ctx, approved('ana'));
    expect(claim().jobs).toEqual([]);
    subscribe('ana');
    service.command('s-ana', 'push.unsubscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/ana' });
    notify(ctx, approved('ana'));
    expect(claim().jobs).toEqual([]);
  });
});

describe('tick', () => {
  it('forgets old sent pushes', () => {
    notify(ctx, approved('ana'));
    claim();
    clock.set('2026-10-24T15:00:00Z');
    service.tick();
    expect(sql.all('SELECT id FROM outbox')).toEqual([]);
  });
});
