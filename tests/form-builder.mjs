// ফর্ম-নির্মাণ ও মোবাইল-খাপ পরীক্ষা (লোকাল ডেমো সার্ভারে):
//   ০) মূল ঘরগুলোও এডিট/লুকানো/টেনে সাজানো যায় (টি-শার্টের ঘরসহ)
//   ০খ) ফর্মের লেখা ও হেডারের মেনু/লোগো অ্যাডমিন থেকে বদলানো যায়
//   ১) অ্যাডমিন প্যানেলের “নিবন্ধন ফর্ম” ট্যাবে নতুন ঘর যোগ/লুকানো/মুছে ফেলা যায়
//   ২) যোগ করা ঘর সঙ্গে সঙ্গে পাবলিক ফর্মে দেখা যায়, লুকালে চলে যায়
//   ৩) নিবন্ধন ফর্মে কোনো ঘর পাশাপাশি নয় — সব উপর-নিচে (মোবাইল ও ডেস্কটপ দুটোতেই)
//   ৪) মোবাইলে কোনো অংশ ডানে-বাঁয়ে বাইরে বেরোয় না (horizontal overflow নেই)
//   ৫) বাধ্যতামূলক ঘর ফাঁকা থাকলে ফর্ম জমা নেয় না
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3312";
assert.ok(
  BASE.includes("127.0.0.1") || BASE.includes("localhost"),
  "এই পরীক্ষা কখনো আসল সাইটে চালানো যাবে না।",
);

