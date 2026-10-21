import { describe, expect, it } from 'vitest';
import { recipients, type AudienceFacts } from './audience';
import { applyPrefs, DEFAULT_PREFS, parsePrefs } from './preferences';
import { mergeData, renderNotification } from './render';
import { digestTime, inQuietHours, likePushTime, nextLocalTime, pushTime } from './schedule';

// São Paulo is UTC-3: 23:00 local is 02:00Z the next day.
const at = (iso: string) => new Date(iso);
const quiet = DEFAULT_PREFS.quietHours;

describe('quiet hours', () => {
  it('covers 23:00 to 08:00 local, across midnight', () => {
    expect(inQuietHours(at('2026-10-22T01:59:00Z'), quiet)).toBe(false); // 22:59
    expect(inQuietHours(at('2026-10-22T02:00:00Z'), quiet)).toBe(true); // 23:00
    expect(inQuietHours(at('2026-10-22T10:59:00Z'), quiet)).toBe(true); // 07:59
    expect(inQuietHours(at('2026-10-22T11:00:00Z'), quiet)).toBe(false); // 08:00
  });

  it('works for a window inside one day, and none when start equals end', () => {
    const lunch = { start: '12:00', end: '14:00' };
    expect(inQuietHours(at('2026-10-22T15:30:00Z'), lunch)).toBe(true); // 12:30
    expect(inQuietHours(at('2026-10-22T17:00:00Z'), lunch)).toBe(false); // 14:00
    expect(inQuietHours(at('2026-10-22T15:30:00Z'), { start: '12:00', end: '12:00' })).toBe(false);
    expect(inQuietHours(at('2026-10-22T05:00:00Z'), null)).toBe(false);
  });

  it('holds a push until the quiet hours end', () => {
    // 23:30 local -> 08:00 the next morning.
    expect(pushTime(at('2026-10-22T02:30:00Z'), quiet).toISOString()).toBe('2026-10-22T11:00:00.000Z');
    // 06:00 local -> 08:00 the same morning.
    expect(pushTime(at('2026-10-22T09:00:00Z'), quiet).toISOString()).toBe('2026-10-22T11:00:00.000Z');
    // Outside the quiet hours: at once.
    expect(pushTime(at('2026-10-22T15:00:00Z'), quiet).toISOString()).toBe('2026-10-22T15:00:00.000Z');
  });
});

describe('daily digest', () => {
  it('goes out at the next digest time', () => {
    expect(nextLocalTime(at('2026-10-22T15:00:00Z'), '20:00').toISOString()).toBe('2026-10-22T23:00:00.000Z');
    // Right at 20:00 the digest is going out; the next request waits for tomorrow.
    expect(nextLocalTime(at('2026-10-22T23:00:00Z'), '20:00').toISOString()).toBe('2026-10-23T23:00:00.000Z');
    // Across the end of the month.
    expect(nextLocalTime(at('2026-10-31T23:30:00Z'), '20:00').toISOString()).toBe('2026-11-01T23:00:00.000Z');
  });

  it('waits for the end of the quiet hours when it falls inside them', () => {
    expect(digestTime(at('2026-10-22T15:00:00Z'), '23:30', quiet).toISOString()).toBe('2026-10-23T11:00:00.000Z');
    expect(digestTime(at('2026-10-22T15:00:00Z'), '20:00', quiet).toISOString()).toBe('2026-10-22T23:00:00.000Z');
  });
});

describe('likes', () => {
  const now = at('2026-10-22T15:00:00Z');
  it('the first like goes out at once', () => {
    expect(likePushTime(now, null, quiet)).toEqual(now);
    expect(likePushTime(now, at('2026-10-22T13:59:00Z'), quiet)).toEqual(now);
  });

  it('later likes wait for the hour to close', () => {
    expect(likePushTime(now, at('2026-10-22T14:30:00Z'), quiet).toISOString()).toBe('2026-10-22T15:30:00.000Z');
  });

  it('pile up names, once each', () => {
    const merged = mergeData('likes', { eventId: 'e', requestId: null, names: ['Ana', 'Bia'] }, { eventId: 'e', requestId: null, names: ['Bia', 'Caio'] });
    expect(merged.names).toEqual(['Ana', 'Bia', 'Caio']);
    expect(renderNotification('likes', merged).body).toBe('Ana, Bia e Caio curtiram sua novidade no feed.');
    expect(renderNotification('likes', { ...merged, requestId: 'r', names: ['Ana', 'Bia', 'Caio', 'Dani'] }).body).toBe('4 pessoas curtiram seu pedido.');
  });
});

