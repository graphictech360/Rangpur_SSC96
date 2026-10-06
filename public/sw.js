/* Static-shell only. NEVER cache participant data, tickets, API responses,
   payment details, admin pages or check-in actions. No offline check-in.

   গুরুত্বপূর্ণ (R15): লোগো/ব্যানারের মতো ছবি আর precache করা হয় না।
   সবসময় আগে নেটওয়ার্ক থেকে আনা হয় — তাই লোগো বদলালে রিফ্রেশেই নতুনটা
   দেখা যায়; নেট না থাকলে কেবল তখনই পুরোনো কপি ব্যবহার হয়।
   ক্যাশের নাম বদলালে পুরোনো ক্যাশ নিজে থেকেই মুছে যায়। */
const CACHE = "r96-static-v2";
/* কিছুই precache করা হয় না — প্রতিটি ছবির সতেজ কপি সবসময় সার্ভারেই থাকে */
const STATIC = [];
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
  // নেটওয়ার্ক আগে, ক্যাশ পরে (offline fallback)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic")
          caches
            .open(CACHE)
            .then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error())),
  );
});
