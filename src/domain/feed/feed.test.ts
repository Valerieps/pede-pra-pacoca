import { describe, expect, it } from 'vitest';
import { toFeedFilter } from './feed';

describe('toFeedFilter', () => {
  it('keeps a known filter and falls back to Tudo', () => {
    expect(toFeedFilter('mine')).toBe('mine');
    expect(toFeedFilter('fulfilled')).toBe('all');
    expect(toFeedFilter('nope')).toBe('all');
    expect(toFeedFilter(undefined)).toBe('all');
  });
});
