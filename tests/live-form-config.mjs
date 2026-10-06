// লাইভ সাইটে (Vercel → Supabase) R13 যাচাই: ফর্মের ঘর এডিট/লুকানো/সাজানো,
// ফর্মের লেখা, হেডারের মেনু ও লোগো — সবই অ্যাডমিন প্যানেল থেকে।
// চালানো: ADMIN_EMAIL=… ADMIN_PASSWORD=… node tests/live-form-config.mjs
import { chromium } from "playwright";

const SITE = process.env.SITE || "https://rangpur-ssc96.vercel.app";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "graphictech360@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD দাও (env)");
let pass = 0,
  fail = 0;
const ok = (t, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${t}${extra ? " — " + extra : ""}`);
};

const smallPng =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAWklEQVR42u3QMQEAAAgDoC251a3gLwqgOXV3z8wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgbQFP8AABlKvx5wAAAABJRU5ErkJggg==";

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(SITE + "/admin", { waitUntil: "networkidle" });
  await page.getByLabel(/ইমেইল/).fill(ADMIN_EMAIL);
  await page.getByLabel(/পাসওয়ার্ড/).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /লগইন|প্রবেশ/ }).first().click();
  await page.waitForTimeout(2500);
  ok("লাইভ অ্যাডমিন প্যানেলে লগইন হলো", page.url().includes("/admin"));

  const call = (path, body, method = "POST") =>
    page.evaluate(
      async ([p, b, m]) => {
        const r = await fetch("/api" + p, {
          method: m,
          headers: { "Content-Type": "application/json" },
          body: b ? JSON.stringify(b) : undefined,
        });
        return { status: r.status, data: await r.json().catch(() => null) };
      },
      [path, body, method],
    );
  const siteNow = () => call("/site", null, "GET").then((r) => r.data);
  const mutate = (action, payload) => call("/admin/mutate", { action, payload });

  const start = await siteNow();
  const fields = start.formFields || [];
  const tshirt = fields.find((f) => f.key === "tshirt");
  const nameField = fields.find((f) => f.key === "name");
  ok(
    "লাইভ ফর্মে মূল ঘরগুলো (৯টি) কনফিগ থেকে আসছে",
    fields.filter((f) => f.isBase).length === 9,
    `${fields.length} টি ঘর`,
  );
  ok(
    "হেডারের মেনু লাইভে এসেছে (৫টি)",
    (start.nav || []).length === 5,
    (start.nav || []).map((n) => n.label).join(", "),
  );
  ok(
    "ফর্মের লেখাও লাইভে আসছে",
    (start.formTexts || {})["card.title"] === "বন্ধু, নামটা লিখে ফেলো!",
  );

  /* ১) টি-শার্টের ঘর লুকানো → পাবলিক সাইটে চলে যাওয়া → আবার ফেরানো */
  await mutate("formField.save", { ...tshirt, visible: false });
  const hidden = await siteNow();
  ok(
    "টি-শার্টের ঘর লুকালে পাবলিক ফর্ম থেকে চলে যায়",
    !(hidden.formFields || []).some((f) => f.key === "tshirt"),
  );
  const pubHide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pp = await pubHide.newPage();
  await pp.goto(SITE + "/", { waitUntil: "networkidle" });
  await pp.locator('nav.main-nav a[href="#registration"]').first().click();
  await pp.waitForTimeout(1200);
  await pp
    .locator('input[type="file"]')
    .setInputFiles(new URL("fixtures/photo-800x600.png", import.meta.url).pathname);
  await pp.waitForTimeout(1500);
  const step1Ids = ["#reg-name", "#reg-school", "#reg-sscRoll", "#reg-mobile", "#reg-location"];
  const vals = ["নাম পরীক্ষা", "রংপুর জিলা স্কুল", "96123", "0171" + String(Date.now() % 10000000).padStart(7, "0"), "ঢাকা"];
  for (let i = 0; i < step1Ids.length; i++) await pp.locator(step1Ids[i]).fill(vals[i]);
  await pp.getByRole("button", { name: "পরের ধাপ", exact: true }).click();
  await pp.waitForTimeout(1200);
  ok(
    "লাইভ পাবলিক ফর্মের ২য় ধাপে টি-শার্টের ঘর নেই",
    (await pp.locator(".registration-card .tshirt-field").count()) === 0,
  );
  await pubHide.close();
  await mutate("formField.save", { ...tshirt, visible: true });
  ok(
    "টি-শার্টের ঘর ফিরিয়ে আনা গেল",
    (await siteNow()).formFields.some((f) => f.key === "tshirt"),
  );
  ok(
    "ফিরিয়ে আনার পর আবার ৯টি মূল ঘরই আছে",
    (await siteNow()).formFields.filter((f) => f.isBase).length === 9,
  );

  /* ২) সুরক্ষিত ঘর (নাম) লুকানো যায় না */
  await mutate("formField.save", { ...nameField, visible: false });
  const nameAfter = (await siteNow()).formFields.find((f) => f.key === "name");
  ok("নামের সুরক্ষিত ঘর লুকানো যায় না", nameAfter?.visible === true);
  const delTry = await mutate("formField.delete", { id: nameField.id });
  ok(
    "মূল ঘর মুছে ফেলার চেষ্টা আটকায় (বাংলা বার্তা)",
    delTry.status !== 200,
    String(delTry.data?.error || "").slice(0, 60),
  );

  /* ৩) টেনে সাজানো: ক্রম বদল → বদল লাইভে দেখা যায় → আগের অবস্থায় ফেরানো */
  const startFields = (await siteNow()).formFields;
  const before = startFields.map((f) => f.key);
  const swapped = before.slice();
  swapped.splice(0, 2, swapped[1], swapped[0]);
  await mutate("formField.reorder", {
    items: swapped.map((key, i) => ({
      id: startFields.find((f) => f.key === key).id,
      order: (i + 1) * 10,
    })),
  });
  const reordered = (await siteNow()).formFields.map((f) => f.key);
  ok("টেনে সাজালে ক্রম লাইভে বদলায়", reordered[0] === before[1], `${before.slice(0, 2).join(",")} → ${reordered.slice(0, 2).join(",")}`);
  const restore = (await siteNow()).formFields;
  const original = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  await mutate("formField.reorder", {
    items: before.map((key, i) => ({
      id: restore.find((f) => f.key === key).id,
      order: original[i] ?? (i + 1) * 10,
    })),
  });
  ok("আগের ক্রমে ফেরানো গেল", true);

  /* ৪) ফর্মের লেখা বদলানো */
  await mutate("formText.save", { key: "step2.title", value: "০২ / পরিবার ও জার্সি" });
  ok(
    "ফর্মের লেখা (ধাপ ২-এর শিরোনাম) বদলানো গেল",
    (await siteNow()).formTexts["step2.title"] === "০২ / পরিবার ও জার্সি",
  );
  await mutate("formText.save", { key: "step2.title", value: "০২ / কারা আসছো একসাথে?" });
  ok("লেখা আগের অবস্থায় ফেরানো গেল", true);

  /* ৫) হেডারের মেনু: যোগ → পাবলিক হেডারে দেখা → মোছা */
  const navId = crypto.randomUUID();
  await mutate("navItem.save", {
    id: navId,
    kind: "link",
    label: "ফেসবুক গ্রুপ",
    target: "https://facebook.com/groups/ssc96",
    order: 900,
    visible: true,
  });
  ok(
    "হেডারে নতুন লিংক যোগ করা গেল",
    (await siteNow()).nav.some((n) => n.label === "ফেসবুক গ্রুপ"),
  );
  const navCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const np = await navCtx.newPage();
  await np.goto(SITE + "/", { waitUntil: "networkidle" });
  ok(
    "পাবলিক হেডারে লিংকটি দেখা যাচ্ছে",
    (await np.locator('nav.main-nav a[href="https://facebook.com/groups/ssc96"]').count()) === 1,
  );
  await navCtx.close();
  await mutate("navItem.delete", { id: navId });
  ok("লিংক মোছা গেল", !(await siteNow()).nav.some((n) => n.label === "ফেসবুক গ্রুপ"));

  /* ৬) লোগো আপলোড (image-2-এর লাল বাক্সের অংশ) */
  // আপলোডের আগের লোগো-লিংকটি ধরে রাখি — শেষে ঠিক এইটাই ফিরিয়ে আনব
  const originalBranding = (await siteNow()).sections.find((s) => s.key === "branding");
  const logo = await call("/admin/logo", { photo: smallPng });
  ok(
    "নতুন লোগো আপলোড হয়ে হেডারে বসে গেল",
    logo.status === 200 && String(logo.data?.url || "").includes("/branding/"),
    String(logo.data?.url || "").slice(-40),
  );
  const withLogo = await siteNow();
  const branding = withLogo.sections.find((s) => s.key === "branding");
  ok("হেডারের লোগো লিংক সেভ হয়েছে", String(branding?.imageUrl || "").includes("/branding/"));
  const logoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const lp = await logoCtx.newPage();
  await lp.goto(SITE + "/", { waitUntil: "networkidle" });
  const headerSrc = await lp.locator("header .brand img").first().getAttribute("src");
  ok("পাবলিক হেডারে নতুন লোগোই দেখাচ্ছে", String(headerSrc || "").includes("/branding/"), String(headerSrc || "").slice(-40));
  await logoCtx.close();
  // আগের লোগো ফিরিয়ে আনা
  await mutate("section.save", {
    id: branding.id,
    key: "branding",
    title: branding.title,
    subtitle: branding.subtitle,
    imageUrl: originalBranding.imageUrl,
    order: branding.order,
    visible: true,
  });
  ok(
    "আগের লোগো ফিরিয়ে আনা গেল",
    (await siteNow()).sections.find((s) => s.key === "branding").imageUrl ===
      originalBranding.imageUrl,
    originalBranding.imageUrl.slice(-40),
  );

  /* ৭) পেমেন্ট/টিকিট কিছু ভাঙেনি */
  const finalSite = await siteNow();
  ok(
    "পেমেন্ট নম্বর ও ফি অটুট আছে",
    (finalSite.accounts || []).length >= 6 && finalSite.fees.friend === 1499,
    `${(finalSite.accounts || []).length} নম্বর · বন্ধু ৳${finalSite.fees.friend}`,
  );
  ok("ব্রাউজারে কোনো এরর নেই", errors.length === 0, errors.slice(0, 1).join(""));

  console.log(`\n═══ লাইভ ফর্ম-কনফিগ: ${pass} পাস, ${fail} ব্যর্থ ═══`);
  console.log(
    "📌 মনে রাখো: টেস্টে ওঠা লোগো ফাইলটি Storage থেকে পরে মুছে ফেলতে হবে (সাইজ-ই-বাকেট পরিষ্কার)।",
  );
} finally {
  await browser.close();
}
process.exit(fail ? 1 : 0);
