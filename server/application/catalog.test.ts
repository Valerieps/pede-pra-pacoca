import { beforeEach, describe, expect, it } from 'vitest';
import type { CatalogItemView, ImdbView, InboxView, MediaProblemView, MediaView, RequestView } from '../../src/application/api-contract';
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
const got: MediaView = { ...dune, type: 'tv', tmdbId: 1399, title: 'Game of Thrones', year: 2011, releaseDate: '2011-04-17', genres: ['Drama'] };

let service: GroupService;
let sql: Sql;

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

function fulfilled(media: MediaView): RequestView {
  const created = service.command('s-ana', 'request.create', { origin: 'tmdb', type: media.type, tmdbId: media.tmdbId }, { media });
  if (!created.ok) throw new Error(created.error);
  const request = created.value as RequestView;
  expect(service.command('s-cesar', 'request.act', { ids: [request.id], action: { type: 'mark_fulfilled' } })).toMatchObject({ ok: true });
  return request;
}

function catalog(session: string): CatalogItemView[] {
  const result = service.query(session, 'catalog', {});
  if (!result.ok) throw new Error(result.error);
  return result.value as CatalogItemView[];
}

function problems(session: string): MediaProblemView[] {
  const result = service.query(session, 'problems', {});
  if (!result.ok) throw new Error(result.error);
  return result.value as MediaProblemView[];
}

function inboxTypes(session: string): string[] {
  const inbox = service.query(session, 'notifications.inbox', {});
  return inbox.ok ? (inbox.value as InboxView).items.map((i) => i.type) : [];
}

beforeEach(() => {
  sql = memorySql();
  service = new GroupService(sql, fixedClock('2026-10-25T15:00:00Z'), sequentialIds());
  service.migrate();
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: idOf('s-cesar'), roles: ['admin', 'attendant'] });
  signIn('ana');
  signIn('bia');
});

describe('the catalog', () => {
  it('lists the titles the app brought in until the library sync arrives, without scores, opening the request', () => {
    const request = fulfilled(dune);
    service.command('s-ana', 'request.create', { origin: 'tmdb', type: 'tv', tmdbId: got.tmdbId }, { media: got });
    expect(catalog('s-bia')).toEqual([
      {
        type: 'movie',
        tmdbId: dune.tmdbId,
        title: dune.title,
        year: 2024,
        posterPath: '/dune.jpg',
        genres: ['Ficção científica'],
        seasons: null,
        imdbRating: null,
        tmdbRating: null,
        criticsScore: null,
        requestId: request.id,
        scoresKnown: false,
        reportedByMe: false,
      },
    ]);
  });

  it('keeps the scores the media page looked up, and looks them up again after 30 days', () => {
    fulfilled(dune);
    const imdb: ImdbView = { imdbId: 'tt15239678', rating: 8.5, criticsScore: 92, audienceScore: 95, tmdbRating: 8.2, runtime: 166, episodes: null, genres: [] };
    expect(service.query('s-bia', 'media.imdb', { type: 'movie', tmdbId: dune.tmdbId }, { imdb })).toEqual({ ok: true, value: imdb });
    expect(catalog('s-bia')[0]).toMatchObject({ imdbRating: 8.5, tmdbRating: 8.2, criticsScore: 92, scoresKnown: true });

    const later = new GroupService(sql, fixedClock('2026-11-25T15:00:00Z'), sequentialIds());
    const [item] = (later.query('s-bia', 'catalog', {}) as { value: CatalogItemView[] }).value;
    expect(item).toMatchObject({ imdbRating: 8.5, scoresKnown: false });
  });

  it('prefers the synced row, with its scores, over the request', () => {
    fulfilled(dune);
    sql.run(
      `INSERT INTO catalog_items (media_key, media_type, tmdb_id, title, year, genres, imdb_rating, tmdb_rating, critics_score, synced_at)
       VALUES ('movie:693134', 'movie', 693134, 'Duna: Parte 2', 2024, '["Aventura"]', 8.5, 8.2, 92, '2026-10-25')`,
    );
    sql.run(
      `INSERT INTO catalog_items (media_key, media_type, tmdb_id, title, year, seasons, synced_at)
       VALUES ('tv:1', 'tv', 1, 'Ted Lasso', 2020, 3, '2026-10-25')`,
    );
    const items = catalog('s-bia');
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.tmdbId === dune.tmdbId)).toMatchObject({
      title: 'Duna: Parte 2',
      genres: ['Aventura'],
      imdbRating: 8.5,
      tmdbRating: 8.2,
      criticsScore: 92,
      requestId: expect.any(String),
      scoresKnown: true,
    });
    expect(items.find((i) => i.tmdbId === 1)).toMatchObject({ type: 'tv', seasons: 3, requestId: null });
  });
});

