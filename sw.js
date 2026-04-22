/* Time Warp — service worker.
 * App-shell cache + notification click handling. Kept intentionally small.
 */

const VERSION = 'tw-v15';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'orb.jsx',
  'screens-1.jsx',
  'screens-2.jsx',
  'screens-3.jsx',
  'capture-variants.jsx',
  'profile.js',
  'api.js',
  'notifications.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-maskable.svg',
  // CDN libs — cached on first successful run, fine to fall through to network.
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Ignore individual failures; the shell must cache best-effort.
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Network-first for Worker API and R2 data — never cache, always fresh.
  // Matches workers.dev, r2.dev, and any custom api./data. subdomains.
  const h = url.hostname;
  const isLive = h.includes('workers.dev') || h.includes('r2.dev')
              || h.startsWith('api.') || h.startsWith('data.');
  if (isLive) {
    e.respondWith((async () => {
      try { return await fetch(request); }
      catch (err) {
        const c = await caches.match(request);
        return c || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Cache-first for the app shell; update in the background.
  e.respondWith((async () => {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then((res) => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        const clone = res.clone();
        caches.open(VERSION).then((c) => c.put(request, clone)).catch(() => {});
      }
      return res;
    }).catch(() => cached || new Response('', { status: 503 }));
    return cached || fetchPromise;
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const route = (e.notification.data && e.notification.data.route) || 'capture';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await c.focus(); c.postMessage({ type: 'tw:route', route }); return; }
    }
    await self.clients.openWindow('./#' + route);
  })());
});

// Web Push — the Worker sends a payloadless push at scheduled times.
// All pushes look identical; the user just sees "How long did the last
// hour take?" and tapping it routes to the capture screen.
self.addEventListener('push', (e) => {
  let title = 'Time Warp';
  let body = 'How long did the last hour take?';
  // If the server ever adds a payload, honor it; otherwise use the defaults.
  if (e.data) {
    try {
      const p = e.data.json();
      if (p.title) title = p.title;
      if (p.body) body = p.body;
    } catch (_) { /* non-JSON payload — ignore */ }
  }
  e.waitUntil(self.registration.showNotification(title, {
    tag: 'tw-push',
    body,
    icon: 'icons/icon.svg',
    badge: 'icons/icon.svg',
    data: { route: 'capture' },
  }));
});

// If the push service rotates the user's subscription (rare but
// spec-required to handle), grab the new one and re-POST to the Worker
// so we keep pinging the same device. The client owns anon_id, so we
// ask the page to re-subscribe next time it's open.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    all.forEach((c) => c.postMessage({ type: 'tw:push-resubscribe' }));
  })());
});
