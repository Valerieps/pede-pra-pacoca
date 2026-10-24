import { beforeEach, describe, expect, it } from 'vitest';
import type { AttendantAction, FeedEventView, InboxView, MediaView, QueuesView, RequestDetailView, RequestView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';
import type { Sql } from './ports';

const dune: MediaView = {
  type: 'movie',
  tmdbId: 693134,
  title: 'Duna',
  year: 2024,
  posterPath: '/dune.jpg',
  releaseDate: '2024-02-27',
  genres: [],
};

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

function create(session: string, media: Partial<MediaView> = {}): RequestView {
  const full = { ...dune, ...media };
  const result = service.command(session, 'request.create', { origin: 'tmdb', type: full.type, tmdbId: full.tmdbId }, { media: full });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestView;
}

function createManual(session: string, title: string): RequestView {
  const result = service.command(session, 'request.create', { origin: 'manual', type: 'movie', title });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestView;
}

function act(session: string, ids: string[], action: AttendantAction | Record<string, unknown>) {
  return service.command(session, 'request.act', { ids, action });
}

function queues(session = 's-cesar'): QueuesView {
  const result = service.query(session, 'queues', {});
  if (!result.ok) throw new Error(result.error);
  return result.value as QueuesView;
}

function detail(id: string): RequestDetailView {
  const result = service.query('s-cesar', 'request.detail', { id });
  if (!result.ok) throw new Error(result.error);
  return result.value as RequestDetailView;
}

function inbox(session: string): InboxView {
  const result = service.query(session, 'notifications.inbox', {});
  if (!result.ok) throw new Error(result.error);
  return result.value as InboxView;
}

const types = (session: string) => inbox(session).items.map((i) => i.type);
const titles = (requests: readonly RequestView[]) => requests.map((r) => r.title);

function spendAll(session: string) {
  for (const tmdbId of [1, 2, 3]) create(session, { tmdbId, title: `Filler ${tmdbId}` });
}

// 15:00Z is noon in São Paulo, outside the default quiet hours.
beforeEach(() => {
  clock = fixedClock('2026-10-21T15:00:00Z');
  sql = memorySql();
  service = new GroupService(sql, clock, sequentialIds());
  service.migrate();
  signIn('cesar');
  service.command('s-cesar', 'member.setRoles', { memberId: idOf('s-cesar'), roles: ['admin', 'attendant'] });
  signIn('ana');
  signIn('bia');
  signIn('caio');
  signIn('dani');
  service.command('s-cesar', 'member.setRoles', { memberId: idOf('s-dani'), roles: ['attendant'] });
});

describe('the queues', () => {
  it('only attendants and admins see them', () => {
    expect(service.query('s-ana', 'queues', {})).toEqual({ ok: false, error: 'forbidden' });
    expect(service.query('s-dani', 'queues', {}).ok).toBe(true);
  });

  it('hold each active request in its queue, oldest first', () => {
    spendAll('s-bia');
    const pending = create('s-bia', { title: 'Sem petisco' });
    const manual = createManual('s-ana', 'Filme raro');
    const sent = create('s-ana', { tmdbId: 7, title: 'Enviado' });
    act('s-cesar', [sent.id], { type: 'mark_sent' });
    const view = queues();
    expect(titles(view.awaiting)).toEqual(['Sem petisco']);
    expect(titles(view.toSend)).toEqual(['Filler 1', 'Filler 2', 'Filler 3']);
    expect(titles(view.inJellyseerr)).toEqual(['Enviado']);
    expect(titles(view.manual)).toEqual(['Filme raro']);
    expect(view.jellyseerrBaseUrl).toBeNull();
    // Closed requests leave the queues.
    act('s-cesar', [pending.id], { type: 'reject', reason: { code: 'not_found' } });
    act('s-cesar', [manual.id], { type: 'mark_fulfilled' });
    expect(queues().awaiting).toEqual([]);
    expect(queues().manual).toEqual([]);
  });

  it('give the Jellyseerr base URL when the admin set it', () => {
    sql.run("INSERT INTO config (key, value) VALUES ('jellyseerrBaseUrl', '\"https://jelly.example\"')");
    expect(queues().jellyseerrBaseUrl).toBe('https://jelly.example');
  });

  it('leave out a request offered to its co-requesters, which cannot be moved meanwhile', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    service.command('s-ana', 'request.cancel', { id: request.id });
    expect(queues().toSend).toEqual([]);
    expect(act('s-cesar', [request.id], { type: 'mark_sent' })).toMatchObject({ ok: true, value: { applied: [], skipped: [request.id] }, changed: [] });
    service.command('s-bia', 'request.answerOffer', { id: request.id, accept: true });
    expect(titles(queues().toSend)).toEqual(['Duna']);
  });
});

