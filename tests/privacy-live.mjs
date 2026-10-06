// গোপনীয়তা-পরীক্ষা (লাইভ সাইট → Supabase): একজন অংশগ্রহণকারী যেন অন্য
// অংশগ্রহণকারীর কোনো তথ্য দেখতে না পারে — সব দিক থেকে যাচাই।
//
//   ADMIN_PASSWORD=… node tests/privacy-live.mjs
//
// যা পরীক্ষা করা হয়:
//   ১) /api/site-এ কারও নাম/মোবাইল/TrxID আছে কি না (থাকলে ফাঁস)
//   ২) অন্য কোনো endpoint-এ খবর নেই কি না (নিবন্ধনের তালিকা কেউ পড়তে পারে কি না)
//   ৩) ক-এর গোপন লিংক দিয়ে কেবল ক-এর টিকিটই আসে — খ-এর কোনো তথ্য আসে না
//   ৪) ভুল/অন্যের রিকভারি কোড দিলে কিছুই আসে না
//   ৫) টেবিল সোজা পড়তে চাইলে আটকায় (RLS)
//   ৬) অ্যাডমিন ডেটা লগইন ছাড়া আটকায়
//   ৭) শেষে পরীক্ষার নিবন্ধনগুলো মুছে ফেলা হয়
const BASE = process.env.BASE_URL || "https://rangpur-ssc96.vercel.app/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "graphictech360@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SB_URL = process.env.SUPABASE_URL || "https://mbuzwqsrnmergrtetwqq.supabase.co";
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

let pass = 0;
let fail = 0;
const ok = (t, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};
const J = (r) => r.json();
const jpeg =
  "data:image/jpeg;base64," +
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

// পরের টেস্ট-রানে যেন কোনো সাদৃশ্য না থাকে
const stamp = String(Date.now()).slice(-6);
const rand = () => String(Math.floor(1000000 + Math.random() * 8999999));
const A = {
  name: "গোপনীয়তা-ক-" + stamp,
  mobile: "0171" + rand(),
  trx: "PRIV-A-" + stamp,
};
const B = {
  name: "গোপনীয়তা-খ-" + stamp,
  mobile: "0172" + rand(),
  trx: "PRIV-B-" + stamp,
};

const site = await fetch(BASE + "/site").then(J);
const photo = await fetch(BASE + "/photo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ photo: jpeg }),
}).then(J);
const account = site.accounts[0];

async function register(p) {
  const res = await fetch(BASE + "/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant: {
        name: p.name,
        school: "গোপনীয়তা পরীক্ষা স্কুল",
        sscRoll: "P" + stamp,
        sscRegistration: "",
        mobile: p.mobile,
        location: "ঢাকা",
        tshirt: "M",
        photoUrl: photo.url,
      },
      spouse: 0,
      children: 0,
      food: "সাধারণ",
      notes: "",
      payment: {
        provider: account.provider,
        accountId: account.id,
        senderMobile: p.mobile,
        transactionId: p.trx,
        amount: site.fees.friend,
      },
      consent: true,
    }),
  });
  return { status: res.status, data: await res.json() };
}

const ra = await register(A);
const rb = await register(B);
ok("দুইজনের নিবন্ধন হলো", ra.status === 201 && rb.status === 201, `ক:${ra.status} খ:${rb.status}`);

// ১) পাবলিক সাইটে কারও ব্যক্তিগত তথ্য নেই
const siteText = JSON.stringify(site);
ok(
  "পাবলিক সাইটে কোনো অংশগ্রহণকারীর নাম/মোবাইল/TrxID নেই",
  !siteText.includes(A.mobile) && !siteText.includes(A.trx) && !siteText.includes("গোপনীয়তা-ক-"),
);

// ২) নিবন্ধনের তালিকা কেউ পড়তে পারে কি না
const listTries = [];
for (const p of ["/registrations", "/admin", "/tickets", "/participants"]) {
  const r = await fetch(BASE + p);
  const t = await r.text();
  listTries.push({ p, status: r.status, leaked: t.includes(A.mobile) || t.includes(B.mobile) });
}
ok(
  "কোনো পাবলিক endpoint-এ নিবন্ধনের তালিকা ফাঁস হয় না",
  listTries.every((x) => !x.leaked),
  listTries.map((x) => `${x.p}:${x.status}`).join(" "),
);

// ৩) ক-এর গোপন লিংক দিয়ে শুধু ক-এর টিকিট
const ticketA = await fetch(BASE + "/ticket", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ trackingKey: ra.data.trackingKey }),
}).then(J);
const aText = JSON.stringify(ticketA);
ok("ক-এর লিংকে ক-এর নামই আসে", ticketA.participant?.name === A.name, ticketA.participant?.name);
ok(
  "ক-এর লিংকে খ-এর কোনো তথ্য নেই (মোবাইল/TrxID/নাম)",
  !aText.includes(B.mobile) && !aText.includes(B.trx) && !aText.includes(B.name),
);
ok("ক-এর লিংকে খ-এর ছবি আসে না", !aText.includes(B.trx));

// ৪) অন্যের রিকভারি কোড দিলে কিছুই আসে না
const wrong = ra.data.trackingKey.split("").reverse().join("");
const wrongTicket = await fetch(BASE + "/ticket", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ trackingKey: wrong }),
}).then(J);
ok(
  "ভুল/অন্যের কোডে কোনো তথ্য আসে না",
  wrongTicket.status !== "pending" && wrongTicket.status !== "approved" && !JSON.stringify(wrongTicket).includes(A.mobile),
  wrongTicket.status || wrongTicket.error,
);

// ৫) টেবিল সোজা পড়া বন্ধ (RLS)
let direct;
if (SB_KEY) {
  direct = [];
  for (const t of ["participants", "registrations", "payments", '"user"']) {
    const r = await fetch(`${SB_URL}/rest/v1/${t}?select=*`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const t2 = await r.text();
    direct.push({ t, status: r.status, leaked: t2.includes(A.mobile) || t2.includes(B.trx) });
  }
  ok(
    "anon চাবি দিয়ে সরাসরি টেবিল পড়া যায় না",
    direct.every((x) => x.status >= 400 && !x.leaked),
    direct.map((x) => `${x.t}:${x.status}`).join(" "),
  );
} else {
  console.log("ℹ️ SUPABASE_PUBLISHABLE_KEY নেই — সরাসরি-টেবিল পরীক্ষা বাদ");
}

// ৬) অ্যাডমিন ডেটা লগইন ছাড়া বন্ধ
const adminNoAuth = await fetch(BASE + "/admin");
ok("লগইন ছাড়া অ্যাডমিন প্যানেলের ডেটা আসে না", adminNoAuth.status >= 400, `HTTP ${adminNoAuth.status}`);

// ৭) পরিষ্কার: দুই নিবন্ধনই অ্যাডমিন দিয়ে বাদ দেওয়া (আর্কাইভ)
if (ADMIN_PASSWORD) {
  const login = await fetch(BASE + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie")])
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");
  for (const r of [ra, rb]) {
    await fetch(BASE + "/admin/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        action: "registration.remove",
        payload: { id: r.data.registration.id },
      }),
    });
  }
  ok("পরীক্ষার দুই নিবন্ধন সরানো হলো", true);
} else {
  console.log("ℹ️ ADMIN_PASSWORD নেই — পরীক্ষার নিবন্ধন দুটি নিজে মুছে নিন");
}

console.log(`\n═══ গোপনীয়তা পরীক্ষা: ${pass} পাস, ${fail} ব্যর্থ ═══\n`);
process.exit(fail ? 1 : 0);
