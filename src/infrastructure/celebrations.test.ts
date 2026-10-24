import { describe, expect, it } from 'vitest';
import { celebratesFulfilled, firstCelebration, MAX_REMEMBERED } from './celebrations';

function storage(initial?: string) {
  const data = new Map<string, string>(initial ? [['celebrated-fulfilled', initial]] : []);
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const viewer = (isRequester: boolean, isCoRequester: boolean) => ({ isRequester, isCoRequester });

describe('celebratesFulfilled', () => {
  it('is for my Cãopleto requests and the ones I also want', () => {
    expect(celebratesFulfilled({ status: 'fulfilled', viewer: viewer(true, false) })).toBe(true);
    expect(celebratesFulfilled({ status: 'fulfilled', viewer: viewer(false, true) })).toBe(true);
  });

  it('is not for other people or other statuses', () => {
    expect(celebratesFulfilled({ status: 'fulfilled', viewer: viewer(false, false) })).toBe(false);
    expect(celebratesFulfilled({ status: 'approved', viewer: viewer(true, false) })).toBe(false);
  });
});

describe('firstCelebration', () => {
  it('plays once per request on this phone', () => {
    const s = storage();
    expect(firstCelebration(s, 'a')).toBe(true);
    expect(firstCelebration(s, 'a')).toBe(false);
    expect(firstCelebration(s, 'b')).toBe(true);
  });

  it('forgets the oldest past the limit', () => {
    const s = storage(JSON.stringify(Array.from({ length: MAX_REMEMBERED }, (_, i) => `r${i}`)));
    expect(firstCelebration(s, 'new')).toBe(true);
    const kept = JSON.parse(s.data.get('celebrated-fulfilled')!) as string[];
    expect(kept).toHaveLength(MAX_REMEMBERED);
    expect(kept).not.toContain('r0');
    expect(firstCelebration(s, 'r0')).toBe(true);
  });

  it('survives garbage and missing storage', () => {
    expect(firstCelebration(storage('{not json'), 'a')).toBe(true);
    expect(firstCelebration(storage('{"x":1}'), 'a')).toBe(true);
    expect(firstCelebration(null, 'a')).toBe(true);
  });
});
