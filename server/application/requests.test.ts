import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaView, RequestDetailView, RequestView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import type { Sql } from './ports';

const dune: MediaView = {
  type: 'movie',
  tmdbId: 693134,
  title: 'Duna: Parte Dois',
  year: 2024,
  posterPath: '/dune.jpg',
  releaseDate: '2024-02-27',
  genres: ['Ficção científica'],
};
const got: MediaView = { ...dune, type: 'tv', tmdbId: 1399, title: 'Game of Thrones', year: 2011, releaseDate: '2011-04-17' };

let service: GroupService;
let sql: Sql;
let clock: ReturnType<typeof fixedClock>;

function signIn(name: string): string {
  const email = `${name}@example.com`;
  if (name !== 'cesar') service.command('s-cesar', 'invite.create', { email });
  expect(service.signIn({ sub: `g-${name}`, email, name, picture: null }, `s-${name}`, ['cesar@example.com'])).toMatchObject({ ok: true });
  return `s-${name}`;
}

function idOf(session: string): string {
  const me = service.query(session, 'me', {});
  if (!me.ok) throw new Error('not signed in');
  return (me.value as { id: string }).id;
}

function petiscos(session: string): number {
  const me = service.query(session, 'me', {});
  return me.ok ? (me.value as { petiscos: { total: number } }).petiscos.total : -1;
}

function create(session: string, media: MediaView = dune, extra: object = {}): RequestView {
  const result = service.command(session, 'request.create', { origin: 'tmdb', type: media.type, tmdbId: media.tmdbId, ...extra }, { media });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestView;
}

function detail(session: string, id: string): RequestDetailView {
  const result = service.query(session, 'request.detail', { id });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestDetailView;
}

function feedTypes(session: string): string[] {
  const feed = service.query(session, 'feed', {});
  return feed.ok ? (feed.value as { type: string }[]).map((e) => e.type) : [];
}

beforeEach(() => {
  clock = fixedClock('2026-10-21T15:00:00Z');
  sql = memorySql();
  service = new GroupService(sql, clock, sequentialIds());
  service.migrate();
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: idOf('s-cesar'), roles: ['admin', 'attendant'] });
  signIn('ana');
  signIn('bia');
  signIn('dani');
});

describe('creating a request', () => {
  it('with a petisco: approved, reserved, on the feed, with the TMDB data', () => {
    const request = create('s-ana', dune, { note: '  legendado  ' });
    expect(request).toMatchObject({ status: 'approved', title: 'Duna: Parte Dois', year: 2024, posterPath: '/dune.jpg', genres: ['Ficção científica'], note: 'legendado' });
    expect(petiscos('s-ana')).toBe(2);
    expect(feedTypes('s-ana')).toContain('request_created');
    expect(detail('s-ana', request.id).transitions).toMatchObject([{ from: null, to: 'approved', actor: { name: 'ana' } }]);
  });

  it('without petiscos: awaiting approval, nothing reserved', () => {
    create('s-ana', { ...dune, tmdbId: 1 });
    create('s-ana', { ...dune, tmdbId: 2 });
    create('s-ana', { ...dune, tmdbId: 3 });
    expect(petiscos('s-ana')).toBe(0);
    expect(create('s-ana', { ...dune, tmdbId: 4 }).status).toBe('awaiting_approval');
    expect(sql.all("SELECT * FROM petisco_movements WHERE operation = 'reserve'")).toHaveLength(3);
  });

  it("an attendant's request reserves nothing", () => {
    expect(create('s-cesar').status).toBe('approved');
    expect(petiscos('s-cesar')).toBe(3);
  });

  it('spends the bonus that expires before the month ends', () => {
    sql.run(
      "INSERT INTO petisco_movements (id, member_id, kind, operation, lot, expires_at, actor, at) VALUES ('b1', ?, 'bonus', 'credit', 'b1', '2026-10-25T00:00:00Z', 'x', '2026-07-27T00:00:00Z')",
      idOf('s-ana'),
    );
    const request = create('s-ana');
    expect(sql.all('SELECT kind, lot FROM petisco_movements WHERE request_id = ?', request.id)).toEqual([{ kind: 'bonus', lot: 'b1' }]);
  });

  it('a TMDB request needs what the Worker looked up', () => {
    expect(service.command('s-ana', 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: 693134 })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command('s-ana', 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: 1 }, { media: dune })).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses a note that is too long', () => {
    expect(service.command('s-ana', 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: dune.tmdbId, note: 'x'.repeat(501) }, { media: dune })).toEqual({
      ok: false,
      error: 'invalid',
    });
  });
});