describe('audience', () => {
  const facts: AudienceFacts = {
    attendants: [
      { id: 'cesar', onVacation: false },
      { id: 'dani', onVacation: true },
    ],
    activeMemberIds: ['cesar', 'dani', 'ana', 'bia', 'caio'],
    requesterId: 'ana',
    coRequesterIds: ['bia', 'ana', 'gone'],
    actorId: null,
  };

  it('sends attendant notices to attendants not on vacation', () => {
    expect(recipients('request_new', facts)).toEqual(['cesar']);
    expect(recipients('request_pending', facts)).toEqual(['cesar']);
    expect(recipients('daily_digest', facts)).toEqual(['cesar']);
    // Vacation only silences new requests.
    expect(recipients('webhook_failed', facts)).toEqual(['cesar', 'dani']);
  });

  it('with every attendant away, only pending requests still reach them', () => {
    const away = { ...facts, attendants: facts.attendants.map((a) => ({ ...a, onVacation: true })) };
    expect(recipients('request_pending', away)).toEqual(['cesar', 'dani']);
    expect(recipients('request_new', away)).toEqual([]);
  });

  it('reaches the requester and co-requesters, once each, active only', () => {
    expect(recipients('request_fulfilled', facts)).toEqual(['ana', 'bia']);
    expect(recipients('request_approved', facts)).toEqual(['ana']);
    expect(recipients('monthly_renewed', facts)).toEqual(['cesar', 'dani', 'ana', 'bia', 'caio']);
  });

  it('never notifies whoever caused it', () => {
    expect(recipients('request_new', { ...facts, actorId: 'cesar' })).toEqual([]);
    expect(recipients('likes', { ...facts, subjectId: 'ana', actorId: 'ana' })).toEqual([]);
    expect(recipients('likes', { ...facts, subjectId: 'ana', actorId: 'bia' })).toEqual(['ana']);
  });
});

describe('preferences', () => {
  it('start with everything on but the monthly renewal, digest at 20:00, quiet 23:00-08:00', () => {
    const prefs = parsePrefs('{}');
    expect(prefs.enabled.monthly_renewed).toBe(false);
    expect(prefs.enabled.likes).toBe(true);
    expect(prefs.newRequests).toBe('digest');
    expect(prefs.digestTime).toBe('20:00');
    expect(prefs.quietHours).toEqual({ start: '23:00', end: '08:00' });
  });

  it('applies valid changes and refuses invalid ones', () => {
    const next = applyPrefs(DEFAULT_PREFS, { enabled: { likes: false }, newRequests: 'immediate', quietHours: null });
    expect(next).toMatchObject({ newRequests: 'immediate', quietHours: null, enabled: { likes: false, co_request: true } });
    expect(applyPrefs(DEFAULT_PREFS, { digestTime: '24:00' })).toBeNull();
    expect(applyPrefs(DEFAULT_PREFS, { enabled: { daily_digest: false } })).toBeNull();
    expect(applyPrefs(DEFAULT_PREFS, { quietHours: { start: '23:00' } })).toBeNull();
    expect(applyPrefs(DEFAULT_PREFS, [])).toBeNull();
  });

  it('reads broken stored JSON as far as it can', () => {
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"digestTime":"9h","enabled":{"likes":false,"x":true}}')).toMatchObject({ digestTime: '20:00', enabled: { likes: false } });
  });
});

describe('texts', () => {
  it('builds every notice with a path in the app', () => {
    const digest = renderNotification('daily_digest', { titles: ['Duna', 'Up', 'Her'] });
    expect(digest.body).toBe('3 pedidos novos hoje: Duna, Up e Her.');
    expect(renderNotification('request_approved', { requestId: 'a/b', title: 'Duna' }).url).toBe('/pedido/a%2Fb');
    expect(renderNotification('petisco_received', { kind: 'cashback', amount: 1 }).body).toBe('A Paçoca te devolveu um petisco!');
  });
});
