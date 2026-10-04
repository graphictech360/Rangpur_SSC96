// ─────────────────────────────────────────────────────────────────
// নতুন নিবন্ধনের খবর সরাসরি আয়োজকের ইমেইলে + মেইল থেকে এক ক্লিকে প্যানেল
//
// কোথায় পাঠাবে (যেকোনো একটি সেট করলেই চলবে):
//   RESEND_API_KEY=re_xxx        → Resend (ফ্রি, সবচেয়ে সহজ)
//   NOTIFY_WEBHOOK_URL=https://… → Google Apps Script / অন্য যেকোনো ওয়েবহুক
// কোনোটাই না থাকলে মেইল পাঠানো হয় না (শুধু লগে লেখা থাকে) —
// নিবন্ধন তখনো স্বাভাবিকভাবে জমা হয়, কিছুই আটকায় না।
//
// এক ক্লিকে লগইন:
//   QUICK_LOGIN_EMAIL / QUICK_LOGIN_PASSWORD সেট থাকলে মেইলের বোতামে চাপ
//   দিলেই সার্ভার নিজে লগইন করে প্যানেল খুলে দেয় (সময়সীমা ৬০ মিনিট)।
//   না থাকলে বোতামটি লগইন পেজ খোলে (ইমেইল আগেই বসানো থাকে)।
// ─────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const QUICK_LOGIN_MINUTES = 60;
const DEFAULT_TO = "graphictech360@gmail.com";
const DEFAULT_FROM = "Rangpur SSC 96 <onboarding@resend.dev>";

export const notifyConfig = () => {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const webhook = (process.env.NOTIFY_WEBHOOK_URL || "").trim();
  const demoMode = process.env.DATA_MODE === "demo";
  const to = (
    process.env.NOTIFY_EMAIL ||
    (demoMode ? "admin@ssc96.demo" : DEFAULT_TO)
  ).trim();
  const from = (process.env.NOTIFY_FROM || DEFAULT_FROM).trim();
  const provider = resendKey ? "resend" : webhook ? "webhook" : "";
  return {
    provider,
    to,
    from,
    resendKey,
    webhook,
    webhookSecret: (process.env.NOTIFY_WEBHOOK_SECRET || "").trim(),
    configured: Boolean(provider),
    quickLogin: Boolean(
      (process.env.QUICK_LOGIN_EMAIL || "").trim() &&
        (process.env.QUICK_LOGIN_PASSWORD || "").trim(),
    ),
  };
};

const siteUrl = () =>
  (process.env.APP_ORIGIN || process.env.SITE_URL || "https://rangpur-ssc96.vercel.app")
    .trim()
    .replace(/\/$/, "");

// ── এক-ক্লিক লগইনের সই-করা টোকেন (৬০ মিনিট) ──────────────────────
const secret = () =>
  process.env.SESSION_SECRET || process.env.VERCEL_SESSION_SECRET || "dev-secret";

