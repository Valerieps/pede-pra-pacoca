import { describe, expect, it } from 'vitest';
import type { PushJob } from '../application/notifications';
import { base64Url, fromBase64Url } from './crypto';
import { encryptPayload, pushSender, sendAll, vapidJwt, importVapidPrivateKey, type VapidKeys } from './web-push';

const enc = new TextEncoder();

/** A browser's side: its key pair and auth secret, as PushSubscription.getKey gives them. */
async function browser() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const p256dh = base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey)));
  const auth = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  return { keys, p256dh, auth };
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: string | Uint8Array<ArrayBuffer>, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const infoBytes = typeof info === 'string' ? enc.encode(info) : info;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes }, key, bytes * 8));
}

/** Decrypts as the browser does (RFC 8291), written apart from the sender on purpose. */
async function decrypt(body: Uint8Array<ArrayBuffer>, receiver: Awaited<ReturnType<typeof browser>>): Promise<string> {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idLength = body[20];
  const senderPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  expect(rs).toBe(4096);
  expect(idLength).toBe(65);

  const senderKey = await crypto.subtle.importKey('raw', senderPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, receiver.keys.privateKey, 256));
  const receiverPublic = fromBase64Url(receiver.p256dh);
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...receiverPublic, ...senderPublic]);
  const ikm = await hkdf(fromBase64Url(receiver.auth), shared, info, 32);
  const cek = await hkdf(salt, ikm, 'Content-Encoding: aes128gcm\0', 16);
  const nonce = await hkdf(salt, ikm, 'Content-Encoding: nonce\0', 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const record = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));
  expect(record[record.length - 1]).toBe(2);
  return new TextDecoder().decode(record.slice(0, -1));
}

async function vapidKeys(): Promise<VapidKeys & { verifyKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  return { publicKey, privateKey: jwk.d!, subject: 'mailto:cesar@example.com', verifyKey: pair.publicKey };
}

describe('aes128gcm encryption', () => {
  it('produces a body the browser decrypts', async () => {
    const receiver = await browser();
    const message = JSON.stringify({ title: 'Pedido aprovado', body: 'A Paçoca aprovou Duna.' });
    const body = await encryptPayload(enc.encode(message), receiver.p256dh, receiver.auth);
    expect(await decrypt(body, receiver)).toBe(message);
  });

  it('uses a fresh salt and key every time', async () => {
    const receiver = await browser();
    const a = await encryptPayload(enc.encode('x'), receiver.p256dh, receiver.auth);
    const b = await encryptPayload(enc.encode('x'), receiver.p256dh, receiver.auth);
    expect(base64Url(a.slice(0, 86))).not.toBe(base64Url(b.slice(0, 86)));
  });

  it('refuses a payload that does not fit one record', async () => {
    const receiver = await browser();
    await expect(encryptPayload(new Uint8Array(4096), receiver.p256dh, receiver.auth)).rejects.toThrow();
  });
});

describe('VAPID', () => {
  it('signs an ES256 token for the push service origin', async () => {
    const keys = await vapidKeys();
    const jwt = await vapidJwt('https://fcm.googleapis.com', keys.subject, await importVapidPrivateKey(keys), 1_800_000_000);
    const [header, claims, signature] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(header)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims)))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_800_000_000 + 12 * 60 * 60,
      sub: 'mailto:cesar@example.com',
    });
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.verifyKey, fromBase64Url(signature), enc.encode(`${header}.${claims}`));
    expect(valid).toBe(true);
  });
});

describe('pushSender', () => {
  async function setup(statuses: Record<string, number>) {
    const keys = await vapidKeys();
    const receiver = await browser();
    const calls: { url: string; init: RequestInit }[] = [];
    const sender = pushSender(keys, async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: statuses[url] ?? 201 });
    });
    const job = (endpoint: string): PushJob => ({ endpoint, p256dh: receiver.p256dh, auth: receiver.auth, payload: '{"title":"Oi"}' });
    return { keys, receiver, calls, sender, job };
  }

  it('posts the encrypted body with the VAPID header, and reuses the token', async () => {
    const { keys, receiver, calls, sender, job } = await setup({});
    expect(await sender.send(job('https://fcm.googleapis.com/fcm/send/abc'))).toBe('sent');
    expect(await sender.send(job('https://fcm.googleapis.com/fcm/send/def'))).toBe('sent');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers.TTL).toBe('86400');
    expect(headers.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`));
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe(headers.Authorization);
    expect(await decrypt(calls[0].init.body as Uint8Array<ArrayBuffer>, receiver)).toBe('{"title":"Oi"}');
  });

  it('reports the subscriptions that are gone', async () => {
    const gone404 = 'https://web.push.apple.com/a';
    const gone410 = 'https://updates.push.services.mozilla.com/wpush/v2/b';
    const busy = 'https://fcm.googleapis.com/fcm/send/c';
    const { sender, job } = await setup({ [gone404]: 404, [gone410]: 410, [busy]: 429 });
    expect(await sendAll(sender, [job(gone404), job(gone410), job(busy)])).toEqual([gone404, gone410]);
  });

  it('never calls an endpoint outside the push services', async () => {
    const { sender, calls, job } = await setup({});
    expect(await sender.send(job('https://evil.example/push'))).toBe('gone');
    expect(calls).toEqual([]);
  });
});
