import { describe, expect, it } from 'vitest';
import { clearCookie, readCookie, setCookie } from './cookies';
import { base64Url, constantTimeEqual } from './crypto';
import { authorizationUrl, decodePendingLogin, encodePendingLogin, newPendingLogin, profileFromIdToken } from './google-oauth';

function idToken(claims: object): string {
  const part = (o: object) => base64Url(new TextEncoder().encode(JSON.stringify(o)));
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

const now = new Date('2026-10-21T15:00:00Z');
const good = {
  iss: 'https://accounts.google.com',
  aud: 'client',
  nonce: 'n',
  exp: now.getTime() / 1000 + 60,
  email_verified: true,
  sub: '123',
  email: 'carla@example.com',
  name: 'Carla',
  picture: 'https://lh3.googleusercontent.com/a/x',
};

describe('profileFromIdToken', () => {
  it('reads a valid token', () => {
    expect(profileFromIdToken(idToken(good), 'client', 'n', now)).toEqual({
      sub: '123',
      email: 'carla@example.com',
      name: 'Carla',
      picture: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it.each([
    ['another audience', { aud: 'other' }],
    ['another nonce', { nonce: 'x' }],
    ['an expired token', { exp: now.getTime() / 1000 - 1 }],
    ['an unverified e-mail', { email_verified: false }],
    ['another issuer', { iss: 'https://evil.example' }],
  ])('refuses %s', (_name, change) => {
    expect(profileFromIdToken(idToken({ ...good, ...change }), 'client', 'n', now)).toBeNull();
  });

  it('refuses garbage', () => {
    expect(profileFromIdToken('not-a-token', 'client', 'n', now)).toBeNull();
  });
});

describe('login flow pieces', () => {
  it('round-trips the pending login cookie', () => {
    const p = newPendingLogin();
    expect(decodePendingLogin(encodePendingLogin(p))).toEqual(p);
    expect(decodePendingLogin('a.b')).toBeNull();
    expect(decodePendingLogin(null)).toBeNull();
  });

  it('sends PKCE and the state to Google', async () => {
    const url = new URL(await authorizationUrl('client', 'http://localhost:5173/api/auth/callback', newPendingLogin()));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBeTruthy();
  });
});

describe('cookies', () => {
  it('reads one cookie among many', () => {
    expect(readCookie('a=1; __Host-sessao=abc; b=2', '__Host-sessao')).toBe('abc');
    expect(readCookie('a=1', '__Host-sessao')).toBeNull();
  });

  it('are HttpOnly, Secure and Lax', () => {
    expect(setCookie('__Host-sessao', 'x', 10)).toBe('__Host-sessao=x; Path=/; Max-Age=10; HttpOnly; Secure; SameSite=Lax');
    expect(clearCookie('__Host-sessao')).toContain('Max-Age=0');
  });
});

describe('constantTimeEqual', () => {
  it('compares', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
