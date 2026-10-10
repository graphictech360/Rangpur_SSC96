# Rangpur SSC 96 Festival

**প্রকল্পের অবস্থা:** কার্যকর local demo + Supabase-ready source code। ব্যবহারকারীর দেওয়া Supabase প্রকল্পে কোনো migration এখনো চালানো হয়নি; publishable/anon key দেওয়া হয়নি। এটি production-এ চালু করা হয়েছে—এমন দাবি নয়।

## অ্যাপের লোগো ও আইকন

`public/assets/` ফোল্ডারে নতুন **SSC 96 রংপুর** লোগো (স্বচ্ছ PNG → WebP) রাখা আছে:
`ssc96-logo-v2.webp` (হেডার, অ্যাডমিন, লগইন, টিকিট, স্ক্যানার), `ssc96-logo.png`
(উচ্চমানের কপি), `favicon-64.png` (ব্রাউজার ট্যাব), `icon-192.png` ও
`icon-512.png` (ফোনের হোমস্ক্রিন আইকন)। লোগো বদলাতে চাইলে হয় এই ফাইলটি
বদলে দিন, নয়তো অ্যাডমিন প্যানেলের **হেডার ও মেনু → নতুন লোগো আপলোড করুন**
ব্যবহার করুন (সেটি ডেটাবেসে সেভ হয়)।

## সব কিছু নিজে সাজাও: ফর্ম, হেডার ও মেনু

অ্যাডমিন প্যানেলের দুটি নতুন অংশ দিয়ে পুরো নিবন্ধন-পেজ নিজের মতো বানানো যায়।

### ১. নিবন্ধন ফর্ম (ট্যাব: **নিবন্ধন ফর্ম**)
- ফর্মের **প্রতিটি ঘর** এখন এখানে কার্ড আকারে — ছবি, নাম, স্কুল, এসএসসি
  রোল, রেজিস্ট্রেশন, মোবাইল, অবস্থান, “কারা আসছো একসাথে?” ও **টি-শার্টের
  সাইজ**।
- প্রতিটি কার্ডে **সম্পাদনা**, **লুকাও / আবার দেখাও** ও **ধাপ বদল** আছে।
  কিছু আয়োজনে টি-শার্ট লাগে না? কার্ডে “লুকাও” চাপলেই ফর্ম থেকে চলে যায়।
- **টেনে (drag) সাজানো**: কার্ড ধরে উপরে-নিচে টেনে ছেড়ে দিলেই ক্রম বদলায়;
  ফোনে/ডেস্কটপে সেই ক্রমেই দেখা যাবে।
- নাম ও মোবাইল **সুরক্ষিত** — লুকানো বা মুছে ফেলা যায় না (নিবন্ধন অসম্পূর্ণ
  হয়ে যেত), লেবেল বদলানো যায়।
- কার্ডের নিচে **“ফর্মের লেখা”** অংশে কার্ডের শিরোনাম (YOUR SEAT IS
  WAITING), ধাপের নাম, ফি-লেবেল, প্রেরকের নম্বর ও ট্রানজেকশন আইডি ঘরের নাম, সম্মতির বাক্য — সব বদলানো যায়।
- “নতুন ঘর যোগ করুন” দিয়ে নিজের ঘর (রক্তের গ্রুপ, জার্সির নাম…) যোগ করা যায়,
  কোন ধাপে দেখাবে সেটিও বেছে নেওয়া যায়।

### ২. হেডার ও মেনু (ট্যাব: **হেডার ও মেনু**)
- **লোগো**: “নতুন লোগো আপলোড করুন” চেপে ছবি দিলে ব্রাউজারে ছোট হয়ে
  Supabase Storage-এ ওঠে ও সাথেই হেডারে বসে যায়; চাইলে লিংকও বসানো যায়।
- **হেডারের নাম ও ছোট লেখা** সরাসরি এডিট হয় (টিকিটেও দেখা যায়)।
- **মেনুর প্রতিটি লিংক**: ধাপে ধাপে যাওয়া লিংক (আমাদের গল্প, আয়োজন…),
  “আমার টিকিট” বোতাম (নাম বদলানো/লুকানো যায়), বা বাইরের লিংক (ফেসবুক গ্রুপ)।
  টেনে ক্রম বদল, চোখের বোতামে লুকানো, ডাস্টবিনে মোছা।

> দুটোই সেভ করার সঙ্গে সঙ্গে পাবলিক পেজে দেখা যায় — আলাদা করে কিছু ছাপতে
> বা সার্ভার চালু করতে হয় না।

## যা তৈরি হয়েছে

