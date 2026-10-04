/**
 * অ্যাডমিন রিপোর্টের হিসাব — Supabase-এর `public.admin_overview() → stats`-এর
 * হুবহু একই গঠন, যাতে ডেমো ও লাইভ দুই জায়গাতেই রিপোর্ট একই রকম দেখায়।
 *
 * সংজ্ঞা:
 *  - "live" নিবন্ধন = যেগুলো আর্কাইভ করা হয়নি
 *  - verifiedAmount = যেসব পেমেন্ট যাচাই হয়েছে তাদের মোট
 *  - pendingAmount  = বাকি সব (যাচাইয়ের অপেক্ষায় বা প্রত্যাখ্যাত)
 *  - absent = অনুমোদিত কিন্তু এখনো চেক-ইন করেনি
 */

const man = (r) => 1 + Number(r.spouse || 0) + Number(r.children || 0);
const approved = (r) => r.status === "approved";
const paid = (r) => r.payment?.status === "verified";
const checked = (r) => Boolean(r.checkedInAt);

const group = (rows, keyOf) => {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    map.set(key, [...(map.get(key) || []), row]);
  }
  return map;
};

const sum = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);

export function computeStats(registrations = [], archivedCount = 0, fields = []) {
  const live = registrations.filter((r) => !r.archivedAt);
  const approvedRows = live.filter(approved);
  const verifiedRows = live.filter(paid);

  const totals = {
    registrations: live.length,
    approved: approvedRows.length,
    pending: live.filter((r) => r.status === "pending").length,
    rejected: live.filter((r) => r.status === "rejected").length,
    families: approvedRows.length,
    spouses: sum(live, (r) => Number(r.spouse || 0)),
    children: sum(live, (r) => Number(r.children || 0)),
    people: sum(live, man),
    approvedPeople: sum(approvedRows, man),
    expectedAmount: sum(live, (r) => Number(r.total || 0)),
    verifiedAmount: sum(verifiedRows, (r) => Number(r.total || 0)),
    pendingAmount: sum(
      live.filter((r) => !paid(r)),
      (r) => Number(r.total || 0),
    ),
    checkedIn: live.filter(checked).length,
    checkedInPeople: sum(live.filter(checked), (r) => Number(r.groupSize || man(r))),
    absent: approvedRows.filter((r) => !checked(r)).length,
    absentPeople: sum(approvedRows.filter((r) => !checked(r)), man),
    checkInPercent: approvedRows.length
      ? Math.round((100 * live.filter(checked).length) / approvedRows.length)
      : 0,
  };

  const schools = [...group(live, (r) => r.participant?.school || "অজানা")]
    .map(([school, rows]) => ({
      school,
      registrations: rows.length,
      approved: rows.filter(approved).length,
      people: sum(rows, man),
      expectedAmount: sum(rows, (r) => Number(r.total || 0)),
      verifiedAmount: sum(rows.filter(paid), (r) => Number(r.total || 0)),
      checkedIn: rows.filter(checked).length,
      checkedInPeople: sum(rows.filter(checked), (r) =>
        Number(r.groupSize || man(r)),
      ),
      absent: rows.filter((r) => approved(r) && !checked(r)).length,
    }))
    .sort((a, b) => b.registrations - a.registrations || a.school.localeCompare(b.school));

  const tally = (rows, keyOf) =>
    [...group(rows, keyOf)].map(([key, list]) => ({ key, count: list.length }));

  const tshirts = tally(live, (r) => r.participant?.tshirt || "—")
    .map((t) => ({ size: t.key, count: t.count }))
    .sort((a, b) => b.count - a.count || String(a.size).localeCompare(String(b.size)));

  // খাবার এখন ঐচ্ছিক — যারা উত্তর দেয়নি তাদের বাদ দেওয়া হয়
  const foods = tally(
    live.filter((r) => (r.food || "").trim() !== ""),
    (r) => r.food,
  )
    .map((t) => ({ preference: t.key, count: t.count }))
    .sort((a, b) => b.count - a.count);

  // অ্যাডমিন-যোগ করা ঘরে কে কী উত্তর দিয়েছে (লাইভের form_field_stats-এর সমান গঠন)
  const formFields = (fields || [])
    .filter((f) => f.visible !== false)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((f) => {
      const values = live
        .map((r) => (r.answers || {})[f.key])
        .filter((v) => v !== undefined && String(v).trim() !== "");
      const counts = new Map();
      for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
      return {
        key: f.key,
        label: f.label,
        kind: f.kind,
        order: f.order,
        answered: values.length,
        top: [...counts]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
          .slice(0, 8),
      };
    });

  const providers = [...group(live, (r) => r.payment?.provider || "—")].map(
    ([provider, rows]) => ({
      provider,
      count: rows.length,
      amount: sum(rows, (r) => Number(r.payment?.amount || 0)),
      verifiedAmount: sum(rows.filter(paid), (r) => Number(r.payment?.amount || 0)),
    }),
  );

  const collectors = [
    ...group(
      live,
      (r) =>
        `${r.payment?.provider || "—"}|${r.payment?.collectorName || "—"}|${r.payment?.collectorMobile || "—"}`,
    ),
  ]
    .map(([key, rows]) => {
      const [provider, name, mobile] = key.split("|");
      return {
        provider,
        name,
        mobile,
        count: rows.length,
        amount: sum(rows, (r) => Number(r.payment?.amount || 0)),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const dailyMap = new Map();
  const cutoff = Date.now() - 14 * 86400000;
  for (const r of live) {
    const time = new Date(r.createdAt).getTime();
    if (Number.isNaN(time) || time < cutoff) continue;
    const day = new Date(time).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  }
  const daily = [...dailyMap]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedAt: new Date().toISOString(),
    totals,
    archived: archivedCount,
    schools,
    tshirts,
    foods,
    formFields,
    providers,
    collectors,
    daily,
  };
}
