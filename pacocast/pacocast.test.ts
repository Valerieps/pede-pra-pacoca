import { describe, expect, it } from 'vitest';
import { pacocast, readConfig, SetupError, stateOf, type Config } from './pacocast';

const config: Config = {
  pedeUrl: 'https://pede.test',
  pacocastToken: 'token',
  jellyseerrUrl: 'http://jellyseerr:5055',
  jellyseerrApiKey: 'key',
  intervalSeconds: 45,
};

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** A fake network: each route answers with a status and a JSON body; every call is recorded. */
function fakeHttp(routes: Record<string, [number, unknown]>) {
  const calls: Call[] = [];
  const http = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : null });
    const [status, body] = routes[`${method} ${url}`] ?? [404, { message: 'not found' }];
    return new Response(JSON.stringify(body), { status });
  };
  return { http, calls };
}

const reportsSent = (calls: readonly Call[]) => calls.filter((c) => c.url.endsWith('/api/pacocast/report')).flatMap((c) => (c.body as { reports: unknown[] }).reports);

describe('stateOf', () => {
  it('maps the Jellyseerr statuses to the Pede', () => {
    expect(stateOf({ status: 2 })).toBe('requested');
    expect(stateOf({ status: 3 })).toBe('processing');
    expect(stateOf({ status: 4 })).toBe('partially_available');
    expect(stateOf({ status: 5 })).toBe('available');
    expect(stateOf({ status: 1 })).toBeNull();
    expect(stateOf(undefined)).toBeNull();
  });

  it('a declined or failed latest request is a failure, unless the media is already there', () => {
    expect(stateOf({ status: 3, requests: [{ status: 2, createdAt: '2026-01-01' }, { status: 4, createdAt: '2026-02-01' }] })).toBe('failed');
    expect(stateOf({ status: 1, requests: [{ status: 3 }] })).toBe('failed');
    expect(stateOf({ status: 3, requests: [{ status: 4, createdAt: '2026-01-01' }, { status: 2, createdAt: '2026-02-01' }] })).toBe('processing');
    expect(stateOf({ status: 5, requests: [{ status: 4 }] })).toBe('available');
  });
});

describe('readConfig', () => {
  it('needs the four addresses and keys, trims trailing slashes, keeps 30 s at least', () => {
    const env = { PEDE_URL: 'https://pede.test/', PACOCAST_TOKEN: 't', JELLYSEERR_URL: 'http://j:5055', JELLYSEERR_API_KEY: 'k', PACOCAST_INTERVAL_SECONDS: '5' };
    expect(readConfig(env)).toEqual({ ...config, pedeUrl: 'https://pede.test', pacocastToken: 't', jellyseerrUrl: 'http://j:5055', jellyseerrApiKey: 'k', intervalSeconds: 30 });
    expect(() => readConfig({ ...env, JELLYSEERR_API_KEY: '' })).toThrow(SetupError);
  });
});

describe('a round', () => {
  const work = { value: { toSend: [{ id: 'r1', mediaType: 'tv', tmdbId: 95396 }], tracking: [{ id: 'r2', mediaType: 'movie', tmdbId: 693134 }] } };

  it('creates the new request, looks up both and reports what it found', async () => {
    const { http, calls } = fakeHttp({
      'GET https://pede.test/api/pacocast/work': [200, work],
      'POST http://jellyseerr:5055/api/v1/request': [201, {}],
      'GET http://jellyseerr:5055/api/v1/tv/95396': [200, { mediaInfo: { status: 2 } }],
      'GET http://jellyseerr:5055/api/v1/movie/693134': [200, { mediaInfo: { status: 5 } }],
      'POST https://pede.test/api/pacocast/report': [200, { value: { applied: 2 } }],
    });
    expect(await pacocast(config, http).round()).toEqual({ sent: 1, reported: 2 });

    const create = calls.find((c) => c.url.endsWith('/api/v1/request'));
    expect(create?.body).toEqual({ mediaType: 'tv', mediaId: 95396, seasons: 'all' });
    expect(create?.headers['X-Api-Key']).toBe('key');
    expect(calls[0].headers.Authorization).toBe('Bearer token');
    expect(reportsSent(calls)).toEqual([
      { requestId: 'r1', state: 'requested' },
      { requestId: 'r2', state: 'available' },
    ]);
  });

  it('a request the Jellyseerr already has (409) is only looked up', async () => {
    const { http, calls } = fakeHttp({
      'GET https://pede.test/api/pacocast/work': [200, { value: { toSend: [work.value.toSend[0]], tracking: [] } }],
      'POST http://jellyseerr:5055/api/v1/request': [409, { message: 'Request for this media already exists.' }],
      'GET http://jellyseerr:5055/api/v1/tv/95396': [200, { mediaInfo: { status: 4 } }],
      'POST https://pede.test/api/pacocast/report': [200, { value: { applied: 1 } }],
    });
    await pacocast(config, http).round();
    expect(reportsSent(calls)).toEqual([{ requestId: 'r1', state: 'partially_available' }]);
  });

  it('a refusal about the media is reported as a failure; a server error waits for the next round', async () => {
    const refused = fakeHttp({
      'GET https://pede.test/api/pacocast/work': [200, { value: { toSend: [work.value.toSend[0]], tracking: [] } }],
      'POST http://jellyseerr:5055/api/v1/request': [400, { message: 'No seasons available to request' }],
      'POST https://pede.test/api/pacocast/report': [200, { value: { applied: 1 } }],
    });
    await pacocast(config, refused.http).round();
    expect(reportsSent(refused.calls)).toEqual([{ requestId: 'r1', state: 'failed', detail: 'No seasons available to request' }]);

    const down = fakeHttp({
      'GET https://pede.test/api/pacocast/work': [200, { value: { toSend: [work.value.toSend[0]], tracking: [] } }],
      'POST http://jellyseerr:5055/api/v1/request': [500, {}],
    });
    expect(await pacocast(config, down.http).round()).toEqual({ sent: 0, reported: 0 });
    expect(reportsSent(down.calls)).toEqual([]);
  });

  it('a wrong key or token stops the round without reporting anything', async () => {
    const badKey = fakeHttp({
      'GET https://pede.test/api/pacocast/work': [200, work],
      'POST http://jellyseerr:5055/api/v1/request': [401, {}],
    });
    await expect(pacocast(config, badKey.http).round()).rejects.toThrow(SetupError);
    expect(reportsSent(badKey.calls)).toEqual([]);

    const badToken = fakeHttp({ 'GET https://pede.test/api/pacocast/work': [401, { error: 'unauthenticated' }] });
    await expect(pacocast(config, badToken.http).round()).rejects.toThrow(SetupError);
  });
});
