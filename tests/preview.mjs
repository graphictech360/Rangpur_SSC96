// একক ফাইল অফলাইন প্রিভিউ (`Rangpur-SSC96-Preview.html`) যাচাই করে।
// ব্যবহার: node scripts/build-preview.mjs && node tests/preview.mjs
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

await mkdir(".artifacts", { recursive: true });
const file =
  process.env.PREVIEW_FILE || "/home/user/Rangpur-SSC96-Preview.html";
const browser = await chromium.launch({ headless: true });
const errors = [];
const external = [];
const context = await browser.newContext({
  viewport: { width: 1360, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (!r.url().startsWith("file://") && !r.url().startsWith("data:"))
    external.push(r.url());
});
const api = (call) => page.evaluate(call);

try {
  await page.goto("file://" + file, { waitUntil: "load" });
  await page.waitForTimeout(1600);

  // ছবি, ফন্ট, লেখা — সব ভেতরে বসে গেছে কি না
  assert.match(await page.title(), /Rangpur SSC 96/);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  // ব্যানার কোলাজের ছবিগুলো সত্যিই ডিকোড হয়েছে কি না (শুধু "complete" নয়)
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll(".collage img")];
      return imgs.length > 0 && imgs.every((i) => i.naturalWidth > 0);
    },
    null,
    { timeout: 20000 },
  );
  assert.equal(
    await page.evaluate(
      () =>
        [...document.querySelectorAll("img")].filter(
          (i) => i.complete && i.naturalWidth === 0,
        ).length,
    ),
    0,
    "ভাঙা ছবি নেই",
  );
  const collageImgs = await page.evaluate(
    () => document.querySelectorAll(".collage-slide").length,
  );
  assert.equal(collageImgs, 2, "ব্যানার কোলাজে দুইটি ছবি আছে");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    1360,
  );
  await page.screenshot({
    path: ".artifacts/preview-desktop.png",
    fullPage: false,
  });

  const site = await api(() => fetch("/api/site").then((r) => r.json()));
  assert.equal(site.mode, "demo");
  assert.equal(site.sections.length, 13);
  assert.equal(site.schedule.length, 14);

  // ফর্ম → pending
  await page.getByRole("button", { name: "নিবন্ধন", exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator("#reg-name").fill("অফলাইন প্রিভিউ বন্ধু");
  await page.locator("#reg-school").fill("রংপুর জিলা স্কুল");
  await page.locator("#reg-sscRoll").fill("961111");
  await page.locator("#reg-mobile").fill("01715550111");
  await page.locator("#reg-location").fill("রংপুর");
  await page.getByRole("button", { name: "পরের ধাপ", exact: true }).click();
  await page.getByRole("switch", { name: "জীবনসঙ্গী আসবেন" }).click();
  await page.getByRole("button", { name: "শিশুর সংখ্যা বাড়াও" }).click();
  await page.getByRole("button", { name: "শিশুর সংখ্যা বাড়াও" }).click();
  assert.match(await page.locator(".form-fee-summary").innerText(), /২,৩৯৯/);
  await page.getByRole("button", { name: "পরের ধাপ", exact: true }).click();
  await page.getByRole("button", { name: /Nagad নগদ/ }).click();
  const arif = site.accounts.find(
    (a) => a.provider === "nagad" && a.name === "Arif",
  );
  await page.getByLabel("পেমেন্ট গ্রহণকারী").selectOption(arif.id);
  await page.locator("[name=transactionId]").fill("PREVIEW" + Date.now());
  await page.getByRole("checkbox", { name: /প্রদত্ত তথ্য সঠিক/ }).check();
  await page
    .getByRole("button", { name: "কাল্পনিক পেমেন্ট তথ্য বসাও" })
    .click();
  await page.getByRole("button", { name: /নিবন্ধন জমা দাও/ }).click();
  await page.locator(".success-card").waitFor();

  // অনুমোদনের আগে QR নেই
  await page.getByRole("button", { name: "আমার স্ট্যাটাস ও টিকিট" }).click();
  await page.locator(".ticket-panel").waitFor();
  assert.equal(await page.locator(".receipt-qr svg").count(), 0);
  assert.match(
    await page.locator(".ticket-panel").innerText(),
    /যাচাই|অপেক্ষা/,
  );
  await page.screenshot({ path: ".artifacts/preview-pending.png" });

  // অ্যাডমিন: ডেমো লগইন ও পেমেন্ট অনুমোদন
  const admin = await context.newPage();
  admin.on("pageerror", (e) => errors.push("admin: " + e.message));
  await admin.goto("file://" + file, { waitUntil: "load" });
  await admin.waitForTimeout(900);
  await admin
    .getByRole("button", { name: /আয়োজক প্যানেল/ })
    .first()
    .click();
  await admin
    .getByRole("button", { name: "ডেমো অ্যাডমিন হিসেবে দেখো" })
    .click();
  await admin.getByRole("button", { name: /^পেমেন্ট যাচাই/ }).click();
  await admin
    .getByRole("button", {
      name: "অফলাইন প্রিভিউ বন্ধু বিস্তারিত",
      exact: true,
    })
    .click();
  await admin.getByRole("checkbox", { name: /নিজের বিকাশ\/নগদের/ }).check();
  await admin
    .getByRole("button", { name: "পেমেন্ট অনুমোদন ও QR তৈরি" })
    .click();
  await admin.locator(".detail-payment .notice-success").waitFor();
  await admin.waitForTimeout(600);
  await admin.screenshot({ path: ".artifacts/preview-admin.png" });

  // QR এখন টিকিটে দেখা যাবে
  await page.bringToFront();
  await page
    .getByRole("button", { name: "স্ট্যাটাস আপডেট", exact: true })
    .click();
  await page.locator(".receipt-qr svg").first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: ".artifacts/preview-ticket.png" });

  // মোবাইল মাপে লেখা/ছবি বাইরে বেরিয়ে যায় কি না
  const mobile = await context.newPage();
  mobile.on("pageerror", (e) => errors.push("mobile: " + e.message));
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto("file://" + file, { waitUntil: "load" });
  await mobile.waitForTimeout(1400);
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "মোবাইলে অনুভূমিক স্ক্রল নেই",
  );
  await mobile.screenshot({ path: ".artifacts/preview-mobile.png" });

  assert.deepEqual(errors, [], "ব্রাউজার কনসোল/স্ক্রিপ্ট ত্রুটি নেই");
  assert.deepEqual(
    external,
    [],
    "কোনো বাইরের নেটওয়ার্ক অনুরোধ নেই (সম্পূর্ণ অফলাইন)",
  );
  console.log("✅ অফলাইন প্রিভিউ: ফর্ম → pending → অনুমোদন → QR — সব ঠিক আছে।");
} finally {
  await browser.close();
}
