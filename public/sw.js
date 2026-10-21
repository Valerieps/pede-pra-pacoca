// Service worker: shows pushes and opens the screen each one points to (docs/spec/notificacoes.md,
// ADR-011). It caches nothing (the app needs the internet anyway) and makes no network calls.
// The page's CSP is a meta tag, so it does not apply here (ADR-002); this file only touches its
// own origin.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** Only paths on the app's own origin; anything else opens the home screen. */
function safePath(url) {
  if (typeof url !== 'string') return '/';
  try {
    const target = new URL(url, self.location.origin);
    return target.origin === self.location.origin ? target.pathname + target.search : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: safePath(data.url) },
  };
  if (typeof data.tag === 'string') options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(typeof data.title === 'string' ? data.title : 'Pede pra Paçoca', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        // The app moves to the screen with its own router, without reloading.
        open.postMessage({ type: 'navigate', path });
        return;
      }
      await self.clients.openWindow(path);
    })(),
  );
});
