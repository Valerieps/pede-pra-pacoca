import { beforeEach, describe, expect, it } from 'vitest';
import type { InboxItemView, InboxView, NotificationSettingsView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

let service: GroupService;
let clock: ReturnType<typeof fixedClock>;
let ids: Record<string, string>;

function signIn(name: string): void {
  const email = `${name}@example.com`;
  if (name !== 'cesar') service.command('s-cesar', 'invite.create', { email });
  service.signIn({ sub: `g-${name}`, email, name, picture: null }, `s-${name}`, ['cesar@example.com']);
  const me = service.query(`s-${name}`, 'me', {});
  if (!me.ok) throw new Error('not signed in');
  ids[name] = (me.value as { id: string }).id;
}

const offline = (session: string): InboxItemView[] =>
  (service.query(session, 'notifications.inbox', {}) as { value: InboxView }).value.items.filter((i) => i.type === 'pacocast_offline');
const settings = (session: string) => (service.query(session, 'notifications.settings', {}) as { value: NotificationSettingsView }).value;
const minutesLater = (minutes: number) => clock.set(new Date(new Date(clock.now()).getTime() + minutes * 60_000).toISOString());

/** Cesar is admin and attendant, Dani admin only, Bia attendant only, Ana a requester. */
beforeEach(() => {
  clock = fixedClock('2026-11-02T15:00:00Z'); // 12:00 local
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
  ids = {};
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.cesar, roles: ['admin', 'attendant'] });
  signIn('dani');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.dani, roles: ['admin'] });
  signIn('bia');
  service.command('s-cesar', 'member.setRoles', { memberId: ids.bia, roles: ['attendant'] });
  signIn('ana');
});

describe('Paçocast offline', () => {
  it('tells the admins once after an hour without a call', () => {
    service.pacocastWork();
    minutesLater(59);
    service.tick();
    expect(offline('s-cesar')).toHaveLength(0);

    minutesLater(1);
    expect(service.tick()).toEqual(['notifications']);
    expect(offline('s-cesar').map((i) => i.body)).toEqual(['A Paçoca não ouve o Paçocast desde 02/11 às 12:00. Dá uma olhada no servidor de casa?']);
    expect(offline('s-dani')).toHaveLength(1);
    expect(offline('s-bia')).toHaveLength(0);
    expect(offline('s-ana')).toHaveLength(0);

    minutesLater(60 * 24);
    expect(service.tick()).toEqual([]);
    expect(offline('s-cesar')).toHaveLength(1);
  });

  it('says nothing before the first call', () => {
    minutesLater(60 * 24);
    expect(service.tick()).toEqual([]);
  });

  it('counts reports as calls, and tells again after the next silence', () => {
    service.pacocastReport({ reports: [] });
    minutesLater(61);
    service.tick();
    service.pacocastWork();
    minutesLater(30);
    service.tick();
    expect(offline('s-cesar')).toHaveLength(1);

    minutesLater(31);
    service.tick();
    expect(offline('s-cesar')).toHaveLength(2);
  });

  it('can be switched off, and only admins see the switch', () => {
    service.command('s-cesar', 'notifications.setPrefs', { enabled: { pacocast_offline: false } });
    service.pacocastWork();
    minutesLater(61);
    service.tick();
    expect(offline('s-cesar')).toHaveLength(0);
    expect(offline('s-dani')).toHaveLength(1);
    expect(settings('s-dani').admin).toBe(true);
    expect(settings('s-bia').admin).toBe(false);
  });
});
