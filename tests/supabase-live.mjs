/**
 * হোস্ট করা Supabase প্রকল্পে (production) পাবলিক ফ্লো ও নিরাপত্তার আসল পরীক্ষা।
 * শুধু publishable/anon key দিয়েই চলে — কোনো staff/secret key লাগে না।
 *
 * ব্যবহার:
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
 *     node tests/supabase-live.mjs
 *
 * পরীক্ষা করে: পাবলিক সাইট, নিবন্ধন জমা, গোপন টিকিট দেখা, ডুপ্লিকেট আটকানো,
 *              সরাসরি টেবিল পড়া নিষিদ্ধ কি না, এবং anonymous-এর অ্যাডমিন/চেক-ইন বন্ধ কি না।
 */
import assert from "node:assert/strict";

const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
if (!url || !key) {
  console.error(
    "SUPABASE_URL ও SUPABASE_PUBLISHABLE_KEY দরকার।\n" +
      "উদাহরণ: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_… node tests/supabase-live.mjs",
  );
  process.exit(1);
}
assert.match(
  key,
  /^(sb_publishable_|eyJ)/,
  "publishable/anon key দিন — secret বা service_role key কখনো নয়।",
);

async function rpc(name, body = {}, headers = {}) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function rest(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, data: await response.text() };
}

const results = [];
const check = (label, condition, detail = "") => {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(
    `${condition ? "✅" : "✖ "} ${label}${detail ? " — " + detail : ""}`,
  );
};

console.log(`প্রকল্প: ${url}\n`);

// ১. পাবলিক সাইট
const site = await rpc("public_site");
const data = site.data || {};
check("public_site RPC চলে", site.status === 200, "HTTP " + site.status);
check("১৩টি কনটেন্ট সেকশন", (data.sections || []).length === 13);
check("১৪টি সময়সূচি", (data.schedule || []).length === 14);
check("৮টি বিকাশ/নগদ নম্বর", (data.accounts || []).length === 8);
check(
  "ফি ঠিক আছে (১৪৯৯/৫০০/২০০)",
  data.fees?.friend === 1499 &&
    data.fees?.spouse === 500 &&
    data.fees?.child === 200,
  JSON.stringify(data.fees),
);

// ২. ব্যক্তিগত টেবিল সরাসরি পড়া যাবে না
for (const table of [
  "participants",
  "registrations",
  "payments",
  "tickets",
  "checkins",
]) {
  const r = await rest(`${table}?select=*`);
  check(
    `সরাসরি ${table} পড়া নিষিদ্ধ`,
    [401, 403, 404].includes(r.status),
    "HTTP " + r.status,
  );
}

// ৩. anonymous কেউ অ্যাডমিন/চেক-ইন করতে পারে না
for (const [name, body] of [
  ["admin_overview", {}],
  ["admin_mutate", { p_action: "registration.approve", p_payload: {} }],
  ["check_in", { p_input: "R96:test:0", p_device_token: "x" }],
  ["device_state", { p_token: "x" }],
]) {
  const r = await rpc(name, body);
  check(`anonymous ${name} করতে পারে না`, r.status !== 200, "HTTP " + r.status);
}

// ৪. নিবন্ধন জমা → pending, QR নেই
const account = (data.accounts || [])[0];
assert.ok(account, "পেমেন্ট অ্যাকাউন্ট পাওয়া যায়নি");
// সঠিক ১১ ডিজিটের বাংলাদেশি নম্বর: 017 + ৮ ডিজিট
const mobile = "017" + String(Date.now() % 100000000).padStart(8, "0");
const registration = {
  participant: {
    name: "লাইভ পরীক্ষা বন্ধু",
    school: "রংপুর জিলা স্কুল",
    sscRoll: "LIVE" + (Date.now() % 10000),
    sscRegistration: "",
    mobile,
    location: "ঢাকা",
    tshirt: "L",
  },
  spouse: 1,
  children: 2,
  food: "সাধারণ",
  notes: "",
  payment: {
    provider: account.provider,
    accountId: account.id,
    senderMobile: mobile,
    transactionId: "LIVE" + Date.now(),
    amount: 2399,
  },
  consent: true,
};
const created = await rpc("submit_registration", { p_data: registration });
check(
  "নিবন্ধন জমা হয়েছে",
  created.status === 200 || created.status === 201,
  "HTTP " +
    created.status +
    (created.status >= 400
      ? " · " + JSON.stringify(created.data).slice(0, 160)
      : ""),
);
const trackingKey = created.data?.trackingKey;
check("গোপন টিকিট লিংক পাওয়া গেছে", /^[a-f0-9]{64}$/.test(trackingKey || ""));
check(
  "অনুমোদনের আগে QR নেই",
  created.data?.registration?.qrPayload === null ||
    created.data?.registration?.qrPayload === undefined,
  "status=" + created.data?.registration?.status,
);
check(
  "মোট ফি ২,৩৯৯",
  created.data?.registration?.total === 2399,
  String(created.data?.registration?.total),
);

