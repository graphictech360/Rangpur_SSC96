import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats } from "../server/stats.mjs";

/** পরীক্ষার জন্য নমুনা নিবন্ধন — Supabase-এর admin_overview()->stats-এর সমান হিসাব। */
const reg = ({
  name,
  school,
  status,
  total,
  spouse = 0,
  children = 0,
  payStatus = "pending",
  provider = "bkash",
  collector,
  tshirt = "L",
  food = "সাধারণ",
  checkedInAt = null,
  archivedAt = null,
  createdAt = "2026-10-04T06:00:00.000Z",
}) => ({
  id: name,
  ticketNumber: "R96-0000" + name.length,
  participant: { name, school, tshirt },
  status,
  total,
  spouse,
  children,
  groupSize: 1 + spouse + children,
  food,
  payment: {
    status: payStatus,
    provider,
    amount: total,
    collectorName: collector || (provider === "bkash" ? "Tomal" : "Arif"),
    collectorMobile: provider === "bkash" ? "01773353972" : "01787898951",
  },
  checkedInAt,
  archivedAt,
  createdAt,
});

const rows = [
  // রংপুর জিলা স্কুল: ২ পরিবার — ১ উপস্থিত (৩ জন), ১ অনুপস্থিত
  reg({
    name: "ক-বন্ধু",
    school: "রংপুর জিলা স্কুল",
    status: "approved",
    total: 2199,
    spouse: 1,
    children: 1,
    payStatus: "verified",
    checkedInAt: "2026-10-04T09:15:00.000Z",
  }),
  reg({
    name: "খ-বন্ধু",
    school: "রংপুর জিলা স্কুল",
    status: "approved",
    total: 1499,
    payStatus: "verified",
  }),
  // কারমাইকেল: ১টি যাচাইয়ের অপেক্ষায় (নগদ)
  reg({
    name: "গ-বন্ধু",
    school: "কারমাইকেল কলেজ",
    status: "pending",
    total: 1899,
    children: 2,
    provider: "nagad",
  }),
  // আর্কাইভ করা নিবন্ধন হিসাবে ধরা হবে না
  reg({
    name: "ঘ-বন্ধু",
    school: "রংপুর জিলা স্কুল",
    status: "approved",
    total: 1499,
    payStatus: "verified",
    archivedAt: "2026-10-03T00:00:00.000Z",
  }),
];

const stats = computeStats(rows, 1);

test("মোট হিসাব: নিবন্ধন, মানুষ, টাকা, উপস্থিতি", () => {
  const t = stats.totals;
  assert.equal(t.registrations, 3, "আর্কাইভ বাদ দিয়ে ৩টি নিবন্ধন");
  assert.equal(t.approved, 2);
  assert.equal(t.pending, 1);
  assert.equal(t.spouses, 1);
  assert.equal(t.children, 3);
  // ক = ৩ জন (বন্ধু+সঙ্গী+শিশু), খ = ১ জন, গ = ৩ জন (বন্ধু+২ শিশু)
  assert.equal(t.people, 3 + 1 + 3, "৩ পরিবারে মোট ৭ জন");
  assert.equal(t.expectedAmount, 2199 + 1499 + 1899);
  assert.equal(t.verifiedAmount, 2199 + 1499);
  assert.equal(t.pendingAmount, 1899);
  assert.equal(t.checkedIn, 1);
  assert.equal(t.checkedInPeople, 3);
  assert.equal(t.absent, 1, "অনুমোদিত কিন্তু চেক-ইন করেনি");
  assert.equal(t.absentPeople, 1);
  assert.equal(t.checkInPercent, 50, "২ পরিবারের ১টি চেক-ইন = ৫০%");
  assert.equal(stats.archived, 1);
});

test("স্কুলভিত্তিক হিসাব আলাদা করে দেখা যায়", () => {
  const jila = stats.schools.find((s) => s.school === "রংপুর জিলা স্কুল");
  const carmichael = stats.schools.find((s) => s.school === "কারমাইকেল কলেজ");
  assert.equal(jila.registrations, 2);
  assert.equal(jila.people, 4, "ক=৩ জন, খ=১ জন");
  assert.equal(jila.verifiedAmount, 2199 + 1499);
  assert.equal(jila.checkedIn, 1);
  assert.equal(jila.absent, 1);
  assert.equal(carmichael.registrations, 1);
  assert.equal(carmichael.verifiedAmount, 0);
  assert.equal(carmichael.absent, 0, "অনুমোদনের আগে কেউ অনুপস্থিত নয়");
  assert.equal(stats.schools[0].school, "রংপুর জিলা স্কুল", "বেশি নিবন্ধন আগে");
});

test("টি-শার্ট, খাবার, বিকাশ/নগদ ও গ্রহণকারীভিত্তিক হিসাব", () => {
  assert.equal(stats.tshirts[0].size, "L");
  assert.equal(stats.tshirts[0].count, 3);
  assert.equal(stats.foods[0].preference, "সাধারণ");
  assert.equal(stats.foods[0].count, 3);
  const bkash = stats.providers.find((p) => p.provider === "bkash");
  const nagad = stats.providers.find((p) => p.provider === "nagad");
  assert.equal(bkash.count, 2);
  assert.equal(bkash.amount, 2199 + 1499);
  assert.equal(bkash.verifiedAmount, 2199 + 1499);
  assert.equal(nagad.count, 1);
  assert.equal(nagad.verifiedAmount, 0);
  const tomal = stats.collectors.find((c) => c.name === "Tomal");
  assert.equal(tomal.count, 2);
  assert.equal(stats.daily[0].count, 3);
});

test("কোনো নিবন্ধন না থাকলে শূন্য হিসাব — ভাঙে না", () => {
  const empty = computeStats([], 0);
  assert.equal(empty.totals.registrations, 0);
  assert.equal(empty.totals.people, 0);
  assert.equal(empty.totals.checkInPercent, 0);
  assert.deepEqual(empty.schools, []);
  assert.deepEqual(empty.daily, []);
});
