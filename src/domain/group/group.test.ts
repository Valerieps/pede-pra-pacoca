import { describe, expect, it } from 'vitest';
import { isPlausibleEmail, normalizeEmail } from './email';
import { canAttend, canManageGroup, isAttendant, keepsAnAdmin, normalizeRoles } from './roles';
import { isPhotoChoice, NAME_MAX_LENGTH, normalizeName, photoFor } from './profile';

describe('roles', () => {
  it('admins can do everything attendants can, but are not attendants in the queue sense', () => {
    const admin = { roles: ['admin'] as const };
    expect(canAttend(admin)).toBe(true);
    expect(canManageGroup(admin)).toBe(true);
    expect(isAttendant(admin)).toBe(false);
  });

  it('attendants cannot manage the group', () => {
    expect(canManageGroup({ roles: ['attendant'] })).toBe(false);
    expect(canAttend({ roles: ['attendant'] })).toBe(true);
  });

  it('requesters have no special role', () => {
    expect(canAttend({ roles: [] })).toBe(false);
  });

  it('never leaves the group without an admin', () => {
    expect(keepsAnAdmin(['a'], 'a')).toBe(false);
    expect(keepsAnAdmin(['a', 'b'], 'a')).toBe(true);
  });

  it('drops unknown roles', () => {
    expect(normalizeRoles(['attendant', 'root', 'admin'])).toEqual(['admin', 'attendant']);
  });
});

describe('e-mail', () => {
  it('normalizes case and spaces', () => {
    expect(normalizeEmail('  Carla@Example.COM ')).toBe('carla@example.com');
  });

  it('rejects what is clearly not an e-mail', () => {
    expect(isPlausibleEmail('carla@example.com')).toBe(true);
    expect(isPlausibleEmail('carla')).toBe(false);
    expect(isPlausibleEmail('carla @example.com')).toBe(false);
  });
});

describe('profile', () => {
  it('trims and collapses the name, and refuses empty or too long names', () => {
    expect(normalizeName('  Carla   Souza ')).toBe('Carla Souza');
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('a'.repeat(NAME_MAX_LENGTH))).toHaveLength(NAME_MAX_LENGTH);
    expect(normalizeName('a'.repeat(NAME_MAX_LENGTH + 1))).toBeNull();
  });

  it('shows the Google photo only when the member chose it', () => {
    expect(photoFor('google', 'https://lh3.googleusercontent.com/a')).toBe('https://lh3.googleusercontent.com/a');
    expect(photoFor('none', 'https://lh3.googleusercontent.com/a')).toBeNull();
    expect(isPhotoChoice('google')).toBe(true);
    expect(isPhotoChoice('gravatar')).toBe(false);
  });
});
