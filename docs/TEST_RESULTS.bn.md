# পরীক্ষার ফলাফল — ২ অক্টোবর ২০২৬

## Passed

- `npm run build`: TypeScript validation + Vite production build সফল।
- `npm test`: **১৫/১৫** domain এবং PostgreSQL-compatible RPC/permission tests সফল।
- Chromium desktop (1360px) এবং mobile (390px): page-level horizontal overflow নেই; uncaught browser errors নেই।
- পরিবার: বন্ধু + জীবনসঙ্গী + ২ শিশু = ৳২,৩৯৯, মোট ৪ জন।
- Nagad/Arif account selection, sender/transaction input ও pending registration সফল।
- Payment approval-এর আগে QR নেই; admin manual-verification confirmation-এর পরে QR পাওয়া যায়।
- QR receipt PNG download সফল; স্থানীয় fonts ও supplied logo ঠিকভাবে exported।
- Logged-out participant check-in denied: HTTP 401।
- Logged-in কিন্তু unapproved staff browser check-in denied: HTTP 403।
- Admin browser-device approval-এর পরে uploaded QR image decode ও check-in সফল।
- একই QR/ticket number-এর দ্বিতীয় check-in duplicate হিসেবে চিহ্নিত; দ্বিতীয় entry নয়।
- Forged QR, revoked device, cancelled ticket ও invalid recovery key SQL tests-এ rejected।
- Duplicate payment normalization, immutable registration fee snapshots, editable schedule/accounts, lost-link rotation ও soft-removal logic SQL tests-এ covered। CSV export-এ formula escaping কোড আছে; এই test run-এ আলাদা CSV download assertion চালানো হয়নি।
- Untrusted Origin থেকে login request denied: HTTP 403।
- Final content: ১৩টি editable content row, ১৪টি schedule row, ৮টি collection account; SQL-এ ১৪টি isolated RLS-enabled table।

## Not performed / still required

- ব্যবহারকারীর **remote Supabase project-এ SQL চালানো বা live connection হয়নি**; publishable/anon key/access দেওয়া হয়নি। SQL tests local PGlite PostgreSQL-compatible engine-এ হয়েছে, hosted Supabase Auth integration test নয়।
- বাস্তব bKash/Nagad transfer করা বা transfer স্বয়ংক্রিয়ভাবে যাচাই করা হয়নি; এই app manual organizer verification ব্যবহার করে।
- বাস্তব Android/iPhone camera hardware, Safari cookies/PWA behavior ও actual event network পরীক্ষা করা হয়নি। Image-based QR scanning test camera hardware test-এর বিকল্প নয়।
- Public domain/HTTPS production deployment করা হয়নি; Arena live preview বর্তমানে synthetic demo।

Demo/test records live Supabase seed-এ থাকে না। Production চালুর checklist `README.bn.md` এবং `SECURITY.bn.md`-এ আছে।

## হোস্ট করা Supabase-এ আসল পরীক্ষা (২৭/২৭ পাস)

প্রকল্প `mbuzwqsrnmergrtetwqq`-এ চালানো হয়েছে (`node tests/supabase-live.mjs`):

- public_site RPC: ১৩ কনটেন্ট, ১৪ সময়সূচি, ৮ নম্বর, ফি ১৪৯৯/৫০০/২০০ ✅
- সরাসরি `participants/registrations/payments/tickets/checkins` পড়া: HTTP 404 (নিষিদ্ধ) ✅
- anonymous-এর `admin_overview`, `admin_mutate`, `check_in`, `device_state`: HTTP 401 (বন্ধ) ✅
- নিবন্ধন জমা → pending, QR নেই; মোট ফি ২,৩৯৯ সঠিক ✅
- একই মোবাইলে দ্বিতীয় নিবন্ধন আটকেছে (HTTP 400) ✅
- গোপন লিংকে স্ট্যাটাস পাওয়া যায়; ভুল/নকল কী প্রত্যাখ্যাত ✅
- অ্যাডমিন লগইন (graphictech360@gmail.com) সফল, ভুল পাসওয়ার্ড HTTP 400 ✅
- `admin_overview().stats`: স্কুল, টি-শার্ট, মাধ্যম, গ্রহণকারী, দৈনিক ধারা — সব হিসাব আসে ✅