describe('Eu pego esse', () => {
  it('takes the request, also from another attendant, and keeps who did it', () => {
    const request = create('s-ana');
    expect(act('s-dani', [request.id], { type: 'assign' })).toMatchObject({ ok: true, value: { applied: [request.id] } });
    expect(queues().toSend[0].assignee).toMatchObject({ name: 'dani' });
    // Taking it again changes nothing.
    expect(act('s-dani', [request.id], { type: 'assign' })).toMatchObject({ value: { skipped: [request.id] } });
    act('s-cesar', [request.id], { type: 'assign' });
    expect(queues().toSend[0].assignee).toMatchObject({ name: 'cesar' });
    expect(detail(request.id).transitions.slice(1)).toMatchObject([
      { from: 'approved', to: 'approved', event: 'assigned', actor: { name: 'dani' } },
      { event: 'assigned', actor: { name: 'cesar' } },
    ]);
  });

  it('is for attendants only', () => {
    const request = create('s-ana');
    expect(act('s-bia', [request.id], { type: 'assign' })).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('approving and refusing', () => {
  let request: RequestView;
  beforeEach(() => {
    spendAll('s-ana');
    request = create('s-ana', { title: 'Pendente' });
    service.command('s-bia', 'request.join', { id: request.id });
  });

  it('the attendants hear about a request waiting for approval at once', () => {
    expect(types('s-cesar')).toContain('request_pending');
    expect(types('s-dani')).toContain('request_pending');
  });

  it('approving consumes no petisco and tells the requester', () => {
    expect(act('s-cesar', [request.id], { type: 'approve' })).toMatchObject({ ok: true, changed: ['requests', 'feed', 'me', 'petiscos', 'notifications'] });
    expect(detail(request.id).status).toBe('approved');
    expect(petiscos('s-ana')).toBe(0);
    expect(types('s-ana')).toContain('request_approved');
    expect(types('s-bia')).not.toContain('request_approved');
    act('s-cesar', [request.id], { type: 'mark_fulfilled' });
    expect(petiscos('s-ana')).toBe(0);
  });

  it('refusing needs a reason from the list; "outro" needs the text', () => {
    expect(act('s-cesar', [request.id], { type: 'reject' })).toEqual({ ok: false, error: 'invalid' });
    expect(act('s-cesar', [request.id], { type: 'reject', reason: { code: 'other' } })).toEqual({ ok: false, error: 'invalid' });
    expect(act('s-cesar', [request.id], { type: 'reject', reason: { code: 'server_failure' } })).toEqual({ ok: false, error: 'invalid' });
    expect(act('s-cesar', [request.id], { type: 'reject', reason: { code: 'not_found', text: 'x'.repeat(201) } })).toEqual({ ok: false, error: 'invalid' });
  });

  it('refusing closes it with the reason, for the requester and co-requesters', () => {
    act('s-cesar', [request.id], { type: 'reject', reason: { code: 'bad_quality', text: ' só tem câmera ' } });
    const seen = detail(request.id);
    expect(seen).toMatchObject({ status: 'rejected', reason: { code: 'bad_quality', text: 'só tem câmera' } });
    expect(seen.transitions.at(-1)).toMatchObject({ from: 'awaiting_approval', to: 'rejected', actor: { name: 'cesar' } });
    for (const session of ['s-ana', 's-bia']) {
      expect(inbox(session).items.find((i) => i.type === 'request_closed')?.body).toContain('qualidade ruim (só tem câmera)');
    }
  });
});

describe('sending and closing', () => {
  it('Enviado, then Cãopleto: debits the petisco, goes on the feed and tells everyone with the note', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    expect(act('s-cesar', [request.id], { type: 'mark_sent' })).toMatchObject({ value: { applied: [request.id] } });
    expect(detail(request.id).status).toBe('in_jellyseerr');
    act('s-cesar', [request.id], { type: 'mark_fulfilled', note: 'Legendado em PT' });

    expect(detail(request.id)).toMatchObject({ status: 'fulfilled', fulfillmentNote: 'Legendado em PT' });
    expect(petiscos('s-ana')).toBe(2);
    expect(sql.all("SELECT operation FROM petisco_movements WHERE request_id = ? ORDER BY rowid", request.id)).toEqual([{ operation: 'reserve' }, { operation: 'debit' }]);
    const feed = service.query('s-ana', 'feed', {});
    expect(feed.ok && (feed.value as FeedEventView[]).map((e) => e.type)).not.toContain('request_fulfilled');
    for (const session of ['s-ana', 's-bia']) {
      expect(inbox(session).items.find((i) => i.type === 'request_fulfilled')?.body).toContain('Legendado em PT');
    }
  });

  it('Cãopleto is always allowed by hand, straight from Solicitado', () => {
    const request = create('s-ana');
    expect(act('s-cesar', [request.id], { type: 'mark_fulfilled' })).toMatchObject({ value: { applied: [request.id] } });
    expect(detail(request.id).status).toBe('fulfilled');
  });

  it('enough co-requesters give the requester her automatic cashback', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    service.command('s-caio', 'request.join', { id: request.id });
    act('s-cesar', [request.id], { type: 'mark_fulfilled' });
    expect(petiscos('s-ana')).toBe(3);
    expect(types('s-ana')).toContain('petisco_received');
  });

  it('Não foi possível refunds the petisco and tells why', () => {
    const request = create('s-ana');
    expect(act('s-cesar', [request.id], { type: 'mark_unavailable', reason: { code: 'try_later' } })).toMatchObject({ value: { applied: [request.id] } });
    expect(detail(request.id)).toMatchObject({ status: 'unavailable', reason: { code: 'try_later' } });
    expect(petiscos('s-ana')).toBe(3);
    expect(inbox('s-ana').items.find((i) => i.type === 'request_closed')?.body).toContain('tenta mais tarde');
  });

  it('a manual request skips Enviado', () => {
    const request = createManual('s-ana', 'Filme raro');
    expect(act('s-cesar', [request.id], { type: 'mark_sent' })).toMatchObject({ value: { skipped: [request.id] } });
    expect(act('s-cesar', [request.id], { type: 'mark_unavailable', reason: { code: 'other', text: 'sumiu da internet' } })).toMatchObject({
      value: { applied: [request.id] },
    });
  });
});

describe('batches', () => {
  it('apply the same action to each request that allows it and skip the rest', () => {
    spendAll('s-ana');
    const one = create('s-ana', { tmdbId: 10, title: 'Um' });
    const two = create('s-ana', { tmdbId: 11, title: 'Dois' });
    const approved = create('s-bia');
    const result = act('s-cesar', [one.id, two.id, approved.id, 'nope'], { type: 'approve' });
    expect(result).toMatchObject({ ok: true, value: { applied: [one.id, two.id], skipped: [approved.id, 'nope'] } });
    expect(queues().awaiting).toEqual([]);
  });

  it('take 1 to 50 requests', () => {
    expect(act('s-cesar', [], { type: 'approve' })).toEqual({ ok: false, error: 'invalid' });
    expect(act('s-cesar', Array.from({ length: 51 }, (_, i) => `r${i}`), { type: 'approve' })).toEqual({ ok: false, error: 'invalid' });
    expect(act('s-cesar', ['x'], { type: 'cancel' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('request notices', () => {
  it('a new request reaches the attendants who want it at once; the digest holds it for the others', () => {
    service.command('s-dani', 'notifications.setPrefs', { newRequests: 'immediate' });
    create('s-ana');
    expect(types('s-dani')).toEqual(['request_new']);
    expect(types('s-cesar')).toEqual([]);
    expect(sql.all("SELECT type FROM outbox WHERE member_id = ?", idOf('s-cesar'))).toEqual([{ type: 'daily_digest' }]);
  });

  it('an attendant is not told about their own request', () => {
    service.command('s-dani', 'notifications.setPrefs', { newRequests: 'immediate' });
    service.command('s-cesar', 'notifications.setPrefs', { newRequests: 'immediate' });
    create('s-dani');
    expect(types('s-dani')).toEqual([]);
    expect(types('s-cesar')).toEqual(['request_new']);
  });

  it('"Eu também quero" tells the requester', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    expect(inbox('s-ana').items).toMatchObject([{ type: 'co_request', body: expect.stringContaining('bia') }]);
  });

  it('the inheritance offer reaches the co-requester offered it, and the next one when it passes', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    service.command('s-caio', 'request.join', { id: request.id });
    service.command('s-ana', 'request.cancel', { id: request.id });
    expect(types('s-bia')).toEqual(['inheritance_offer']);
    expect(types('s-caio')).toEqual([]);
    service.command('s-bia', 'request.answerOffer', { id: request.id, accept: false });
    expect(types('s-caio')).toEqual(['inheritance_offer']);
  });

  it('an heir without petiscos sends the request back to the attendants for approval', () => {
    const request = create('s-ana');
    service.command('s-bia', 'request.join', { id: request.id });
    spendAll('s-bia');
    service.command('s-ana', 'request.cancel', { id: request.id });
    service.command('s-bia', 'request.answerOffer', { id: request.id, accept: true });
    expect(inbox('s-cesar').items.filter((i) => i.type === 'request_pending')).toMatchObject([{ body: expect.stringContaining('bia') }]);
  });

  it('an attendant on vacation does not hear about requests waiting for approval while another works', () => {
    service.command('s-dani', 'vacation.set', { onVacation: true, until: null });
    service.command('s-cesar', 'member.setRoles', { memberId: idOf('s-caio'), roles: ['attendant'] });
    spendAll('s-ana');
    create('s-ana', { title: 'Pendente' });
    expect(types('s-dani')).toEqual([]);
    expect(types('s-caio')).toEqual(['request_pending']);
  });
});
