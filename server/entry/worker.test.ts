// The test config has no Workers types (they live in tsconfig.server.json), so worker.ts is imported by a
// variable path to keep it out of this type-check.
// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));

const workerPath = './worker';
const { Cron, default: worker, runCron } = await import(/* @vite-ignore */ workerPath);

function fakeEnv() {
  const tick = vi.fn(async () => {});
  const env = { GROUP: { idFromName: () => 'id', get: () => ({ tick }) } };
  return { env: env, tick };
}

describe('cron', () => {
  it('runCron ticks the group', async () => {
    const { env, tick } = fakeEnv();
    await runCron(env, {});
    expect(tick).toHaveBeenCalledOnce();
  });

  it('scheduled() does the same as runCron', async () => {
    const { env, tick } = fakeEnv();
    await worker.scheduled!({}, env, {});
    expect(tick).toHaveBeenCalledOnce();
  });

  it('Cron.tick does the same as runCron', async () => {
    const { env, tick } = fakeEnv();
    await new Cron({}, env).tick();
    expect(tick).toHaveBeenCalledOnce();
  });
});
