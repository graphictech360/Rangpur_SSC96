# Rangpur SSC 96 Festival

**প্রকল্পের অবস্থা:** কার্যকর local demo + Supabase-ready source code। ব্যবহারকারীর দেওয়া Supabase প্রকল্পে কোনো migration এখনো চালানো হয়নি; publishable/anon key দেওয়া হয়নি। এটি production-এ চালু করা হয়েছে—এমন দাবি নয়।

## যা তৈরি হয়েছে

- একটি লিংকে responsive Bengali festival web app; ফোনে PWA হিসেবে হোম স্ক্রিনে যোগ করা যাবে। আলাদা Android/iOS native অ্যাপ নয়।
- হালকা cream background, green/coral/yellow palette, বড় creative heading, image parallax/float, text reveal, moving festival ribbon। Reduced-motion preference সম্মান করা হয়।
- দেওয়া logo ও Friends Forever ছবির local, optimized WebP assets; Bangla/English fonts local। কোনো CDN stylesheet বা image নির্ভরতা নেই।
- বাংলা সময়সূচির ১৪টি আয়োজন; সকাল ৯টার নিবন্ধন/পিঠা উৎসব ও দুপুর ১২টায় কাউন্টার বন্ধের নোট।
- তিন ধাপের form: পরিচয়, পরিবার, পেমেন্ট। এসএসসি রোল প্রয়োজনীয়; SSC registration ঐচ্ছিক।
- ফি: বন্ধু ৳১,৪৯৯ + জীবনসঙ্গী ৳৫০০ (০/১ জন) + প্রতি শিশু ৳২০০। Server-side calculation এবং registration-time fee snapshots।
- বিকাশ/নগদের ব্যক্তিগত Send Money নম্বর: Tomal, Mahatab, Shohag, Arif। Provider/collector selection, copy-number, sender mobile, transaction ID।
- ম্যানুয়াল payment review: pending → approved/rejected। Status অংশগ্রহণকারী নিজে বদলাতে পারেন না। একই provider+TrxID পুনর্ব্যবহার আটকানো হয়েছে।
- অনুমোদনের পর random-token QR ticket, unique `R96-xxxxx` number, digital receipt, PNG download ও Print/PDF।
- **কোনো SMS/email প্রয়োজন নেই।** Receipt/status-এর গোপন লিংক registration-এর পর দেওয়া হয়; একই ব্রাউজারে “আমার টিকিট”-এও পাওয়া যায়। খোলা status page প্রতি ১৫ সেকেন্ডে আপডেট হয়।
- Staff-only camera QR scan, QR image upload ও ticket-number fallback। Staff login + admin-approved browser session ছাড়া check-in নয়; এক টিকিটে একবার entry।
- Admin: overview, participant add/edit/soft-remove, individual payment review/correction, CSV export, event/fee/content/schedule/payment-number editing, browser-device approval/revocation, action log, lost-link recovery।
- একজন বন্ধু ও তার নিবন্ধিত পরিবার **একটি QR দিয়ে একসঙ্গে** check-in করবেন। আলাদা সময়ে/আলাদা শিশুতে partial check-in এই সংস্করণে নেই।

## দ্রুত ডেমো চালানো

Node.js 20+ প্রয়োজন।

```bash
npm ci
npm run dev
```

খুলুন `http://localhost:3000`। Mobile/desktop একই app।

| পেজ                         | পথ                           |
| --------------------------- | ---------------------------- |
| মূল festival ও registration | `/`                          |
| গোপন status/receipt link    | `/#ticket=YOUR_RECOVERY_KEY` |
| আয়োজক প্যানেল               | `/admin`                     |
| গেট চেক-ইন                  | `/check-in`                  |

ডেমো login পেজে এক-ক্লিক অ্যাকাউন্ট রয়েছে:

- Admin: `admin@ssc96.demo` / `Festival96!`
- Gate staff: `staff@ssc96.demo` / `Checkin96!`

