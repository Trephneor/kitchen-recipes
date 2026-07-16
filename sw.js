// Service worker: cache the app shell for instant loads and offline use.
// Recipe/API traffic (TheMealDB, Anthropic) always goes to the network.

const CACHE = "kitchen-recipes-v3";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./icon.svg",
  "./manifest.webmanifest",
  "./fonts/fraunces-var.woff2",
  "./fonts/fraunces-var-italic.woff2",
  "./js/app.js",
  "./js/ui.js",
  "./js/foodicons.js",
  "./js/store.js",
  "./js/units.js",
  "./js/nutrition.js",
  "./js/graph.js",
  "./js/mealdb.js",
  "./js/claude.js",
  "./js/voice.js",
  "./js/charts.js",
  "./js/views/recipes.js",
  "./js/views/recipe.js",
  "./js/views/diary.js",
  "./js/views/dashboard.js",
  "./js/views/settings.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return; // APIs go to network
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      }),
    ),
  );
});
