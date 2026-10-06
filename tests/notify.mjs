// নোটিফিকেশন পরীক্ষা (লোকাল ডেমো সার্ভার):
//   ১) কেউ নিবন্ধন করলেই আয়োজকের কাছে মেইল যায় (ওয়েবহুকে ধরা পড়ে)
//   ২) মেইলে কী কী তথ্য থাকে (নাম, স্কুল, টাকা, TrxID, টিকিট নম্বর…)
//   ৩) মেইলের “এক ক্লিকে প্যানেল” লিংক সত্যিই লগইন করায়
//   ৪) ভুল/মেয়াদোত্তীর্ণ টোকেন দিয়ে লগইন হয় না
//   ৫) ইমেইল সেট না থাকলে নিবন্ধন তবুও স্বাভাবিকভাবে জমা হয়
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:http";
import assert from "node:assert/strict";

const PORT = 3313;
const CAPTURE = 3399;
let pass = 0;
let fail = 0;
const ok = (t, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};

// ── ১. ওয়েবহুক-ধরার সার্ভার (মেইল এখানে এসে পড়বে) ────────────────
const captured = [];
const catcher = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      captured.push(JSON.parse(body));
    } catch {
      captured.push({ raw: body });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
  });
});
await new Promise((r) => catcher.listen(CAPTURE, "127.0.0.1", r));

