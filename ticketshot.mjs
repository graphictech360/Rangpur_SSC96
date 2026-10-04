import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 } });
const page = await ctx.newPage();
await page.goto("file:///home/user/Rangpur-SSC96-Preview.html", { waitUntil: "load" });
await page.waitForTimeout(1500);
// দ্রুত নিবন্ধন + অনুমোদন (ব্রাউজারের ভেতরের API দিয়ে)
await page.evaluate(async () => {
  const site = await (await fetch("/api/site")).json();
  const arif = site.accounts.find((a) => a.provider === "nagad" && a.name === "Arif");
  await fetch("/api/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      participant: { name: "টিকিট লেখা পরীক্ষা", school: "রংপুর জিলা স্কুল", sscRoll: "961999", sscRegistration: "", mobile: "01715550888", location: "ঢাকা", tshirtSize: "XL" },
      spouse: 1, children: 2, food: "সাধারণ", notes: "",
      payment: { provider: "nagad", accountId: arif.id, senderMobile: "01715550888", transactionId: "TKT" + Date.now(), amount: 2399 },
      consent: true,
    }),
  });
  await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@ssc96.demo", password: "Festival96!" }) });
  const ov = await (await fetch("/api/admin")).json();
  const t = ov.registrations.find((r) => r.participant.name === "টিকিট লেখা পরীক্ষা");
  await fetch("/api/admin/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "registration.approve", payload: { id: t.id, verified: true } }) });
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1200);
const key = await page.evaluate(() => JSON.parse(localStorage.getItem("r96-tickets") || "[]")[0].key);
await page.evaluate((k) => { location.hash = "#ticket=" + k; }, key);
await page.waitForTimeout(1800);
await page.locator(".ticket-panel").waitFor();
await page.locator(".receipt-qr svg").waitFor();
await page.screenshot({ path: ".artifacts/u-ticket.png" });
console.log("ticket screenshot ok");
await b.close();