- একটি লিংকে responsive Bengali festival web app; ফোনে PWA হিসেবে হোম স্ক্রিনে যোগ করা যাবে। আলাদা Android/iOS native অ্যাপ নয়।
- হালকা cream background, green/coral/yellow palette, বড় creative heading, image parallax/float, text reveal, moving festival ribbon। Reduced-motion preference সম্মান করা হয়।
- দেওয়া logo ও Friends Forever ছবির local, optimized WebP assets; Bangla/English fonts local। কোনো CDN stylesheet বা image নির্ভরতা নেই।
- বাংলা সময়সূচির ১৪টি আয়োজন; সকাল ৯টার নিবন্ধন/পিঠা উৎসব ও দুপুর ১২টায় কাউন্টার বন্ধের নোট।
- তিন ধাপের form: পরিচয়, পরিবার, পেমেন্ট। এসএসসি রোল প্রয়োজনীয়; SSC registration ঐচ্ছিক।
- **ছবি আপলোড (নতুন):** পরিচয় ধাপে নিজের ছবি দেওয়া যায় — যেকোনো সাইজের ছবি (ফোনের ছবি) দিলেও অ্যাপ নিজেই ঠিক **৫১২×৫১২ স্কয়ার JPEG (~৪০–৯০ KB)** বানায়, তাই জায়গা কম লাগে ও টিকিটে পরিষ্কার দেখা যায়। ছবি রাখা হয় **Supabase Storage → photos** bucket-এ (Vercel-এ ফাইল স্থায়ীভাবে রাখা যায় না — serverless ডিস্ক প্রতি অনুরোধে মুছে যায়, তাই Storage-ই আসল স্থায়ী জায়গা)। ডিফল্টে ছবি ছাড়া জমা দেওয়া যায় না; চাইলে সেটিং `app.photo_required` থেকে ঐচ্ছিক করা যায়।
- ফি: বন্ধু ৳১,৪৯৯ + জীবনসঙ্গী ৳৫০০ (০/১ জন) + প্রতি শিশু ৳২০০। Server-side calculation এবং registration-time fee snapshots।
- বিকাশ/নগদের ব্যক্তিগত Send Money নম্বর: Tomal, Mahatab, Shohag, Arif। Provider/collector selection, copy-number, sender mobile, transaction ID।
- ম্যানুয়াল payment review: pending → approved/rejected। Status অংশগ্রহণকারী নিজে বদলাতে পারেন না। একই provider+TrxID পুনর্ব্যবহার আটকানো হয়েছে।
- অনুমোদনের পর random-token QR ticket, unique `R96-xxxxx` number, digital receipt, PNG download ও Print/PDF — **রিসিটে অংশগ্রহণকারীর ছবি + সব তথ্য** (নাম, স্কুল, এসএসসি রোল/রেজিস্ট্রেশন, মোবাইল, অবস্থান, টি-শার্ট, খাবার, পরিবার, পেমেন্ট)।
- **কোনো SMS/email প্রয়োজন নেই।** Receipt/status-এর গোপন লিংক registration-এর পর দেওয়া হয়; একই ব্রাউজারে “আমার টিকিট”-এও পাওয়া যায়। খোলা status page প্রতি ১৫ সেকেন্ডে আপডেট হয়।
- Staff-only camera QR scan, QR image upload ও ticket-number fallback। Staff login + admin-approved browser session ছাড়া check-in নয়; এক টিকিটে একবার entry - চেক-ইনের ফলাফলে অংশগ্রহণকারীর **ছবি** আসে, গেটে চিনতে সুবিধা।
- Admin: overview, participant add/edit/soft-remove, individual payment review/correction, CSV export, event/fee/content/schedule/payment-number editing, browser-device approval/revocation, action log, lost-link recovery।
- একজন বন্ধু ও তার নিবন্ধিত পরিবার **একটি QR দিয়ে একসঙ্গে** check-in করবেন। আলাদা সময়ে/আলাদা শিশুতে partial check-in এই সংস্করণে নেই।

## দ্রুত ডেমো চালানো

Node.js 20+ প্রয়োজন।

```bash
npm ci
npm run dev
```

খুলুন `http://localhost:3000`। Mobile/desktop একই app।

| পেজ                         | পথ                           |
| --------------------------- | ---------------------------- |
| মূল festival ও registration | `/`                          |
| গোপন status/receipt link    | `/#ticket=YOUR_RECOVERY_KEY` |
| আয়োজক প্যানেল               | `/admin`                     |
| গেট চেক-ইন                  | `/check-in`                  |

ডেমো login পেজে এক-ক্লিক অ্যাকাউন্ট রয়েছে:

- Admin: `admin@ssc96.demo` / `Festival96!`
- Gate staff: `staff@ssc96.demo` / `Checkin96!`

**এই অ্যাকাউন্টগুলো কেবল `DATA_MODE=demo`-তে কাজ করে। ডেমোতে বাস্তব টাকা পাঠাবেন না বা প্রকৃত ব্যক্তিগত তথ্য দেবেন না।** নম্বরগুলো ব্যবহারকারীর দেওয়া, কিন্তু ডেমো পেমেন্ট কোনো বাস্তব টাকা সংগ্রহ করে না।

ডেমোর কাল্পনিক তথ্য `data/demo-store.json`-এ থাকে। Server বন্ধ করে এই ফাইল মুছলে পরবর্তী startup-এ ডেমো reset হয়। এই ফাইল source ZIP-এ রাখা হয়নি।

## সার্ভার ছাড়া অফলাইন প্রিভিউ (সহজে দেখানোর জন্য)

কোনো ইনস্টলেশন, সার্ভার বা ইন্টারনেট ছাড়াই একটি ফাইলেই পুরো অ্যাপ দেখা যায়:

```bash
npm run preview:build   # তৈরি করে: Rangpur-SSC96-Preview.html (প্রজেক্টের বাইরে /home/user-এ)
npm run preview:test    # হেডলেস ব্রাউজারে ফর্ম → pending → অনুমোদন → QR যাচাই করে
```