describe('manual requests', () => {
  const manual = (session: string, extra: object = {}) =>
    service.command(session, 'request.create', { origin: 'manual', type: 'movie', title: ' Filme raro ', ...extra });

  it('reserve a petisco and have no TMDB data', () => {
    expect(manual('s-ana', { link: 'https://example.com/filme#top' })).toMatchObject({
      ok: true,
      value: { origin: 'manual', title: 'Filme raro', tmdbId: null, posterPath: null, link: 'https://example.com/filme', status: 'approved' },
    });
    expect(petiscos('s-ana')).toBe(2);
  });

  it('need a title and a valid http(s) link', () => {
    expect(manual('s-ana', { title: '  ' })).toEqual({ ok: false, error: 'invalid' });
    expect(manual('s-ana', { link: 'javascript:alert(1)' })).toEqual({ ok: false, error: 'invalid' });
    expect(manual('s-ana', { type: 'book' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('the same exact link enters the duplicate check; no link, no check', () => {
    manual('s-ana', { link: 'https://example.com/filme' });
    expect(service.query('s-bia', 'manual.availability', { link: 'https://example.com/filme' })).toMatchObject({ ok: true, value: { kind: 'active', mine: false } });
    expect(manual('s-bia', { link: 'https://example.com/filme' })).toEqual({ ok: false, error: 'conflict' });
    expect(manual('s-bia', { link: 'https://example.com/outro' }).ok).toBe(true);
    expect(manual('s-bia').ok).toBe(true);
    expect(manual('s-dani').ok).toBe(true);
    expect(service.query('s-bia', 'manual.availability', { link: 'nada' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('duplicates', () => {
  it('an active request is found by TMDB id; creating it again is refused', () => {
    const request = create('s-ana');
    expect(service.query('s-bia', 'media.preview', {}, { media: dune })).toMatchObject({
      ok: true,
      value: { title: 'Duna: Parte Dois', availability: { kind: 'active', requestId: request.id, mine: false, joined: false } },
    });
    expect(service.command('s-bia', 'request.create', { origin: 'tmdb', type: 'movie', tmdbId: dune.tmdbId }, { media: dune })).toEqual({ ok: false, error: 'conflict' });
  });

  it('the same id as a series is a different media', () => {
    create('s-ana');
    expect(create('s-bia', { ...got, tmdbId: dune.tmdbId }).status).toBe('approved');
  });

  it('fulfilled or known media need "Pedir de novo", which spends a petisco', () => {
    const request = create('s-ana');
    sql.run("UPDATE requests SET status = 'fulfilled' WHERE id = ?", request.id);
    sql.run("INSERT INTO known_media (media_key, at) VALUES ('tv:1399', '2026-10-01T00:00:00Z')");
    expect(service.query('s-bia', 'media.search', {}, { results: [dune, got, { ...dune, tmdbId: 9 }] })).toMatchObject({
      ok: true,
      value: [{ availability: { kind: 'fulfilled', requestId: request.id } }, { availability: { kind: 'known' } }, { availability: { kind: 'new' } }],
    });
    expect(service.command('s-bia', 'request.create', { origin: 'tmdb', type: 'tv', tmdbId: 1399 }, { media: got })).toEqual({ ok: false, error: 'conflict' });
    expect(create('s-bia', got, { again: true }).status).toBe('approved');
    expect(create('s-bia', dune, { again: true }).status).toBe('approved');
    expect(petiscos('s-bia')).toBe(1);
  });

  it('search without results from the Worker is invalid', () => {
    expect(service.query('s-bia', 'media.search', { query: 'x' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('Eu também quero', () => {
  it('joins without spending, shows on the feed, and can be undone', () => {
    const request = create('s-ana');
    expect(service.command('s-bia', 'request.join', { id: request.id })).toMatchObject({ ok: true, changed: ['requests', 'feed'] });
    expect(petiscos('s-bia')).toBe(3);
    expect(detail('s-bia', request.id)).toMatchObject({ coRequesters: [{ name: 'bia' }], viewer: { isCoRequester: true, canLeave: true, canJoin: false } });
    expect(feedTypes('s-bia')).toContain('co_request');
    expect(service.query('s-bia', 'media.preview', {}, { media: dune })).toMatchObject({ value: { availability: { joined: true } } });

    expect(service.command('s-bia', 'request.leave', { id: request.id }).ok).toBe(true);
    expect(detail('s-bia', request.id).coRequesters).toEqual([]);
    expect(feedTypes('s-bia')).not.toContain('co_request');
  });

  it('not on my own request, not twice, not on a closed one', () => {
    const request = create('s-ana');
    expect(service.command('s-ana', 'request.join', { id: request.id })).toEqual({ ok: false, error: 'forbidden' });
    service.command('s-bia', 'request.join', { id: request.id });
    expect(service.command('s-bia', 'request.join', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    sql.run("UPDATE requests SET status = 'fulfilled' WHERE id = ?", request.id);
    expect(service.command('s-dani', 'request.join', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-bia', 'request.leave', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-dani', 'request.join', { id: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('joined requests show in my requests', () => {
    const request = create('s-ana');
    create('s-bia', got);
    service.command('s-bia', 'request.join', { id: request.id });
    const mine = service.query('s-bia', 'requests.mine', {});
    expect(mine.ok && (mine.value as RequestView[]).map((r) => r.title).sort()).toEqual(['Duna: Parte Dois', 'Game of Thrones']);
  });
});

describe('cancel', () => {
  it('refunds the petisco and leaves the feed', () => {
    const request = create('s-ana');
    expect(service.command('s-ana', 'request.cancel', { id: request.id })).toMatchObject({ ok: true });
    expect(petiscos('s-ana')).toBe(3);
    expect(detail('s-ana', request.id)).toMatchObject({ status: 'canceled', viewer: { canCancel: false } });
    expect(feedTypes('s-ana')).not.toContain('request_created');
  });

  it('only the requester, only before No Jellyseerr', () => {
    const request = create('s-ana');
    expect(service.command('s-bia', 'request.cancel', { id: request.id })).toEqual({ ok: false, error: 'forbidden' });
    sql.run("UPDATE requests SET status = 'in_jellyseerr' WHERE id = ?", request.id);
    expect(service.command('s-ana', 'request.cancel', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
  });

  it('a refund in another month goes back to the month it came from', () => {
    const request = create('s-ana');
    clock.set('2026-11-02T15:00:00Z');
    service.command('s-ana', 'request.cancel', { id: request.id });
    expect(petiscos('s-ana')).toBe(3);
    expect(sql.all("SELECT lot FROM petisco_movements WHERE operation = 'refund'")).toEqual([{ lot: 'monthly:2026-10' }]);
  });
});

describe('the offer to co-requesters', () => {
  let request: RequestView;

  beforeEach(() => {
    request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    clock.set('2026-10-21T15:01:00Z');
    service.command('s-dani', 'request.join', { id: request.id });
    clock.set('2026-10-21T16:00:00Z');
    service.command('s-ana', 'request.cancel', { id: request.id });
  });

  it('goes to the oldest co-requester; the requester gets her petisco back', () => {
    expect(petiscos('s-ana')).toBe(3);
    const seen = detail('s-bia', request.id);
    expect(seen).toMatchObject({ status: 'approved', offer: { member: { name: 'bia' }, expiresAt: '2026-10-26T16:00:00.000Z' }, viewer: { hasOffer: true } });
    expect(detail('s-ana', request.id).viewer).toMatchObject({ canCancel: false, canEditNote: false });
    expect(service.command('s-ana', 'request.cancel', { id: request.id })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command('s-dani', 'request.answerOffer', { id: request.id, accept: true })).toEqual({ ok: false, error: 'forbidden' });
  });

  it('accepting makes her the requester and spends her petisco; the original leaves', () => {
    expect(service.command('s-bia', 'request.answerOffer', { id: request.id, accept: true })).toMatchObject({ ok: true });
    const seen = detail('s-bia', request.id);
    expect(seen).toMatchObject({ status: 'approved', requester: { name: 'bia' }, coRequesters: [{ name: 'dani' }], offer: null, viewer: { canCancel: true } });
    expect(petiscos('s-bia')).toBe(2);
    expect(petiscos('s-ana')).toBe(3);
    // Her cancel later refunds her own petisco, not Ana's.
    clock.set('2026-10-22T16:00:00Z');
    service.command('s-bia', 'request.cancel', { id: request.id });
    expect(petiscos('s-bia')).toBe(3);
    expect(detail('s-dani', request.id).offer).toMatchObject({ member: { name: 'dani' } });
  });

  it('an heir without petiscos sends it to Aguardando aprovação', () => {
    for (const id of [1, 2, 3]) create('s-bia', { ...dune, tmdbId: id });
    service.command('s-bia', 'request.answerOffer', { id: request.id, accept: true });
    expect(detail('s-bia', request.id).status).toBe('awaiting_approval');
  });

  it('declining passes it on; with nobody left it is Cancelado for everyone', () => {
    service.command('s-bia', 'request.answerOffer', { id: request.id, accept: false });
    expect(detail('s-dani', request.id).offer).toMatchObject({ member: { name: 'dani' } });
    service.command('s-dani', 'request.answerOffer', { id: request.id, accept: false });
    expect(detail('s-dani', request.id)).toMatchObject({ status: 'canceled', offer: null });
    expect(feedTypes('s-ana')).not.toContain('request_created');
  });

  it('undoing "Eu também quero" with the offer in hand passes it on', () => {
    service.command('s-bia', 'request.leave', { id: request.id });
    expect(detail('s-dani', request.id).offer).toMatchObject({ member: { name: 'dani' } });
  });

  it('an offer nobody answers in 5 days expires on the cron', () => {
    clock.set('2026-10-26T16:00:00Z');
    expect(service.tick()).toEqual(['requests', 'feed']);
    expect(detail('s-dani', request.id).offer).toMatchObject({ member: { name: 'dani' } });
    clock.set('2026-10-31T16:00:00Z');
    service.tick();
    expect(detail('s-dani', request.id).status).toBe('canceled');
    expect(service.tick()).toEqual([]);
  });

  it('the attendant may move it meanwhile; past Aprovado nobody accepting does not cancel it', () => {
    sql.run("UPDATE requests SET status = 'in_jellyseerr' WHERE id = ?", request.id);
    service.command('s-bia', 'request.answerOffer', { id: request.id, accept: false });
    service.command('s-dani', 'request.answerOffer', { id: request.id, accept: false });
    expect(detail('s-dani', request.id).status).toBe('in_jellyseerr');
  });
});

describe('the note', () => {
  it('the requester edits it while awaiting approval or approved', () => {
    const request = create('s-ana');
    expect(service.command('s-ana', 'request.editNote', { id: request.id, note: 'dublado' })).toMatchObject({ ok: true, changed: ['requests'] });
    expect(detail('s-ana', request.id).note).toBe('dublado');
    expect(service.command('s-ana', 'request.editNote', { id: request.id, note: '' }).ok).toBe(true);
    expect(detail('s-ana', request.id).note).toBeNull();
    expect(service.command('s-bia', 'request.editNote', { id: request.id, note: 'x' })).toEqual({ ok: false, error: 'forbidden' });
    sql.run("UPDATE requests SET status = 'in_jellyseerr' WHERE id = ?", request.id);
    expect(service.command('s-ana', 'request.editNote', { id: request.id, note: 'x' })).toEqual({ ok: false, error: 'conflict' });
  });
});

describe('request detail', () => {
  it('anyone in the group sees it; an unknown id is not found', () => {
    const request = create('s-ana');
    expect(detail('s-dani', request.id).viewer).toMatchObject({ isRequester: false, canJoin: true, canCancel: false });
    expect(service.query('s-dani', 'request.detail', { id: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('the feed shows the title', () => {
    create('s-ana');
    const feed = service.query('s-ana', 'feed', {});
    expect(feed.ok && (feed.value as { type: string }[]).find((e) => e.type === 'request_created')).toMatchObject({ requestTitle: 'Duna: Parte Dois' });
  });
});
