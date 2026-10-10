/* Static-shell only. NEVER cache participant data, tickets, API responses,
   payment details, admin pages or check-in actions. No offline check-in.

   গুরুত্বপূর্ণ (R15): লোগো/ব্যানারের মতো ছবি আর precache করা হয় না।
   সবসময় আগে নেটওয়ার্ক থেকে আনা হয় — তাই লোগো বদলালে রিফ্রেশেই নতুনটা
   দেখা যায়; নেট না থাকলে কেবল তখনই পুরোনো কপি ব্যবহার হয়।
   ক্যাশের নাম বদলালে পুরোনো ক্যাশ নিজে থেকেই মুছে যায়। */
const CACHE = "r96-static-v4"; // R26: পুশ নোটিফিকেশন
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

/* ── R26: পুশ নোটিফিকেশন — নতুন নিবন্ধনের খবর ─────────────────────
   অ্যাপ/ব্রাউজার বন্ধ থাকলেও নোটিফিকেশন দেখায়; চাপলে অ্যাডমিন প্যানেল খোলে। */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "🎟️ নতুন নিবন্ধন";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "অ্যাডমিন প্যানেলে বিস্তারিত দেখুন।",
      icon: "/assets/icon-192.png",
      badge: "/assets/icon-192.png",
      tag: data.tag || "r96-registration",
      data: { url: data.url || "/admin" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list)
        if (new URL(c.url).pathname.startsWith("/admin") && "focus" in c)
          return c.focus();
      return clients.openWindow(url);
    }),
  );
});
