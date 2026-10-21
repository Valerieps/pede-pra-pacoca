// Requests (docs/spec/pedidos.md): create, "Eu também quero", cancel with the offer to the
// co-requesters, the note, and the views. The lifecycle rules live in src/domain/request; this
// file reads the state, asks the domain and applies the effects it returns. The attendant's
// queues and status changes are in ./requests-queue.ts, on the helpers exported here.
import type {
  Availability,
  InheritanceOfferView,
  MediaCardView,
  MediaView,
  RequestDetailView,
  RequestTransitionView,
  RequestView,
} from '../../src/application/api-contract';
import { isAttendant } from '../../src/domain/group/roles';
import { MAX_NOTE_LENGTH, MAX_TITLE_LENGTH, mediaKey, normalizeManualLink, type MediaType } from '../../src/domain/media/media';
import { balanceOf, pickLotToReserve, type PetiscoKind } from '../../src/domain/petisco/ledger';
import {
  ACTIVE_STATUSES,
  inheritedStatus,
  initialStatus,
  isActive,
  transition,
  type Effect,
  type NotificationTrigger,
  type Reason,
  type ReasonCode,
  type RequestOrigin,
  type RequestState,
  type RequestStatus,
} from '../../src/domain/request/lifecycle';
import { reasonText } from '../../src/domain/request/reason';
import { addDays } from '../../src/domain/time';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import { feedbackOf } from './feedback';
import { recordFeedEvent, removeFeedEvents } from './feed';
import { memberView, toMember, type Member, type MemberRow } from './members';
import { notify } from './notifications';
import { evaluateAutomaticCashback, monthlyQuotaOf, movementsOf } from './petiscos';
import type { Prefetched } from './tmdb';

export const OFFER_DAYS = 5;
const MY_REQUESTS_LIMIT = 100;
const ACTIVE_SQL = ACTIVE_STATUSES.map((s) => `'${s}'`).join(', ');

type Input = Record<string, unknown>;

export interface RequestRow {
  id: string;
  origin: RequestOrigin;
  media_type: MediaType;
  tmdb_id: number | null;
  media_key: string | null;
  title: string;
  year: number | null;
  poster_path: string | null;
  release_date: string | null;
  genres: string;
  link: string | null;
  note: string | null;
  requester_id: string;
  status: RequestStatus;
  assignee_id: string | null;
  petisco_lot: string | null;
  reason_code: ReasonCode | null;
  reason_text: string | null;
  fulfillment_note: string | null;
  created_at: string;
  updated_at: string;
}

interface OfferRow {
  id: string;
  request_id: string;
  member_id: string;
  expires_at: string;
}

const isMediaType = (value: unknown): value is MediaType => value === 'movie' || value === 'tv';

export function findRequest(ctx: Context, id: unknown): RequestRow | null {
  if (typeof id !== 'string') return null;
  const [row] = ctx.sql.all<RequestRow>('SELECT * FROM requests WHERE id = ?', id);
  return row ?? null;
}

export function coRequesterIds(ctx: Context, requestId: string): string[] {
  return ctx.sql
    .all<{ member_id: string }>('SELECT member_id FROM co_requests WHERE request_id = ? ORDER BY at, member_id', requestId)
    .map((r) => r.member_id);
}

export function stateOf(ctx: Context, row: RequestRow): RequestState {
  return {
    status: row.status,
    origin: row.origin,
    mediaType: row.media_type,
    requesterId: row.requester_id,
    assigneeId: row.assignee_id,
    petiscoLot: row.petisco_lot,
    coRequesterIds: coRequesterIds(ctx, row.id),
  };
}

export function openOffer(ctx: Context, requestId: string): OfferRow | null {
  const [row] = ctx.sql.all<OfferRow>("SELECT * FROM inheritance_offers WHERE request_id = ? AND state = 'pending'", requestId);
  return row ?? null;
}

/** Records a transition; `extra` (reason, note) goes into its detail next to the event. */
export function setStatus(ctx: Context, id: string, from: RequestStatus | null, to: RequestStatus, actorId: string, event?: string, extra: object = {}): void {
  const at = nowIso(ctx);
  ctx.sql.run('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?', to, at, id);
  ctx.sql.run(
    'INSERT INTO request_transitions (request_id, from_status, to_status, actor, detail, at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    from,
    to,
    actorId,
    JSON.stringify(event ? { event, ...extra } : extra),
    at,
  );
}

// ---------------------------------------------------------------------------------------------
// Petiscos and effects