`Rangpur-SSC96-Preview.html`-এ CSS, JS, বাংলা ফন্ট ও ছবি সব ভেতরে বসানো থাকে, তাই WhatsApp/ইমেইলে পাঠিয়ে ফোনের ব্রাউজারে খোলা যায়। এতে চলে ডেমো স্টোরের হুবহু একই কোড (`server/demo-store.mjs`), শুধু ডেটা ব্রাউজারের ভেতরে (localStorage) থাকে — কিন্তু কোনো অনলাইন কাজ হয় না। এই প্রিভিউর কোড `preview/` ফোল্ডারে; প্রকৃত সার্ভার/অ্যাপের কোনো অংশ বদলায় না। ভেতরে `process.env`-এর `SUPABASE_*` মান কখনো বসানো হয় না, তাই ডেমো মোডই চলে।

## 🌐 লাইভ অ্যাড্রেস (Vercel)

**https://ssc96-rangpur.vercel.app** — সবার জন্য খোলা। অ্যাডমিন প্যানেল: `/admin` (শুধু `graphictech360@gmail.com`)।

- Vercel প্রজেক্ট: `rangpur-ssc96` (টিম `nirob14`) · ডেটা: আসল Supabase · ডেমো নয়
- এনভায়রনমেন্ট: `DATA_MODE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY`, `APP_ORIGIN`
- সেশন এখন **সই-করা কুকিতে** (serverless-এর একাধিক ইনস্ট্যান্সেও টেকে), অ্যাডমিন সেশন ৮ ঘণ্টা
- পাসওয়ার্ড রিসেট: `/admin/reset` · Supabase `site_url` = `https://ssc96-rangpur.vercel.app`

## নিবন্ধন ফর্ম নিজেই সাজাও (অ্যাডমিন প্যানেল → “ফর্মের ঘর”)

ফর্মে কী কী ঘর থাকবে তা এখন **আপনি নিজেই ঠিক করবেন** — কোড ছুঁতে হবে না।
প্যানেলে ঢুকে **“ফর্মের ঘর”** ট্যাবে গিয়ে:

- **ঘর যোগ করুন** — নাম (বাংলা), কী (ইংরেজি), ধরন (এক লাইন / বড় লেখা / তালিকা / সংখ্যা / মোবাইল / তারিখ / হ্যাঁ-না)
- **বাধ্যতামূলক** কি না — টিক দিলে উত্তর না দিয়ে কেউ জমা দিতে পারবে না
- **উপর/নিচ তির** — ক্রম বদলানো
- **লুকাও / আবার দেখাও** — মুছে না ফেলেই ফর্ম থেকে লুকানো (পুরোনো উত্তর রেকর্ডে থাকে)
- **সম্পাদনা / মুছে ফেলা**

যোগ করা ঘর **সঙ্গে সঙ্গে** পাবলিক ফর্মে (পরিবার ধাপে) দেখা যায়; উত্তরগুলো
`registrations.custom_answers`-এ JSON আকারে জমা হয়, রিপোর্ট পেজে “কে কী উত্তর দিয়েছে”
আর CSV এক্সপোর্টেও ওঠে।

**মূল ঘরগুলো সবসময় থাকে:** ছবি, নাম, স্কুল, এসএসসি রোল, এসএসসি রেজিস্ট্রেশন,
মোবাইল, বর্তমান অবস্থান, টি-শার্ট সাইজ, পরিবারের সদস্য, পেমেন্ট তথ্য।
**সরানো হয়েছে (আয়োজকের নির্দেশে):** খাবারের পছন্দ ও বিশেষ অনুরোধ।

**সব সেকশন মোবাইল-খাপ:** নিবন্ধন ফর্মে কোনো ঘর পাশাপাশি নয় — মোবাইল, ট্যাবলেট,
ডেস্কটপ সবখানে এক কলামে উপর-নিচে। প্রতিটি সেকশন (হিরো, গল্প, আয়োজন, সময়সূচি,
FAQ, টিকিট, প্যানেল) ছোট স্ক্রিনে নিজে থেকেই সাজিয়ে নেয়; কিছুই ডানে-বাঁয়ে
বাইরে বেরোয় না।

## নতুন নিবন্ধনের খবর আপনার ইমেইলে (এক ক্লিকে প্যানেল)

কেউ নিবন্ধন করলেই **সাথে সাথে ইমেইল** যায় — নাম, স্কুল, মোবাইল, টাকা, TrxID, টিকিট নম্বর সহ।
মেইলের **“এক ক্লিকে প্যানেলে যাই”** বোতামে চাপ দিলেই অ্যাডমিন প্যানেল খোলে (৬০ মিনিটের সই-করা লিংক)।
চালু করতে শুধু একটি চাবি (Resend API key) বসাতে হয় — পুরো গাইড: **`docs/NOTIFICATION.bn.md`**।
সেটআপ ছাড়াও সব কাজ করে; শুধু মেইলটা যায় না (প্যানেলের হেডারে “ইমেইল খবর বন্ধ/চালু” দেখে বুঝবেন)।

## Supabase Table Editor-এ টেবিল কোথায়?

Table Editor খুললেই (schema = **`public`**) বাঁয়ের তালিকায় **সব টেবিল একসাথে** দেখা যায় — কোনো dropdown বদলাতে হয় না।
নামের শুরু দেখেই সেকশন চেনা যায়:

| নামের শুরু | সেকশন | টেবিল |
| ---------- | ------ | ----- |
| **`user`** | **বন্ধু ও নিবন্ধন** (এক ক্লিকে সবার সব তথ্য) | `user` · `participants` · `registrations` · `user_links` |
| `admin_` | অ্যাডমিন | `admin_users` · `admin_login_events` · `admin_password_resets` · `admin_email_outbox` · `admin_devices` · `admin_audit_logs` |
| `payments` · `payment_` · `refunds` | পেমেন্ট | `payments` · `payment_accounts` · `refunds` |
| `gate_` | গেট | `gate_tickets` · `gate_checkins` |
| `content_` | পেজের লেখা | `content_sections` · `content_schedule` |
| `event_` | অনুষ্ঠান | `event_events` · `event_fees` · `event_contacts` |
| `report_` | রিপোর্ট (ভিউ) | ৮টি হিসাব-ভিউ |
| `guide_` | গঠন-বর্ণনা | `guide_tables` · `guide_flows` + ৪টি ভিউ |
| `database_` | ডেটাবেস | `database_schemas` · `database_settings` · `database_migrations` · `database_health` |

**Database → Schema Visualizer**-এ টেবিলগুলো ও সংযোগের তীর একসাথে দেখা যায়।
মোট ২৪টি টেবিল + ১৪টি ভিউ, সব এক স্কিমায়। বিস্তারিত: `docs/DATABASE.bn.md`।

## অ্যাডমিন অ্যাকাউন্ট ও রিপোর্ট

- **অ্যাডমিন (শুধু একজন):** `graphictech360@gmail.com` — Supabase Auth-এ তৈরি, ইমেইল কনফার্ম করা, ভূমিকা `admin`।
- **পাবলিক সাইন-আপ বন্ধ** (`disable_signup=true`) — তাই বাইরের কেউ নিজে অ্যাকাউন্ট বানিয়ে অ্যাডমিন হতে পারবে না।
- অ্যাডমিন প্যানেলের প্রথম ট্যাব দুটি: **“এক নজরে”** (দ্রুত অবস্থা) ও **“রিপোর্ট ও হিসাব”** — স্কুলভিত্তিক হিসাব, মোট টাকা, উপস্থিতি ও অনুপস্থিত।
- গেট স্টাফ লাগলে Authentication → Users-এ অ্যাকাউন্ট বানিয়ে `supabase/03_staff_setup.sql`-এ ভূমিকা দিন; স্টাফ অ্যাডমিন প্যানেল দেখতে পায় না, শুধু চেক-ইন করে।

> ⚠️ **পাসওয়ার্ড `123456` দুর্বল।** যেকোনো সময় Authentication → Users → আপনার অ্যাকাউন্ট → Reset/Update password দিয়ে বদলে নিন; অ্যাপের কিছুই বদলাতে হবে না।

## রিপোর্ট ও হিসাব (নতুন)

অ্যাডমিন প্যানেল → **রিপোর্ট ও হিসাব** ট্যাবে যা যা দেখা যায়:

| অংশ                    | কী দেখায়                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| উপরের কার্ড            | মোট নিবন্ধন, মোট মানুষ (বন্ধু/সঙ্গী/শিশু), প্রত্যাশিত টাকা, যাচাই বাকি টাকা, চেক-ইন, অনুপস্থিত |
| উপস্থিতির হার          | অনুমোদিত পরিবারের কত % দরজা পেরেছে (প্রগ্রেস বার)                                              |
| শেষ ১৪ দিনের ধারা      | দিনভিত্তিক নিবন্ধনের বার-চার্ট                                                                 |
| **স্কুলভিত্তিক টেবিল** | প্রতিটি স্কুলের নিবন্ধন, অনুমোদিত, মানুষ, প্রত্যাশিত টাকা, যাচাইকৃত টাকা, চেক-ইন, অনুপস্থিত    |
| টি-শার্ট সাইজ          | কোন সাইজ কতটি লাগবে                                                                            |
| খাবারের পছন্দ          | সাধারণ/নিরামিষ/বিশেষ কতটি                                                                      |
| বিকাশ/নগদ হিসাব        | কোন মাধ্যমে কত নিবন্ধন ও কত টাকা (যাচাইকৃত সহ)                                                 |
| গ্রহণকারীভিত্তিক জমা   | Tomal/Mahatab/Shohag/Arif — কে কত টাকা Received করেছেন                                         |

**CSV রপ্তানি (৩টি বাটন):** সারসংক্ষেপ, স্কুলভিত্তিক, উপস্থিতি — বাংলা লেখাসহ Excel/Google Sheets-এ খোলে; ব্যক্তিগত তালিকা আলাদা `বন্ধু ও নিবন্ধন` ট্যাবের CSV থেকে।

একই হিসাব সরাসরি ডেটাবেস থেকেও: `public.admin_overview() → stats` (SQL: `supabase/06_stats.sql`)।

## Supabase অবস্থা (live)

প্রকল্প **Rangpur_SSC96** → `https://mbuzwqsrnmergrtetwqq.supabase.co` — **টেবিল তৈরি ও যাচাই সম্পন্ন।**

- **১৪টি টেবিল** (সবগুলোতে RLS চালু), ১৩টি SECURITY DEFINER ফাংশন, ৪৪টি ইনডেক্স, ৯টি `updated_at` ট্রিগার
- **১৪টি টেবিল-বর্ণনা ও ৩২টি কলাম-বর্ণনা** বাংলায় — Table Editor-এ `ssc96` স্কিমা বেছে নিলেই দেখা যাবে
- এক নজরের গাইড: `select * from ssc96.table_guide;`
- সিড ডেটা: ১৩ কনটেন্ট, ১৪ সময়সূচি, ৮ বিকাশ/নগদ নম্বর (কোনো নমুনা অংশগ্রহণকারী নেই)
- **২১/২১ live পরীক্ষা পাস** — পাবলিক সাইট, নিবন্ধন, গোপন টিকিট, ডুপ্লিকেট আটকানো, এবং anonymous-এর কাছে অ্যাডমিন/চেক-ইন বন্ধ