export function quickLoginToken(email, minutes = QUICK_LOGIN_MINUTES) {
  const payload = Buffer.from(
    JSON.stringify({
      e: String(email).toLowerCase(),
      x: Date.now() + minutes * 60000,
      n: randomBytes(6).toString("hex"),
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyQuickLoginToken(token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const want = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data?.e || !data?.x || data.x < Date.now()) return null;
  return data;
}

export const quickLoginUrl = (email) =>
  `${siteUrl()}/api/quick-login?t=${encodeURIComponent(quickLoginToken(email))}`;

// ── মেইলের লেখা (বাংলা) ───────────────────────────────────────────
const bn = (n) =>
  String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
const money = (n) => bn(Number(n || 0).toLocaleString("en-IN"));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// অতিরিক্ত ঘরের বাংলা নাম মেইলে পাঠানোর সময়: registration.__fields থাকলে সেটি, নইলে কী-ই দেখানো হয়
const fieldLabel = (key, registration) =>
  (registration?.fields || []).find((f) => f.key === key)?.label || key;

const row = (label, value) =>
  value === "" || value === undefined || value === null
    ? ""
    : `<tr><td style="padding:7px 0;color:#6b7280;font-size:14px">${esc(label)}</td>` +
      `<td style="padding:7px 0;color:#1f2937;font-size:15px;font-weight:600;text-align:right">${esc(value)}</td></tr>`;

export function registrationEmail({ site, registration, registrationId }) {
  const p = registration.participant || {};
  const pay = registration.payment || {};
  const provider = pay.provider === "nagad" ? "নগদ" : "বিকাশ";
  const when = new Date().toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
  const to = notifyConfig().to;
  const subject = `🎟️ নতুন নিবন্ধন: ${p.name} — ৳${bn(Number(registration.total).toLocaleString("en-IN"))} (${provider})`;

  const who =
    bn(1 + Number(registration.spouse || 0) + Number(registration.children || 0)) + " জন";
  const panel = quickLoginUrl(to);
  const loginFallback = `${siteUrl()}/admin?email=${encodeURIComponent(to)}`;

  const html = `<!doctype html><html lang="bn"><body style="margin:0;background:#f6f3ea;padding:24px 12px;font-family:'Noto Sans Bengali',Segoe UI,Roboto,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fffdf7;border:1px solid #e8e0cd;border-radius:18px;overflow:hidden">
    <div style="background:#1f6b3f;padding:20px 24px">
      <div style="color:#fff;font-size:13px;letter-spacing:1.5px;opacity:.9">RANGPUR SSC 96 FESTIVAL</div>
      <div style="color:#fff;font-size:22px;font-weight:700;margin-top:4px">🎟️ নতুন নিবন্ধন এসেছে!</div>
    </div>
    <div style="padding:22px 24px">
      <p style="margin:0 0 16px;color:#374151;font-size:15.5px;line-height:1.7">
        <b>${esc(p.name)}</b> নিবন্ধন করেছেন — মোট <b>৳${money(registration.total)}</b>
        (${esc(provider)}), ${who}।
      </p>

      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee6d4;border-bottom:1px solid #eee6d4;margin-bottom:18px">
        ${row("টিকিট নম্বর", registration.ticketNumber)}
        ${row("স্কুল", p.school)}
        ${row("এসএসসি রোল", p.sscRoll)}
        ${row("মোবাইল", p.mobile)}
        ${row("বর্তমান অবস্থান", p.location)}
        ${row("পরিবার", `${bn(registration.spouse || 0)} জন জীবনসঙ্গী · ${bn(registration.children || 0)} জন শিশু`)}
        ${row("খাবারের পছন্দ", registration.food)}
        ${row("টি-শার্ট", p.tshirt)}
        ${Object.entries(registration.answers || {})
          .filter(([, v]) => String(v ?? "").trim() !== "")
          .map(([k, v]) => row(fieldLabel(k, registration), v))
          .join("")}
        ${row("পেমেন্ট মাধ্যম", provider)}
        ${row("প্রেরকের নম্বর", pay.senderMobile)}
        ${row("ট্রানজেকশন আইডি", pay.transactionId)}
        ${row("যে নম্বরে পাঠানো হয়েছে", `${pay.collectorName || ""} ${pay.collectorMobile ? "· " + pay.collectorMobile : ""}`)}
        ${row("সময় (ঢাকা)", when)}
      </table>

      <div style="text-align:center;margin:24px 0 10px">
        <a href="${panel}" style="display:inline-block;background:#e9c948;color:#2b3126;text-decoration:none;font-weight:700;font-size:16.5px;padding:14px 26px;border-radius:999px">
          এক ক্লিকে প্যানেলে যাই →
        </a>
      </div>
      <p style="text-align:center;margin:0 0 6px;color:#6b7280;font-size:13.5px">
        না খুললে এই লিংকেও যেতে পারেন: <a href="${loginFallback}" style="color:#1f6b3f">${esc(loginFallback)}</a>
      </p>
      <p style="text-align:center;margin:0 0 20px;color:#9ca3af;font-size:12.5px">
        (এই লিংকটি ৬০ মিনিট পর্যন্ত কাজ করে; একবার চাপলেই প্যানেল খুলবে)
      </p>

      <div style="background:#f3f7f1;border:1px solid #d9e6d5;border-radius:14px;padding:14px 16px;color:#3c4a3a;font-size:14.5px;line-height:1.75">
        <b>এখন কী করবেন:</b><br>
        ১) ${esc(provider)}-এর স্টেটমেন্টে <b>${esc(pay.senderMobile)}</b> নম্বর থেকে
        <b>৳${money(pay.amount || registration.total)}</b> এসেছে কি না দেখুন।<br>
        ২) ট্রানজেকশন আইডি মিলিয়ে দেখুন: <b>${esc(pay.transactionId)}</b>।<br>
        ৩) প্যানেলে <b>“পেমেন্ট যাচাই”</b> ট্যাবে গিয়ে অনুমোদন দিলে QR টিকিট তৈরি হয়ে যাবে।
      </div>
    </div>
    <div style="padding:14px 24px;background:#faf7ef;border-top:1px solid #eee6d4;color:#8b8574;font-size:12.5px;line-height:1.7">
      এই মেইলটি স্বয়ংক্রিয়ভাবে যায় — কেউ নিবন্ধন করলেই। বন্ধ করতে চাইলে ডেটাবেস থেকে
      <code>NOTIFY_EMAIL</code> খালি করে দিন (অথবা RESEND_API_KEY মুছে দিন)।
      নিবন্ধন নম্বর: ${esc(registrationId || registration.ticketNumber)}
    </div>
  </div></body></html>`;

  const text = [
    `🎟️ নতুন নিবন্ধন: ${p.name} — ৳${registration.total} (${provider})`,
    ``,
    `টিকিট নম্বর: ${registration.ticketNumber}`,
    `স্কুল: ${p.school} · রোল: ${p.sscRoll}`,
    `মোবাইল: ${p.mobile} · অবস্থান: ${p.location}`,
    `পরিবার: ${registration.spouse} জন সঙ্গী, ${registration.children} জন শিশু · খাবার: ${registration.food} · টি-শার্ট: ${p.tshirt}`,
    `পেমেন্ট: ${provider} · প্রেরক: ${pay.senderMobile} · TrxID: ${pay.transactionId} · ৳${pay.amount || registration.total}`,
    ...Object.entries(registration.answers || {})
      .filter(([, v]) => String(v ?? "").trim() !== "")
      .map(([k, v]) => `${fieldLabel(k, registration)}: ${v}`),
    `সময়: ${when}`,
    ``,
    `এক ক্লিকে প্যানেল: ${panel}`,
    `(লিংকটি ৬০ মিনিট পর্যন্ত কাজ করে)`,
    ``,
    `প্যানেলে “পেমেন্ট যাচাই” ট্যাবে অনুমোদন দিলে QR টিকিট তৈরি হবে।`,
  ].join("\n");

  return { subject, html, text, to, panel };
}

// ── পাঠানোর কাজ ──────────────────────────────────────────────────
async function post(url, body, headers = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, body: txt.slice(0, 400) };
  } finally {
    clearTimeout(timer);
  }
}

/** মেইল পাঠায়; কোনো কারণে ব্যর্থ হলেও কখনোই নিবন্ধন আটকায় না। */
export async function sendMail({ subject, html, text, to, from }) {
  const cfg = notifyConfig();
  if (!cfg.configured) return { ok: false, reason: "not-configured", provider: "" };
  try {
    if (cfg.provider === "resend") {
      const r = await post(
        "https://api.resend.com/emails",
        { from: from || cfg.from, to: [to || cfg.to], subject, html, text },
        { Authorization: `Bearer ${cfg.resendKey}` },
      );
      let id = "";
      try {
        id = JSON.parse(r.body)?.id || "";
      } catch {
        id = "";
      }
      return { ok: r.ok, provider: "resend", status: r.status, id, detail: r.body };
    }
    const r = await post(
      cfg.webhook,
      { to: to || cfg.to, from: from || cfg.from, subject, html, text, secret: cfg.webhookSecret },
      {},
    );
    return { ok: r.ok, provider: "webhook", status: r.status, detail: r.body };
  } catch (e) {
    return { ok: false, provider: cfg.provider, reason: String(e?.message || e) };
  }
}

/** নতুন নিবন্ধনের খবর পাঠানোর সহজ দরজা (নিজেই মেইল বানায়)। */
export async function notifyNewRegistration({ registration, registrationId, log = console }) {
  const cfg = notifyConfig();
  if (!cfg.configured) {
    log.log("[notify] ইমেইল সেট করা নেই — খবর পাঠানো হয়নি (RESEND_API_KEY/NOTIFY_WEBHOOK_URL দিন)");
    return { ok: false, reason: "not-configured" };
  }
  const mail = registrationEmail({ registration, registrationId });
  const result = await sendMail(mail);
  if (result.ok)
    log.log(
      `[notify] মেইল পাঠানো হলো → ${result.provider} → ${mail.to}${
        result.id ? " (Resend id: " + result.id + ")" : ""
      }`,
    );
  else log.error("[notify] মেইল পাঠানো যায়নি:", result);
  return { ...result, to: mail.to, subject: mail.subject };
}
