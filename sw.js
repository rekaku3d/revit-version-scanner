// Revit Version Scanner - Service Worker (Online-First)
// Strategy: Network-First with cache fallback.
// This ensures the app always serves fresh content from Cloudflare Pages.
// Offline caching is minimal to avoid 500 errors after PWA installation.

const CACHE_NAME = 'revit-scanner-v3';

// Only pre-cache the bare minimum for a functional offline fallback
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/app.js',
  '/cfb.min.js',
  '/icon.svg'
];

// Install: pre-cache core assets but don't block on it
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-cache failed (non-fatal):', err);
        return self.skipWaiting();
      })
  );
});

// Activate: clear old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-First strategy
// Always try the network first. Only fall back to cache if network fails.
// This prevents stale/incorrect cached responses from causing 500 errors.
self.addEventListener('fetch', (e) => {
  // Skip non-GET requests and cross-origin requests
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  
  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If network succeeds, update cache and return response
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cloned));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — try cache as fallback
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // If no cache either, return a minimal offline page for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Network error', { status: 408, statusText: 'Network Error' });
        });
      })
  );
});