আবার যাচাই করতে: `SUPABASE_ACCESS_TOKEN=… npm run supabase -- --ref mbuzwqsrnmergrtetwqq --verify-only`
live পরীক্ষা: `SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… node tests/supabase-live.mjs`

## Supabase সেটআপ কে করবে ও কী অ্যাক্সেস লাগবে

- **এক কমান্ডে পুরো সেটআপ:** `SUPABASE_ACCESS_TOKEN=… npm run supabase -- --ref mbuzwqsrnmergrtetwqq --admin you@example.com`
  (দরকার শুধু scoped PAT: `database:read` + `database:write`; service_role/ডেটাবেস পাসওয়ার্ড কখনো নয়)
- **হাতে করার সহজ পথ:** `supabase/04_SETUP_ALL_IN_ONE.sql` পুরোটা SQL Editor-এ পেস্ট → Run (২ মিনিট)
- **key rotation, কে কী বদলাবে, কী অপরিবর্তিত থাকবে:** `docs/SUPABASE_ACCESS.bn.md`

## অন্য মোবাইল/কম্পিউটারে খোলা (লিংক)

- **অফলাইন ফাইল:** `Rangpur-SSC96-Preview.html` — লিংক লাগে না, ফাইল শেয়ার করলেই চলে।
- **একই Wi-Fi-এর লিংক:** `npm ci` তারপর `npm run share` — স্ক্রিনে `http://192.168.x.x:3000` দেখাবে; একই Wi-Fi-তে থাকা যেকোনো ফোনে খুলবে।
- **সবার জন্য পাবলিক লিংক:** Supabase + Render ধাপে ধাপে → `docs/HOW_TO_OPEN_ANYWHERE.bn.md`

## লেখার আকার (+২pt) ও ব্যানার কোলাজ

সব সাধারণ লেখা (বর্ণনা, লেবেল, বাটন, টেবিল, টিকিটের লেখা) **২ পয়েন্ট বড়** করা হয়েছে—যাতে বয়স অনুযায়ী সবাই সহজে পড়তে পারেন। শুধু **মূল হেডিং** (RANGPUR / SSC 96 / Festival), প্রতিটি সেকশনের **হেডিং**, হিরোর ইনফো-কার্ডের সংখ্যা, ইমোজি ও অ্যাডমিনের বড় সংখ্যাগুলো আগের আকারেই আছে। আবার চালাতে চাইলে:

```bash
node scripts/bump-text.mjs   # আবার সব সাধারণ টেক্সটে +২pt যোগ করে (একবারই চালাবেন)
```

**ব্যানারে একাধিক ছবি:** অ্যাডমিন → কনটেন্ট → `hero` সেকশন → “ছবির লিংক” ঘরে **প্রতি লাইনে একটি ছবির লিংক** দিন। সবগুলো ছবি ব্যানারে নিজে থেকেই ধীরে ধীরে বদলাবে (crossfade + হালকা motion), আর এক কোণে ছোট কার্ডে পরের ছবিটি দেখানো হবে। ডিফল্টভাবে ব্যাচের দুইটি স্মৃতিচিত্র (`friends-forever.webp` ও `friends-together.webp`) পালা করে দেখা যায়।

## ভেতরের নিরাপত্তা (R15)

অ্যাপে যে সুরক্ষাগুলো সবসময় চালু থাকে — অ্যাডমিন প্যানেলের **এক নজরে** ট্যাবে
“নিরাপত্তা” কার্ডে এগুলোর জীবন্ত হিসাবও দেখা যায় (বাইরের অনুরোধ কতগুলো আটকানো হলো,
রোবট কতটা ধরা পড়ল, ভুল লগইন কতবার, কতবার অস্থায়ী লক বসল):

- **সেশন কুকি** `httpOnly` + signed — জাভাস্ক্রিপ্ট কুকি পড়তে পারে না; Vercel-এর একাধিক ইনস্ট্যান্সেও লগইন থাকে।
- **শুধু নিজের সাইটের উৎস থেকে বদল-অনুরোধ** — বাইরের কোনো সাইট থেকে নিবন্ধন/লগইন/বদল এলে ৪০৩।
- **ব্রুট-ফোর্স আটকানো** — এক ইমেইল+আইপি থেকে ৫ বার ভুল পাসওয়ার্ড → ৫ মিনিটের অস্থায়ী লক (বাংলা বার্তাসহ)।
- **রোবট-ফাঁদ ও সময়-যাচাই** — ফর্মে লুকানো একটি ঘর; মানুষ দেখে না, রোবট ভরে ফেলে → জমা বাতিল। ১.৫ সেকেন্ডের কম সময়ে পূরণ হলে সব পাসওয়ার্ডও ৪০০।
- **লেখা পরিষ্কার** — নাম/স্কুল/ঠিকানা থেকে HTML ট্যাগ ও নিয়ন্ত্রণ-অক্ষর বাদ।
- **সুরক্ষা-হেডার** — CSP (লাইভ), HSTS, `X-Frame-Options: SAMEORIGIN`, `nosniff`, Referrer-Policy, Permissions-Policy (ক্যামেরা কেবল গেট-স্ক্যানারে; মাইক/লোকেশন/পেমেন্ট বন্ধ)।
- **ক্যাশে গোপন তথ্য নেই** — 모든 API উত্তর `no-store`; service worker কখনো অংশগ্রহণকারীর তথ্য/টিকিট ক্যাশ করে না।
- **পরিসীমা** — মিনিটে ১৫০ অনুরোধের সীমা; লগইন/নিবন্ধনে আরও কড়া সীমা।