**এই অ্যাকাউন্টগুলো কেবল `DATA_MODE=demo`-তে কাজ করে। ডেমোতে বাস্তব টাকা পাঠাবেন না বা প্রকৃত ব্যক্তিগত তথ্য দেবেন না।** নম্বরগুলো ব্যবহারকারীর দেওয়া, কিন্তু ডেমো পেমেন্ট কোনো বাস্তব টাকা সংগ্রহ করে না।

ডেমোর কাল্পনিক তথ্য `data/demo-store.json`-এ থাকে। Server বন্ধ করে এই ফাইল মুছলে পরবর্তী startup-এ ডেমো reset হয়। এই ফাইল source ZIP-এ রাখা হয়নি।

## সার্ভার ছাড়া অফলাইন প্রিভিউ (সহজে দেখানোর জন্য)

কোনো ইনস্টলেশন, সার্ভার বা ইন্টারনেট ছাড়াই একটি ফাইলেই পুরো অ্যাপ দেখা যায়:

```bash
npm run preview:build   # তৈরি করে: Rangpur-SSC96-Preview.html (প্রজেক্টের বাইরে /home/user-এ)
npm run preview:test    # হেডলেস ব্রাউজারে ফর্ম → pending → অনুমোদন → QR যাচাই করে
```

`Rangpur-SSC96-Preview.html`-এ CSS, JS, বাংলা ফন্ট ও ছবি সব ভেতরে বসানো থাকে, তাই WhatsApp/ইমেইলে পাঠিয়ে ফোনের ব্রাউজারে খোলা যায়। এতে চলে ডেমো স্টোরের হুবহু একই কোড (`server/demo-store.mjs`), শুধু ডেটা ব্রাউজারের ভেতরে (localStorage) থাকে — কিন্তু কোনো অনলাইন কাজ হয় না। এই প্রিভিউর কোড `preview/` ফোল্ডারে; প্রকৃত সার্ভার/অ্যাপের কোনো অংশ বদলায় না। ভেতরে `process.env`-এর `SUPABASE_*` মান কখনো বসানো হয় না, তাই ডেমো মোডই চলে।

## 🌐 লাইভ অ্যাড্রেস (Vercel)

**https://rangpur-ssc96.vercel.app** — সবার জন্য খোলা। অ্যাডমিন প্যানেল: `/admin` (শুধু `graphictech360@gmail.com`)।

- Vercel প্রজেক্ট: `rangpur-ssc96` (টিম `nirob14`) · ডেটা: আসল Supabase · ডেমো নয়
- এনভায়রনমেন্ট: `DATA_MODE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY`, `APP_ORIGIN`
- সেশন এখন **সই-করা কুকিতে** (serverless-এর একাধিক ইনস্ট্যান্সেও টেকে), অ্যাডমিন সেশন ৮ ঘণ্টা
- পাসওয়ার্ড রিসেট: `/admin/reset` · Supabase `site_url` = `https://rangpur-ssc96.vercel.app`

## Supabase Table Editor-এ টেবিল কোথায়?

Table Editor খুললে schema dropdown-এ `public` লেখা থাকে — তাই খালি দেখায়। **সেকশনের নাম বাছুন**, তারপর যেকোনো টেবিলে ক্লিক করলেই শুধু সেই টেবিলের ডেটা দেখাবে:

| schema | সেকশন | টেবিল |
|---|---|---|
| `admin` | অ্যাডমিন | admins · login_events · password_resets · email_outbox · devices · audit_logs |
| `payment` | পেমেন্ট | accounts · payments · refunds |
| `registration` | বন্ধু ও নিবন্ধন | participants · registrations · links |
| `gate` | গেট | tickets · checkins |
| `content` | পেজের লেখা | sections · schedule |
| `event` | অনুষ্ঠান | events · fees · contacts |
| `report` | রিপোর্ট | ৮টি হিসাব-ভিউ |
| `guide` | গঠন-বর্ণনা | tables · flows |
| `database` | ডেটাবেস | schemas · settings · migrations |

