# ডেটাবেস গঠন — Rangpur SSC 96 Festival

> প্রকল্প: **Rangpur_SSC96** · `mbuzwqsrnmergrtetwqq` · PostgreSQL 17.11 · Singapore (ap-southeast-1)
> শেষ হালনাগাদ: নতুন সেকশন-ভিত্তিক গঠন বসানোর পর (৯ স্কিমা · ২৪ টেবিল · ৮ রিপোর্ট ভিউ)

---

## ১. এক টেবিল = এক সেকশন (Table Editor-এ কীভাবে দেখবেন)

Supabase Dashboard → **Table Editor** → বাঁয়ে ওপরে **schema dropdown** → সেকশনের নাম বাছুন।
এরপর যেকোনো টেবিলে ক্লিক করলেই **শুধু সেই টেবিলের ডেটা** দেখাবে — এক টেবিলের সাথে আরেক টেবিলের সারি মেশে না।

| schema dropdown-এ বাছুন | সেকশন | ভেতরে টেবিল |
|---|---|---|
| `admin` | **অ্যাডমিন সেকশন** | `admins` · `login_events` · `password_resets` · `email_outbox` · `devices` · `audit_logs` |
| `payment` | **পেমেন্ট সেকশন** | `accounts` · `payments` · `refunds` |
| `registration` | **বন্ধু ও নিবন্ধন** | `participants` · `registrations` · `links` |
| `gate` | **গেট সেকশন** | `tickets` · `checkins` |
| `content` | **পেজের লেখা ও ছবি** | `sections` · `schedule` |
| `event` | **অনুষ্ঠান সেকশন** | `events` · `fees` · `contacts` |
| `report` | **রিপোর্ট সেকশন** | ৮টি হিসাব-ভিউ: `summary` · `school_wise` · `daily` · `attendance` · `refunds` · `tshirt_sizes` · `food_preferences` · `collectors` |
| `guide` | **গঠন-বর্ণনা** | `tables` · `flows` |
| `database` | **ডেটাবেস সেকশন** | `schemas` · `settings` · `migrations` (+ `health` ভিউ) |

> `public` স্কিমা খুললে শুধু **`table_map`** নামের একটি ভিউ দেখবেন — সেটি ২৪টি টেবিলের নাম ও কাজের তালিকা (ডেটা নয়)।

**গুরুত্বপূর্ণ:** এই সেকশন-স্কিমাগুলো **Settings → API → Exposed schemas**-এ যোগ করবেন না। সব কাজ অনুমোদিত RPC দিয়েই হয়, তাই কোনো টেবিল বাইরে থেকে পড়া/লেখা যায় না।

---

## ২. টেবিল-থেকে-টেবিল সংযোগ (৩৬টি foreign key)

```
event.events
   ├── event.fees            ফি-র হার (বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · শিশু ২০০)
   ├── event.contacts        হেল্পলাইন নম্বর
   ├── content.sections      পেজের ১৩টি সেকশন
   ├── content.schedule      ১৪ ধাপের সময়সূচি
   ├── payment.accounts      bKash/Nagad Send Money নম্বর (৮টি)
   ├── registration.participants  অংশগ্রহণকারী
   │      └── registration.registrations  নিবন্ধন (কতজন, মোট ফি, অবস্থা)
   │             ├── registration.links   গোপন টিকিট-লিংকের hash
   │             ├── payment.payments     Send Money রেকর্ড (প্রেরক, TrxID, টাকা)
   │             │      └── payment.refunds   রিফান্ড (আংশিকও হতে পারে)
   │             ├── gate.tickets         QR টিকিট
   │             └── gate.checkins        দরজার চেক-ইন
   ├── admin.devices         অনুমোদিত ফোন → gate.checkins.device_id
   └── admin.audit_logs      সব কাজের লগ

admin.admins  ←  auth.users (Supabase-এর অ্যাকাউন্ট টেবিল)
   ├── admin.devices         approved_by → admin.admins
   ├── admin.login_events    কে কখন ঢুকল
   └── admin.password_resets / admin.email_outbox
```

Supabase-এ দেখার সহজ পথ: যেকোনো টেবিল → **Insert row** পাশে সংযোগগুলো দেখাবে; আর `select * from guide.relations;` দিলে ৩৬টি সম্পর্কের পুরো তালিকা।

---

## ৩. Action → Reaction (কেউ কিছু করলে স্বয়ংক্রিয়ভাবে যা ঘটে)

