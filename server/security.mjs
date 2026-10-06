// ─────────────────────────────────────────────────────────────────────
// নিরাপত্তা স্তর (Security layer)
//   ১) সন্দেহজনক ঘটনার হিসাব (ব্লক করা অনুরোধ, ভুল লগইন, বট) — প্যানেলে দেখা যায়
//   ২) একই ইমেইল+আইপি থেকে বারবার ভুল পাসওয়ার্ড → অস্থায়ী লক
//   ৩) রোবট ঠেকানো: লুকানো ফাঁদ-ঘর (honeypot) + খুব দ্রুত জমা দেওয়া আটকানো
//   ৪) লেখা পরিষ্কার করা (HTML/কন্ট্রোল অক্ষর বাদ)
// ─────────────────────────────────────────────────────────────────────

const MAX_EVENTS = 60;
const events = [];
const counters = {
  blockedOrigin: 0,
  blockedBot: 0,
  loginFailure: 0,
  lockout: 0,
  rateLimited: 0,
  startedAt: Date.now(),
};

const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

/** একটি ঘটনা লিখে রাখি — শুধু মেমোরিতে (সার্ভার থেকে কিছু বাইরে যায় না)। */
export function record(kind, detail = "", req = null) {
  const ip = req ? clientIp(req).slice(0, 4) + "…" : "";
  events.unshift({ kind, detail: String(detail).slice(0, 120), ip, at: Date.now() });
  if (events.length > MAX_EVENTS) events.pop();
  if (kind in counters) counters[kind] += 1;
}

export const eventsSnapshot = () => ({
  counters: { ...counters },
  recent: events.slice(0, 12),
  human: {
    blockedOrigin: `${bn(counters.blockedOrigin)}টি`,
    blockedBot: `${bn(counters.blockedBot)}টি`,
    loginFailure: `${bn(counters.loginFailure)}টি`,
    lockout: `${bn(counters.lockout)}টি`,
    rateLimited: `${bn(counters.rateLimited)}টি`,
  },
});

export function clientIp(req) {
  const fwd = String(req.get?.("x-forwarded-for") || "").split(",")[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || "unknown";
}

// ── ভুল পাসওয়ার্ডের হিসাব: একই ইমেইল+আইপি ৫ বার ভুল হলে ৫ মিনিট লক ──
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const fails = new Map(); // key → { count, first, until }

const lockKey = (req, email) => `${String(email).toLowerCase()}|${clientIp(req)}`;

export function loginLockRemaining(req, email) {
  const row = fails.get(lockKey(req, email));
  if (!row || !row.until) return 0;
  const left = row.until - Date.now();
  if (left <= 0) {
    fails.delete(lockKey(req, email));
    return 0;
  }
  return left;
}

export function noteLoginFailure(req, email) {
  const key = lockKey(req, email);
  const now = Date.now();
  const row = fails.get(key);
  if (!row || now - row.first > FAIL_WINDOW_MS) {
    fails.set(key, { count: 1, first: now, until: 0 });
    return { locked: false, left: MAX_FAILS - 1 };
  }
  row.count += 1;
  if (row.count >= MAX_FAILS) {
    row.until = now + LOCK_MS;
    counters.lockout += 1;
    record("lockout", `বারবার ভুল পাসওয়ার্ড: ${String(email).slice(0, 40)}`, req);
    return { locked: true, left: 0 };
  }
  return { locked: false, left: MAX_FAILS - row.count };
}

export function noteLoginSuccess(req, email) {
  fails.delete(lockKey(req, email));
}

export const lockMessageBn = (ms) =>
  `বারবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। নিরাপত্তার জন্য ${bn(
    Math.max(1, Math.ceil(ms / 60000)),
  )} মিনিট পরে আবার চেষ্টা করুন।`;

// ── রোবট ঠেকানো: লুকানো ঘরে কিছু লেখা থাকলে বা ১.৫ সেকেন্ডের কম সময়ে
//    পুরো ফর্ম ভরে ফেললে তা রোবট — চুপচাপ আটকে দেওয়া হয় ──
const MIN_FILL_MS = 1500;
const MAX_FORM_AGE_MS = 12 * 60 * 60 * 1000; // ১২ ঘণ্টার পুরোনো ফর্মও সন্দেহজনক

export function botGuard(body) {
  const honey = typeof body?._hp === "string" ? body._hp.trim() : "";
  if (honey) return "লুকানো ঘরে লেখা পাওয়া গেছে — অনুরোধটি রোবটের বলে বাতিল হলো।";
  const started = Number(body?._t);
  if (Number.isFinite(started) && started > 0) {
    const age = Date.now() - started;
    if (age >= 0 && age < MIN_FILL_MS)
      return "ফর্মটি একটু আগে-ভাগেই দেখা হচ্ছে — আবার জমা দিন।";
    if (age > MAX_FORM_AGE_MS)
      return "ফর্মটি অনেক পুরোনো হয়ে গেছে। পেজটি নতুন করে খুলে আবার চেষ্টা করুন।";
  }
  return "";
}

// ── লেখা পরিষ্কার: HTML ট্যাগ ও নিয়ন্ত্রণ-অক্ষর বাদ, দৈর্ঘ্য কেটে দেওয়া ──
export function cleanText(value, max = 200) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")            // <script> ধরনের ট্যাগ বাদ
    .replace(/[\u0000-\u001f\u007f]/g, " ") // নিয়ন্ত্রণ-অক্ষর বাদ
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