function lotKind(ctx: Context, lot: string): PetiscoKind {
  if (lot.startsWith('monthly:')) return 'monthly';
  const [credit] = ctx.sql.all<{ kind: PetiscoKind }>("SELECT kind FROM petisco_movements WHERE lot = ? AND operation = 'credit'", lot);
  return credit?.kind ?? 'bonus';
}

/** The petisco a member would spend now ("vence primeiro, sai primeiro"); attendants spend none. */
function lotToReserve(ctx: Context, member: Member): string | null {
  if (isAttendant(member)) return null;
  return pickLotToReserve(balanceOf(movementsOf(ctx, member.id), monthlyQuotaOf(ctx, member), ctx.clock.now()))?.lot ?? null;
}

function insertMovement(ctx: Context, m: { memberId: string; kind: PetiscoKind; operation: string; lot: string; requestId: string; actorId: string }) {
  ctx.sql.run(
    'INSERT INTO petisco_movements (id, member_id, kind, operation, lot, request_id, actor, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.ids.next(),
    m.memberId,
    m.kind,
    m.operation,
    m.lot,
    m.requestId,
    m.actorId,
    nowIso(ctx),
  );
}

/** The request an effect applies to. */
export interface EffectTarget {
  readonly id: string;
  readonly requesterId: string;
  readonly title: string;
}

/** What the attendant said with the transition, for the notices. */
export interface EffectDetail {
  readonly reason?: Reason | null;
  readonly note?: string | null;
}

function nameOf(ctx: Context, memberId: string): string {
  const [row] = ctx.sql.all<{ name: string }>('SELECT name FROM members WHERE id = ?', memberId);
  return row?.name ?? '';
}

/** The lifecycle's notification triggers, as notices (docs/spec/notificacoes.md, "Gatilhos"). */
function notifyTrigger(ctx: Context, trigger: NotificationTrigger, request: EffectTarget, actorId: string, detail: EffectDetail): void {
  const people = { actorId, requesterId: request.requesterId, coRequesterIds: coRequesterIds(ctx, request.id) };
  const ref = { requestId: request.id, title: request.title };
  const reason = reasonText(detail.reason ?? { code: 'other' });
  switch (trigger) {
    case 'request_new':
      return notify(ctx, { type: 'request_new', data: { ...ref, requesterName: nameOf(ctx, request.requesterId) }, ...people });
    case 'request_awaiting_approval':
      return notify(ctx, { type: 'request_pending', data: { ...ref, requesterName: nameOf(ctx, request.requesterId) }, ...people });
    case 'request_approved':
      return notify(ctx, { type: 'request_approved', data: ref, ...people });
    case 'request_rejected':
      return notify(ctx, { type: 'request_closed', data: { ...ref, outcome: 'refused', reason }, ...people });
    case 'request_unavailable':
      return notify(ctx, { type: 'request_closed', data: { ...ref, outcome: 'unavailable', reason }, ...people });
    case 'request_fulfilled':
      return notify(ctx, { type: 'request_fulfilled', data: { ...ref, note: detail.note ?? null }, ...people });
    case 'webhook_failure':
      return notify(ctx, { type: 'webhook_failed', data: { detail: `${request.title}: ${reason}` }, actorId });
    case 'inheritance_offer':
      // Sent by offerToNext, which knows who is offered.
      return;
  }
}

/**
 * Applies what the domain returned, inside the command's transaction. A debit or refund goes to
 * whoever reserved the lot for this request, which is not always the current requester. The
 * cashback is evaluated after the debit, which comes first in the effects.
 */
export function applyEffects(ctx: Context, request: EffectTarget, effects: readonly Effect[], actorId: string, detail: EffectDetail = {}): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'petisco': {
        if (effect.operation === 'reserve') {
          insertMovement(ctx, { memberId: request.requesterId, kind: lotKind(ctx, effect.lot), operation: 'reserve', lot: effect.lot, requestId: request.id, actorId });
          break;
        }
        const [reserved] = ctx.sql.all<{ member_id: string; kind: PetiscoKind }>(
          "SELECT member_id, kind FROM petisco_movements WHERE request_id = ? AND lot = ? AND operation = 'reserve' ORDER BY at DESC, id DESC LIMIT 1",
          request.id,
          effect.lot,
        );
        if (reserved) insertMovement(ctx, { memberId: reserved.member_id, kind: reserved.kind, operation: effect.operation, lot: effect.lot, requestId: request.id, actorId });
        break;
      }
      case 'feed':
        recordFeedEvent(ctx, { type: effect.event, actorId: request.requesterId, requestId: request.id });
        break;
      case 'offer_to_co_requesters':
        offerToNext(ctx, request.id);
        break;
      case 'notify':
        notifyTrigger(ctx, effect.trigger, request, actorId, detail);
        break;
      case 'evaluate_cashback':
        evaluateAutomaticCashback(ctx, request.id);
        break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Duplicates

