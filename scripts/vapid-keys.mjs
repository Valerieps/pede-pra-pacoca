// Prints a new VAPID key pair for Web Push (ADR-011). Run once, then store each value with
// `npx wrangler secret put <NAME>` (and in .dev.vars for local runs). Changing the pair later
// invalidates every phone's subscription: the app subscribes again the next time it opens.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const base64Url = (bytes) => Buffer.from(bytes).toString('base64url');
const publicKey = base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
console.log('VAPID_SUBJECT=mailto:<the attendant or admin e-mail>');
