// লাইভ সাইটে (Vercel) আসল ব্রাউজারে যাচাই — ব্যবহারকারী ঠিক যা করেন:
//   নেভ-এর “নিবন্ধন” চাপলে নিবন্ধনের ফর্ম আসে কি না, আর টিকিটের লিংক/কোড
//   কোথায় পাবে তা দেখানো হয় কি না। কিছুই লেখা/জমা হয় না (শুধু পড়া)।
//
//   node tests/live-site.mjs
import { chromium } from "playwright";
const SITE = process.env.SITE_URL || "https://rangpur-ssc96.vercel.app";

let pass = 0;
let fail = 0;
const ok = (t, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// ১) হেডারে “নিবন্ধন” আসল লিংক
const navLink = page.locator('nav.main-nav a[href="#registration"]');
ok("হেডারে “নিবন্ধন” লিংক আছে", (await navLink.count()) === 1);

// ২) ক্লিক করলে নিবন্ধন সেকশন ও ফর্ম আসে
await navLink.first().click();
await page.waitForTimeout(1300);
ok("ক্লিকে পেজ নিচে গেল", (await page.evaluate(() => window.scrollY)) > 400);
ok(
  "নিবন্ধন ফর্ম দেখা যাচ্ছে",
  await page.locator(".registration-card").first().isVisible(),
);
const formText = await page.locator(".registration-card").first().innerText();
ok("ফর্মে তিনটি ধাপ আছে", /পরিচয়/.test(formText) && /পরিবার/.test(formText) && /পেমেন্ট/.test(formText));
ok("ফর্মে ছবি বাধ্যতামূলক পিক আছে", (await page.locator('.registration-card input[type="file"]').count()) >= 1);

// ৩) হিরোর বোতামটাও লিংক
ok(
  "হিরোতে “নিবন্ধন করি” লিংক আছে",
  (await page.locator('.hero-buttons a[href="#registration"]').count()) === 1,
);

// ৪) “আমার টিকিট”: কোথায় পাবে (৩ ধাপ) + গোপনীয়তার বার্তা
await page.getByRole("button", { name: /আমার টিকিট/ }).click();
await page.locator(".ticket-find-steps").waitFor({ timeout: 8000 });
ok(
  "টিকিট প্যানেলে “কোথায় পাব” ৩ ধাপ আছে",
  /রিকভারি কোড/.test(await page.locator(".ticket-find-steps").innerText()),
);
ok(
  "গোপনীয়তার বার্তা আছে (অন্য কারও তথ্য দেখা যায় না)",
  /শুধুই একজন|অন্য কারও/.test(await page.locator(".ticket-privacy-note").innerText()),
);
await page.locator('dialog[open] button[aria-label="বন্ধ করুন"]').first().click();

ok("ব্রাউজারে কোনো এরর নেই", errs.length === 0, errs.slice(0, 2).join(" | "));
await page.close();

// ৫) মোবাইলে খাপ খায় কি না (৩৯০×৮৪৪): নেভিগেশন, ফর্মের ঘর উপর-নিচে, ডানে-বাঁয়ে বাইরে নয়
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const mp = await mob.newPage();
const mobErrs = [];
mp.on("pageerror", (e) => mobErrs.push(String(e)));
await mp.goto(SITE, { waitUntil: "networkidle" });
await mp.waitForTimeout(1200);
const overflow = () =>
  mp.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
const home = await overflow();
ok(
  "মোবাইলে হোমপেজ স্ক্রিনের বাইরে যায় না",
  home.scrollW <= home.clientW + 2,
  `${home.scrollW}/${home.clientW}`,
);
const burger = mp.getByRole("button", { name: "মেনু খুলুন" });
ok("মোবাইলে মেনু বোতাম (হ্যামবার্গার) আছে", (await burger.count()) === 1);
if (await burger.count()) {
  await burger.first().click();
  await mp.waitForTimeout(400);
}
const mobNavLink = mp.locator('nav.main-nav a[href="#registration"]');
ok("মোবাইল মেনুতে নিবন্ধন লিংক খোলে", await mobNavLink.first().isVisible());
await mobNavLink.first().click();
await mp.waitForTimeout(1200);
ok(
  "মোবাইলে নিবন্ধন ফর্ম দেখা যাচ্ছে",
  await mp.locator(".registration-card").first().isVisible(),
);
const boxes = await mp
  .locator(".registration-card .field")
  .evaluateAll((nodes) =>
    nodes
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { x: Math.round(r.x), w: Math.round(r.width), y: Math.round(r.y) };
      })
      .filter((b) => b.w > 0),
  );
let sideBySide = 0;
for (let i = 0; i < boxes.length; i++)
  for (let j = i + 1; j < boxes.length; j++)
    if (
      Math.abs(boxes[i].y - boxes[j].y) < 12 &&
      !(boxes[i].x + boxes[i].w <= boxes[j].x + 2 || boxes[j].x + boxes[j].w <= boxes[i].x + 2)
    )
      sideBySide++;
ok("মোবাইলে ফর্মের ঘরগুলো পাশাপাশি নয় — উপর-নিচে", sideBySide === 0, `${sideBySide}টি পাশাপাশি`);
const formMob = await overflow();
ok("মোবাইলে ফর্মও স্ক্রিনের বাইরে যায় না", formMob.scrollW <= formMob.clientW + 2, `${formMob.scrollW}/${formMob.clientW}`);
// দ্বিতীয় ধাপেও একই নিয়ম
await mp.locator('input[type="file"]').setInputFiles(
  new URL("fixtures/photo-800x600.png", import.meta.url).pathname,
);
await mp.waitForTimeout(900);
await mp.locator("#reg-name").fill("মোবাইল খাপ পরীক্ষা");
await mp.locator("#reg-school").fill("রংপুর জিলা স্কুল");
await mp.locator("#reg-sscRoll").fill("96001");
await mp.locator("#reg-mobile").fill("0171" + String(Date.now() % 10000000).padStart(7, "0"));
await mp.locator("#reg-location").fill("ঢাকা");
await mp.getByRole("button", { name: "পরের ধাপ", exact: true }).click();
await mp.waitForTimeout(900);
const step2 = await mp.locator(".registration-card .field").evaluateAll((nodes) =>
  nodes
    .map((n) => {
      const r = n.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), y: Math.round(r.y) };
    })
    .filter((b) => b.w > 0),
);
let step2Side = 0;
for (let i = 0; i < step2.length; i++)
  for (let j = i + 1; j < step2.length; j++)
    if (
      Math.abs(step2[i].y - step2[j].y) < 12 &&
      !(step2[i].x + step2[i].w <= step2[j].x + 2 || step2[j].x + step2[j].w <= step2[i].x + 2)
    )
      step2Side++;
ok("দ্বিতীয় ধাপেও কোনো ঘর পাশাপাশি নয়", step2Side === 0, `${step2Side}টি পাশাপাশি`);
ok("মোবাইলে কোনো ব্রাউজার এরর নেই", mobErrs.length === 0, mobErrs.slice(0, 2).join(" | "));
await mob.close();
await browser.close();
console.log(`\n═══ লাইভ সাইট পরীক্ষা: ${pass} পাস, ${fail} ব্যর্থ ═══\n`);
process.exit(fail ? 1 : 0);