function memberJoined(ctx: Context, requestId: string, memberId: string): boolean {
  return ctx.sql.all('SELECT 1 FROM co_requests WHERE request_id = ? AND member_id = ?', requestId, memberId).length > 0;
}

/** What already exists for a TMDB media (by `media_key`) or a manual link (docs/spec/pedidos.md). */
function availabilityOf(ctx: Context, viewerId: string, target: { mediaKey: string } | { link: string }): Availability {
  const [column, value] = 'mediaKey' in target ? ['media_key', target.mediaKey] : ['link', target.link];
  const origin = 'mediaKey' in target ? 'tmdb' : 'manual';
  const [active] = ctx.sql.all<{ id: string; requester_id: string }>(
    `SELECT id, requester_id FROM requests WHERE ${column} = ? AND origin = ? AND status IN (${ACTIVE_SQL}) ORDER BY created_at LIMIT 1`,
    value,
    origin,
  );
  if (active) {
    return { kind: 'active', requestId: active.id, mine: active.requester_id === viewerId, joined: memberJoined(ctx, active.id, viewerId) };
  }
  const [fulfilled] = ctx.sql.all<{ id: string }>(
    `SELECT id FROM requests WHERE ${column} = ? AND origin = ? AND status = 'fulfilled' ORDER BY updated_at DESC LIMIT 1`,
    value,
    origin,
  );
  if (fulfilled) return { kind: 'fulfilled', requestId: fulfilled.id };
  if ('mediaKey' in target && ctx.sql.all('SELECT 1 FROM known_media WHERE media_key = ?', target.mediaKey).length > 0) {
    return { kind: 'known' };
  }
  return { kind: 'new' };
}

function card(ctx: Context, actor: Member, media: MediaView): MediaCardView {
  return { ...media, availability: availabilityOf(ctx, actor.id, { mediaKey: mediaKey(media.type, media.tmdbId) }) };
}

export function searchMedia(ctx: Context, actor: Member, _input: Input, prefetched: Prefetched): MediaCardView[] | QueryError {
  if (!prefetched.results) return new QueryError('invalid');
  return prefetched.results.map((media) => card(ctx, actor, media));
}

export function previewMedia(ctx: Context, actor: Member, _input: Input, prefetched: Prefetched): MediaCardView | QueryError {
  return prefetched.media ? card(ctx, actor, prefetched.media) : new QueryError('invalid');
}

export function manualAvailability(ctx: Context, actor: Member, input: Input): Availability | QueryError {
  const link = typeof input.link === 'string' ? normalizeManualLink(input.link) : null;
  return link ? availabilityOf(ctx, actor.id, { link }) : new QueryError('invalid');
}

// ---------------------------------------------------------------------------------------------
// Views

function membersById(ctx: Context, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, ReturnType<typeof memberView>>();
  const rows = ctx.sql.all<MemberRow>(`SELECT * FROM members WHERE id IN (${unique.map(() => '?').join(', ')})`, ...unique);
  return new Map(rows.map((r) => [r.id, memberView(toMember(r))]));
}

export function toViews(ctx: Context, rows: readonly RequestRow[]): RequestView[] {
  const co = new Map(rows.map((r) => [r.id, coRequesterIds(ctx, r.id)]));
  const members = membersById(ctx, rows.flatMap((r) => [r.requester_id, ...(r.assignee_id ? [r.assignee_id] : []), ...(co.get(r.id) ?? [])]));
  return rows.map((row) => ({
    id: row.id,
    origin: row.origin,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    releaseDate: row.release_date,
    genres: JSON.parse(row.genres) as string[],
    link: row.link,
    note: row.note,
    status: row.status,
    requester: members.get(row.requester_id)!,
    assignee: row.assignee_id ? (members.get(row.assignee_id) ?? null) : null,
    coRequesters: (co.get(row.id) ?? []).map((id) => members.get(id)!),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reason: row.reason_code ? (row.reason_text ? { code: row.reason_code, text: row.reason_text } : { code: row.reason_code }) : null,
    fulfillmentNote: row.fulfillment_note,
  }));
}

