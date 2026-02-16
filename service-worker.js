/* Service Worker for PWA Offline Support */

const CACHE_VERSION = "kmap-hamming-v2-0";
const CACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./service-worker.js"
];

/* Install event: cache all assets */
self.addEventListener("install", (event) => {
  console.log("[SW] Install event");
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log("[SW] Caching assets:", CACHE_ASSETS);
      return cache.addAll(CACHE_ASSETS);
    }).catch((err) => {
      console.error("[SW] Install cache error:", err);
    })
  );
  self.skipWaiting();
});

/* Activate event: clean old caches */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate event");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

/* Fetch event: cache-first strategy with network fallback */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log("[SW] Serving from cache:", event.request.url);
        return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          console.log("[SW] Fetch failed, offline:", event.request.url);
          return new Response("Offline - resource not cached", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain" })
          });
        });
    })
  );
});

/* Background sync (optional future enhancement) */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-results") {
    event.waitUntil(
      clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SYNC_RESULTS" }));
      })
    );
  }
});