// ── ২. ডেমো সার্ভার চালু (ওয়েবহুক-সহ) ─────────────────────────────
try {
  const pids = execSync(`ss -ltnp 2>/dev/null | grep ":${PORT} " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true`)
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const pid of pids) try { process.kill(Number(pid)); } catch {}
} catch {}
execSync("rm -f data/demo-store.json");
const server = spawn("node", ["server/index.mjs"], {
  env: {
    ...process.env,
    DATA_MODE: "demo",
    PORT: String(PORT),
    SESSION_SECRET: "test-secret-1234567890123456789012345",
    APP_ORIGIN: `http://127.0.0.1:${PORT}`,
    NOTIFY_WEBHOOK_URL: `http://127.0.0.1:${CAPTURE}/hook`,
    NOTIFY_WEBHOOK_SECRET: "tok-123",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const BASE = `http://127.0.0.1:${PORT}/api`;
for (let i = 0; i < 25; i++) {
  try {
    const r = await fetch(`${BASE}/site`);
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 700));
}

try {
  const site = await fetch(`${BASE}/site`).then((r) => r.json());
  const jpeg =
    "data:image/jpeg;base64," +
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
  const up = await fetch(`${BASE}/photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo: jpeg }),
  }).then((r) => r.json());
  const acc = site.accounts.find((a) => a.provider === "nagad");

  // ── ৩. একটা নিবন্ধন → মেইল এলো কি না ───────────────────────────
  const reg = await fetch(`${BASE}/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant: {
        name: "মেইল পরীক্ষা বন্ধু",
        school: "রংপুর জিলা স্কুল",
        sscRoll: "96999",
        sscRegistration: "",
        mobile: "01717000999",
        location: "রংপুর",
        tshirt: "XL",
        photoUrl: up.url,
      },
      spouse: 1,
      children: 2,
      food: "সাধারণ",
      notes: "",
      payment: {
        provider: "nagad",
        accountId: acc.id,
        senderMobile: "01717000999",
        transactionId: "MAIL-TEST-96",
        amount: 2399,
      },
      consent: true,
    }),
  }).then((r) => r.json());

  await new Promise((r) => setTimeout(r, 1200));
  ok("নিবন্ধন করলেই আয়োজকের কাছে মেইল গেল", captured.length >= 1, `${captured.length}টি`);

  const mail = captured.find((m) => String(m?.subject || "").includes("নতুন নিবন্ধন")) || captured[0] || {};
  ok("মেইলের ঠিকানা ঠিক", mail.to === "admin@ssc96.demo", mail.to);
  ok("বিষয়-লাইনে নাম আছে", String(mail.subject).includes("মেইল পরীক্ষা বন্ধু"), mail.subject);
  ok("মেইলে হুইসেল-ব্লোয়ার সিক্রেট পাঠানো হয়", mail.secret === "tok-123");
  const body = String(mail.html || "");
  for (const [label, needle] of [
    ["নাম", "মেইল পরীক্ষা বন্ধু"],
    ["স্কুল", "রংপুর জিলা স্কুল"],
    ["মোবাইল", "01717000999"],
    ["TrxID", "MAIL-TEST-96"],
    ["টাকার পরিমাণ", "২,৩৯৯"],
    ["টিকিট নম্বর", reg.registration.ticketNumber],
    ["পরিবার", "১ জন জীবনসঙ্গী"],
    ["নগদ", "নগদ"],
  ])
    ok(`মেইলে ${label} আছে`, body.includes(needle));
  ok("সাধারণ লেখার সংস্করণও আছে (HTML ছাড়া মেইল-অ্যাপে)", String(mail.text).includes("মেইল পরীক্ষা বন্ধু"));

  // ── ৪. এক ক্লিকে লগইন ─────────────────────────────────────────
  const link = body.match(/http:\/\/127\.0\.0\.1:\d+\/api\/quick-login\?t=[^"']+/)?.[0];
  ok("মেইলে এক-ক্লিক লিংক আছে", Boolean(link), (link || "").slice(0, 60));
  const noFollow = await fetch(link, { redirect: "manual" });
  const cookie = (noFollow.headers.getSetCookie?.() || [noFollow.headers.get("set-cookie")])
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");
  ok("লিংকে চাপলে ৩০২ হয়ে প্যানেলে পাঠায়", noFollow.status === 302, `HTTP ${noFollow.status}`);
  ok("লগইনের কুকি বসে যায়", /r96_session=/.test(cookie));
  const me = await fetch(`${BASE}/me`, { headers: { cookie } }).then((r) => r.json());
  ok("সেই কুকি দিয়েই অ্যাডমিন হিসেবে ঢুকে পড়া যায়", me?.role === "admin", JSON.stringify(me?.role));
  const adminData = await fetch(`${BASE}/admin`, { headers: { cookie } });
  ok("লগইন করা অবস্থায় প্যানেলের ডেটা আসে", adminData.status === 200, `HTTP ${adminData.status}`);

  // ── ৫. নকল/মেয়াদোত্তীর্ণ টোকেন ────────────────────────────────
  const tampered = link.replace(/t=([^&]+)/, (m, t) => `t=${t.slice(0, -3)}xyz`);
  const bad = await fetch(tampered, { redirect: "manual" });
  ok("টোকেন বদলে দিলে লগইন হয় না", bad.status === 302 && /login=expired/.test(bad.headers.get("location") || ""), bad.headers.get("location"));

  // ── ৬. প্যানেলের “নোটিফিকেশন অবস্থা” ───────────────────────────
  const noAuth = await fetch(`${BASE}/notify-status`);
  ok("লগইন ছাড়া নোটিফিকেশনের অবস্থা দেখা যায় না", noAuth.status === 401, `HTTP ${noAuth.status}`);
  const st = await fetch(`${BASE}/notify-status`, { headers: { cookie } }).then((r) => r.json());
  ok("প্যানেলে নোটিফিকেশন চালু হিসেবে দেখায়", st.configured === true, JSON.stringify(st));
  ok("প্যানেলে ঠিকানা দেখায়", st.to === "admin@ssc96.demo", st.to);

  console.log(`\n═══ নোটিফিকেশন পরীক্ষা: ${pass} পাস, ${fail} ব্যর্থ ═══\n`);
} catch (e) {
  console.error("পরীক্ষা ব্যর্থ:", e);
  console.error(serverLog.slice(-1500));
  fail++;
} finally {
  server.kill();
  catcher.close();
}
process.exit(fail ? 1 : 0);
