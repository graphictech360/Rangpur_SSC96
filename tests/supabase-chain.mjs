// ═══════════════════════════════════════════════════════════════════
// Rangpur SSC 96 — আসল Supabase-এ পুরো কার্য-প্রবাহ পরীক্ষা (এক ফাইলে)
// চালান:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_PUBLISHABLE_KEY=$(cat ~/.supabase-publishable) \
//   SUPABASE_ADMIN_EMAIL=you@example.com SUPABASE_ADMIN_PASSWORD=******** \
//   node tests/supabase-chain.mjs
// যা যা দেখে: পাবলিক দরজা, বন্ধ দরজা, লগইন-হিসাব, পাসওয়ার্ড রিসেট,
// গঠন-বর্ণনা (guide), নিবন্ধন → অনুমোদন → QR → রিফান্ড → টিকিট বাতিল।
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";

const URL = process.env.SUPABASE_URL || "https://mbuzwqsrnmergrtetwqq.supabase.co";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  (existsSync("/home/user/.supabase-publishable") ? readFileSync("/home/user/.supabase-publishable", "utf8").trim() : "");
const EMAIL = process.env.SUPABASE_ADMIN_EMAIL || "";
const PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD || "";
const H = { apikey: KEY, "Content-Type": "application/json" };

const call = async (path, body, tok) => {
  const r = await fetch(URL + path, {
    method: "POST",
    headers: { ...H, ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t.slice(0, 120);
  }
  return { status: r.status, j };
};

let pass = 0,
  fail = 0;
const ok = (c, m, extra = "") => {
  c ? (pass++, console.log("  ✅", m)) : (fail++, console.log("  ❌", m, extra));
};
const mob = "017" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const trx = "CHAIN" + Date.now().toString().slice(-7);

console.log("\n— ১) পাবলিক দরজা (লগইন ছাড়া) —");
const site = await call("/rest/v1/rpc/public_site", {});
ok(site.status === 200, "public_site খোলে", site.j);
ok(site.j?.sections?.length === 13 && site.j?.schedule?.length === 14 && site.j?.accounts?.length === 8,
  `সেকশন ১৩ / সময়সূচি ১৪ / নম্বর ৮ (পেয়েছি ${site.j?.sections?.length}/${site.j?.schedule?.length}/${site.j?.accounts?.length})`);
ok((site.j?.contacts || []).length === 4, "যোগাযোগ নম্বর ৪টি");
ok(site.j?.fees?.friend === 1499 && site.j?.fees?.spouse === 500 && site.j?.fees?.child === 200, "ফি ১৪৯৯/৫০০/২০০");

console.log("\n— ২) বন্ধ দরজাগুলো সত্যিই বন্ধ —");
for (const fn of ["admin_overview", "guide_overview", "staff_identity"]) {
  const r = await call(`/rest/v1/rpc/${fn}`, {});
  ok(r.status === 401 || r.status === 403, `${fn} → অনন 401/403 (পেয়েছি ${r.status})`);
}
for (const t of ["registrations", "participants", "payments", "admins", "checkins", "tickets"]) {
  const r = await fetch(`${URL}/rest/v1/${t}?select=id`, { headers: H });
  ok([401, 403, 404].includes(r.status), `সরাসরি টেবিল পড়া বন্ধ: ${t} (${r.status})`);
}

console.log("\n— ৩) অ্যাডমিন লগইন —");
if (EMAIL && PASSWORD) {
  const bad = await call("/auth/v1/token?grant_type=password", { email: EMAIL, password: "ভুলপাসওয়ার্ড!" });
  ok(bad.status >= 400, "ভুল পাসওয়ার্ড প্রত্যাখ্যাত");
  var good = await call("/auth/v1/token?grant_type=password", { email: EMAIL, password: PASSWORD });
  ok(good.status === 200 && !!good.j?.access_token, "সঠিক পাসওয়ার্ডে অ্যাডমিন লগইন");
} else {
  console.log("  ⏭️  SUPABASE_ADMIN_EMAIL / SUPABASE_ADMIN_PASSWORD ছাড়া লগইন পরীক্ষা বাদ");
}
const tok = good?.j?.access_token;

console.log("\n— ৪) পাসওয়ার্ড ভুলে যাওয়া (তথ্য ফাঁস হয় না) —");
const fp1 = await call("/rest/v1/rpc/request_password_reset", { p_email: EMAIL || "keu@example.com" });
const fp2 = await call("/rest/v1/rpc/request_password_reset", { p_email: "keu.nai@example.com" });
ok(fp1.status === 200 && fp1.j?.ok === true, "অনুরোধ গ্রহণ করা হলো");
ok(JSON.stringify(fp1.j) === JSON.stringify(fp2.j), "ইমেইল থাকুক বা না থাকুক — একই উত্তর");

console.log("\n— ৫) গঠন-বর্ণনা (guide) —");
const g = await call("/rest/v1/rpc/guide_overview", {}, tok);
if (tok) {
  ok(g.status === 200, "guide_overview অ্যাডমিনের জন্য খোলে", g.j);
  const data = g.j?.data || g.j;
  const c = (data || {}).counts || {};
  ok(c.schemas === 9, `স্কিমা ৯ (পেয়েছি ${c.schemas})`);
  ok(c.tables === 24, `টেবিল ২৪ (পেয়েছি ${c.tables})`);
  ok(c.flows === 16, `কার্য-প্রবাহ ১৬ (পেয়েছি ${c.flows})`);
  ok((data?.relations || []).length >= 20, `টেবিল-সংযোগ ${data?.relations?.length}টি`);
  ok((data?.tables || []).every((t) => t.rows >= 0), "প্রতিটি টেবিল আলাদা সারি-গণনা দিচ্ছে");
}

console.log("\n— ৬) নিবন্ধন → অনুমোদন → QR —");
const acct = site.j.accounts[0];
const sub = await call("/rest/v1/rpc/submit_registration", {
  p_data: {
    participant: { name: "গঠন পরীক্ষা বন্ধু", school: "রংপুর জিলা স্কুল", sscRoll: "9001", mobile: mob, location: "ঢাকা", tshirt: "L" },
    spouse: 1, children: 2, food: "সাধারণ", notes: "", consent: true,
    payment: { provider: acct.provider, accountId: acct.id, senderMobile: mob, transactionId: trx, amount: 1499 + 500 + 400 },
  },
});
ok(sub.status === 200 && sub.j?.registration?.status === "pending", "নিবন্ধন pending হলো", JSON.stringify(sub.j).slice(0, 200));
ok(sub.j?.registration?.qrPayload === null, "অনুমোদনের আগে QR নেই");
const rid = sub.j?.registration?.id, key = sub.j?.trackingKey;
const dup = await call("/rest/v1/rpc/submit_registration", {
  p_data: {
    participant: { name: "গঠন পরীক্ষা বন্ধু ২", school: "কারমাইকেল কলেজ", sscRoll: "9002", mobile: mob, location: "রংপুর", tshirt: "M" },
    spouse: 0, children: 0, food: "নিরামিষ", notes: "", consent: true,
    payment: { provider: acct.provider, accountId: acct.id, senderMobile: mob, transactionId: trx + "B", amount: 1499 },
  },
});
ok(dup.status >= 400, "একই মোবাইলে দ্বিতীয় নিবন্ধন আটকেছে");
if (tok) {
  const appr = await call("/rest/v1/rpc/admin_mutate", { p_action: "registration.approve", p_payload: { id: rid, verified: true } }, tok);
  ok(appr.status === 200, "অ্যাডমিন অনুমোদন করল", appr.j);
  const tk = await call("/rest/v1/rpc/ticket_status", { p_tracking_key: key });
  ok(tk.status === 200 && tk.j?.status === "approved" && !!tk.j?.qrPayload, "ট্রিগার অনুমোদন + নতুন QR টিকিট দিল");
  const ci = await call("/rest/v1/rpc/check_in", { p_input: tk.j?.qrPayload, p_device_token: "0".repeat(64) }, tok);
  ok(ci.status >= 400, `অননুমোদিত ফোনে চেক-ইন আটকেছে (${ci.status})`);
  const rf = await call("/rest/v1/rpc/admin_mutate", { p_action: "payment.refund", p_payload: { id: rid, amount: 1499, reason: "পরীক্ষার জন্য আংশিক রিফান্ড", method: "bkash", reference: "TESTREF1" } }, tok);
  ok(rf.status === 200, "রিফান্ড যোগ হলো");
  const after = await call("/rest/v1/rpc/ticket_status", { p_tracking_key: key });
  ok(after.j?.status === "refunded", `নিবন্ধন এখন refunded (পেয়েছি ${after.j?.status})`);
  ok(after.j?.qrPayload === null, "রিফান্ডের পর QR বাতিল — দরজায় চলবে না");
  ok(after.j?.refund?.amount === 1499, "রিফান্ডের টাকা রেকর্ডে আছে");
  const over = await call("/rest/v1/rpc/admin_mutate", { p_action: "payment.refund", p_payload: { id: rid, amount: 500, reason: "বেশি টাকা ফেরানোর চেষ্টা", method: "bkash" } }, tok);
  ok(over.status >= 400, "জমার চেয়ে বেশি রিফান্ড আটকেছে");
  const re = await call("/rest/v1/rpc/admin_mutate", { p_action: "registration.approve", p_payload: { id: rid, verified: true } }, tok);
  ok(re.status >= 400, "রিফান্ড হওয়া নিবন্ধন আবার অনুমোদন হয় না");
  const ov = await call("/rest/v1/rpc/admin_overview", {}, tok);
  ok(ov.status === 200 && ov.j?.stats?.totals?.refundedAmount >= 1499, "রিপোর্টে রিফান্ডের হিসাব এসেছে");
  const rm = await call("/rest/v1/rpc/admin_mutate", { p_action: "registration.remove", p_payload: { id: rid } }, tok);
  ok(rm.status === 200, "নিবন্ধন বাদ দেওয়া (আর্কাইভ) হলো");
  const gone = await call("/rest/v1/rpc/ticket_status", { p_tracking_key: key });
  ok(gone.status >= 400, "বাদ দেওয়ার পর গোপন লিংক আর কাজ করে না");
}

console.log(`\n═══ ফলাফল: ${pass} পাস, ${fail} ব্যর্থ ═══\n`);
process.exit(fail ? 1 : 0);
