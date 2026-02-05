
const CACHE_NAME = 'yasouj-airport-native-v1'; 
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.tsx',
  './IranSans.ttf',
  'https://cdn.tailwindcss.com/3.4.3',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://esm.sh/react-router-dom@6.22.3?external=react,react-dom',
  'https://esm.sh/react-dom@18.2.0',
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/@supabase/supabase-js@2.39.8',
  'https://esm.sh/dexie@3.2.4',
  'https://esm.sh/jalaali-js@1.2.6'
];

// Install: Cache all static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Precaching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
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

// Fetch: Cache-First for static assets, Network-First for others
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // Skip Supabase API calls (let the app handle offline/online sync)
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Return from cache if found (Instant loading)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Otherwise fetch from network and cache for next time
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