এছাড়া প্রোডাকশন মোডে (`DATA_MODE=supabase`, পোর্ট ৩২১০) ব্রাউজারে যাচাই: লগইন পেজে ডেমো বাটন **নেই**, আসল অ্যাডমিন লগইনে প্যানেল খোলে, রিপোর্ট ট্যাব ৬টি কার্ড + স্কুল টেবিল + CSV বাটন দেয়, কোনো ব্রাউজার ত্রুটি নেই। ১৯/১৯ ইউনিট+SQL টেস্ট ও ফর্ম→অনুমোদন→QR ফ্লো পাস।

**যা এখনো বাকি:** পাবলিক হোস্টিং (রেন্ডার ইত্যাদি) — তারপরেই সবার জন্য লিংক; এবং Android/iPhone ক্যামেরা, Safari/PWA, প্রিন্ট — আসল হার্ডওয়্যারে দেখা হয়নি।

## সর্বশেষ ফল (ফর্মের ঘর + মোবাইল-খাপ)

| পরীক্ষা | ফল |
| --- | --- |
| ফর্ম-নির্মাণ ও মোবাইল খাপ (`tests/form-builder.mjs`) | ✅ ১১/১১ |
| লোকাল অ্যাপ (`npm test`) | ✅ ২১/২১ |
| ডেটাবেস (PGlite, নতুন ঘর-পরীক্ষাসহ) (`tests/supabase.test.mjs`) | ✅ ১২/১২ |
| লাইভ সাইট — ডেস্কটপ ও মোবাইল (`tests/live-site.mjs`) | ✅ ১৭/১৭ |
| ইমেইল-নোটিফিকেশন (`tests/notify.mjs`) | ✅ ২২/২২ |
| লাইভ ফর্ম-ঘর (যোগ → সাইটে দেখা → মুছে ফেলা) | ✅ ৭/৭ |
| ব্রাউজার · ছবি · প্রিভিউ | ✅ পাস |
| লাইভ চেইন · লাইভ ডেটাবেস · ছবির পথ · গোপনীয়তা | ✅ ২০/২০ · ২২/২২ · ১১/১১ · ৮/৮ |

মোবাইলে (৩৯০×৮৪৪) যাচাই হয়েছে: হোমপেজ ও প্যানেল স্ক্রিনের বাইরে যায় না,
নিবন্ধন ফর্মের **কোনো ঘর পাশাপাশি নয় — সব উপর-নিচে** (প্রথম ও দ্বিতীয় ধাপ দুটোতেই)।


## ধাপ: নিবন্ধন ফর্ম, হেডার ও মেনু সম্পূর্ণ এডিটযোগ্য (নতুন)

| পরীক্ষা | কী দেখা হয় | ফল |
| --- | --- | --- |
| `tests/supabase.test.mjs` (১৩টি) | মূল ঘরসহ সব ঘর এডিট/লুকানো/টেনে সাজানো, সুরক্ষিত ঘর অটুট, ফর্মের লেখা, হেডার-মেনু, PQG পেমেন্ট নিয়ম | ✅ ১৩/১৩ |
| `npm test` (২২টি) | ডোমেইন নিয়ম: ফর্ম স্কিমা, মেনু আইটেম, অংশগ্রহণকারীর ছবি-বদল | ✅ ২২/২২ |
| `tests/supabase-chain.mjs` (২০টি) | লাইভ Supabase-এ নিবন্ধন → অনুমোদন → টিকিট → চেক-ইন চেইন | ✅ ২০/২০ |
| `tests/form-builder.mjs` (২৪টি) | **নিবন্ধন ফর্ম** ট্যাবে মূল ঘরের কার্ড, টি-শার্ট লুকানো, **ড্র্যাগ করে সাজানো**, ফর্মের লেখা সেভ, হেডার ট্যাবে লোগো/মেনু, তারপর পাবলিক ফর্মে প্রতিফল | ✅ ২৪/২৪ |
| `tests/live-form-config.mjs` (২৩টি) | **লাইভ সাইটে**: মূল ঘর লুকানো/ফেরানো, সুরক্ষিত ঘর আটক, ড্র্যাগ-রি-অর্ডার, ফর্মের লেখা, হেডারে লিংক যোগ/মোছা, **লোগো আপলোড লাইভে** | ✅ ২৩/২৩ |
| `tests/live-site.mjs` (১৭টি) | লাইভ সাইট: হেডার, নিবন্ধন, ধাপ, ছবি-বাধ্যতামূলক, টিকিট প্যানেল, গোপনীয়তা, মোবাইল খাপ | ✅ ১৭/১৭ |
| `tests/preview.mjs` | অফলাইন এক-ফাইল প্রিভিউ: ফর্ম → pending → অনুমোদন → QR | ✅ পাস |
| `tests/live-photo-flow.mjs` | লাইভ ছবি আপলোড → Registration → টিকিট | ✅ ১১/১১ |
| `tests/privacy-live.mjs` | একজন অংশগ্রহণকারী আরেকজনের তথ্য দেখতে পারে না | ✅ ৮/৮ |

