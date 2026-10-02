const CM_CACHE = 'cm-shell-v28381';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CM_CACHE);
    await Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('cm-shell-') && k !== CM_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CM_CACHE);
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok && (req.mode === 'navigate' || ['style','script','image','font'].includes(req.destination) || url.pathname.endsWith('.webmanifest'))) {
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await cache.match('/');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});


self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data?.text?.() || 'Construction Monitoring update' }; }

  const title = payload.title || 'Construction Monitoring';
  const options = {
    body: payload.body || 'You have a new update.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'cm-background-notification',
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    timestamp: payload.timestamp || Date.now(),
    data: {
      url: payload.url || '/',
      ...(payload.data || {})
    },
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of windows) {
      if ('focus' in client) {
        try {
          if (client.url !== target && 'navigate' in client) await client.navigate(target);
        } catch (_) {}
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
