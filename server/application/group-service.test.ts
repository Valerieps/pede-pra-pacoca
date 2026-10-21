import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import { MIGRATIONS } from './schema';

const cesar = { sub: 'g-cesar', email: 'Cesar@Example.com', name: 'Cesar', picture: null };
const carla = { sub: 'g-carla', email: 'carla@example.com', name: 'Carla', picture: null };
const BOOTSTRAP = ['cesar@example.com'];

let service: GroupService;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  clock = fixedClock('2026-10-21T15:00:00Z');
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
});

function cesarSignsIn() {
  expect(service.signIn(cesar, 'session-cesar', BOOTSTRAP)).toMatchObject({ ok: true });
}

describe('migrations', () => {
  it('run once and can run again', () => {
    service.migrate();
    expect(MIGRATIONS.length).toBeGreaterThan(0);
  });
});

describe('sign-in', () => {
  it('turns down an e-mail without invite and creates nothing', () => {
    cesarSignsIn();
    expect(service.signIn(carla, 'session-carla', BOOTSTRAP)).toEqual({ ok: false, error: 'no_invite' });
    expect(service.query('session-cesar', 'members', {})).toMatchObject({ ok: true, value: [{ name: 'Cesar' }] });
  });

  it('lets the bootstrap e-mail in as admin only while there is no admin', () => {
    cesarSignsIn();
    expect(service.query('session-cesar', 'me', {})).toMatchObject({ ok: true, value: { roles: ['admin'] } });
    const other = { sub: 'g-x', email: 'x@example.com', name: 'X', picture: null };
    expect(service.signIn(other, 's', ['x@example.com'])).toEqual({ ok: false, error: 'no_invite' });
  });

  it('accepts an invite, joins the feed and gets the whole month of petiscos', () => {
    cesarSignsIn();
    service.command('session-cesar', 'invite.create', { email: ' CARLA@example.com ' });
    expect(service.signIn(carla, 'session-carla', [])).toMatchObject({ ok: true });

    const me = service.query('session-carla', 'me', {});
    expect(me).toMatchObject({ ok: true, value: { name: 'Carla', roles: [], petiscos: { total: 3, monthlyAvailable: 3 } } });
    const feed = service.query('session-carla', 'feed', {});
    expect(feed.ok && feed.value).toMatchObject([{ type: 'member_joined', actor: { name: 'Carla' } }, { type: 'member_joined' }]);
    const invites = service.query('session-cesar', 'invites', {});
    expect(invites).toMatchObject({ ok: true, value: [{ email: 'carla@example.com', state: 'accepted' }] });
  });

  it('rejects unknown and expired sessions', () => {
    cesarSignsIn();
    expect(service.query('nope', 'me', {})).toEqual({ ok: false, error: 'unauthenticated' });
    clock.set('2027-10-21T15:00:00Z');
    expect(service.query('session-cesar', 'me', {})).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('signing out ends the session', () => {
    cesarSignsIn();
    service.signOut('session-cesar');
    expect(service.query('session-cesar', 'me', {})).toEqual({ ok: false, error: 'unauthenticated' });
  });
});

describe('invites', () => {
  beforeEach(cesarSignsIn);

  it('only admins invite', () => {
    service.command('session-cesar', 'invite.create', { email: 'carla@example.com' });
    service.signIn(carla, 'session-carla', []);
    expect(service.command('session-carla', 'invite.create', { email: 'dani@example.com' })).toEqual({ ok: false, error: 'forbidden' });
    expect(service.query('session-carla', 'invites', {})).toEqual({ ok: false, error: 'forbidden' });
  });

  it('validates the e-mail and refuses current members', () => {
    expect(service.command('session-cesar', 'invite.create', { email: 'not an email' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('session-cesar', 'invite.create', { email: 'cesar@example.com' })).toEqual({ ok: false, error: 'conflict' });
  });

  it('a revoked invite no longer lets the person in', () => {
    service.command('session-cesar', 'invite.create', { email: 'carla@example.com' });
    expect(service.command('session-cesar', 'invite.revoke', { email: 'carla@example.com' })).toMatchObject({ ok: true, changed: ['invites'] });
    expect(service.signIn(carla, 'session-carla', [])).toEqual({ ok: false, error: 'no_invite' });
  });

  it('only pending invites can be revoked', () => {
    service.command('session-cesar', 'invite.create', { email: 'carla@example.com' });
    service.signIn(carla, 'session-carla', []);
    expect(service.command('session-cesar', 'invite.revoke', { email: 'carla@example.com' })).toEqual({ ok: false, error: 'conflict' });
  });
});

describe('roles', () => {
  beforeEach(cesarSignsIn);

  it('the last admin keeps the role', () => {
    const [{ id }] = (service.query('session-cesar', 'members', {}) as { ok: true; value: { id: string }[] }).value;
    expect(service.command('session-cesar', 'member.setRoles', { memberId: id, roles: ['attendant'] })).toEqual({ ok: false, error: 'last_admin' });
    expect(service.command('session-cesar', 'member.setRoles', { memberId: id, roles: ['admin', 'attendant'] })).toMatchObject({
      ok: true,
      value: { roles: ['admin', 'attendant'] },
    });
  });

  it('unknown queries and commands are not found', () => {
    expect(service.query('session-cesar', 'constructor', {})).toEqual({ ok: false, error: 'not_found' });
    expect(service.command('session-cesar', 'drop.everything', {})).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('tick', () => {
  it('removes expired sessions', () => {
    cesarSignsIn();
    clock.set('2027-10-21T15:00:00Z');
    service.tick();
    clock.set('2026-10-21T15:00:00Z');
    expect(service.query('session-cesar', 'me', {})).toEqual({ ok: false, error: 'unauthenticated' });
  });
});
