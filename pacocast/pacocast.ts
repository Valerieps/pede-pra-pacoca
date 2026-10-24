// The Paçocast: the agent at the attendant's home (docs/spec/jellyseerr.md, ADR-016). Every few
// seconds it asks the Pede what to do, creates the Solicitado requests in the local Jellyseerr,
// looks up the ones the Jellyseerr already has and tells the Pede what it found. Outgoing
// connections only: nothing at home is opened to the internet.
//
// Plain Node (24 or newer runs TypeScript as is), no dependencies. Settings come from the
// environment; see pacocast/README.md.
import { pathToFileURL } from 'node:url';

export type JellyseerrState = 'requested' | 'processing' | 'partially_available' | 'available' | 'failed';

export interface Item {
  readonly id: string;
  readonly mediaType: 'movie' | 'tv';
  readonly tmdbId: number;
}

export interface Work {
  readonly toSend: readonly Item[];
  readonly tracking: readonly Item[];
}

export interface Report {
  readonly requestId: string;
  readonly state: JellyseerrState;
  readonly detail?: string;
}

export interface Config {
  /** The Pede's address (its https origin, no path). */
  readonly pedeUrl: string;
  readonly pacocastToken: string;
  /** The Jellyseerr's address as seen from this container, like http://jellyseerr:5055. */
  readonly jellyseerrUrl: string;
  readonly jellyseerrApiKey: string;
  readonly intervalSeconds: number;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The Pede takes at most this many reports per call (server/application/pacocast.ts). */
const REPORT_BATCH = 50;
const DEFAULT_INTERVAL = 45;
const MIN_INTERVAL = 30;

// Jellyseerr 2.7 (server/constants/media.ts): MediaStatus and MediaRequestStatus.
const MEDIA_PENDING = 2;
const MEDIA_PROCESSING = 3;
const MEDIA_PARTIALLY_AVAILABLE = 4;
const MEDIA_AVAILABLE = 5;
const REQUEST_DECLINED = 3;
const REQUEST_FAILED = 4;

/** The `mediaInfo` of the Jellyseerr's movie and series pages; absent when nobody asked for it. */
export interface MediaInfo {
  readonly status?: number;
  readonly requests?: readonly { readonly status?: number; readonly createdAt?: string }[];
}

/** A configuration error (wrong key, Pede refusing the token): the round stops, nothing is reported. */
export class SetupError extends Error {}

/**
 * The Jellyseerr's media status, in the Pede's words. What is in the server wins; then a refused
 * or failed latest request; then "Requested" and "Processing". Null when there is nothing to say.
 */
export function stateOf(media: MediaInfo | null | undefined): JellyseerrState | null {
  if (!media) return null;
  if (media.status === MEDIA_AVAILABLE) return 'available';
  if (media.status === MEDIA_PARTIALLY_AVAILABLE) return 'partially_available';
  const latest = [...(media.requests ?? [])].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')).at(-1);
  if (latest?.status === REQUEST_DECLINED || latest?.status === REQUEST_FAILED) return 'failed';
  if (media.status === MEDIA_PROCESSING) return 'processing';
  if (media.status === MEDIA_PENDING) return 'requested';
  return null;
}

export function readConfig(env: Record<string, string | undefined>): Config {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new SetupError(`falta a variável ${name}`);
    return value.replace(/\/+$/, '');
  };
  const interval = Number(env.PACOCAST_INTERVAL_SECONDS ?? DEFAULT_INTERVAL);
  return {
    pedeUrl: required('PEDE_URL'),
    pacocastToken: required('PACOCAST_TOKEN'),
    jellyseerrUrl: required('JELLYSEERR_URL'),
    jellyseerrApiKey: required('JELLYSEERR_API_KEY'),
    intervalSeconds: Number.isFinite(interval) ? Math.max(MIN_INTERVAL, interval) : DEFAULT_INTERVAL,
  };
}

async function messageOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? body.message.slice(0, 200) : `HTTP ${response.status}`;
}

export function pacocast(config: Config, http: Fetch = fetch) {
  const pede = (path: string, init: RequestInit = {}) =>
    http(`${config.pedeUrl}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${config.pacocastToken}` } });
  const jellyseerr = (path: string, init: RequestInit = {}) =>
    http(`${config.jellyseerrUrl}/api/v1${path}`, { ...init, headers: { ...init.headers, 'X-Api-Key': config.jellyseerrApiKey } });

  async function work(): Promise<Work> {
    const response = await pede('/api/pacocast/work');
    if (response.status === 401 || response.status === 404) throw new SetupError(`o Pede recusou o token (HTTP ${response.status})`);
    if (!response.ok) throw new Error(`o Pede respondeu HTTP ${response.status}`);
    return ((await response.json()) as { value: Work }).value;
  }

  async function lookUp(item: Item): Promise<JellyseerrState | null> {
    const response = await jellyseerr(`/${item.mediaType}/${item.tmdbId}`);
    if (response.status === 401 || response.status === 403) throw new SetupError('o Jellyseerr recusou a chave de API');
    if (!response.ok) return null;
    return stateOf(((await response.json()) as { mediaInfo?: MediaInfo }).mediaInfo);
  }

  /** Creates the request; a 409 means the Jellyseerr already has it, which is fine too. */
  async function send(item: Item): Promise<Report | null> {
    const body = { mediaType: item.mediaType, mediaId: item.tmdbId, ...(item.mediaType === 'tv' ? { seasons: 'all' } : {}) };
    const response = await jellyseerr('/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (response.status === 401 || response.status === 403) throw new SetupError('o Jellyseerr recusou a chave de API');
    if (response.ok || response.status === 409) {
      const state = await lookUp(item);
      return state ? { requestId: item.id, state } : null;
    }
    // Another refusal is about this media; a server error may pass, so it is tried next round.
    if (response.status >= 400 && response.status < 500) return { requestId: item.id, state: 'failed', detail: await messageOf(response) };
    return null;
  }

  async function report(reports: readonly Report[]): Promise<void> {
    for (let i = 0; i < reports.length; i += REPORT_BATCH) {
      const response = await pede('/api/pacocast/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: reports.slice(i, i + REPORT_BATCH) }),
      });
      if (!response.ok) throw new Error(`o Pede recusou o relatório (HTTP ${response.status})`);
    }
  }

  /** One round: send what is new, look up what is on its way, tell the Pede. */
  async function round(): Promise<{ sent: number; reported: number }> {
    const { toSend, tracking } = await work();
    const reports: Report[] = [];
    let sent = 0;
    for (const item of toSend) {
      const result = await send(item);
      if (result) {
        reports.push(result);
        if (result.state !== 'failed') sent++;
      }
    }
    for (const item of tracking) {
      const state = await lookUp(item);
      if (state) reports.push({ requestId: item.id, state });
    }
    await report(reports);
    return { sent, reported: reports.length };
  }

  return { round };
}

async function main(): Promise<void> {
  const config = readConfig(process.env);
  const agent = pacocast(config);
  let stopping = false;
  let wake: (() => void) | null = null;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  console.log(`Paçocast farejando a cada ${config.intervalSeconds}s: ${config.pedeUrl} → ${config.jellyseerrUrl}`);
  while (!stopping) {
    try {
      const { sent, reported } = await agent.round();
      if (reported > 0) console.log(`${new Date().toISOString()} enviados ${sent}, avisos ao Pede ${reported}`);
    } catch (error) {
      console.error(`${new Date().toISOString()} ${error instanceof SetupError ? 'configuração: ' : ''}${(error as Error).message}`);
    }
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, config.intervalSeconds * 1000);
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
