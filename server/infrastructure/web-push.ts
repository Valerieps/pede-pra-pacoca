// Web Push with WebCrypto only (ADR-011): the payload is encrypted with aes128gcm (RFC 8188,
// RFC 8291) and the request is signed with VAPID (RFC 8292). No npm package.
import { PUSH_SERVICE_ORIGINS } from '../../network-policy';
import type { PushJob } from '../application/notifications';
import { base64Url, fromBase64Url } from './crypto';

export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url (65 bytes). The app subscribes with it. */
  readonly publicKey: string;
  /** The private scalar d, base64url (32 bytes). */
  readonly privateKey: string;
  /** "mailto:..." or an https URL the push services may use to reach the sender. */
  readonly subject: string;
}

export type PushOutcome = 'sent' | 'gone' | 'failed';

const RECORD_SIZE = 4096;
/** How long a push service keeps a push for an offline phone. */
const TTL_SECONDS = 24 * 60 * 60;
/** VAPID tokens may last up to 24 hours; renew well before. */
const JWT_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();
const utf8 = (text: string) => new Uint8Array(encoder.encode(text));

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

export interface EncryptOptions {
  /** Only tests pass these, to check the result against known values. */
  readonly salt?: Uint8Array<ArrayBuffer>;
  readonly senderKeys?: CryptoKeyPair;
}

/** Encrypts one push message for a subscription's keys, as a single aes128gcm record. */
export async function encryptPayload(plaintext: Uint8Array, p256dh: string, auth: string, options: EncryptOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const receiverPublic = fromBase64Url(p256dh);
  const authSecret = fromBase64Url(auth);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const sender = options.senderKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const senderPublic = new Uint8Array((await crypto.subtle.exportKey('raw', sender.publicKey)) as ArrayBuffer);

  const receiverKey = await crypto.subtle.importKey('raw', receiverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  // The runtime reads `public`; Workers' types spell it `$public` because `public` is reserved.
  const ecdh = { name: 'ECDH', public: receiverKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0];
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, sender.privateKey, 256));

  // RFC 8291 section 3.4: mix the auth secret and both public keys into the key material.
  const keyInfo = concat(utf8('WebPush: info\0'), receiverPublic, senderPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  // One record: the plaintext followed by the last-record delimiter 0x02, no padding.
  const record = concat(plaintext, new Uint8Array([2]));
  if (record.length + 16 > RECORD_SIZE) throw new Error('push payload too large');
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record));

  // Header: salt (16) | record size (4, big-endian) | key id length (1) | key id (sender public key).
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, ciphertext);
}

export async function importVapidPrivateKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = fromBase64Url(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID public key must be an uncompressed P-256 point');
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64Url(pub.slice(1, 33)),
    y: base64Url(pub.slice(33, 65)),
    d: keys.privateKey,
    ext: false,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** A VAPID JWT (ES256) for one push service origin. */
export async function vapidJwt(audience: string, subject: string, key: CryptoKey, nowSeconds: number): Promise<string> {
  const part = (o: object) => base64Url(utf8(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: audience, exp: nowSeconds + JWT_SECONDS, sub: subject })}`;
  // WebCrypto returns the raw r|s signature, which is what JWS ES256 wants.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

export interface PushSender {
  send(job: PushJob): Promise<PushOutcome>;
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** Sends pushes, reusing each push service's VAPID token until it is close to expiring. */
export function pushSender(keys: VapidKeys, fetchFn: Fetch = (input, init) => fetch(input, init), now: () => number = Date.now): PushSender {
  let signingKey: Promise<CryptoKey> | null = null;
  const tokens = new Map<string, { jwt: string; renewAt: number }>();

  async function tokenFor(audience: string): Promise<string> {
    const nowSeconds = Math.floor(now() / 1000);
    const cached = tokens.get(audience);
    if (cached && cached.renewAt > nowSeconds) return cached.jwt;
    signingKey ??= importVapidPrivateKey(keys);
    const jwt = await vapidJwt(audience, keys.subject, await signingKey, nowSeconds);
    tokens.set(audience, { jwt, renewAt: nowSeconds + JWT_SECONDS / 2 });
    return jwt;
  }

  return {
    async send(job) {
      const origin = new URL(job.endpoint).origin;
      // Checked when subscribing too; never call anywhere else (network-policy.ts).
      if (!PUSH_SERVICE_ORIGINS.includes(origin)) return 'gone';
      try {
        const body = await encryptPayload(utf8(job.payload), job.p256dh, job.auth);
        const response = await fetchFn(job.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `vapid t=${await tokenFor(origin)}, k=${keys.publicKey}`,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: String(TTL_SECONDS),
            Urgency: 'normal',
          },
          body,
        });
        if (response.status === 404 || response.status === 410) return 'gone';
        return response.ok ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    },
  };
}

/** Sends a batch and returns the endpoints that no longer exist. */
export async function sendAll(sender: PushSender, jobs: readonly PushJob[]): Promise<string[]> {
  const outcomes = await Promise.all(jobs.map((job) => sender.send(job)));
  return jobs.filter((_, i) => outcomes[i] === 'gone').map((job) => job.endpoint);
}
