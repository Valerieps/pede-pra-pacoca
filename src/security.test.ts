import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_ORIGINS, LOCAL_ONLY } from '../network-policy.ts';
import { CONTENT_SECURITY_POLICY } from '../vite.config';

/**
 * Guards for docs/SEGURANCA.md, run by `npm test` and therefore by every build.
 * Scans the app source (not tests) for APIs that would break the rules.
 */

const SOURCE_ROOT = join(__dirname);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const NETWORK: [string, RegExp][] = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\b/],
];

const HTML_INJECTION: [string, RegExp][] = [
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['innerHTML', /\.(inner|outer)HTML\s*=/],
  ['insertAdjacentHTML', /insertAdjacentHTML/],
  ['eval', /\beval\s*\(|new Function\s*\(/],
];

const EXTERNAL_URL = /https?:\/\/(?!www\.w3\.org\/)[a-z0-9.-]+\.[a-z]+/gi;

const files = sourceFiles(SOURCE_ROOT);
const read = (file: string) => readFileSync(file, 'utf8');
const rel = (file: string) => relative(SOURCE_ROOT, file).split(sep).join('/');
// With a network policy, requests are allowed only in the infrastructure layer.
const mayUseNetwork = (file: string) => !LOCAL_ONLY && rel(file).startsWith('infrastructure/');

describe('security rules', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(HTML_INJECTION)('app source never uses %s', (_name, pattern) => {
    expect(files.filter((file) => pattern.test(read(file))).map(rel)).toEqual([]);
  });

  it.each(NETWORK)('only the allowed places use %s', (_name, pattern) => {
    expect(files.filter((file) => !mayUseNetwork(file) && pattern.test(read(file))).map(rel)).toEqual([]);
  });

  it('every URL in the source points to an allowed origin', () => {
    const offenders = files.flatMap((file) =>
      (read(file).match(EXTERNAL_URL) ?? [])
        .filter((url) => !ALLOWED_ORIGINS.some((origin) => url.startsWith(origin)))
        .map((url) => `${rel(file)}: ${url}`),
    );
    expect(offenders).toEqual([]);
  });

  it('the production CSP opens connections only to the allowed origins', () => {
    const connect = CONTENT_SECURITY_POLICY.split('; ').find((rule) => rule.startsWith('connect-src'));
    expect(connect).toBe(LOCAL_ONLY ? "connect-src 'none'" : `connect-src ${ALLOWED_ORIGINS.join(' ')}`);
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it('allowed origins are bare https origins', () => {
    for (const origin of ALLOWED_ORIGINS) expect(origin).toMatch(/^https:\/\/[a-z0-9.-]+(:\d+)?$/);
  });
});