মোট **৯ স্কিমা · ২৪ টেবিল · ৩৬ সম্পর্ক · ৮ রিপোর্ট ভিউ**। বিস্তারিত: `docs/DATABASE.bn.md`

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

## ডেমো পরীক্ষা করার সহজ পথ

1. Registration → “ডেমো তথ্য” → পরিবার বাছাই → “কাল্পনিক পেমেন্ট তথ্য বসাও” → consent → submit।
2. গোপন ticket link কপি করুন। QR তখনো থাকবে না।
3. `/admin` → demo admin → payment review → নিজের record মিলিয়েছি checkbox → approve।
4. Ticket link খুলুন/refresh করুন; QR ও receipt দেখা যাবে।
5. `/check-in` → staff login → device approval request।
6. Admin-এর “স্টাফ ডিভাইস” থেকে approve → staff screen-এ permission refresh।
7. QR scan/image upload বা ticket number দিয়ে check-in। দ্বিতীয়বার duplicate message আসবে।

ডেমো admin credentials সবার জানা বলেই এটি বাস্তব registration-এর জন্য নয়। Live mode-এ নিজের Supabase Auth accounts ও roles ব্যবহার করতে হবে।

## Supabase সংযোগ: Rangpur_SSC96

Project URL: `https://mbuzwqsrnmergrtetwqq.supabase.co`

URL একা দিয়ে database পরিবর্তন করা যায় না। আপনার Supabase dashboard-এ নিজে নিচের কাজগুলো করুন:

1. বিদ্যমান database থাকলে backup নিন। `01_schema.sql` একটি fresh `ssc96` schema-এর জন্য একবার চালানোর migration। কোনো table DROP করা হয় না।
2. **SQL Editor**-এ `supabase/01_schema.sql` পুরোটা চালান।
3. তারপর `supabase/02_seed.sql` চালান। এতে event, ৩টি fee, ১৩টি content row (branding, মূল সেকশন, ribbon ও FAQ), ১৪টি schedule row ও ৮টি payment account যোগ হবে। **কোনো কাল্পনিক participant/payment live database-এ যোগ হয় না।** Seed আবার চালালে admin-edited rows overwrite হয় না।
4. **Authentication → Users** থেকে admin এবং প্রত্যেক gate staff-এর জন্য পৃথক account তৈরি করুন, confirmed email ও শক্তিশালী password দিন। Public signup বন্ধ রাখুন।
5. `supabase/03_staff_setup.sql`-এর placeholder email/name বদলে চালান। শেষে SELECT-এ roles তৈরি হয়েছে কিনা দেখুন।
6. Supabase-এর project API Keys থেকে **publishable key** (`sb_publishable_...`) অথবা legacy **anon key** নিন। **Service-role/secret key ব্যবহার করবেন না।**
7. `.env.example` কপি করে `.env` বানান:

