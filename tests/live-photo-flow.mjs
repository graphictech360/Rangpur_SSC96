// লাইভ সাইটে (Vercel → Supabase) ছবির পুরো পথ যাচাই
const BASE = "https://rangpur-ssc96.vercel.app/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "graphictech360@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const J = (r) => r.json();
let pass = 0, fail = 0;
const ok = (t, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};

// ছোট JPEG (২×২) — আসল ছবির magic bytes সহ
const jpeg =
  "data:image/jpeg;base64," +
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

// ১) ছবি আপলোড
const up = await fetch(BASE + "/photo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ photo: jpeg }),
}).then(J);
ok("ছবি Storage-এ উঠল", typeof up.url === "string" && up.url.includes("/storage/v1/object/public/photos/"), up.url?.slice(0, 90));
const img = await fetch(up.url);
ok("ছবির লিংক খোলা যায় (পাবলিক)", img.status === 200 && (img.headers.get("content-type") || "").startsWith("image/"), `HTTP ${img.status}`);

// ২) ছবিসহ নিবন্ধন
const site = await fetch(BASE + "/site").then(J);
const account = site.accounts[0];
const mobile = "017" + String(Date.now() % 100000000).padStart(8, "0");
const body = {
  participant: { name: "লাইভ ছবি পরীক্ষা", school: "রংপুর জিলা স্কুল", sscRoll: "LIVEP1", sscRegistration: "", mobile, location: "ঢাকা", tshirt: "L", photoUrl: up.url },
  spouse: 0, children: 0, food: "সাধারণ", notes: "", consent: true,
  payment: { provider: account.provider, accountId: account.id, senderMobile: mobile, transactionId: "LIVEP" + Date.now(), amount: site.fees.friend },
};
const reg = await fetch(BASE + "/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const regData = await reg.json();
ok("ছবিসহ নিবন্ধন জমা (pending)", reg.status === 201 && regData.registration?.status === "pending", `HTTP ${reg.status}`);

// ৩) ছবি ছাড়া নিবন্ধন আটকায়
const noPhoto = await fetch(BASE + "/registrations", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...body, participant: { ...body.participant, name: "লাইভ ছবি ছাড়া", mobile: "018" + mobile.slice(3), photoUrl: undefined },
    payment: { ...body.payment, senderMobile: "018" + mobile.slice(3), transactionId: "LIVEN" + Date.now() } }),
});
const noPhotoData = await noPhoto.json();
ok("ছবি ছাড়া নিবন্ধন আটকেছে", noPhoto.status >= 400, (noPhotoData.error || "").slice(0, 60));

// ৪) অ্যাডমিন লগইন → অনুমোদন
const login = await fetch(BASE + "/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie")]).filter(Boolean).map((c) => c.split(";")[0]).join("; ");
ok("অ্যাডমিন লগইন", login.status === 200, `HTTP ${login.status}`);
const approve = await fetch(BASE + "/admin/mutate", {
  method: "POST", headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({ action: "registration.approve", payload: { id: regData.registration.id, verified: true } }),
});
ok("পেমেন্ট অনুমোদন (QR টিকিট)", approve.status === 200, `HTTP ${approve.status}`);

// ৫) টিকিটে ছবি + সব তথ্য
const ticket = await fetch(BASE + "/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackingKey: regData.trackingKey }) }).then(J);
ok("টিকিট অনুমোদিত", ticket.status === "approved", ticket.status);
ok("টিকিটে ছবির লিংক আছে", ticket.participant?.photoUrl === up.url, (ticket.participant?.photoUrl || "").slice(0, 60));
ok("টিকিটে পূর্ণ তথ্য (নাম/স্কুল/রোল/মোবাইল/টি-শার্ট/অবস্থান)",
  ["name", "school", "sscRoll", "mobile", "tshirt", "location"].every((k) => Boolean(ticket.participant?.[k])),
  JSON.stringify({ n: ticket.participant?.name, s: ticket.participant?.school, r: ticket.participant?.sscRoll }));
ok("গোপন ট্র্যাকিং লিংক কাজ করে", Boolean(ticket.trackingKey || regData.trackingKey));

// ৬) নমুনা পরিষ্কার (নিবন্ধন আর্কাইভ)
const archive = await fetch(BASE + "/admin/mutate", {
  method: "POST", headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({ action: "registration.remove", payload: { id: regData.registration.id } }),
});
ok("পরীক্ষার নিবন্ধন সরানো হলো", archive.status === 200, `HTTP ${archive.status}`);

console.log(`\n═══ লাইভ ছবি পরীক্ষা: ${pass} পাস, ${fail} ব্যর্থ ═══\n`);
process.exit(fail ? 1 : 0);
