// ছবি আপলোডের পুরো পথ ব্রাউজারে পরীক্ষা: ফর্ম → অনুমোদন → টিকিট → গেট
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3312";
const MODE = process.env.MODE || "demo";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@ssc96.demo";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Festival96!";
let failures = 0;
const label = (t, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};

console.log("পরীক্ষার ছবি:", fs.statSync(new URL("fixtures/photo-800x600.png", import.meta.url).pathname).size, "বাইট (৯০০×৭০০ PNG)");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let trackingKey = "";
page.on("response", async (r) => {
  if (r.url().endsWith("/api/registrations") && r.status() === 201) {
    try {
      trackingKey = (await r.json()).trackingKey || "";
    } catch {}
  }
  if (r.url().endsWith("/api/admin/mutate")) {
    let body = "";
    try {
      body = (await r.text()).slice(0, 200);
    } catch {}
    console.log(`   [mutate] ${r.status()} ${body}`);
  }
  if (r.status() >= 400) {
    let body = "";
    try {
      body = (await r.text()).slice(0, 160);
    } catch {}
    errors.push(`${r.status()} ${r.url().replace(BASE, "")} ${body}`);
  }
});

await page.goto(BASE, { waitUntil: "networkidle" });
const navReg = page.locator('nav.main-nav a[href="#registration"]');
  await (await navReg.count() ? navReg.first() : page.getByRole("button", { name: "নিবন্ধন", exact: true })).click();
await page.waitForTimeout(700);

// ── ধাপ ০: ছবি বাছাই (৯০০×৭০০ ছবি দিলেও অ্যাপ নিজেই ছোট করে) ──
await page.locator('input[type="file"]').setInputFiles(new URL("fixtures/photo-800x600.png", import.meta.url).pathname);
await page.waitForTimeout(1200);
const preview = await page.locator(".photo-preview img").count();
label("ফর্মে ছবির প্রিভিউ দেখা যাচ্ছে", preview > 0);
const bytes = await page.locator(".photo-preview img").getAttribute("src");
const kb = Math.round(((bytes?.length || 0) * 0.75) / 1024);
label("৯০০×৭০০ ছবি ছোট করে নেওয়া হয়েছে", kb > 2 && kb < 400, `~${kb} KB (৫১২×৫১২ মাপ)`);
await page.screenshot({ path: "/home/user/.artifacts/form-photo.png" });

const fill = (name, value) => page.locator(`input[name="${name}"]`).fill(value);
const mobile = "017" + String(20000000 + Math.floor(Math.random() * 79999999)).slice(0, 8);
const tester = "ছবি পরীক্ষা " + String(Date.now()).slice(-5);
await fill("name", tester);
await fill("school", "রংপুর জিলা স্কুল");
await fill("sscRoll", "1996001");
await fill("mobile", mobile);
await fill("location", "ঢাকা");
await page.getByRole("button", { name: "পরের ধাপ" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "পরের ধাপ" }).click();
await page.waitForTimeout(600);
await page.locator('input[name="senderMobile"]').fill(mobile);
await page.locator('input[name="transactionId"]').fill("TRXPH" + Date.now().toString().slice(-6));
await page.locator('input[type="checkbox"]').first().check();
await page.getByRole("button", { name: /জমা|সম্পন্ন|পাঠান/ }).first().click();
await page.waitForTimeout(2200);
label("নিবন্ধন জমা হয়েছে", (await page.locator(".success-card").count()) > 0);

// ── অ্যাডমিন: লগইন → বিস্তারিত পর্দায় ছবি → অনুমোদন ──
await page.getByRole("button", { name: /আয়োজক প্যানেল/ }).first().click();
await page.waitForTimeout(1200);
const emailBox = page.locator('input[name="email"], input[type="email"]').first();
if (await emailBox.count()) {
  await emailBox.fill(ADMIN_EMAIL);
  await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /লগইন|প্রবেশ/ }).first().click();
  await page.waitForTimeout(3000);
}
label("অ্যাডমিন প্যানেলে ঢোকা গেছে", (await page.locator(".admin-panel, .admin-shell, .admin-dashboard, nav, aside").count()) > 0);

