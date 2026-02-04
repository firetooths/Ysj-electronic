
const CACHE_NAME = 'yasouj-airport-v5'; // Incremented version to force update and cache new font
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  // Fonts
  '/utils/IranSans.ttf',
  // Styles
  'https://cdn.tailwindcss.com/3.4.3',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  // Critical Libraries (from importmap) to ensure offline functionality
  'https://aistudiocdn.com/react-router-dom@^7.9.6',
  'https://aistudiocdn.com/react-dom@^19.2.0',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/@supabase/supabase-js@^2.82.0',
  'https://esm.sh/dexie@^4.3.0',
  'https://esm.sh/jalaali-js@^1.2.8'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. Ignore Non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 2. EXCLUDE Supabase API calls from Service Worker Caching.
  // Let the browser handle these normally so 'offlineHandler.ts' can catch failures properly.
  if (url.hostname.includes('supabase.co')) {
      return;
  }

  // 3. Cache-First Strategy for static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((fetchResponse) => {
          if (!fetchResponse || (fetchResponse.status !== 200 && fetchResponse.type !== 'opaque')) {
            return fetchResponse;
          }

          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
                cache.put(event.request, responseToCache);
            } catch (err) {
                // Ignore cache errors for opaque responses if quota exceeded
            }
          });
          return fetchResponse;
        }).catch(() => {
           // If both cache and network fail, we can't do much for assets.
           // For API calls (which are excluded above), the app handles the error.
        });
    })
  );
});