```env
DATA_MODE=supabase
SUPABASE_URL=https://mbuzwqsrnmergrtetwqq.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

8. Server restart করুন। Credentials বা keys source control/public chat-এ দেবেন না।

**Table Editor-এ schema `ssc96` বাছুন।** ওই schema-কে Supabase-এর exposed Data API schemas-এ যোগ করবেন না। সব access controlled public RPC-এর মাধ্যমে হয়; participant/payment tables-এ direct grants নেই এবং RLS default-deny।

Supabase API key security bypass নয়: administrative RPC-তে Auth JWT এবং database staff-role check লাগবেই। Publishable/anon key দিয়ে নিজেকে approve বা check-in করা যাবে না।

## Production deployment

Static-only hosting যথেষ্ট নয়: Express API server প্রয়োজন। একটি Node container/server-এ deploy করুন (যেমন উপযুক্ত Node hosting), একই origin-এ browser ও API থাকবে।

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

- নিজের domain ও HTTPS configure করুন; camera permission-এর জন্য HTTPS প্রয়োজন।
- `SESSION_SECRET` তৈরির উদাহরণ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`। Secret privately store করুন।
- `TRUST_PROXY` আপনার hosting-এর actual proxy chain অনুযায়ী ঠিক করুন।
- Server sessions বর্তমানে memory-তে, সর্বোচ্চ ৮ ঘণ্টা; restart হলে staff-কে আবার login করতে হয়। **একটি Node instance** দিয়ে শুরু করুন। Multi-instance deployment-এর আগে shared session store/sticky-session ব্যবস্থা যোগ করুন। Device authorization Supabase-এ থাকে।
- Real device (Android/iPhone) camera permission, Safari/Chrome login cookie আচরণ, ticket download/printing ও gate network পরীক্ষা করুন। Desktop/image QR tests hardware camera test-এর বিকল্প নয়।
- Public form-এর জন্য প্রয়োজনে CAPTCHA ও additional abuse controls যোগ করুন; API key গোপন থাকা কোনো security assumption নয়।
- Database backup, data retention ও deletion policy ঠিক করুন। Personal number-এ fee সংগ্রহের আগে bKash/Nagad-এর প্রযোজ্য নিয়ম/limits যাচাই করুন।
- এই সংস্করণ payment gateway নয়; ব্যক্তিগত account-এ transfer app স্বয়ংক্রিয়ভাবে যাচাই করে না। Payment approval organizer-এর দায়িত্ব। PIN/OTP চাইবেন না।

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

SQL tests local PostgreSQL-compatible engine-এ migration, isolated table permissions, server-side totals, duplicate payments, approval-before-QR, staff/device restrictions, forged QR rejection, duplicate check-in, content editing, link rotation ও soft-removal যাচাই করে। **এগুলো আপনার remote Supabase project-এ migration চালানোর প্রমাণ নয়।**

## পরের পরিবর্তন সহজ করতে

- তারিখ/ভেন্যু/ফি: Admin → অনুষ্ঠান ও ফি। Year জানা না থাকায় countdown রাখা হয়নি; ৩১ ডিসেম্বর ডেমো label।
- banner text/image, header branding, ribbon, fee heading ও FAQ: Admin → পেজের লেখা ও ছবি। `/assets/...` অথবা HTTPS image URL দিন; নিজের image server/storage-এর CORS export-এর জন্য ঠিক রাখতে হবে। এই সংস্করণে direct image-file upload নেই।
- schedule: Admin → সময়সূচি → edit/add/remove।
- payment numbers: Admin → পেমেন্ট নম্বর। Old receipts collector-name/number snapshots রাখে।
- participant: edit করা যায়। Approved fee/family count পরিবর্তন সরাসরি করা যায় না; verified financial records সুরক্ষিত রাখা হয়েছে। Pending family count বদলালে নতুন total ও actual claimed payment আবার মিলিয়ে নিতে হবে।
- remove: soft-remove/cancel; QR invalid, list থেকে বাদ, কিন্তু payment/check-in/audit record থাকে। এটি refund নয়।
- forgotten receipt link: admin পরিচয় নিশ্চিত করে নতুন recovery link তৈরি করতে পারবেন। পুরোনো link বাতিল হবে; বিদ্যমান QR অপরিবর্তিত থাকে। QR চুরি/compromise হলে ticket বাতিল করুন।

Content keys: `branding` = header logo/name; `marquee` body-এর শব্দগুলো `|` দিয়ে আলাদা; `festival` = fee-section heading; `faq` = FAQ intro; `faq_01`, `faq_02` ইত্যাদি = আলাদা প্রশ্ন/উত্তর। মূল template sections-এর অবস্থান নির্দিষ্ট; অতিরিক্ত custom sections ও FAQ-এর মধ্যে `order` কাজ করে। `visible` দিয়ে মূল sections-ও hide করা যায়।
