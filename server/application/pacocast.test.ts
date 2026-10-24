import { beforeEach, describe, expect, it } from 'vitest';
import type { InboxView, MediaView, PacocastReport, RequestDetailView, RequestView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import { PACOCAST_BATCH } from './pacocast';

const dune: MediaView = { type: 'movie', tmdbId: 693134, title: 'Duna', year: 2024, posterPath: null, releaseDate: '2024-02-27', genres: [] };
const severance: MediaView = { type: 'tv', tmdbId: 95396, title: 'Ruptura', year: 2022, posterPath: null, releaseDate: '2022-02-17', genres: [] };

let service: GroupService;

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

function detail(id: string): RequestDetailView {
  const result = service.query('s-cesar', 'request.detail', { id });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestDetailView;
}

function petiscos(session: string): number {
  const me = service.query(session, 'me', {});
  return me.ok ? (me.value as { petiscos: { total: number } }).petiscos.total : -1;
}

const inboxTypes = (session: string) => (service.query(session, 'notifications.inbox', {}) as { value: InboxView }).value.items.map((i) => i.type);
const report = (...reports: PacocastReport[]) => service.pacocastReport({ reports });

beforeEach(() => {
  service = new GroupService(memorySql(), fixedClock('2026-10-21T15:00:00Z'), sequentialIds());
  service.migrate();
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: 'id-1', roles: ['admin', 'attendant'] });
  signIn('ana');
});

describe('the work', () => {
  it('lists Solicitado TMDB requests to send and the sent ones to follow', () => {
    const movie = create('s-ana', dune);
    const series = create('s-ana', severance);
    service.command('s-ana', 'request.create', { origin: 'manual', type: 'movie', title: 'Filme raro' });
    service.command('s-cesar', 'request.act', { ids: [series.id], action: { type: 'mark_sent' } });

    expect(service.pacocastWork()).toEqual({
      toSend: [{ id: movie.id, mediaType: 'movie', tmdbId: 693134 }],
      tracking: [{ id: series.id, mediaType: 'tv', tmdbId: 95396 }],
    });
  });
});

describe('the reports', () => {
  it('Requested: Solicitado becomes Farejando, recorded as the Jellyseerr', () => {
    const movie = create('s-ana', dune);
    expect(report({ requestId: movie.id, state: 'requested' })).toMatchObject({ ok: true, value: { applied: 1 } });
    const view = detail(movie.id);
    expect(view.status).toBe('in_jellyseerr');
    expect(view.transitions.at(-1)).toMatchObject({ to: 'in_jellyseerr', actor: null });
  });

  it('the same report twice changes nothing the second time', () => {
    const movie = create('s-ana', dune);
    report({ requestId: movie.id, state: 'processing' });
    expect(report({ requestId: movie.id, state: 'processing' })).toMatchObject({ ok: true, value: { applied: 0 }, changed: [] });
  });

  it('a series partially available tells its requesters, then Available closes it', () => {
    const series = create('s-ana', severance);
    const before = petiscos('s-ana');
    report({ requestId: series.id, state: 'requested' }, { requestId: series.id, state: 'partially_available' });
    expect(detail(series.id).status).toBe('partially_available');
    expect(inboxTypes('s-ana')).toContain('request_partially_available');
    expect(petiscos('s-ana')).toBe(before);

    report({ requestId: series.id, state: 'available' });
    expect(detail(series.id).status).toBe('fulfilled');
    expect(inboxTypes('s-ana')).toContain('request_fulfilled');
    expect(petiscos('s-ana')).toBe(before);
    expect(service.pacocastWork().tracking).toEqual([]);
  });

  it('Available marks the media as known in the server', () => {
    const movie = create('s-ana', dune);
    report({ requestId: movie.id, state: 'available' });
    const again = service.query('s-ana', 'media.preview', {}, { media: dune });
    expect(again).toMatchObject({ ok: true, value: { availability: { kind: 'fulfilled' } } });
  });

  it('a failure: Não foi possível, the petisco back, the attendants warned', () => {
    const movie = create('s-ana', dune);
    const before = petiscos('s-ana');
    report({ requestId: movie.id, state: 'failed', detail: 'Radarr sem espaço' });
    const view = detail(movie.id);
    expect(view.status).toBe('unavailable');
    expect(view.reason).toEqual({ code: 'server_failure', text: 'Radarr sem espaço' });
    expect(petiscos('s-ana')).toBe(before + 1);
    expect(inboxTypes('s-cesar')).toContain('webhook_failed');
  });

  it('a request closed by hand meanwhile stays closed', () => {
    const movie = create('s-ana', dune);
    service.command('s-cesar', 'request.act', { ids: [movie.id], action: { type: 'mark_fulfilled' } });
    expect(report({ requestId: movie.id, state: 'failed' })).toMatchObject({ value: { applied: 0 } });
    expect(detail(movie.id).status).toBe('fulfilled');
  });

  it('refuses malformed reports, and unknown ids are only skipped', () => {
    expect(service.pacocastReport({ reports: [{ requestId: 'x', state: 'deleted' }] })).toEqual({ ok: false, error: 'invalid' });
    expect(service.pacocastReport({ reports: 'x' })).toEqual({ ok: false, error: 'invalid' });
    const tooMany = Array.from({ length: PACOCAST_BATCH + 1 }, () => ({ requestId: 'x', state: 'available' }));
    expect(service.pacocastReport({ reports: tooMany })).toEqual({ ok: false, error: 'invalid' });
    expect(report({ requestId: 'nope', state: 'available' })).toMatchObject({ ok: true, value: { applied: 0 } });
  });
});