/** The requests I made or joined, newest first. */
export function myRequests(ctx: Context, actor: Member): RequestView[] {
  const rows = ctx.sql.all<RequestRow>(
    `SELECT * FROM requests WHERE requester_id = ? OR id IN (SELECT request_id FROM co_requests WHERE member_id = ?)
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    actor.id,
    actor.id,
    MY_REQUESTS_LIMIT,
  );
  return toViews(ctx, rows);
}

export function requestDetail(ctx: Context, actor: Member, input: Input): RequestDetailView | QueryError {
  const row = findRequest(ctx, input.id);
  if (!row) return new QueryError('not_found');
  const [view] = toViews(ctx, [row]);
  const transitions = ctx.sql.all<{ from_status: RequestStatus | null; to_status: RequestStatus; actor: string; detail: string; at: string }>(
    'SELECT from_status, to_status, actor, detail, at FROM request_transitions WHERE request_id = ? ORDER BY id',
    row.id,
  );
  const offerRow = openOffer(ctx, row.id);
  const people = membersById(ctx, [...transitions.map((t) => t.actor), ...(offerRow ? [offerRow.member_id] : [])]);
  const offer: InheritanceOfferView | null = offerRow ? { member: people.get(offerRow.member_id)!, expiresAt: offerRow.expires_at } : null;

  const isRequester = row.requester_id === actor.id;
  const isCoRequester = view.coRequesters.some((m) => m.id === actor.id);
  const editable = isRequester && !offer && (row.status === 'awaiting_approval' || row.status === 'approved');
  return {
    ...view,
    transitions: transitions.map(
      (t): RequestTransitionView => ({
        from: t.from_status,
        to: t.to_status,
        actor: people.get(t.actor) ?? null,
        event: (JSON.parse(t.detail) as { event?: string }).event ?? null,
        at: t.at,
      }),
    ),
    offer,
    viewer: {
      isRequester,
      isCoRequester,
      canCancel: editable,
      canEditNote: editable,
      canJoin: !isRequester && !isCoRequester && isActive(row.status),
      canLeave: isCoRequester && isActive(row.status),
      hasOffer: offer?.member.id === actor.id,
      canGiveFeedback: row.status === 'fulfilled',
      feedback: feedbackOf(ctx, row.id, actor.id),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Commands

type NoteResult = { ok: true; note: string | null } | { ok: false };

function readNote(value: unknown): NoteResult {
  if (value === undefined || value === null) return { ok: true, note: null };
  if (typeof value !== 'string') return { ok: false };
  const note = value.trim();
  if (note.length > MAX_NOTE_LENGTH) return { ok: false };
  return { ok: true, note: note || null };
}

interface NewRequest {
  origin: RequestOrigin;
  type: MediaType;
  tmdbId: number | null;
  key: string | null;
  title: string;
  year: number | null;
  posterPath: string | null;
  releaseDate: string | null;
  genres: readonly string[];
  link: string | null;
}

function newRequestFrom(input: Input, prefetched: Prefetched): NewRequest | null {
  if (input.origin === 'tmdb') {
    const media = prefetched.media;
    if (!media || media.type !== input.type || media.tmdbId !== input.tmdbId) return null;
    return {
      origin: 'tmdb',
      type: media.type,
      tmdbId: media.tmdbId,
      key: mediaKey(media.type, media.tmdbId),
      title: media.title,
      year: media.year,
      posterPath: media.posterPath,
      releaseDate: media.releaseDate,
      genres: media.genres,
      link: null,
    };
  }
  if (input.origin !== 'manual' || !isMediaType(input.type) || typeof input.title !== 'string') return null;
  const title = input.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) return null;
  let link: string | null = null;
  if (typeof input.link === 'string' && input.link.trim()) {
    link = normalizeManualLink(input.link);
    if (!link) return null;
  } else if (input.link !== undefined && input.link !== null && input.link !== '') {
    return null;
  }
  return { origin: 'manual', type: input.type, tmdbId: null, key: null, title, year: null, posterPath: null, releaseDate: null, genres: [], link };
}

export function createRequest(ctx: Context, actor: Member, input: Input, prefetched: Prefetched): CommandResult<RequestView> {
  const media = newRequestFrom(input, prefetched);
  const note = readNote(input.note);
  if (!media || !note.ok) return failure('invalid');

  // The duplicate check (docs/spec/pedidos.md): an active request takes "Eu também quero";
  // something already on the server needs an explicit "Pedir de novo".
  const target = media.key ? { mediaKey: media.key } : media.link ? { link: media.link } : null;
  const existing = target ? availabilityOf(ctx, actor.id, target) : ({ kind: 'new' } as const);
  if (existing.kind === 'active') return failure('conflict');
  if (existing.kind !== 'new' && input.again !== true) return failure('conflict');

  const lot = lotToReserve(ctx, actor);
  const start = initialStatus({ requesterIsAttendant: isAttendant(actor), reservedLot: lot });
  const id = ctx.ids.next();
  const at = nowIso(ctx);
  ctx.sql.run(
    `INSERT INTO requests (id, origin, media_type, tmdb_id, media_key, title, year, poster_path, release_date, genres, link, note,
       requester_id, status, petisco_lot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    media.origin,
    media.type,
    media.tmdbId,
    media.key,
    media.title,
    media.year,
    media.posterPath,
    media.releaseDate,
    JSON.stringify(media.genres),
    media.link,
    note.note,
    actor.id,
    start.status,
    lot,
    at,
    at,
  );
  ctx.sql.run(
    'INSERT INTO request_transitions (request_id, from_status, to_status, actor, detail, at) VALUES (?, NULL, ?, ?, ?, ?)',
    id,
    start.status,
    actor.id,
    '{}',
    at,
  );
  applyEffects(ctx, { id, requesterId: actor.id, title: media.title }, start.effects, actor.id);
  const [view] = toViews(ctx, [findRequest(ctx, id)!]);
  return { ok: true, value: view, changed: ['requests', 'feed', 'me', 'notifications'] };
}

/** "Eu também quero": on someone else's active request; never spends a petisco. */
export function joinRequest(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  const row = findRequest(ctx, input.id);
  if (!row) return failure('not_found');
  if (row.requester_id === actor.id) return failure('forbidden');
  if (!isActive(row.status) || memberJoined(ctx, row.id, actor.id)) return failure('conflict');
  ctx.sql.run('INSERT INTO co_requests (request_id, member_id, at) VALUES (?, ?, ?)', row.id, actor.id, nowIso(ctx));
  recordFeedEvent(ctx, { type: 'co_request', actorId: actor.id, requestId: row.id });
  notify(ctx, { type: 'co_request', data: { requestId: row.id, title: row.title, memberName: actor.name }, requesterId: row.requester_id, actorId: actor.id });
  return { ok: true, value: null, changed: ['requests', 'feed', 'notifications'] };
}

/** Undo "Eu também quero" while the request is active; an offer made to me passes on. */
export function leaveRequest(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  const row = findRequest(ctx, input.id);
  if (!row) return failure('not_found');
  if (!isActive(row.status) || !memberJoined(ctx, row.id, actor.id)) return failure('conflict');
  ctx.sql.run('DELETE FROM co_requests WHERE request_id = ? AND member_id = ?', row.id, actor.id);
  removeFeedEvents(ctx, row.id, { type: 'co_request', actorId: actor.id });
  const offer = openOffer(ctx, row.id);
  if (offer?.member_id === actor.id) {
    ctx.sql.run("UPDATE inheritance_offers SET state = 'withdrawn' WHERE id = ?", offer.id);
    offerToNext(ctx, row.id);
  }
  return { ok: true, value: null, changed: ['requests', 'feed', 'notifications'] };
}

/** Only the requester, only before No Jellyseerr. With co-requesters, the request is offered on. */
export function cancelRequest(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  const row = findRequest(ctx, input.id);
  if (!row) return failure('not_found');
  if (openOffer(ctx, row.id)) return failure('conflict');
  const result = transition(stateOf(ctx, row), { type: 'cancel' }, { kind: 'member', id: actor.id, canAttend: false });
  if (!result.ok) return failure(result.error === 'forbidden' ? 'forbidden' : 'conflict');
  const offered = result.effects.some((e) => e.type === 'offer_to_co_requesters');
  ctx.sql.run('UPDATE requests SET petisco_lot = ? WHERE id = ?', result.next.petiscoLot, row.id);
  setStatus(ctx, row.id, row.status, result.next.status, actor.id, offered ? 'offered_to_co_requesters' : undefined);
  applyEffects(ctx, { id: row.id, requesterId: row.requester_id, title: row.title }, result.effects, actor.id);
  if (result.next.status === 'canceled') removeFeedEvents(ctx, row.id);
  return { ok: true, value: null, changed: ['requests', 'feed', 'me', 'notifications'] };
}

/**
 * Offers the request to the oldest co-requester not yet asked since the requester cancelled.
 * With nobody left, the request becomes Cancelado for everyone, if it still can.
 */
export function offerToNext(ctx: Context, requestId: string): void {
  const [round] = ctx.sql.all<{ at: string }>(
    "SELECT at FROM request_transitions WHERE request_id = ? AND json_extract(detail, '$.event') = 'offered_to_co_requesters' ORDER BY id DESC LIMIT 1",
    requestId,
  );
  const asked = new Set(
    ctx.sql
      .all<{ member_id: string }>('SELECT member_id FROM inheritance_offers WHERE request_id = ? AND offered_at >= ?', requestId, round?.at ?? '')
      .map((r) => r.member_id),
  );
  const next = coRequesterIds(ctx, requestId).find((id) => !asked.has(id));
  if (next) {
    const now = ctx.clock.now();
    const expiresAt = addDays(now, OFFER_DAYS).toISOString();
    ctx.sql.run(
      "INSERT INTO inheritance_offers (id, request_id, member_id, state, offered_at, expires_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      ctx.ids.next(),
      requestId,
      next,
      now.toISOString(),
      expiresAt,
    );
    const { title } = findRequest(ctx, requestId)!;
    notify(ctx, { type: 'inheritance_offer', data: { requestId, title, expiresAt }, subjectId: next });
    return;
  }
  const row = findRequest(ctx, requestId)!;
  if (row.status === 'awaiting_approval' || row.status === 'approved') {
    setStatus(ctx, row.id, row.status, 'canceled', row.requester_id, 'nobody_inherited');
    removeFeedEvents(ctx, row.id);
  }
}

/** The co-requester offered the request accepts (and becomes the requester) or declines. */
export function answerOffer(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  const row = findRequest(ctx, input.id);
  if (!row) return failure('not_found');
  if (typeof input.accept !== 'boolean') return failure('invalid');
  const offer = openOffer(ctx, row.id);
  if (!offer || offer.member_id !== actor.id) return failure('forbidden');

  if (!input.accept) {
    ctx.sql.run("UPDATE inheritance_offers SET state = 'declined' WHERE id = ?", offer.id);
    offerToNext(ctx, row.id);
    return { ok: true, value: null, changed: ['requests', 'feed', 'notifications'] };
  }

  ctx.sql.run("UPDATE inheritance_offers SET state = 'accepted' WHERE id = ?", offer.id);
  const lot = lotToReserve(ctx, actor);
  const next = inheritedStatus({ status: row.status, heirIsAttendant: isAttendant(actor), reservedLot: lot });
  ctx.sql.run('DELETE FROM co_requests WHERE request_id = ? AND member_id = ?', row.id, actor.id);
  ctx.sql.run('UPDATE requests SET requester_id = ?, petisco_lot = ? WHERE id = ?', actor.id, isAttendant(actor) ? null : lot, row.id);
  setStatus(ctx, row.id, row.status, next.status, actor.id, 'inherited');
  applyEffects(ctx, { id: row.id, requesterId: actor.id, title: row.title }, next.effects, actor.id);
  return { ok: true, value: null, changed: ['requests', 'feed', 'me', 'notifications'] };
}

export function editNote(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  const row = findRequest(ctx, input.id);
  if (!row) return failure('not_found');
  const note = readNote(input.note);
  if (!note.ok) return failure('invalid');
  if (row.requester_id !== actor.id) return failure('forbidden');
  if ((row.status !== 'awaiting_approval' && row.status !== 'approved') || openOffer(ctx, row.id)) return failure('conflict');
  ctx.sql.run('UPDATE requests SET note = ?, updated_at = ? WHERE id = ?', note.note, nowIso(ctx), row.id);
  return { ok: true, value: null, changed: ['requests'] };
}

/** Cron: an offer nobody answered in 5 days passes to the next co-requester. */
export function expireOffers(ctx: Context): boolean {
  const due = ctx.sql.all<OfferRow>("SELECT * FROM inheritance_offers WHERE state = 'pending' AND expires_at <= ?", nowIso(ctx));
  for (const offer of due) {
    ctx.sql.run("UPDATE inheritance_offers SET state = 'expired' WHERE id = ?", offer.id);
    offerToNext(ctx, offer.request_id);
  }
  return due.length > 0;
}