let pass = 0;
let fail = 0;
const ok = (t, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch();
try {
  /* ── ক. অ্যাডমিন: নতুন ঘর যোগ ───────────────────────────────── */
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await admin.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await page.getByLabel(/ইমেইল/).fill("admin@ssc96.demo");
  await page.getByLabel(/পাসওয়ার্ড/).fill("Festival96!");
  await page.getByRole("button", { name: /লগইন|প্রবেশ/ }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "নিবন্ধন ফর্ম" }).first().click();
  await page.waitForTimeout(700);
  ok("অ্যাডমিন প্যানেলে “নিবন্ধন ফর্ম” ট্যাব খোলে", await page.locator(".admin-section-toolbar").isVisible());

  /* ── ০. মূল ঘর: ব্যাজ, লুকানো ও টেনে সাজানো ────────────────── */
  const baseCards = await page.locator(".form-field-card").count();
  ok("ফর্মের সব ঘর (মূল ঘরসহ) প্যানেলে দেখা যায়", baseCards >= 9, `${baseCards} টি কার্ড`);
  ok(
    "মূল ঘরের কার্ডে “মূল ঘর” ব্যাজ আছে",
    (await page.locator(".form-field-card .base-badge").count()) >= 8,
  );
  const tshirtCard = page
    .locator(".form-field-card")
    .filter({ hasText: "টি-শার্টের সাইজ" })
    .first();
  ok("টি-শার্টের সাইজের ঘর নিজেও একটি কার্ড", await tshirtCard.isVisible());
  const lockedName = page
    .locator(".form-field-card")
    .filter({ hasText: "নাম" })
    .first();
  ok(
    "নামের ঘর সুরক্ষিত — লুকানোর বোতাম নেই",
    (await lockedName.locator(".lock-badge").count()) === 1 &&
      (await lockedName.getByRole("button", { name: /লুকাও/ }).count()) === 0,
  );

  // টি-শার্টের ঘর লুকিয়ে দেওয়া (কিছু আয়োজনে টি-শার্ট লাগে না)
  await tshirtCard.getByRole("button", { name: /লুকাও/ }).click();
  await page.waitForTimeout(1200);
  const tshirtHiddenCard = page
    .locator(".form-field-card")
    .filter({ hasText: "টি-শার্টের সাইজ" })
    .first();
  ok(
    "টি-শার্টের ঘর লুকানো হলো (কার্ডে “লুকানো” ব্যাজ)",
    (await tshirtHiddenCard.locator(".hidden-badge").count()) === 1,
  );

  // টেনে সাজানো: দ্বিতীয় কার্ডের জায়গায় প্রথম কার্ড
  const before = await page
    .locator(".form-step-group")
    .first()
    .locator(".form-field-card h3")
    .allInnerTexts();
  await page
    .locator(".form-field-card")
    .nth(0)
    .dispatchEvent("dragstart", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await page
    .locator(".form-field-card")
    .nth(1)
    .dispatchEvent("dragover", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await page
    .locator(".form-field-card")
    .nth(1)
    .dispatchEvent("drop", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await page.waitForTimeout(1400);
  const after = await page
    .locator(".form-step-group")
    .first()
    .locator(".form-field-card h3")
    .allInnerTexts();
  ok(
    "কার্ড টেনে (drag) জায়গা বদলানো যায়",
    before[0] !== after[0] || before[1] !== after[1],
    `${before.slice(0, 2).join(" | ")} → ${after.slice(0, 2).join(" | ")}`,
  );

  await page.getByRole("button", { name: /ঘর যোগ করুন/ }).click();
  await page.waitForTimeout(400);
  const stamp = String(Date.now() % 100000);
  const label = `রক্তের গ্রুপ ${stamp}`;
  const dialog = page.locator(".entity-editor");
  await dialog.getByLabel(/ঘরের নাম/).first().fill(label);
  await dialog.getByLabel(/কী \(ইংরেজি/).first().fill(`blood_${stamp}`);
  await dialog.getByLabel(/ঘরের ধরন/).first().selectOption("select");
  await dialog.getByLabel(/বিকল্পগুলো/).first().fill("A+, B+, O+");
  await dialog.getByRole("checkbox", { name: /বাধ্যতামূলক/ }).first().check();
  await dialog.getByRole("button", { name: /সেভ|সংরক্ষণ|যোগ/ }).first().click();
  await page.waitForTimeout(1500);
  ok(
    "নতুন ঘর প্যানেলে দেখা যাচ্ছে",
    await page.getByText(label).first().isVisible(),
  );
  /* ── ০খ. ফর্মের লেখা ও হেডারের মেনু/লোগো ───────────────────── */
  const titleInput = page
    .locator(".form-texts-card .field")
    .filter({ hasText: "কার্ডের শিরোনাম" })
    .locator("input");
  await titleInput.fill("তোমার আসনটি তৈরি!");
  await page
    .locator(".form-texts-card .field")
    .filter({ hasText: "কার্ডের শিরোনাম" })
    .getByRole("button", { name: /সেভ/ })
    .click();
  await page.waitForTimeout(1200);
  ok("ফর্মের লেখা (কার্ডের শিরোনাম) বদলে সেভ করা যায়", true);

  await page.getByRole("button", { name: "হেডার ও মেনু" }).first().click();
  await page.waitForTimeout(700);
  ok(
    "হেডার ট্যাবে লোগো আপলোড বোতাম আছে",
    await page.getByText(/নতুন লোগো আপলোড করুন/).isVisible(),
  );
  ok(
    "হেডারে এখনকার পাঁচটি মেনু আইটেম দেখা যায়",
    (await page.locator(".nav-item-row").count()) === 5,
    `${await page.locator(".nav-item-row").count()} টি`,
  );
  await page.locator(".nav-add-row select").selectOption("link");
  await page.waitForTimeout(200);
  await page.locator(".nav-add-row input").first().fill("ফেসবুক গ্রুপ");
  await page.locator(".nav-add-row input").nth(1).fill("https://facebook.com/groups/ssc96");
  await page.getByRole("button", { name: /যোগ করুন/ }).click();
  await page.waitForTimeout(1200);
  ok(
    "মেনুতে নতুন লিংক যোগ করা গেল",
    (await page.locator(".nav-item-row").count()) === 6,
  );
  await admin.close();

  /* ── খ. পাবলিক ফর্মে ঘরটি এসেছে কি না ───────────────────────── */
  const pub = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const form = await pub.newPage();
  await form.goto(BASE + "/", { waitUntil: "networkidle" });
  await form.locator('nav.main-nav a[href="#registration"]').first().click();
  await form.waitForTimeout(900);
  // প্রথম ধাপের বাধ্যতামূলক ঘর পূরণ না করলে ফর্ম এগোয় না — তাই পূরণ করে নিই
  await form
    .locator('input[type="file"]')
    .setInputFiles(new URL("fixtures/photo-800x600.png", import.meta.url).pathname);
  await form.waitForTimeout(800);
  await form.locator("#reg-name").fill("ফর্ম ঘর পরীক্ষা");
  await form.locator("#reg-school").fill("রংপুর জিলা স্কুল");
  await form.locator("#reg-sscRoll").fill("96555");
  // মোবাইল ঠিক ১১ অঙ্ক হতে হবে (০১ + ৯), নইলে ফর্ম এগোয় না
  await form.locator("#reg-mobile").fill("0171" + String(Date.now() % 10000000).padStart(7, "0"));
  await form.locator("#reg-location").fill("ঢাকা");
  await form.getByRole("button", { name: "পরের ধাপ", exact: true }).click();
  await form.waitForTimeout(900);
  ok(
    "অ্যাডমিনের যোগ করা ঘর পাবলিক ফর্মে এসেছে",
    await form.locator(".registration-card").getByText(label).first().isVisible(),
  );
  ok(
    "হেডারে অ্যাডমিনের যোগ করা লিংকটি এসেছে",
    (await form.locator('nav.main-nav a[href="https://facebook.com/groups/ssc96"]').count()) === 1,
  );
  ok(
    "কার্ডের নতুন শিরোনাম পাবলিক ফর্মে দেখা যায়",
    await form.locator(".registration-card").getByText("তোমার আসনটি তৈরি!").first().isVisible(),
  );
  ok(
    "লুকানো টি-শার্টের ঘর আর ফর্মে নেই",
    (await form.locator(".registration-card .tshirt-field").count()) === 0,
  );
  ok(
    "খাবারের পছন্দ ও বিশেষ অনুরোধ আর ফর্মে নেই (আয়োজকের নির্দেশ)",
    (await form.locator(".registration-card").getByText("খাবারের পছন্দ").count()) === 0 &&
      (await form.locator(".registration-card").getByText("বিশেষ অনুরোধ").count()) === 0,
  );
  ok(
    "বাধ্যতামূলক ঘরে “*” চিহ্ন আছে",
    (await form.locator(".registration-card .dynamic-field .dynamic-field-label em").count()) > 0,
  );

  /* ── গ. সব ঘর উপর-নিচে কি না (ডেস্কটপে) ─────────────────────── */
  const stackCheck = async (p, label) => {
    const boxes = await p.locator(".registration-card .field").evaluateAll((nodes) =>
      nodes
        .map((n) => {
          const r = n.getBoundingClientRect();
          return {
            x: Math.round(r.x),
            w: Math.round(r.width),
            y: Math.round(r.y),
            visible: r.width > 0 && r.height > 0,
          };
        })
        .filter((b) => b.visible),
    );
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const sideBySide = Math.abs(a.y - b.y) < 12 && !(a.x + a.w <= b.x + 2 || b.x + b.w <= a.x + 2);
        if (sideBySide) overlaps.push(`${a.y}/${a.x}+${a.w} vs ${b.y}/${b.x}+${b.w}`);
      }
    ok(`${label}: কোনো ঘর পাশাপাশি নেই`, overlaps.length === 0, overlaps.slice(0, 2).join(" · "));
  };
  await stackCheck(form, "ডেস্কটপ");

  /* ── ঘ. মোবাইলে খাপ খাওয়া ─────────────────────────────────── */
  const mob = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mp = await mob.newPage();
  const mobErrors = [];
  mp.on("pageerror", (e) => mobErrors.push(String(e)));
  await mp.goto(BASE + "/", { waitUntil: "networkidle" });
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: ".artifacts/mobile-home.png", fullPage: false });

  const overflow = () =>
    mp.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      wide: [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
        .slice(0, 4)
        .map((el) => `${el.tagName}.${(el.className || "").toString().split(" ")[0]}`),
    }));
  const home = await overflow();
  ok(
    "মোবাইলে হোমপেজ ডানে-বাঁয়ে বাইরে যায় না",
    home.scrollW <= home.clientW + 2,
    `${home.scrollW} / ${home.clientW} ${home.wide.join(",")}`,
  );

  // মোবাইলে মেনু হ্যামবার্গার বোতামের ভিতরে থাকে
  const burger = mp.getByRole("button", { name: "মেনু খুলুন" });
  if (await burger.count()) {
    await burger.first().click();
    await mp.waitForTimeout(400);
  }
  await mp.locator('nav.main-nav a[href="#registration"]').first().click();
  await mp.waitForTimeout(900);
  await mp.screenshot({ path: ".artifacts/mobile-form-step1.png", fullPage: false });
  const formOverflow = await overflow();
  ok(
    "মোবাইলে নিবন্ধন ফর্মও স্ক্রিনের ভিতরে থাকে",
    formOverflow.scrollW <= formOverflow.clientW + 2,
    `${formOverflow.scrollW} / ${formOverflow.clientW} ${formOverflow.wide.join(",")}`,
  );
  await stackCheck(mp, "মোবাইল");
  await mp.getByRole("button", { name: "পরের ধাপ", exact: true }).click();
  await mp.waitForTimeout(700);
  const step2 = await overflow();
  ok(
    "মোবাইলে দ্বিতীয় ধাপও খাপ খায়",
    step2.scrollW <= step2.clientW + 2,
    `${step2.scrollW} / ${step2.clientW}`,
  );
  await mp.screenshot({ path: ".artifacts/mobile-form-step2.png", fullPage: false });

  // বাধ্যতামূলক ঘর ফাঁকা থাকলে জমা নেয় না
  const badSubmit = await mp.getByRole("button", { name: /নিবন্ধন জমা দাও/ }).count();
  if (badSubmit) {
    await mp.getByRole("button", { name: /নিবন্ধন জমা দাও/ }).click();
    await mp.waitForTimeout(700);
    ok(
      "বাধ্যতামূলক ঘর ফাঁকা থাকলে জমা হয় না",
      (await mp.locator(".dynamic-field").count()) > 0,
    );
  }
  await mob.close();

  ok("ব্রাউজারে কোনো এরর নেই", errors.length === 0 && mobErrors.length === 0,
     [...errors, ...mobErrors].slice(0, 2).join(" · "));
  await pub.close();

  console.log(`\n═══ ফর্ম-নির্মাণ ও মোবাইল খাপ: ${pass} পাস, ${fail} ব্যর্থ ═══\n`);
} catch (e) {
  console.error("পরীক্ষা ব্যর্থ:", e);
  fail++;
} finally {
  await browser.close();
}
process.exit(fail ? 1 : 0);