| কে করল | কী করল | তার ফলে স্বয়ংক্রিয়ভাবে যা ঘটে | কোথায় লেখা হয় |
|---|---|---|---|
| প্রধাণ আয়োজক | সঠিক পাসওয়ার্ডে লগইন | প্যানেল খোলে; `log_login` ডাকে | `admin.login_events` (succeeded=true), `admin.admins.last_login_at`, `login_count+1` |
| যে কেউ | ভুল পাসওয়ার্ড | প্যানেল খোলে না | `admin.login_events` (succeeded=false), `failed_logins+1` |
| স্টাফ | "পাসওয়ার্ড ভুলে গেছি" | ইমেইল থাকলে Supabase Auth রিসেট-লিংক পাঠায়; **বাইরে সবসময় একই উত্তর** (তথ্য ফাঁস নয়) | `admin.password_resets`, `admin.email_outbox` |
| অংশগ্রহণকারী | নিবন্ধন জমা | ফি snapshot হয়, গোপন ট্র্যাকিং কী তৈরি, অবস্থা `pending` | `registration.participants`, `registration.registrations`, `payment.payments`, `registration.links` |
| অংশগ্রহণকারী | একই মোবাইল/TrxID আবার | ডেটাবেস আটকে দেয়, বাংলা বার্তা | — |
| অ্যাডমিন | পেমেন্ট **যাচাই** | ① পেমেন্ট `verified` ② নিবন্ধন `approved` ③ **নতুন QR টিকিট তৈরি** ④ অডিট | `payment.payments`, `registration.registrations`, `gate.tickets`, `admin.audit_logs` |
| অ্যাডমিন | পেমেন্ট **প্রত্যাখ্যান** | পেমেন্ট `rejected`, টিকিট `revoked`(চেক-ইন হলে আটকে যায়) | `payment.payments`, `gate.tickets` |
| অ্যাডমিন | **রিফান্ড** | রিফান্ড রেকর্ড → পেমেন্ট `refunded` → নিবন্ধন `refunded` → **QR বাতিল**। জমার চেয়ে বেশি রিফান্ড আটকানো | `payment.refunds`, `payment.payments`, `registration.registrations`, `gate.tickets` |
| স্টাফ | QR স্ক্যান (অনুমোদিত ফোনে) | তিনটি শর্ত মিলতেই ঢুকবে (approved + verified + চালু টিকিট); একবারই | `gate.checkins`, `admin.audit_logs` |
| স্টাফ | একই QR আবার | দ্বিতীয় সারি হয় না — "আগেই চেক-ইন হয়েছে" | — |
| চলতি কাজ | মোবাইল নম্বর লেখা | যেকোনো রূপ → `01XXXXXXXXX` | ট্রিগার |
| নতুন স্টাফ যোগ | `admin.admins`-এ সারি | auth.users থেকে ইমেইল ও নাম নিজে থেকে বসে | ট্রিগার `trg_admin_fill` |
| অ্যাডমিন | ফি/লেখা/নম্বর বদল | নতুন ফি আগামী নিবন্ধনে; পুরোনোতে তখনকার snapshot অটুট | `event.fees`, `content.*` |

---

## ৪. শুরুর ডেটা (সিড)

| কী | সংখ্যা |
|---|---|
| অনুষ্ঠান | ১ (`rangpur-ssc96`) · ফি বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · শিশু ২০০ |
| পেজের সেকশন | ১৩ |
| সময়সূচি | ১৪ ধাপ (সকাল ০৯:০০ – সন্ধ্যা ০৬:০০) |
| Send Money নম্বর | ৮ (Tomal · Mahatab · Shohag · Arif — bKash ও Nagad) |
| যোগাযোগ নম্বর | ৪ |
| গঠন-বর্ণনা | ২৪ টেবিল + ১৬ কার্য-প্রবাহ |
| নমুনা মানুষ/পেমেন্ট | **শূন্য** — আসল নিবন্ধন ছাড়া কিছু নেই |

---

## ৫. আসল ডেটাবেসে যাচাই করা ফল (সর্বশেষ)

```
সেকশন-স্কিমা : ৯
টেবিল        : ২৪  (সবগুলোতে RLS চালু ✅)
রিপোর্ট ভিউ  : ৮
SECURITY DEFINER ফাংশন : ১৮
ইনডেক্স ৫৮ · ট্রিগার ২৬ · সম্পর্ক ৩৬
টেবিল-বর্ণনা ২৯ · কলাম-বর্ণনা ৪১
অ্যাডমিন     : ১ (graphictech360@gmail.com)
বাইরে থেকে সরাসরি টেবিল পড়া : নিষিদ্ধ (404) ✅
অনন-এর admin_overview / guide_overview / staff_identity : 401 ✅
```

পুরো কার্য-প্রবাহ পরীক্ষা: `node tests/supabase-chain.mjs` → **৩৮/৩৮ পাস**
(নিবন্ধন → অনুমোদন → QR → ফোন-নিষেধ → রিফান্ড → টিকিট বাতিল → লিংক অচল)

---

## ৬. নতুন করে বসাতে হলে (ক্রম)

Supabase SQL Editor-এ একের পর এক অথবা `supabase/04_SETUP_ALL_IN_ONE.sql` পুরোটা একবারে:

```
00_reset.sql   (পুরোনো গঠন মুছে ফেলে — শুধু নতুন করে বসানোর আগে)
10_database · 11_event · 12_content · 13_registration · 14_payment ·
15_admin · 16_gate · 17_report · 18_functions · 19_rules · 20_guide ·
21_api · 22_seed · 23_harden (নিরাপত্তা)
তারপর: 03_staff_setup.sql — আপনার ইমেইল বসিয়ে চালালেই admin.admins ভরে যাবে
```

অথবা টোকেন দিয়ে: `node scripts/supabase-apply.mjs --ref mbuzwqsrnmergrtetwqq`

---

## ৭. মূল আয়োজকের কাজের নিয়ম

- **অ্যাডমিন টেবিল:** `admin.admins` — শুধু একজনেরই `role='admin'` থাকতে পারে (unique index), বাকিরা `scanner`।
- কারও অনুমতি বাতিল: `update admin.admins set is_active=false where user_id='…';`
- Supabase Auth-এ **পাবলিক সাইন-আপ বন্ধ** — বাইরের কেউ নিজে অ্যাকাউন্ট বানাতে পারে না।
- ⚠️ পাসওয়ার্ড `123456` দুর্বল — Authentication → Users থেকে যেকোনো সময় বদলে নিন।
