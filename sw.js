/**
 * PHEEL OS - Service Worker
 * Provides offline support, caching, and PWA functionality
 */

const CACHE_NAME = 'pheel-os-v1';
const STATIC_ASSETS = [
  '/PheelOs.html',
  '/manifest.json',
  '/sw.js',
  '/offline.html',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/icon-512x512-maskable.png'
];

// External resources to cache (fonts, icons, libraries)
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/intertight/v3/1cXxaUPXBpj2rGoU7C9WiH4kw9su.woff2',
  'https://fonts.gstatic.com/s/inter/v19/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2',
  'https://fonts.gstatic.com/s/notosansthai/v32/htCr2PODF8XCrXgeWOnwTouMsvFk.woff2',
  'https://unpkg.com/lucide@1.43.0/dist/umd/lucide.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy: Network First for API calls, Cache First for static assets
  if (url.pathname.includes('/api/') || url.searchParams.has('format=json')) {
    // Network First for API
    event.respondWith(networkFirst(request));
  } else if (isExternalResource(url)) {
    // Stale While Revalidate for external resources
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Cache First for static assets
    event.respondWith(cacheFirst(request));
  }
});

// Cache First strategy
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/PheelOs.html') || cache.match('/offline.html');
    }
    throw error;
  }
}

// Network First strategy
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline fallback for navigation
    if (request.mode === 'navigate') {
      return cache.match('/PheelOs.html') || cache.match('/offline.html');
    }
    throw error;
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// Check if URL is an external resource we want to cache
function isExternalResource(url) {
  return EXTERNAL_RESOURCES.some(resource => url.href.startsWith(resource)) ||
         url.hostname === 'fonts.googleapis.com' ||
         url.hostname === 'fonts.gstatic.com' ||
         url.hostname === 'unpkg.com';
}

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncAppData());
  }
});

// Sync app data with server (placeholder for future backend)
async function syncAppData() {
  // This would sync IndexedDB data with a backend when online
  console.log('[SW] Background sync triggered');
}

// Push notifications (placeholder for future)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'มีการแจ้งเตือนใหม่จาก PHEEL OS',
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PHEEL OS', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/PheelOs.html')
    );
  } else if (event.action === 'focus') {
    event.waitUntil(
      clients.openWindow('/PheelOs.html?view=focus')
    );
  } else {
    event.waitUntil(
      clients.openWindow('/PheelOs.html')
    );
  }
});

console.log('[SW] PHEEL OS Service Worker loaded');