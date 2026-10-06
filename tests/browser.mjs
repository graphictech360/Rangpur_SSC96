// Requires a running DEMO server. Run: npm run dev; node tests/browser.mjs
// Uses synthetic data only; archives its test registration afterward.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir(".artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1360, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const response = await page.request.get(base + "/api/site");
const site = await response.json();
assert.equal(
  site.mode,
  "demo",
  "Browser tests must never run against a real festival database.",
);
try {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    1360,
  );
  await page.screenshot({ path: ".artifacts/desktop.png" });
  const navReg = page.locator('nav.main-nav a[href="#registration"]');
  await (await navReg.count() ? navReg.first() : page.getByRole("button", { name: "নিবন্ধন", exact: true })).click();
  await page.waitForTimeout(900);
  await page.locator('input[type="file"]').setInputFiles(new URL("fixtures/photo-800x600.png", import.meta.url).pathname);
  await page.waitForTimeout(900);
  await page.locator("#reg-name").fill("পরীক্ষার বন্ধু");
  await page.locator("#reg-school").fill("রংপুর জিলা স্কুল");
  await page.locator("#reg-sscRoll").fill("961234");
  const mobile = "0179" + String(Date.now() % 10000000).padStart(7, "0");
  await page.locator("#reg-mobile").fill(mobile);
  await page.locator("#reg-location").fill("ঢাকা");
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
  await page.locator("[name=transactionId]").fill("UITEST" + Date.now());
  await page.getByRole("checkbox", { name: /প্রদত্ত তথ্য সঠিক/ }).check();
  const registeredResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/registrations") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /নিবন্ধন জমা দাও/ }).click();
  const registered = await (await registeredResponse).json();
  assert.equal(registered.registration.status, "pending");
  assert.equal(registered.registration.total, 2399);
  await page.locator(".success-card").waitFor();
  await page.getByRole("button", { name: "আমার স্ট্যাটাস ও টিকিট" }).click();
  await page.locator(".pending-ticket").waitFor();
  assert.equal(await page.locator(".receipt-qr svg").count(), 0);
  const blocked = await page.request.post(base + "/api/checkin", {
    data: { input: registered.registration.ticketNumber },
  });
  assert.equal(blocked.status(), 401);
  const adminContext = await browser.newContext({
    viewport: { width: 1360, height: 1000 },
  });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(base + "/admin", { waitUntil: "networkidle" });
  await admin
    .getByRole("button", { name: "ডেমো অ্যাডমিন হিসেবে দেখো" })
    .click();
  await admin.locator(".admin-stats").waitFor();
  await admin.screenshot({ path: ".artifacts/admin.png" });
  await admin.getByRole("button", { name: /^পেমেন্ট যাচাই/ }).click();
  await admin
    .locator("tr")
    .filter({ hasText: registered.registration.ticketNumber })
    .getByRole("button", { name: "পরীক্ষার বন্ধু বিস্তারিত", exact: true })
    .click();
  await admin.getByRole("checkbox", { name: /নিজের বিকাশ\/নগদের/ }).check();
  await admin
    .getByRole("button", { name: "পেমেন্ট অনুমোদন ও QR তৈরি" })
    .click();
  await admin.locator(".detail-payment .notice-success").waitFor();
  await page
    .getByRole("button", { name: "স্ট্যাটাস আপডেট", exact: true })
    .click();
  await page.locator(".receipt-qr svg").waitFor();
  const qr = await page.locator(".receipt-qr svg").screenshot();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "টিকিট ডাউনলোড", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs(".artifacts/digital-ticket.png");
  await page.screenshot({ path: ".artifacts/ticket-dialog.png" });
  const staffContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const staff = await staffContext.newPage();
  staff.on("pageerror", (e) => errors.push(e.message));
  await staff.goto(base + "/check-in", { waitUntil: "networkidle" });
  await staff
    .getByRole("button", { name: "ডেমো গেট স্টাফ হিসেবে দেখো" })
    .click();
  await staff.locator(".device-enrollment").waitFor();
  await staff.getByRole("button", { name: "অনুমোদনের অনুরোধ পাঠাও" }).click();
  await staff
    .getByText("অ্যাডমিন অনুমোদনের অপেক্ষায়", { exact: true })
    .waitFor();
  const device = await (
    await staff.request.get(base + "/api/staff/device")
  ).json();
  assert.equal(device.status, "pending");
  const blockedStaff = await staff.request.post(base + "/api/checkin", {
    data: { input: registered.registration.ticketNumber },
  });
  assert.equal(blockedStaff.status(), 403);
  const grant = await admin.request.post(base + "/api/admin/mutate", {
    data: {
      action: "device.update",
      payload: { id: device.id, status: "approved" },
    },
  });
  assert.equal(grant.status(), 200);
  await staff.getByRole("button", { name: "অনুমতি আবার যাচাই করো" }).click();
  await staff.locator(".approved-device").waitFor();
  await staff
    .locator("input[type=file]")
    .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: qr });
  await staff.locator(".checkin-result").waitFor({ timeout: 20000 });
  assert.match(
    await staff.locator(".checkin-result").innerText(),
    /চেক-ইন সম্পন্ন/,
  );
  assert.match(await staff.locator(".checkin-result").innerText(), /৪ জন/);
  await staff.screenshot({
    path: ".artifacts/check-in-mobile.png",
    fullPage: true,
  });
  await staff
    .getByLabel("টিকিট নম্বর", { exact: true })
    .fill(registered.registration.ticketNumber);
  await staff.getByRole("button", { name: "চেক-ইন", exact: true }).click();
  await staff.locator(".checkin-result.duplicate").waitFor();
  await admin.request.post(base + "/api/admin/mutate", {
    data: {
      action: "registration.remove",
      payload: { id: registered.registration.id },
    },
  });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(base + "/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1300);
  assert.equal(
    await mobilePage.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await mobilePage.screenshot({ path: ".artifacts/mobile.png" });
  await mobilePage.locator("#registration").scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({
    path: ".artifacts/mobile-form.png",
    fullPage: false,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile layouts, family fees, Nagad payment data, pending→approval→QR, ticket PNG download, unauthorized scan denial, device approval, image-based QR check-in, duplicate prevention, soft removal. No browser errors.",
  );
} finally {
  await browser.close();
}