পরীক্ষা: `node tests/security.mjs` (ডেমো ৩৩১২-এ) — ২০টি যাচাই।

## ডেমো পরীক্ষা করার সহজ পথ

1. Registration → “ডেমো তথ্য” → পরিবার বাছাই → “কাল্পনিক পেমেন্ট তথ্য বসাও” → consent → submit।
2. গোপন ticket link কপি করুন। QR তখনো থাকবে না।
3. `/admin` → demo admin → payment review → নিজের record মিলিয়েছি checkbox → approve।
4. Ticket link খুলুন/refresh করুন; QR ও receipt দেখা যাবে।
5. `/check-in` → staff login → device approval request।
6. Admin-এর “স্টাফ ডিভাইস” থেকে approve → staff screen-এ permission refresh।
7. QR scan/image upload বা ticket number দিয়ে check-in। দ্বিতীয়বার duplicate message আসবে।

ডেমো admin credentials সবার জানা বলেই এটি বাস্তব registration-এর জন্য নয়। Live mode-এ নিজের Supabase Auth accounts ও roles ব্যবহার করতে হবে।

## Supabase সংযোগ: Rangpur_SSC96

Project URL: `https://mbuzwqsrnmergrtetwqq.supabase.co`

URL একা দিয়ে database পরিবর্তন করা যায় না। আপনার Supabase dashboard-এ নিজে নিচের কাজগুলো করুন:

1. বিদ্যমান database থাকলে backup নিন। `01_schema.sql` একটি fresh `ssc96` schema-এর জন্য একবার চালানোর migration। কোনো table DROP করা হয় না।
2. **SQL Editor**-এ `supabase/01_schema.sql` পুরোটা চালান।
3. তারপর `supabase/02_seed.sql` চালান। এতে event, ৩টি fee, ১৩টি content row (branding, মূল সেকশন, ribbon ও FAQ), ১৪টি schedule row ও ৮টি payment account যোগ হবে। **কোনো কাল্পনিক participant/payment live database-এ যোগ হয় না।** Seed আবার চালালে admin-edited rows overwrite হয় না।
4. **Authentication → Users** থেকে admin এবং প্রত্যেক gate staff-এর জন্য পৃথক account তৈরি করুন, confirmed email ও শক্তিশালী password দিন। Public signup বন্ধ রাখুন।
5. `supabase/03_staff_setup.sql`-এর placeholder email/name বদলে চালান। শেষে SELECT-এ roles তৈরি হয়েছে কিনা দেখুন।
6. Supabase-এর project API Keys থেকে **publishable key** (`sb_publishable_...`) অথবা legacy **anon key** নিন। **Service-role/secret key ব্যবহার করবেন না।**
7. `.env.example` কপি করে `.env` বানান:

```env
DATA_MODE=supabase
SUPABASE_URL=https://mbuzwqsrnmergrtetwqq.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

8. Server restart করুন। Credentials বা keys source control/public chat-এ দেবেন না।

**Table Editor-এ schema `ssc96` বাছুন।** ওই schema-কে Supabase-এর exposed Data API schemas-এ যোগ করবেন না। সব access controlled public RPC-এর মাধ্যমে হয়; participant/payment tables-এ direct grants নেই এবং RLS default-deny।

Supabase API key security bypass নয়: administrative RPC-তে Auth JWT এবং database staff-role check লাগবেই। Publishable/anon key দিয়ে নিজেকে approve বা check-in করা যাবে না।

## Production deployment

Static-only hosting যথেষ্ট নয়: Express API server প্রয়োজন। একটি Node container/server-এ deploy করুন (যেমন উপযুক্ত Node hosting), একই origin-এ browser ও API থাকবে।

```bash
npm ci
npm run build
npm start
```

অতিরিক্ত production environment:

```env
NODE_ENV=production
DATA_MODE=supabase
PORT=3000
SESSION_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
COOKIE_SECURE=true
APP_ORIGIN=https://YOUR_REAL_DOMAIN
TRUST_PROXY=1
```

- নিজের domain ও HTTPS configure করুন; camera permission-এর জন্য HTTPS প্রয়োজন।
- `SESSION_SECRET` তৈরির উদাহরণ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`। Secret privately store করুন।
- `TRUST_PROXY` আপনার hosting-এর actual proxy chain অনুযায়ী ঠিক করুন।
- Server sessions বর্তমানে memory-তে, সর্বোচ্চ ৮ ঘণ্টা; restart হলে staff-কে আবার login করতে হয়। **একটি Node instance** দিয়ে শুরু করুন। Multi-instance deployment-এর আগে shared session store/sticky-session ব্যবস্থা যোগ করুন। Device authorization Supabase-এ থাকে।
- Real device (Android/iPhone) camera permission, Safari/Chrome login cookie আচরণ, ticket download/printing ও gate network পরীক্ষা করুন। Desktop/image QR tests hardware camera test-এর বিকল্প নয়।
- Public form-এর জন্য প্রয়োজনে CAPTCHA ও additional abuse controls যোগ করুন; API key গোপন থাকা কোনো security assumption নয়।
- Database backup, data retention ও deletion policy ঠিক করুন। Personal number-এ fee সংগ্রহের আগে bKash/Nagad-এর প্রযোজ্য নিয়ম/limits যাচাই করুন।
- এই সংস্করণ payment gateway নয়; ব্যক্তিগত account-এ transfer app স্বয়ংক্রিয়ভাবে যাচাই করে না। Payment approval organizer-এর দায়িত্ব। PIN/OTP চাইবেন না।

