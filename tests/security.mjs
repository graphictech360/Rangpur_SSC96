/* R15 নিরাপত্তা-পরীক্ষা: রোবট-যাচাই, ভুল উৎস আটকানো, লগইন লক, সুরক্ষা-হেডার,
   সেশন-কুকি ও নিরাপত্তা-প্রতিবেদন।
   চালান:  node tests/security.mjs            (ডেমো সার্ভার 3312-এ)
           BASE=https://rangpur-ssc96.vercel.app ADMIN_PASSWORD=... node tests/security.mjs --live
*/
const BASE = process.env.BASE || "http://127.0.0.1:3312";
const LIVE = process.argv.includes("--live");
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || (LIVE ? "graphictech360@gmail.com" : "admin@ssc96.demo");
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || (LIVE ? "" : "Festival96!");
let pass = 0,
  fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${extra ? " — " + extra : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const call = async (path, { body, method = "GET", headers = {}, cookie } = {}) => {
  const res = await fetch(BASE + "/api" + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data, headers: res.headers };
};

const site = await call("/site");
if (site.status !== 200) {
  console.error("সাইট API উত্তর দিচ্ছে না — সার্ভার চালু আছে?", BASE);
  process.exit(1);
}
const accountId = site.data.accounts[0].id;
const validBase = {
  participant: {
    name: "নিরাপত্তা পরীক্ষা",
    school: "রংপুর জিলা স্কুল",
    sscRoll: "৯৯",
    sscRegistration: "SEC1",
    mobile: "01700000000",
    location: "রংপুর",
    tshirt: "L",
    // জমা দেওয়ার জন্য ছবি বাধ্যতামূলক — ছোট একটা আসল PNG
    photoUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  },
  spouse: 0,
  children: 0,
  notes: "",
  answers: {},
  consent: true,
};
const paymentFor = (amount = 1499) => ({
  provider: "bkash",
  accountId,
  senderMobile: "01700000000",
  transactionId: "SECURE" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  amount,
});

console.log(`\n═══ R15 নিরাপত্তা-পরীক্ষা (${LIVE ? "লাইভ" : "ডেমো"}: ${BASE}) ═══`);

/* ১) সুরক্ষা-হেডার */
console.log("\n১) সুরক্ষা-হেডার ও sitemap-বিরোধী সেটআপ");
{
  const res = await fetch(BASE + "/");
  const h = (k) => res.headers.get(k) || "";
  ok("X-Content-Type-Options: nosniff", h("x-content-type-options") === "nosniff");
  ok("X-Frame-Options: SAMEORIGIN (iframe-প্রতারণা বন্ধ)", h("x-frame-options") === "SAMEORIGIN");
  ok("Referrer-Policy সেট", /strict-origin/.test(h("referrer-policy")), h("referrer-policy"));
  ok("Permissions-Policy: ক্যামেরা ছাড়া সব বন্ধ", /camera=\(self\)/.test(h("permissions-policy")) && /microphone=\(\)/.test(h("permissions-policy")));
  if (LIVE) {
    ok("HSTS চালু (লাইভ)", /max-age=\d+/.test(h("strict-transport-security")), h("strict-transport-security"));
    ok("CSP চালু (লাইভ)", /default-src 'self'/.test(h("content-security-policy")));
  } else {
    ok("লোকাল মোডে HSTS/CSP বন্ধ (ডেমোর সুবিধায়)", !h("strict-transport-security"));
  }
}

/* ২) বাইরের উৎস থেকে বদল-অনুরোধ আটকানো */
console.log("\n২) বাইরের ওয়েবসাইট থেকে অনুরোধ");
{
  const r = await call("/registrations", {
    method: "POST",
    headers: { origin: "https://evil-example.com" },
    body: { ...validBase, payment: paymentFor() },
  });
  ok("ভুয়া উৎস থেকে নিবন্ধন আটকানো (৪০৩)", r.status === 403, `${r.status} · ${r.data?.error || ""}`);
  const r2 = await call("/login", {
    method: "POST",
    headers: { origin: "https://evil-example.com" },
    body: { email: ADMIN_EMAIL, password: "wrong-one" },
  });
  ok("ভুয়া উৎস থেকে লগইন আটকানো (৪০৩)", r2.status === 403);
}

/* ৩) রোবট-যাচাই (ফাঁদ-ঘর ও সময়) */
console.log("\n৩) রোবট-যাচাই");
{
  const honey = await call("/registrations", {
    method: "POST",
    body: { ...validBase, payment: paymentFor(), _hp: "রোবট এখানে লিখে ফেলেছে", _t: Date.now() - 60000 },
  });
  ok("লুকানো ফাঁদ-ঘরে লেখা থাকলে জমা বাতিল (৪০০)", honey.status === 400 && /রোবট/.test(honey.data?.error || ""), honey.data?.error);

  const quick = await call("/registrations", {
    method: "POST",
    body: { ...validBase, payment: paymentFor(), _hp: "", _t: Date.now() },
  });
  ok("অস্বাভাবিক দ্রুত জমা বাতিল (৪০০)", quick.status === 400 && /দ্রুত|আগে-ভাগেই/.test(quick.data?.error || ""), quick.data?.error);

  // মানুষের মতো ধীরে পূরণ → নিবন্ধন ঠিকঠাক হবে
  const started = Date.now() - 2500;
  await sleep(50);
  const good = await call("/registrations", {
    method: "POST",
    body: { ...validBase, payment: paymentFor(), _hp: "", _t: started },
  });
  ok("স্বাভাবিক গতিতে জমা দিলে নিবন্ধন হয়", good.status === 200 || good.status === 201, `${good.status} · ${good.data?.ticketNumber || good.data?.error || ""}`);
  if (good.data?.ticketNumber) console.log("     (পরীক্ষার নিবন্ধন:", good.data.ticketNumber, ")");
}

/* ৪) সুরক্ষা-প্রতিবেদন কেবল অ্যাডমিনের জন্য */
console.log("\n৪) নিরাপত্তা-প্রতিবেদন");
{
  const anon = await call("/admin/security");
  ok("লগইন ছাড়া নিরাপত্তা-প্রতিবেদন দেখা যায় না (৪০১)", anon.status === 401, String(anon.status));
}

/* ৫) ভুল পাসওয়ার্ডে লগইন লক */
console.log("\n৫) ভুল পাসওয়ার্ড ৫ বার → অস্থায়ী লক");
let jwt = "";
{
  if (ADMIN_PASSWORD) {
    // সঠিক পাসওয়ার্ডে ঢুকে সেশন নিই (লক পরীক্ষার আগে)
    const good = await call("/login", { method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    ok("সঠিক পাসওয়ার্ডে লগইন হয়", good.status === 200 && !!good.data?.id, `${good.status} · ${good.data?.email || ""}`);
    const c = good.headers.get("set-cookie") || "";
    ok("সেশন কুকি httpOnly (স্ক্রিপ্ট পড়তে পারে না)", /HttpOnly/i.test(c) && /sess/i.test(c));
    jwt = c.split(";")[0];
  }
  // লক-পরীক্ষা হয় আলাদা ইমেইলে — আসল অ্যাডমিনের লগইন লক হয়ে বাকি পরীক্ষা আটকাবে না
  const lockEmail = `lock-test-${Date.now()}@ssc96.demo`;
  let last = null;
  for (let i = 1; i <= 5; i++)
    last = await call("/login", { method: "POST", body: { email: lockEmail, password: "ভুল-পাসওয়ার্ড-" + i } });
  ok("ভুল চেষ্টায় ঢোকা যায়নি (৪০১/৪২৯)", last.status === 401 || last.status === 429, String(last.status));
  const sixth = await call("/login", { method: "POST", body: { email: lockEmail, password: "আরেক ভুল" } });
  ok("এর পরের চেষ্টায় অস্থায়ী লক (৪২৯)", sixth.status === 429 && /লক|মিনিট/.test(sixth.data?.error || ""), sixth.data?.error);
  const user = await call("/login", { method: "POST", body: { email: "lock-test-" + Date.now() + "@ssc96.demo", password: "x" } });
  ok("অন্য ইমেইলের লগইন খোলা আছে (লক শুধু অপরাধীকে ধরে)", user.status === 401, String(user.status));
  if (jwt) {
    const sec = await call("/admin/security", { cookie: jwt });
    ok("লগইন থাকা অবস্থায় নিরাপত্তা-প্রতিবেদন পাওয়া যায়", sec.status === 200 && !!sec.data?.counters, `${sec.status}`);
    ok(
      "ভুল লগইন ও ব্লক-হিসাব গুনে রাখা হয়",
      (sec.data?.counters?.loginFailure || 0) >= 5 &&
        (sec.data?.counters?.blockedOrigin || 0) >= 2 &&
        (sec.data?.counters?.blockedBot || 0) >= 2,
      JSON.stringify(sec.data?.counters),
    );
    ok("বাংলায় মানুষের-পাঠ্য সারসংক্ষেপ আছে", typeof sec.data?.human?.loginFailure === "string" && sec.data.human.loginFailure.length > 0, sec.data?.human?.loginFailure);
    ok("সাম্প্রতিক ঘটনার তালিকা আছে", Array.isArray(sec.data?.recent));
  }
}

/* ৬) API ক্যাশ হয় না (গোপন তথ্য ব্রাউজারে জমা না থাকা) */
console.log("\n৬) API উত্তর কখনো ক্যাশ হয় না");
{
  const r = await call("/site");
  ok("Cache-Control: no-store", /no-store/.test(r.headers.get("cache-control") || ""), r.headers.get("cache-control"));
}

/* ৭) অতিরিক্ত অনুরোধের সীমা (শুধু স্পষ্ট অনুরোধে, কারণ লাইভে বাকি পরীক্ষা ব্যাঘাত ঘটাতে পারে) */
if (process.env.RATELIMIT === "1") {
  console.log("\n৭) মিনিটে ১৫০ অনুরোধের সীমা");
  let got429 = false;
  const started = Date.now();
  for (let i = 0; i < 175 && Date.now() - started < 40000; i++) {
    const r = await call("/site");
    if (r.status === 429) {
      got429 = true;
      console.log(`  ✅ ${i + 1} নম্বর অনুরোধে থেমে গেল`);
      break;
    }
  }
  ok("সীমা ছাড়ালে ৪২৯ আসে", got429);
}

console.log(`\n═══ নিরাপত্তা: ${pass} পাস, ${fail} ব্যর্থ ═══`);
process.exit(fail ? 1 : 0);
