const CACHE_NAME = "1000cc-static-v10-20260805";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=10",
  "./theme-folio.css?v=10",
  "./app.js?v=10",
  "./data.js",
  "./character-meta.js",
  "./character-content.js",
  "./manifest.webmanifest?v=10",
  "./icon.svg",
  "./assets/learning-seasons-atlas.webp",
  "./assets/memory-atlas-01.webp",
  "./assets/memory-atlas-02.webp",
  "./assets/memory-atlas-03.webp",
  "./assets/memory-atlas-04.webp",
  "./assets/memory-atlas-05.webp",
  "./assets/memory-atlas-06.webp",
  "./assets/memory-atlas-07.webp",
  "./assets/memory-atlas-08.webp",
  "./assets/memory-atlas-09.webp",
  "./assets/memory-atlas-10.webp",
  "./assets/memory-atlas-11.webp",
  "./assets/memory-atlas-12.webp",
  "./assets/memory-atlas-13.webp",
  "./assets/memory-atlas-14.webp",
  "./assets/memory-atlas-15.webp",
  "./assets/memory-atlas-16.webp",
  "./js/data-model.js",
  "./js/course-engine.js?v=10",
  "./js/grid-engine.js?v=10",
  "./js/lesson-content.js",
  "./js/progress-engine.js",
  "./js/review-scheduler.js",
  "./js/render.js",
  "./js/state.js",
  "./js/storage.js?v=10",
  "./js/tts-manager.js",
  "./js/utils.js",
  "./js/voice-utils.js",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.startsWith("1000cc-static-") && key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put("./index.html", copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match("./index.html");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      const network = fetch(request)
        .then(function (response) {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return cached;
        });
      return cached || network;
    }),
  );
});