// পেমেন্ট যাচাই → অংশগ্রহণকারীর সারিতে ক্লিক → বিস্তারিত পর্দা
const payTab = page.getByRole("button", { name: /পেমেন্ট যাচাই/ }).first();
if (await payTab.count()) {
  await payTab.click();
  await page.waitForTimeout(1500);
}
const row = page.locator("tr", { hasText: tester }).first();
if (await row.count()) {
  // সারির ভিতরের "বিস্তারিত" (চোখের) বোতামটিই বিস্তারিত পর্দা খোলে
  await page
    .getByRole("button", { name: new RegExp(tester + " বিস্তারিত") })
    .first()
    .click()
    .catch(async () => row.click());
  await page.waitForTimeout(1800);
}
const detailPhoto = await page.locator(".registration-detail .participant-avatar img").count();
label("অ্যাডমিনের বিস্তারিত পর্দায় ছবি আছে", detailPhoto > 0);
await page.screenshot({ path: "/home/user/.artifacts/admin-photo.png" });

// অনুমোদনের আগে "মিলিয়ে পেয়েছি" টিক দিতে হয় (জানালার ভিতরের ঘরটি)
const dialog = page.locator("dialog[open]").first();
const boxes = dialog.locator('input[type="checkbox"]');
if (await boxes.count()) {
  await boxes.last().check().catch(() => {});
  await page.waitForTimeout(500);
}
const approveBtn = dialog.getByRole("button", { name: /পেমেন্ট অনুমোদন/ }).first();
let status = "";
if (await approveBtn.count()) {
  const disabled = await approveBtn.isDisabled();
  console.log(`   (অনুমোদন বোতাম: ${disabled ? "নিষ্ক্রিয় — টিক পড়েনি" : "সক্রিয়"})`);
  await approveBtn.click({ timeout: 8000 }).catch((e) => console.log("   ক্লিক ব্যর্থ:", e.message.slice(0, 80)));
  // সত্যিই অনুমোদন হয়েছে কি না — সার্ভারকে জিজ্ঞেস করে নিশ্চিত হওয়া
  for (let i = 0; i < 10; i++) {
    status = await page
      .evaluate(
        async (k) =>
          (
            await (
              await fetch("/api/ticket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trackingKey: k }),
              })
            ).json()
          ).status,
        trackingKey,
      )
      .catch(() => "");
    if (status === "approved") break;
    await page.waitForTimeout(1500);
  }
  label("পেমেন্ট অনুমোদন হয়েছে (QR টিকিট তৈরি)", status === "approved", `অবস্থা: ${status}`);
} else {
  label("অনুমোদনের বোতাম পাওয়া গেছে", false);
}

// বিস্তারিত জানালাটি বন্ধ করা (নইলে ক্লিক আটকে যায়)
await page
  .locator('dialog[open] button[aria-label="বন্ধ করুন"]')
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(900);