describe('reporting a problem', () => {
  beforeEach(() => fulfilled(dune));

  const report = (session: string, extra: object = {}) =>
    service.command(session, 'problem.report', { type: 'movie', tmdbId: dune.tmdbId, reason: 'no_subtitles', description: '  some no meio  ', ...extra });

  it('any member reports; only the attendants hear of it and see it in Gerenciar pedidos', () => {
    expect(report('s-bia')).toMatchObject({ ok: true, changed: ['problems', 'notifications'] });
    expect(inboxTypes('s-cesar')).toContain('problem_reported');
    expect(inboxTypes('s-ana')).not.toContain('problem_reported');
    expect(problems('s-cesar')).toMatchObject([{ title: dune.title, reason: 'no_subtitles', description: 'some no meio', reporter: { name: 'bia' } }]);
    expect(catalog('s-bia')[0].reportedByMe).toBe(true);
    expect(catalog('s-ana')[0].reportedByMe).toBe(false);
    expect(service.query('s-bia', 'problems', {})).toEqual({ ok: false, error: 'forbidden' });
  });

  it('takes a reason without text, except "Outro"', () => {
    expect(report('s-bia', { reason: 'wont_play', description: '' })).toMatchObject({ ok: true });
    expect(problems('s-cesar')).toMatchObject([{ reason: 'wont_play', description: '' }]);
    expect(report('s-ana', { reason: 'other', description: '  ' })).toEqual({ ok: false, error: 'invalid' });
    expect(report('s-ana', { reason: 'other', description: 'tela verde' })).toMatchObject({ ok: true });
  });

  it('refuses a missing or unfitting reason, a long text, a title not in the catalog and a second open report', () => {
    expect(report('s-bia', { reason: undefined })).toEqual({ ok: false, error: 'invalid' });
    expect(report('s-bia', { reason: 'missing_episode' })).toEqual({ ok: false, error: 'invalid' });
    expect(report('s-bia', { description: 'x'.repeat(301) })).toEqual({ ok: false, error: 'invalid' });
    expect(report('s-bia', { tmdbId: 42 })).toEqual({ ok: false, error: 'not_found' });
    report('s-bia');
    expect(report('s-bia')).toEqual({ ok: false, error: 'conflict' });
    expect(report('s-ana')).toMatchObject({ ok: true });
  });

  it('the attendant resolves it and the reporter is told; then she can report again', () => {
    report('s-bia');
    const [problem] = problems('s-cesar');
    expect(service.command('s-bia', 'problem.resolve', { id: problem.id })).toEqual({ ok: false, error: 'forbidden' });
    expect(service.command('s-cesar', 'problem.resolve', { id: problem.id })).toMatchObject({ ok: true });
    expect(service.command('s-cesar', 'problem.resolve', { id: problem.id })).toEqual({ ok: false, error: 'conflict' });
    expect(inboxTypes('s-bia')).toContain('problem_resolved');
    expect(problems('s-cesar')).toEqual([]);
    expect(catalog('s-bia')[0].reportedByMe).toBe(false);
    expect(report('s-bia')).toMatchObject({ ok: true });
  });
});
