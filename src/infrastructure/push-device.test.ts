import { describe, expect, it } from 'vitest';
import { offersPushAtFirstAccess } from './push-device';

describe('offersPushAtFirstAccess', () => {
  it('offers while the browser can still ask, and on an iPhone to explain installing', () => {
    expect(offersPushAtFirstAccess('prompt')).toBe(true);
    expect(offersPushAtFirstAccess('needs-install')).toBe(true);
  });

  it('skips what is already answered or impossible', () => {
    expect(offersPushAtFirstAccess('granted')).toBe(false);
    expect(offersPushAtFirstAccess('denied')).toBe(false);
    expect(offersPushAtFirstAccess('unsupported')).toBe(false);
  });
});