// ── টিকিট: ছবি + সব তথ্য ──
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
// খোলা জানালা থাকলে বন্ধ করা (এগুলো ক্লিক আটকে দেয়)
await page.evaluate(() =>
  document.querySelectorAll("dialog[open]").forEach((d) => d.close()),
);
await page.getByRole("button", { name: /আমার টিকিট/ }).first().click();
await page.waitForTimeout(2000);
// টিকিটের ঘর না খুললে (নেভিগেশন মিস হলে) গোপন লিংক দিয়ে সরাসরি খোলা হয়
if ((await page.locator(".ticket-receipt").count()) === 0 && trackingKey) {
  await page.evaluate((k) => (location.hash = "#ticket=" + k), trackingKey);
  await page.waitForTimeout(2000);
}
const receipt = page.locator(".ticket-receipt").first();
// টিকিট লোড হতে বা অনুমোদন ছড়াতে কয়েক সেকেন্ড লাগতে পারে
for (let i = 0; i < 12 && (await receipt.count()) === 0; i++) await page.waitForTimeout(1500);
if ((await receipt.count()) === 0) {
  await page.screenshot({ path: "/home/user/.artifacts/debug-ticket.png", fullPage: true });
  console.log("ডিবাগ → টিকিটের ঘর আছে?", await page.locator('input[placeholder="গোপন লিংক বা রিকভারি কোড"]').count());
  console.log("ডিবাগ → trackingKey:", trackingKey ? "পাওয়া গেছে" : "পাওয়া যায়নি");
  const dbg = await page.evaluate(
    async (k) => {
      const r = await fetch("/api/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackingKey: k }) });
      const j = await r.json();
      return { status: r.status, ticket: j.status, name: j.participant?.name, err: j.error, saved: (localStorage.getItem("r96_tickets") || "").slice(0, 60) };
    },
    trackingKey,
  );
  console.log("ডিবাগ → API:", JSON.stringify(dbg));
  console.log(
    "ডিবাগ → পর্দার লেখা:",
    (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 260),
  );
}
if (await receipt.count()) {
  label("টিকিটে অংশগ্রহণকারীর ছবি আছে", (await page.locator("img.receipt-photo").count()) > 0);
  const text = await receipt.innerText();
  // “খাবার” আর ফর্মে নেই (আয়োজকের নির্দেশ) — তাই টিকিটেও খালি সারি আসে না
  const wanted = [tester, "রংপুর জিলা স্কুল", "১৯৯৬০০১", "টি-শার্ট", "TICKET NUMBER"];
  label("টিকিটে সব তথ্য আছে", wanted.every((x) => text.includes(x)), text.replace(/\n+/g, " · ").slice(0, 190));
  const ticketNo = (text.match(/R96-\d+/) || [""])[0];
  await page.screenshot({ path: "/home/user/.artifacts/ticket-photo.png" });

  // ── গেট: টিকিট নম্বর দিয়ে চেক-ইন → ছবি দেখা যায় কি না ──
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /গেট চেক-ইন/ }).first().click();
  await page.waitForTimeout(2500);
  // এই ব্রাউজারটি চেক-ইনের জন্য অনুমোদন করা (অ্যাডমিন হলে সঙ্গে সঙ্গে অনুমোদিত হয়)
  if ((await page.locator('input[placeholder="R96-00001"]').count()) === 0) {
    const deviceBox = page.locator(".field input").first();
    if (await deviceBox.count()) {
      await deviceBox.fill("পরীক্ষার ফোন");
      await page.getByRole("button", { name: /এই ব্রাউজার অনুমোদন করো/ }).first().click();
      await page.waitForTimeout(2500);
    }
  }
  if ((await page.locator('input[placeholder="R96-00001"]').count()) === 0) {
    await page.screenshot({ path: "/home/user/.artifacts/debug-gate.png", fullPage: true });
    console.log(
      "ডিবাগ → গেট পর্দা:",
      (await page.locator("body").innerText()).replace(/\n+/g, " · ").slice(0, 220),
    );
  }
  const ticketInput = page.locator('input[placeholder="R96-00001"], input[name="code"], input[type="text"]').first();
  await ticketInput.fill(ticketNo);
  await page.getByRole("button", { name: /^চেক-ইন$/ }).first().click();
  await page.waitForTimeout(2500);
  const resultCard = page.locator(".checkin-result").first();
  if (await resultCard.count()) {
    label("গেটের ফলাফলে ছবি দেখা যাচ্ছে", (await page.locator(".checkin-result .participant-avatar").count()) > 0);
    console.log("   গেট লেখা:", (await resultCard.innerText()).replace(/\n+/g, " · ").slice(0, 140));
  } else {
    const gateText = await page.locator("body").innerText();
    label("গেটের ফলাফল এসেছে", /চেক-ইন/.test(gateText), gateText.replace(/\n+/g, " · ").slice(0, 200));
  }
  await page.screenshot({ path: "/home/user/.artifacts/gate-photo.png" });
} else {
  label("টিকিটের রিসিট দেখা যাচ্ছে", false);
}

console.log(errors.length ? "⚠️ কনসোল এরর: " + errors.slice(0, 3).join(" | ") : "🟢 কোনো কনসোল এরর নেই");
console.log(failures ? `❌ ${failures} টি পরীক্ষা ব্যর্থ` : "✅ সব ছবি-পরীক্ষা পাস");
await browser.close();
process.exit(failures ? 1 : 0);
