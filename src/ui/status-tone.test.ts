import { describe, expect, it } from 'vitest';
import { statusTone } from './status-tone';

describe('statusTone', () => {
  it('gives each step of the lifecycle its own tone', () => {
    expect(statusTone('awaiting_approval')).toBe('waiting');
    expect(statusTone('approved')).toBe('approved');
    expect(statusTone('in_jellyseerr')).toBe('sent');
    expect(statusTone('fulfilled')).toBe('done');
    expect(statusTone('canceled')).toBe('canceled');
  });

  it('shows Recusado and Não foi possível alike, as a failure', () => {
    expect(statusTone('rejected')).toBe('failed');
    expect(statusTone('unavailable')).toBe('failed');
  });
});
