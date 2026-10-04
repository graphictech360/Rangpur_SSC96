# পরীক্ষার ফলাফল — ২ অক্টোবর ২০২৬

## Passed

- `npm run build`: TypeScript validation + Vite production build সফল।
- `npm test`: **১৫/১৫** domain এবং PostgreSQL-compatible RPC/permission tests সফল।
- Chromium desktop (1360px) এবং mobile (390px): page-level horizontal overflow নেই; uncaught browser errors নেই।
- পরিবার: বন্ধু + জীবনসঙ্গী + ২ শিশু = ৳২,৩৯৯, মোট ৪ জন।
- Nagad/Arif account selection, sender/transaction input ও pending registration সফল।
- Payment approval-এর আগে QR নেই; admin manual-verification confirmation-এর পরে QR পাওয়া যায়।
- QR receipt PNG download সফল; স্থানীয় fonts ও supplied logo ঠিকভাবে exported।
- Logged-out participant check-in denied: HTTP 401।
- Logged-in কিন্তু unapproved staff browser check-in denied: HTTP 403।
- Admin browser-device approval-এর পরে uploaded QR image decode ও check-in সফল।
- একই QR/ticket number-এর দ্বিতীয় check-in duplicate হিসেবে চিহ্নিত; দ্বিতীয় entry নয়।
- Forged QR, revoked device, cancelled ticket ও invalid recovery key SQL tests-এ rejected।
- Duplicate payment normalization, immutable registration fee snapshots, editable schedule/accounts, lost-link rotation ও soft-removal logic SQL tests-এ covered। CSV export-এ formula escaping কোড আছে; এই test run-এ আলাদা CSV download assertion চালানো হয়নি।
- Untrusted Origin থেকে login request denied: HTTP 403।
- Final content: ১৩টি editable content row, ১৪টি schedule row, ৮টি collection account; SQL-এ ১৪টি isolated RLS-enabled table।

## Not performed / still required

- ব্যবহারকারীর **remote Supabase project-এ SQL চালানো বা live connection হয়নি**; publishable/anon key/access দেওয়া হয়নি। SQL tests local PGlite PostgreSQL-compatible engine-এ হয়েছে, hosted Supabase Auth integration test নয়।
- বাস্তব bKash/Nagad transfer করা বা transfer স্বয়ংক্রিয়ভাবে যাচাই করা হয়নি; এই app manual organizer verification ব্যবহার করে।
- বাস্তব Android/iPhone camera hardware, Safari cookies/PWA behavior ও actual event network পরীক্ষা করা হয়নি। Image-based QR scanning test camera hardware test-এর বিকল্প নয়।
- Public domain/HTTPS production deployment করা হয়নি; Arena live preview বর্তমানে synthetic demo।

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
