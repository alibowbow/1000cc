const CACHE_NAME = "1000cc-static-v43-20260810";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=25",
  "./theme-folio.css?v=27",
  "./passage-folio-v25.css?v=26",
  "./compact-sunji-v26.css?v=31",
  "./styles/recognition-game.css?v=6",
  "./app.js?v=41",
  "./data.js",
  "./character-meta.js",
  "./character-content.js",
  "./manifest.webmanifest?v=25",
  "./icon.svg",
  "./assets/learning-seasons-atlas.webp",
  "./assets/joseon-folio-spread.webp",
  "./assets/cheonjamun-title.woff",
  "./assets/cheonjamun-hanja.woff",
  "./assets/joseon-folio-single.webp",
  "./assets/sunji-fiber-tile.webp",
  "./assets/study-canvas-atmosphere.webp",
  "./assets/hanji-ivory-tile.webp",
  "./assets/hanji-gray-tile.webp",
  "./assets/hanji-charcoal-tile.webp",
  "./assets/ink-wash-tile.webp",
  "./assets/ui-listen.webp",
  "./assets/ui-shuffle.webp",
  "./assets/ui-share.webp",
  "./assets/ui-settings.webp",
  "./assets/ui-single.webp",
  "./assets/ui-eight.webp",
  "./assets/ui-quiz.webp",
  "./assets/ui-seal.webp",
  "./assets/ui-bookmark.webp",
  "./assets/ui-bamboo.webp",
  "./assets/ui-mountains.webp",
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
  "./js/data-model.js?v=35",
  "./js/character-word-supplements.js?v=34",
  "./js/course-engine.js?v=25",
  "./js/matching-engine.js?v=24",
  "./js/adaptive-selector.js?v=1",
  "./js/confusion-engine.js?v=1",
  "./js/distractor-engine.js?v=1",
  "./js/recognition-engine.js?v=2",
  "./js/recognition-prompts.js?v=1",
  "./js/recognition-renderer.js?v=1",
  "./js/recognition-score.js?v=1",
  "./js/couplet-order-engine.js?v=2",
  "./js/sound-effects.js?v=3",
  "./js/lesson-content.js?v=35",
  "./js/progress-engine.js",
  "./js/progress-engine.js?v=1",
  "./js/review-scheduler.js",
  "./js/overview-layout.js?v=28",
  "./js/render.js?v=29",
  "./js/state.js",
  "./js/storage.js?v=28",
  "./js/tts-manager.js?v=27",
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

  // 서로 다른 배포의 모듈이 섞이면 화면 코드와 데이터 모양이 어긋날 수 있다.
  // 스크립트는 온라인에서 최신 응답을 우선하고, 오프라인일 때만 캐시로 대체한다.
  if (request.destination === "script") {
    event.respondWith(
      fetch(request)
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
          return caches.match(request);
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