> লাইভ যাচাইয়ের পর Storage-এ শুধু আসল ছবিগুলোই রাখা হয় (পরীক্ষার ফাইল মুছে ফেলা হয়)।


## ধাপ R15: ক্রিম হেডার · নতুন লোগো সবসময় · ভেতরের নিরাপত্তা (নতুন)

| পরীক্ষা | কী দেখা হয় | ফল |
| --- | --- | --- |
| `tests/security.mjs` (নতুন) | সুরক্ষা-হেডার (nosniff · SAMEORIGIN · Referrer · Permissions-Policy), বাইরের উৎস থেকে নিবন্ধন/লগইন আটকানো (৪০৩), রোবট-ফাঁদ ও সময়-যাচাই (৪০০), সঠিকভাবে জমা দিলে নিবন্ধন হয়, নিরাপত্তা-প্রতিবেদন কেবল অ্যাডমিনের (৪০১), ভুল পাসওয়ার্ডে লক (৪২৯), httpOnly কুকি, `no-store` | ✅ ২০/২০ |
| `tests/form-builder.mjs` (২৪টি) | ফর্ম ট্যাব, ড্র্যাগ-রি-অর্ডার, হেডার-লোগো — R15-এর পরও অটুট | ✅ ২৪/২৪ |
| `npm test` (২২টি) · `tests/supabase.test.mjs` (১৩টি) | ডোমেইন ও ডেটাবেস নিয়ম — অটুট | ✅ ২২/২২ · ১৩/১৩ |
| ব্রাউজারে চোখে দেখা (ডেমো ৩৩১২) | স্প্ল্যাশের লোগো = `ssc96-logo-v2.webp`, হেডারের রঙ = ক্রিম `rgba(251,246,235,0.933)`, অ্যাডমিন প্যানেলে “নিরাপত্তা” কার্ড ও হিসাব, কনসোলে কোনো এরর নেই | ✅ পাস |
| অফলাইন প্রিভিউ | ফর্ম → pending → অনুমোদন → QR (প্রিভিউতেও রোবট-যাচাই কাজ করে) | ✅ পাস |

> **বারবার লোগো ভাঙার আসল কারণ:** অ্যাপে স্ট্যাটিক-শেল service worker আছে। পুরোনো সংস্করণে
> `sw.js` লোগো ও আইকন *আগে থেকে ক্যাশ* করে রাখত এবং “ক্যাশ আগে, নেট পরে” নিয়মে দিত —
> তাই লোগো ফাইল বদলালেও রিফ্রেশে পুরোনোটাই ফিরে আসত। এখন `sw.js` কিছুই precache করে না,
> সবসময় আগে নেটওয়ার্ক থেকে আনে (নেট না থাকলে ক্যাশ), ক্যাশের নাম `r96-static-v2`,
> রেজিস্ট্রেশন হয় `updateViaCache: "none"` দিয়ে এবং নতুন ভার্সন চালু হলেই পেজ একবার নিজে
> থেকে রিলোড হয়। লোগোর ফাইলনামও বদলে `ssc96-logo-v2.webp` করা হয়েছে।
