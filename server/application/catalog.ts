// The Catálogo (docs/spec/catalogo.md): every title in the attendant's library, and the problems
// members report with them. Until the library sync fills catalog_items (ADR-018), the titles the
// app itself brought in (Cãopleto or Parcialmente disponível) show, without the scores.
import type { CatalogItemView, MediaProblemView } from '../../src/application/api-contract';
import { MAX_PROBLEM_LENGTH } from '../../src/domain/catalog/catalog';
import { canAttend } from '../../src/domain/group/roles';
import { mediaKey, type MediaType } from '../../src/domain/media/media';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { findMember, memberView, type Member } from './members';
import { notify } from './notifications';

type Input = Record<string, unknown>;

interface CatalogRow {
  media_key: string;
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  genres: string;
  seasons: number | null;
  imdb_rating: number | null;
  tmdb_rating: number | null;
  critics_score: number | null;
}

const IN_LIBRARY = "('fulfilled', 'partially_available')";

/** The synced library, plus the latest in-library request of each title the sync does not have. */
const CATALOG_SQL = `
  SELECT media_key, media_type, tmdb_id, title, year, poster_path, genres, seasons, imdb_rating, tmdb_rating, critics_score
  FROM catalog_items
  UNION ALL
  SELECT media_key, media_type, tmdb_id, title, year, poster_path, genres, NULL, NULL, NULL, NULL
  FROM requests r
  WHERE origin = 'tmdb' AND status IN ${IN_LIBRARY}
    AND media_key NOT IN (SELECT media_key FROM catalog_items)
    AND id = (SELECT id FROM requests r2 WHERE r2.media_key = r.media_key AND r2.status IN ${IN_LIBRARY} ORDER BY updated_at DESC, id DESC LIMIT 1)`;

function catalogRows(ctx: Context, key?: string): CatalogRow[] {
  return key ? ctx.sql.all<CatalogRow>(`SELECT * FROM (${CATALOG_SQL}) WHERE media_key = ?`, key) : ctx.sql.all<CatalogRow>(CATALOG_SQL);
}

function parseGenres(json: string): string[] {
  const value = JSON.parse(json) as unknown;
  return Array.isArray(value) ? value.filter((g): g is string => typeof g === 'string') : [];
}

export function listCatalog(ctx: Context, actor: Member): CatalogItemView[] {
  const reported = new Set(
    ctx.sql.all<{ media_key: string }>('SELECT media_key FROM media_problems WHERE member_id = ? AND resolved_at IS NULL', actor.id).map((r) => r.media_key),
  );
  return catalogRows(ctx).map((row) => ({
    type: row.media_type,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    genres: parseGenres(row.genres),
    seasons: row.seasons,
    imdbRating: row.imdb_rating,
    tmdbRating: row.tmdb_rating,
    criticsScore: row.critics_score,
    reportedByMe: reported.has(row.media_key),
  }));
}

/** Any member reports a problem with a title in the Catálogo; it goes to the attendants only. */
export function reportProblem(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  const { type, tmdbId } = input;
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if ((type !== 'movie' && type !== 'tv') || !Number.isSafeInteger(tmdbId) || (tmdbId as number) <= 0) return failure('invalid');
  if (description === '' || description.length > MAX_PROBLEM_LENGTH) return failure('invalid');
  const key = mediaKey(type, tmdbId as number);
  const [item] = catalogRows(ctx, key);
  if (!item) return failure('not_found');
  const [open] = ctx.sql.all('SELECT id FROM media_problems WHERE member_id = ? AND media_key = ? AND resolved_at IS NULL', actor.id, key);
  if (open) return failure('conflict');

  const id = ctx.ids.next();
  ctx.sql.run(
    `INSERT INTO media_problems (id, media_key, media_type, tmdb_id, title, poster_path, member_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    key,
    item.media_type,
    item.tmdb_id,
    item.title,
    item.poster_path,
    actor.id,
    description,
    nowIso(ctx),
  );
  notify(ctx, { type: 'problem_reported', data: { problemId: id, title: item.title, memberName: actor.name, description }, actorId: actor.id });
  return { ok: true, value: null, changed: ['problems', 'notifications'] };
}

interface ProblemRow {
  id: string;
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  member_id: string;
  description: string;
  created_at: string;
  resolved_at: string | null;
}

/** The open problems, oldest first, for Gerenciar pedidos. */
export function listProblems(ctx: Context, actor: Member): MediaProblemView[] | null {
  if (!canAttend(actor)) return null;
  return ctx.sql.all<ProblemRow>('SELECT * FROM media_problems WHERE resolved_at IS NULL ORDER BY created_at, id').flatMap((row) => {
    const reporter = findMember(ctx, row.member_id);
    return reporter
      ? [
          {
            id: row.id,
            type: row.media_type,
            tmdbId: row.tmdb_id,
            title: row.title,
            posterPath: row.poster_path,
            description: row.description,
            reporter: memberView(reporter),
            createdAt: row.created_at,
          },
        ]
      : [];
  });
}

/** The attendant marks a problem solved; whoever reported it is told. */
export function resolveProblem(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  const [problem] = ctx.sql.all<ProblemRow>('SELECT * FROM media_problems WHERE id = ?', typeof input.id === 'string' ? input.id : '');
  if (!problem) return failure('not_found');
  if (problem.resolved_at) return failure('conflict');
  ctx.sql.run('UPDATE media_problems SET resolved_at = ?, resolved_by = ? WHERE id = ?', nowIso(ctx), actor.id, problem.id);
  notify(ctx, { type: 'problem_resolved', data: { problemId: problem.id, title: problem.title }, subjectId: problem.member_id, actorId: actor.id });
  return { ok: true, value: null, changed: ['problems', 'notifications'] };
}
