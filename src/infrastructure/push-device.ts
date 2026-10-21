// Web Push in the browser: registers the service worker (public/sw.js) and manages this phone's
// subscription. The subscription goes to the server through the API; nothing here sends it.
import type { PushSubscriptionInput } from '../application/api-contract';
import type { PushDevice, PushState } from '../application/ports';

function base64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  let binary = '';
  for (const b of new Uint8Array(buffer)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function toInput(subscription: PushSubscription): PushSubscriptionInput {
  return { endpoint: subscription.endpoint, p256dh: base64Url(subscription.getKey('p256dh')), auth: base64Url(subscription.getKey('auth')) };
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options.applicationServerKey;
  return current !== null && base64Url(current) === publicKey;
}

export function browserPushDevice(): PushDevice {
  const hasWorker = 'serviceWorker' in navigator;
  const supported = hasWorker && 'PushManager' in window && 'Notification' in window;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  if (hasWorker) navigator.serviceWorker.register('/sw.js').catch(() => undefined);

  async function registration(): Promise<ServiceWorkerRegistration> {
    return navigator.serviceWorker.ready;
  }

  async function subscribeWith(publicKey: string, onlyIfSubscribed: boolean): Promise<PushSubscriptionInput | null> {
    const reg = await registration();
    const existing = await reg.pushManager.getSubscription();
    if (existing && sameKey(existing, publicKey)) return toInput(existing);
    // Turned off on this phone: stay off until the member turns it on again.
    if (!existing && onlyIfSubscribed) return null;
    if (existing) await existing.unsubscribe();
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) });
    return toInput(subscription);
  }

  return {
    isIos,
    state(): PushState {
      if (!supported) return isIos && !standalone ? 'needs-install' : 'unsupported';
      if (Notification.permission === 'default') return 'prompt';
      return Notification.permission;
    },
    async subscribe(publicKey) {
      if (!supported) return null;
      try {
        // First thing in the tap: Safari only asks inside the user's gesture.
        if ((await Notification.requestPermission()) !== 'granted') return null;
        return await subscribeWith(publicKey, false);
      } catch {
        return null;
      }
    },
    async current(publicKey) {
      if (!supported || Notification.permission !== 'granted') return null;
      try {
        return await subscribeWith(publicKey, true);
      } catch {
        return null;
      }
    },
    async isSubscribed() {
      if (!supported || Notification.permission !== 'granted') return false;
      return (await (await registration()).pushManager.getSubscription()) !== null;
    },
    async unsubscribe() {
      if (!supported) return null;
      const subscription = await (await registration()).pushManager.getSubscription();
      if (!subscription) return null;
      await subscription.unsubscribe();
      return subscription.endpoint;
    },
    onNavigate(listener) {
      if (!hasWorker) return () => undefined;
      const handle = (event: MessageEvent) => {
        const data = event.data as { type?: unknown; path?: unknown } | null;
        if (data?.type === 'navigate' && typeof data.path === 'string' && data.path.startsWith('/') && !data.path.startsWith('//')) listener(data.path);
      };
      navigator.serviceWorker.addEventListener('message', handle);
      return () => navigator.serviceWorker.removeEventListener('message', handle);
    },
  };
}

/**
 * Right after the first-access profile, the app offers push (docs/spec/app-e-instalacao.md):
 * when the browser can still ask, or on an iPhone that needs the app installed first. Already
 * answered or impossible: nothing to offer, the member can still go to Avisos later.
 */
export function offersPushAtFirstAccess(state: PushState): boolean {
  return state === 'prompt' || state === 'needs-install';
}
