import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import { migrate, MIGRATIONS } from './schema';

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

describe('migration 2', () => {
  it('keeps the photo of members who existed before, and asks them to confirm their profile', () => {
    const sql = memorySql();
    sql.run('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    for (const statement of MIGRATIONS[0]) sql.run(statement);
    sql.run("INSERT INTO schema_migrations VALUES (1, '2026-10-01T00:00:00Z')");
    sql.run("INSERT INTO members (id, email, name, photo_url, roles, joined_at) VALUES ('m1', 'a@example.com', 'A', 'https://p/a', '[]', '2026-10-01T00:00:00Z')");
    migrate(sql);
    expect(sql.all('SELECT photo_url, google_photo_url, photo_choice, profile_confirmed_at FROM members')).toEqual([
      { photo_url: 'https://p/a', google_photo_url: 'https://p/a', photo_choice: 'google', profile_confirmed_at: null },
    ]);
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

describe('members and roles', () => {
  beforeEach(() => {
    cesarSignsIn();
    service.command('session-cesar', 'invite.create', { email: 'carla@example.com' });
    service.signIn(carla, 'session-carla', []);
  });

  const members = (session: string) => (service.query(session, 'members', {}) as { ok: true; value: { id: string; name: string; email?: string }[] }).value;
  const carlaId = () => members('session-cesar').find((m) => m.name === 'Carla')!.id;

  it('everyone sees the members; only admins see e-mails', () => {
    expect(members('session-carla').map((m) => [m.name, m.email])).toEqual([
      ['Carla', undefined],
      ['Cesar', undefined],
    ]);
    expect(members('session-cesar').map((m) => m.email)).toEqual(['carla@example.com', 'cesar@example.com']);
  });

  it('an admin gives and takes the attendant and admin roles', () => {
    expect(service.command('session-cesar', 'member.setRoles', { memberId: carlaId(), roles: ['attendant', 'admin', 'owner'] })).toMatchObject({
      ok: true,
      value: { roles: ['admin', 'attendant'] },
      changed: ['members', 'me'],
    });
    expect(service.query('session-carla', 'me', {})).toMatchObject({ value: { roles: ['admin', 'attendant'] } });
    expect(service.command('session-cesar', 'member.setRoles', { memberId: carlaId(), roles: [] })).toMatchObject({ ok: true, value: { roles: [] } });
  });

  it('only admins change roles', () => {
    const cesarId = members('session-carla').find((m) => m.name === 'Cesar')!.id;
    expect(service.command('session-carla', 'member.setRoles', { memberId: carlaId(), roles: ['admin'] })).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('session-carla', 'member.setRoles', { memberId: cesarId, roles: [] })).toEqual({ ok: false, error: 'forbidden' });
  });

  it('an admin may drop their own admin role while another admin remains', () => {
    service.command('session-cesar', 'member.setRoles', { memberId: carlaId(), roles: ['admin'] });
    const cesarId = members('session-cesar').find((m) => m.name === 'Cesar')!.id;
    expect(service.command('session-cesar', 'member.setRoles', { memberId: cesarId, roles: ['attendant'] })).toMatchObject({ ok: true });
    expect(service.command('session-carla', 'member.setRoles', { memberId: carlaId(), roles: [] })).toEqual({ ok: false, error: 'last_admin' });
  });

  it('refuses unknown members and malformed input', () => {
    expect(service.command('session-cesar', 'member.setRoles', { memberId: 'nobody', roles: [] })).toEqual({ ok: false, error: 'not_found' });
    expect(service.command('session-cesar', 'member.setRoles', { memberId: carlaId(), roles: 'admin' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('first access and profile', () => {
  const photo = 'https://lh3.googleusercontent.com/carla';
  const carlaWithPhoto = { ...carla, picture: photo };

  beforeEach(() => {
    cesarSignsIn();
    service.command('session-cesar', 'invite.create', { email: 'carla@example.com' });
    service.signIn(carlaWithPhoto, 'session-carla', []);
  });

  it('starts unconfirmed, with the Google photo on offer', () => {
    expect(service.query('session-carla', 'me', {})).toMatchObject({
      value: { profileConfirmed: false, photoChoice: 'google', photoUrl: photo, googlePhotoUrl: photo },
    });
  });

  it('confirms name and photo once, and can change them later', () => {
    expect(service.command('session-carla', 'member.updateProfile', { name: '  Carla  S. ', photo: 'none' })).toMatchObject({
      ok: true,
      value: { name: 'Carla S.', photoUrl: null, googlePhotoUrl: photo, profileConfirmed: true },
      changed: ['me', 'members', 'feed'],
    });
    expect(service.command('session-carla', 'member.updateProfile', { name: 'Carla', photo: 'google' })).toMatchObject({
      value: { name: 'Carla', photoUrl: photo, profileConfirmed: true },
    });
    expect(service.query('session-carla', 'feed', {})).toMatchObject({ value: [{ actor: { name: 'Carla' } }, {}] });
  });

  it('keeps "no photo" across sign-ins, and keeps the Google photo current otherwise', () => {
    service.command('session-carla', 'member.updateProfile', { name: 'Carla', photo: 'none' });
    service.signIn({ ...carla, picture: `${photo}-new` }, 'session-carla-2', []);
    expect(service.query('session-carla-2', 'me', {})).toMatchObject({ value: { photoUrl: null, googlePhotoUrl: `${photo}-new` } });

    service.command('session-carla-2', 'member.updateProfile', { name: 'Carla', photo: 'google' });
    service.signIn({ ...carla, picture: `${photo}-newer` }, 'session-carla-3', []);
    expect(service.query('session-carla-3', 'me', {})).toMatchObject({ value: { photoUrl: `${photo}-newer` } });
  });

  it('refuses an empty or too long name and an unknown photo choice', () => {
    expect(service.command('session-carla', 'member.updateProfile', { name: '   ', photo: 'google' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('session-carla', 'member.updateProfile', { name: 'x'.repeat(41), photo: 'google' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('session-carla', 'member.updateProfile', { name: 'Carla', photo: 'gravatar' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.query('session-carla', 'me', {})).toMatchObject({ value: { profileConfirmed: false } });
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