// ৫. একই মোবাইলে আবার জমা দিলে আটকাবে
const duplicate = await rpc("submit_registration", {
  p_data: {
    ...registration,
    payment: { ...registration.payment, transactionId: "DUP" + Date.now() },
  },
});
check(
  "একই মোবাইলে দ্বিতীয় নিবন্ধন আটকেছে",
  duplicate.status !== 200 && duplicate.status !== 201,
  "HTTP " + duplicate.status,
);

// ৬. গোপন লিংকে স্ট্যাটাস দেখা যায়, অনুপস্থিত কী-তে নয়
const status = await rpc("ticket_status", { p_tracking_key: trackingKey });
check(
  "গোপন লিংকে স্ট্যাটাস পাওয়া যায়",
  status.status === 200 && status.data?.status === "pending",
);
const wrong = await rpc("ticket_status", { p_tracking_key: "f".repeat(64) });
check("ভুল/নকল কী প্রত্যাখ্যাত", wrong.status !== 200, "HTTP " + wrong.status);

// ৭. (ঐচ্ছিক) অ্যাডমিন লগইন — শুধু ADMIN_EMAIL/ADMIN_PASSWORD দিলে চলে
const adminEmail = process.env.SUPABASE_ADMIN_EMAIL;
const adminPassword = process.env.SUPABASE_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const tokenResponse = await fetch(
    `${url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    },
  );
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  const token = tokenBody.access_token;
  check(
    "অ্যাডমিন লগইন সফল",
    tokenResponse.status === 200 && Boolean(token),
    "HTTP " + tokenResponse.status,
  );

  if (token) {
    const overview = await rpc(
      "admin_overview",
      {},
      { Authorization: `Bearer ${token}` },
    );
    const stats = overview.data?.stats;
    check(
      "অ্যাডমিন প্যানেল খোলে",
      overview.status === 200,
      "HTTP " + overview.status,
    );
    check(
      "রিপোর্ট (stats) উপস্থিত",
      Boolean(stats?.totals),
      "totals: " + Boolean(stats?.totals),
    );
    check(
      "স্কুল/টি-শার্ট/মাধ্যম/গ্রহণকারী — সব হিসাব আসে",
      Array.isArray(stats?.schools) &&
        Array.isArray(stats?.tshirts) &&
        Array.isArray(stats?.providers) &&
        Array.isArray(stats?.collectors) &&
        Array.isArray(stats?.daily),
    );
    check(
      "মোট টাকা ও উপস্থিতির হিসাব সংখ্যা",
      typeof stats?.totals?.expectedAmount === "number" &&
        typeof stats?.totals?.checkedIn === "number" &&
        typeof stats?.totals?.absent === "number",
    );

    // ভুল পাসওয়ার্ড প্রত্যাখ্যাত হয় কি না
    const bad = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword + "-ভুল",
      }),
    });
    check(
      "ভুল পাসওয়ার্ড প্রত্যাখ্যাত",
      bad.status >= 400,
      "HTTP " + bad.status,
    );
  }
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} পরীক্ষা পাস`,
);
if (failed.length) {
  console.log("ব্যর্থ:", failed.map((f) => f.label).join(", "));
  process.exitCode = 1;
}
console.log(
  "\nলক্ষ্য করুন: এই পরীক্ষার নিবন্ধনটি মুছে ফেলা দরকার — scripts/cleanup-live-test.sql দেখুন।",
);
