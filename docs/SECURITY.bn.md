# Security model ও সীমাবদ্ধতা

## স্ক্যান করা আর প্রবেশ রেকর্ড করা আলাদা

কেউ নিজের ক্যামেরা দিয়ে QR-এর লেখা পড়তে পারেন। এটি বন্ধ করার দাবি করা হয়নি। কিন্তু check-in API/RPC **staff login + active role + approved browser-device token** ছাড়া entry record করে না। QR-এর ভিতরে নাম/ফোন/পেমেন্ট নেই; registration UUID ও একটি দীর্ঘ random secret থাকে। Receipt-recovery key আলাদা, তাই scan করা QR থেকে private receipt link তৈরি হয় না।

একবার entry হলে পুনরায় scan-এ existing check-in time ও duplicate status আসে। Concurrent scans-এর জন্য PostgreSQL row lock ও unique constraint আছে; demo store-এ serialized mutations আছে। Cancelled/rejected/pending ticket-এ valid entry হয় না।

## নির্দিষ্ট organizer ফোন

একটি HttpOnly, signed browser cookie-এর random token hash staff user-এর সঙ্গে database-এ সংরক্ষিত হয়। Admin authorization ছাড়া scanner-role browser কাজ করে না। Revocation database-side চেক হয়।

**এটি IMEI/hardware lock নয়।** Cookie/session চুরি, একই account ব্যবহার বা browser profile copying-এর বিরুদ্ধে শতভাগ ফোন-লক দাবি নয়। আলাদা staff accounts, শক্তিশালী passwords, trusted phones, session/device revocation ও device ownership controls ব্যবহার করুন। Native managed app/passkeys/MFA/MDM আরও কঠোর control-এর আলাদা কাজ; এই সংস্করণে MFA UI নেই।

## Payment

- কোনো bKash/Nagad unofficial API, scraping, PIN বা OTP সংগ্রহ নেই।
- ব্যক্তিগত Send Money transfer app নিজে যাচাই করে না। Organizer নিজের statement/transaction history-তে TrxID, sender, receiver ও amount মিলিয়ে approve করবেন।
- Submitted TrxID proof নয়। একই provider+case-normalized TrxID আবার জমা দেওয়া যায় না।
- Participant approval status বা expected fee পরিবর্তন করতে পারেন না। Fees server/DB-side calculated; approved financial/family data সরাসরি editable নয়।
- Demo accounts ও seeded payments সম্পূর্ণ কাল্পনিক; production mode-এ hard-coded demo logins ব্যবহার হয় না।
- Amount mismatch থাকলে admin approval প্রত্যাখ্যান করা হয়। Send Money fees/limits ও ব্যক্তিগত নম্বরে collection-এর অনুমতি provider-এর নিয়ম অনুযায়ী যাচাই করতে হবে।

## Private receipt

- Registration-এর পর একবার গোপন recovery link দেওয়া হয়; QR approval-এর পর তৈরি হয়। SMS/email পাঠানো হয় না।
- Database recovery token-এর hash রাখে। Public mobile-number search নেই—phone guessing দিয়ে অন্যের ticket/receipt নেওয়া যাবে না।
- Own-browser ticket links localStorage-এ থাকে, convenience-এর জন্য। Shared/public device হলে participant links রেখে যাবেন না। Link/QR sensitive; screenshots প্রকাশ করবেন না।
- Ticket links URL fragment-এ থাকে (`#ticket=`), request log/query string-এ নয়। Referrer policy `no-referrer` এবং API responses `no-store`।
- Lost link admin identity verification করে rotate করতে পারেন। Old recovery link invalid হয়; QR তখন unchanged। QR compromised হলে registration cancel/re-register/নিয়ন্ত্রিত ticket-reissue ব্যবস্থা ব্যবহার করতে হবে।
- Approved ticket secret private `tickets` table-এ রাখা হয়, যাতে owner receipt-এ QR পুনরায় render করা যায়। Database administrator-কে trusted ধরে নেওয়া হয়েছে।

## Backend / database

- Browser API calls relative URLs; separate localhost backend/browser URLs নেই।
- Publishable/anon Supabase key ছাড়া app-এর secret database administrator key লাগে না। Server startup-এ service-role/secret keys প্রত্যাখ্যান করা হয়।
- Publicly exposed RPC function permissions explicit allowlist। RLS-enabled internal tables default-deny; internal schema/helper functions-এ app roles-এর grant নেই।
- Admin/scanner permission database active role থেকে যাচাই হয়। JWT user UUID authenticates staff; frontend toggle/filter security boundary নয়।
- Cookies signed, HttpOnly; HTTPS production-এ Secure + SameSite Strict। Arena preview iframe-এর জন্য Secure, SameSite None, Partitioned cookie ব্যবহৃত হয়। Mutating browser requests-এর Origin check আছে।
- API/login/submission rate limits, Zod validation, SQL constraints, fixed search paths, no arbitrary SQL/table mutations, safe CSV cell escaping, React escaped text।
- Current sessions in memory: one server instance recommended; multi-instance deployment needs shared session infrastructure। Restart logs staff out; stable production SESSION_SECRET keeps device cookie signature valid।
- Service worker শুধু static `/assets/` cache করে; tickets, participant/payment data, admin APIs ও check-in requests cache করে না। **Offline check-in নেই।**

## Before real registrations open

1. Remote Supabase migration + seed চালানো ও organizer/staff roles যাচাই।
2. Real domain/HTTPS, strong unique accounts, private environment configuration, correct Origin/proxy config।
3. Android ও iPhone-এর actual camera + image fallback + QR download + print + browser cookies পরীক্ষা।
4. দুই approved device দিয়ে একই QR একসঙ্গে পরীক্ষা; duplicate prevention যাচাই।
5. Staff logout/revocation, forged QR, pending/rejected/cancelled tickets পরীক্ষা।
6. All four collection numbers, provider permissions/limits, fee policy ও family-entry rules নিশ্চিত করা।
7. Backup, retention/deletion schedule, operator training ও gate internet/hotspot fallback প্রস্তুত রাখা।
8. Public-RPC abuse risk বিবেচনায় CAPTCHA/extra limits যোগ করা প্রয়োজন কিনা ঠিক করা।

This is an implemented, tested prototype with a Supabase adapter—not an external payment audit or an assertion of deployment/security certification. The supplied remote project has not been modified without credentials/access.
