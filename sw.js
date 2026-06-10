const CACHE_NAME = 'soleverde-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install - cache all assets immediately, don't wait
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean ALL old caches, take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - CACHE FIRST for navigation/HTML, NETWORK FIRST for other requests
// This ensures the app ALWAYS loads offline on iOS Safari
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For same-origin navigation requests (the HTML page) — cache first, then update in background
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Serve from cache immediately if available
        const fetchPromise = fetch(event.request).then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => null);

        // If we have a cached version, serve it instantly (stale-while-revalidate)
        if (cached) {
          // Update cache in background for next time
          fetchPromise;
          return cached;
        }
        // No cache — must wait for network
        return fetchPromise.then(response => {
          return response || new Response('Offline — please connect to the internet and reload.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }

  // For all other requests (manifest, icons, etc.) — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
