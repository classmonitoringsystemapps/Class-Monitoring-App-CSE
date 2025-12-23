/* ===============================
   Service Worker – Class Monitoring App
   =============================== */

const CACHE_NAME = "class-monitoring-v1";

/* Files to cache (ADD/REMOVE if needed) */
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];

/* ================= INSTALL ================= */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("✅ Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting(); // activate immediately
});

/* ================= ACTIVATE ================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log("🧹 Removing old cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* ================= FETCH ================= */
self.addEventListener("fetch", event => {
  const request = event.request;

  /* Always go to network for Google Apps Script API */
  if (request.url.includes("script.google.com")) {
    return; // do not cache API calls
  }

  event.respondWith(
    caches.match(request).then(response => {
      return (
        response ||
        fetch(request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          /* Offline fallback */
          if (request.destination === "document") {
            return caches.match("./index.html");
          }
        })
      );
    })
  );
});