## Database সাজানো

সম্পূর্ণ table map ও সম্পর্ক: `docs/DATABASE.bn.md`। Security model ও limitations: `docs/SECURITY.bn.md`।

```text
rangpur-ssc96/
├── src/                  React + TypeScript UI
│   └── components/       Home, Registration, Ticket, Admin, Editors, Scanner, Login
├── server/               Express API, validators, serialized demo store
├── public/assets/        Supplied images, local fonts, PWA icons
├── supabase/             Schema + seed + first-admin/staff setup
├── docs/                 Database/security guides + font licenses
├── tests/                Validation, SQL/RPC permissions, browser workflow
├── .env.example          Configuration template (no real credentials)
└── package.json          Install/build/run scripts
```

## পরীক্ষাগুলো চালানো

```bash
npm test                 # PostgreSQL-compatible local PGlite + domain tests
npm run build            # TypeScript validation + production bundle
npx playwright install --with-deps chromium
node tests/browser.mjs   # Running DEMO server required; synthetic data only
```

SQL tests local PostgreSQL-compatible engine-এ migration, isolated table permissions, server-side totals, duplicate payments, approval-before-QR, staff/device restrictions, forged QR rejection, duplicate check-in, content editing, link rotation ও soft-removal যাচাই করে। **এগুলো আপনার remote Supabase project-এ migration চালানোর প্রমাণ নয়।**

## পরের পরিবর্তন সহজ করতে

- তারিখ/ভেন্যু/ফি: Admin → অনুষ্ঠান ও ফি। Year জানা না থাকায় countdown রাখা হয়নি; ৩১ ডিসেম্বর ডেমো label।
- banner text/image, header branding, ribbon, fee heading ও FAQ: Admin → পেজের লেখা ও ছবি। `/assets/...` অথবা HTTPS image URL দিন; নিজের image server/storage-এর CORS export-এর জন্য ঠিক রাখতে হবে। এই সংস্করণে direct image-file upload নেই।
- schedule: Admin → সময়সূচি → edit/add/remove।
- payment numbers: Admin → পেমেন্ট নম্বর। Old receipts collector-name/number snapshots রাখে।
- participant: edit করা যায়। Approved fee/family count পরিবর্তন সরাসরি করা যায় না; verified financial records সুরক্ষিত রাখা হয়েছে। Pending family count বদলালে নতুন total ও actual claimed payment আবার মিলিয়ে নিতে হবে।
- remove: soft-remove/cancel; QR invalid, list থেকে বাদ, কিন্তু payment/check-in/audit record থাকে। এটি refund নয়।
- forgotten receipt link: admin পরিচয় নিশ্চিত করে নতুন recovery link তৈরি করতে পারবেন। পুরোনো link বাতিল হবে; বিদ্যমান QR অপরিবর্তিত থাকে। QR চুরি/compromise হলে ticket বাতিল করুন।

Content keys: `branding` = header logo/name; `marquee` body-এর শব্দগুলো `|` দিয়ে আলাদা; `festival` = fee-section heading; `faq` = FAQ intro; `faq_01`, `faq_02` ইত্যাদি = আলাদা প্রশ্ন/উত্তর। মূল template sections-এর অবস্থান নির্দিষ্ট; অতিরিক্ত custom sections ও FAQ-এর মধ্যে `order` কাজ করে। `visible` দিয়ে মূল sections-ও hide করা যায়।

## টিম, অনুমতি ও খরচের খাতা (R17)
- **মেইন অ্যাডমিন** (graphictech360@gmail.com) একমাত্র অথরিটি — “টিম ও অনুমতি” ট্যাব থেকে
  সহ-অ্যাডমিন/গেট স্টাফ যোগ, বাদ, সাময়িক বন্ধ ও পাসওয়ার্ড বদল করতে পারেন।
- **সহ-অ্যাডমিন (moderator)**: ট্যাব-ধরে অনুমতি — যে ট্যাবের টিক নেই, সেটি সে দেখেই না;
  সার্ভারও সেই কাজ ৪০৩ দিয়ে আটকায় (দুই স্তরের পাহারা)।
- **খরচের খাতা**: শুধু অ্যাডমিন/অনুমতিপ্রাপ্তদের জন্য — অনুমোদিত নিবন্ধনের আয়
  (বন্ধু/জীবনসঙ্গী/শিশু ভাগে), বন্ধুদের ঐচ্ছিক অনুদান, খরচের এন্ট্রি (কে-কবে-কত স্বয়ংক্রিয়),
  মোট তহবিল − খরচ = ব্যালেন্স, CSV ডাউনলোড। ফি-র অঙ্ক বদলাতে হয় «অনুষ্ঠান ও ফি» ট্যাব থেকে।
- **বন্ধুদের ঐচ্ছিক অনুদান — আলাদা অনুমতি (R17.1):** সহ-অ্যাডমিনের চেকলিস্টে
  «বন্ধুদের ঐচ্ছিক অনুদান» আলাদা ঘর। এই অনুমতি (বা মেইন অ্যাডমিন) ছাড়া কেউ অনুদান
  যোগ/এডিট/মুছতে পারে না — বাকিরা খরচের খাতায় তালিকাটা শুধু দেখতে পায়, কোনো এডিট-বোতাম পায় না।
  একইভাবে শুধু «খরচের খাতা» অনুমতি থাকলে খরচ লেখা যায়, অনুদান শুধু-দেখা।
