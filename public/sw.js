/* Static-shell only. NEVER cache participant data, tickets, API responses,
   payment details, admin pages or check-in actions. No offline check-in. */
const CACHE = "r96-static-v1";
const STATIC = [
  "/assets/ssc96-logo.webp",
  "/assets/friends-forever.webp",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(STATIC))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/assets/")
  )
    return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok)
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, response.clone()));
          return response;
        }),
    ),
  );
});
