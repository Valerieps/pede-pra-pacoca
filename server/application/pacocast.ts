// The Paçocast, the agent at the attendant's home (docs/spec/jellyseerr.md, ADR-016): what it has
// to do, and what it says the Jellyseerr did. The agent is not a member: its changes go through
// the same lifecycle as the attendant's, with the actor `jellyseerr`.
import type { PacocastItem, PacocastReportResult, PacocastWork } from '../../src/application/api-contract';
import { actionFor, isJellyseerrState, type JellyseerrState } from '../../src/domain/request/jellyseerr';
import { transition } from '../../src/domain/request/lifecycle';
import { nowIso, type CommandResult, type Context } from './context';
import { applyEffects, findRequest, openOffer, setStatus, stateOf, type RequestRow } from './requests';

/** The actor recorded in `request_transitions` and `petisco_movements`. */
export const JELLYSEERR_ACTOR = 'jellyseerr';
/** At most this many requests per list and reports per call; the rest come in the next round. */
export const PACOCAST_BATCH = 50;
const MAX_DETAIL = 200;

const items = (rows: readonly RequestRow[]): PacocastItem[] =>
  rows.filter((r) => r.tmdb_id !== null).map((r) => ({ id: r.id, mediaType: r.media_type, tmdbId: r.tmdb_id as number }));

/**
 * Solicitado requests of the TMDB, oldest first, to create in the Jellyseerr, and the ones it
 * already has, to follow. A request being offered to its co-requesters waits, as in the queues.
 */
export function pacocastWork(ctx: Context): PacocastWork {
  const toSend = ctx.sql.all<RequestRow>(
    `SELECT * FROM requests WHERE status = 'approved' AND origin = 'tmdb'
       AND id NOT IN (SELECT request_id FROM inheritance_offers WHERE state = 'pending')
     ORDER BY created_at, id LIMIT ${PACOCAST_BATCH}`,
  );
  const tracking = ctx.sql.all<RequestRow>(
    `SELECT * FROM requests WHERE status IN ('in_jellyseerr', 'partially_available') AND origin = 'tmdb'
     ORDER BY updated_at, id LIMIT ${PACOCAST_BATCH}`,
  );
  return { toSend: items(toSend), tracking: items(tracking) };
}

interface Report {
  readonly requestId: string;
  readonly state: JellyseerrState;
  readonly detail: string | null;
}

function readReports(value: unknown): Report[] | null {
  if (!Array.isArray(value) || value.length > PACOCAST_BATCH) return null;
  const reports: Report[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { requestId, state, detail } = item as Record<string, unknown>;
    if (typeof requestId !== 'string' || !isJellyseerrState(state)) return null;
    if (detail !== undefined && typeof detail !== 'string') return null;
    reports.push({ requestId, state, detail: detail ? detail.slice(0, MAX_DETAIL) : null });
  }
  return reports;
}

/** Applies one report. False when the request is unknown or already where the report says. */
function apply(ctx: Context, row: RequestRow, report: Report): boolean {
  const state = stateOf(ctx, row);
  const action = actionFor(state, report.state);
  if (!action) return false;
  const result = transition(state, action, { kind: 'jellyseerr' });
  if (!result.ok) return false;

  const reason = action.type === 'mark_unavailable' ? { ...action.reason, ...(report.detail ? { text: report.detail } : {}) } : null;
  if (reason) ctx.sql.run('UPDATE requests SET reason_code = ?, reason_text = ? WHERE id = ?', reason.code, reason.text ?? null, row.id);
  if (report.state === 'available' && row.media_key) {
    ctx.sql.run('INSERT OR IGNORE INTO known_media (media_key, at) VALUES (?, ?)', row.media_key, nowIso(ctx));
  }
  setStatus(ctx, row.id, row.status, result.next.status, JELLYSEERR_ACTOR, undefined, reason ? { reason } : {});
  applyEffects(ctx, { id: row.id, requesterId: row.requester_id, title: row.title }, result.effects, JELLYSEERR_ACTOR, { reason });
  return true;
}

/**
 * What the Jellyseerr did with each request. Reports that change nothing (the same state twice, a
 * request closed by hand meanwhile) are skipped, so the agent may repeat itself safely.
 */
export function pacocastReport(ctx: Context, input: { reports?: unknown }): CommandResult<PacocastReportResult> {
  const reports = readReports(input.reports);
  if (!reports) return { ok: false, error: 'invalid' };
  let applied = 0;
  for (const report of reports) {
    const row = findRequest(ctx, report.requestId);
    if (row && !(row.status === 'approved' && openOffer(ctx, row.id)) && apply(ctx, row, report)) applied++;
  }
  return { ok: true, value: { applied }, changed: applied > 0 ? ['requests', 'feed', 'me', 'petiscos', 'notifications'] : [] };
}