- পরীক্ষা: `bash scripts/demo-dev.sh` তারপর `node tests/team-expenses.mjs` (৩৪টি চেক)।
- লাইভে নেওয়ার SQL: `supabase/25_team_finance.sql` (ডিপ্লয়ের অনুমোদনের পর চালাতে হবে)।

## R20: আগের সফল আয়োজনের স্মৃতি-অ্যালবাম

- **পাবলিক পেজ:** «বয়স বাড়ে, বন্ধুত্ব নয়» অংশের ঠিক নিচে "সফল আয়োজনের স্মৃতি" —
  ছবি নিজে নিজে বদলায় (ক্রসফেড + ধীর জুম), বাঁয়ে-ডানে তীর, উপরে অ্যালবাম-ডট।
  এক আয়োজনের ছবি শেষ হলে পরের আয়োজন — লোকেশন/নাম ও তারিখও বদলে যায়।
  ডান পাশে সেই আয়োজনের ভিডিও (ইউটিউব বা .mp4 লিংক) — চাপলে বড় প্লেয়ারে চলে।
- **অ্যাডমিন → পেজের লেখা ও ছবি:** নিচে "আগের আয়োজনের অ্যালবাম" —
  নাম, তারিখ, যত খুশি ছবি (সরাসরি আপলোড বা https লিংক), ভিডিও লিংক;
  লুকানো/দেখানো, ক্রম বদল, মুছে ফেলা — সব এক জায়গায়। অনুমতি: «পেজের লেখা ও ছবি»।
- **ডেটাবেজ:** `memory_albums` টেবিল (RPC-only, RLS অন); ছবি ফাইল যায়
  `photos/memories/…` ফোল্ডারে। মাইগ্রেশন: `supabase/26_memories.sql`।

## R21: ভেন্যুর লাইভ লোকেশন ম্যাপ

রেজিস্ট্রেশন সেকশনের বাঁ পাশে (QR-টিকিট নোটের নিচে) ভেন্যুর গুগল ম্যাপ দেখা যায়।

- **অতিথির জন্য:** ম্যাপে ভেন্যুর অবস্থান; "আমার অবস্থান থেকে রুট দেখো" চাপলে গুগল ম্যাপ খুলে নিজের জায়গা থেকে ভেন্যু পর্যন্ত পথ দেখায়; "গুগল ম্যাপে খোলো" বোতামে বড় ম্যাপ।
- **অ্যাডমিনের জন্য:** অ্যাডমিন প্যানেল → অনুষ্ঠান ও ফি → অনুষ্ঠানের তথ্য-তে তিনটি নতুন ঘর —
  - *ম্যাপে খোঁজার ঠিকানা*: যেমন `ভিন্নজগৎ, রংপুর` বা `25.8605, 89.2720`
  - *গুগল ম্যাপ লিংক (ঐচ্ছিক)*: https:// শেয়ার/এমবেড লিংক — এমবেড লিংক দিলে সেটিই সরাসরি বসে
  - *পাবলিক পেজে লোকেশন ম্যাপ দেখাও*: আনচেক করলে সেকশনটি লুকায়
- **ডাটাবেস:** `supabase/27_event_map.sql` — `event_events`-এ `map_query / map_link / map_visible` কলাম; `public_site()` ও `admin_mutate()` হালনাগাদ।
- **নিরাপত্তা:** কেবল `https://www.google.com` ও `https://maps.google.com`-এর iframe অনুমোদিত (CSP frame-src)।

## R22: ইন-অ্যাপ রুট, এডিটেবল স্মৃতি-লেখা, ভিডিও প্রিভিউ-ছবি

- **অ্যাপের ভেতরেই রুট:** ভেন্যু-ম্যাপ কার্ডে "অ্যাপেই রুট দেখো" চাপলে ব্রাউজার লোকেশনের অনুমতি নিয়ে ওই ম্যাপেই নিজের অবস্থান→ভেন্যু রুট দেখায় — 🚌 বাস/গণপরিবহন, 🏍️ বাইক/গাড়ি, 🚶 হাঁটা বেছে নেওয়া যায়; ট্যাব বদলাতে হয় না। "গুগল ম্যাপ অ্যাপে এই রুট" বোতামে আগের মতো আলাদা ট্যাবও খোলে। (Permissions-Policy: geolocation=self)
- **স্মৃতি-সেকশনের লেখা এডিটেবল:** "সফল আয়োজনের স্মৃতি" অংশের উপশিরোনাম/শিরোনাম/বর্ণনা এখন অ্যাডমিন → পেজের লেখা ও ছবি → `past_events` সেকশন থেকে বদলানো যায়; লুকালে সেকশনটি পাবলিক পেজ থেকে সরে। (`supabase/28_memory_texts.sql`)
- **ভিডিওর প্রিভিউ-ছবি:** সবুজ বক্সের বদলে ভিডিও থেকেই থাম্বনেইল — ইউটিউব হলে অফিসিয়াল থাম্ব, Cloudinary হলে প্রথম ফ্রেমের jpg, অন্য mp4 হলে ভিডিওর প্রথম ফ্রেম; অ্যাডমিন অ্যালবাম-ম্যানেজারেও একই প্রিভিউ। ইউটিউব প্লেয়ারের জন্য CSP frame-src-এ youtube-nocookie যুক্ত।
