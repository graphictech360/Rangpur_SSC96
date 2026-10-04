# ডেটাবেস গঠন — Rangpur SSC 96 Festival

> প্রকল্প: **Rangpur_SSC96** · `mbuzwqsrnmergrtetwqq` · PostgreSQL 17.11 · Singapore (ap-southeast-1)
> শেষ হালনাগাদ: সব টেবিল এক স্কিমায় (public) আনার পর — ২৪ টেবিল · ১৪ ভিউ · ১৩টি অনুমোদিত RPC

---

## ১. সব টেবিল একটিমাত্র স্কিমায় — `public` (Table Editor-এ কীভাবে দেখবেন)

Supabase Dashboard → **Table Editor** খুললেই বাঁয়ের তালিকায় **সব টেবিল একসাথে** দেখা যায় —
কোনো dropdown বদলাতে হয় না। যেকোনো টেবিলে ক্লিক করলেই **শুধু সেই টেবিলের ডেটা ও কলাম** দেখাবে।

নামের শুরুতেই সেকশন বোঝা যায়:

| নামের শুরু (প্রিফিক্স) | সেকশন | টেবিল                                                                     |
| ---------------------- | ------ | ------------------------------------------------------------------------- |
| **(কিছু নেই)** = আপনার **"user" সেকশন** | বন্ধু ও নিবন্ধন | **`user`** (এক ক্লিকে সবার সব তথ্য) · `participants` · `registrations` · `user_links` |
| `admin_`               | অ্যাডমিন সেকশন | `admin_users` · `admin_login_events` · `admin_password_resets` · `admin_email_outbox` · `admin_devices` · `admin_audit_logs` |
| `payment_` / `payments` / `refunds` | পেমেন্ট সেকশন | `payments` · `payment_accounts` · `refunds`                    |
| `gate_`                | গেট সেকশন | `gate_tickets` · `gate_checkins`                                          |
| `content_`             | পেজের লেখা ও ছবি | `content_sections` · `content_schedule`                              |
| `event_`               | অনুষ্ঠান সেকশন | `event_events` · `event_fees` · `event_contacts`                       |
| `report_`              | রিপোর্ট সেকশন | ৮টি হিসাব-ভিউ: `report_summary` · `report_school_wise` · `report_daily` · `report_attendance` · `report_refunds` · `report_tshirt_sizes` · `report_food_preferences` · `report_collectors` |
| `guide_`               | গঠন-বর্ণনা | `guide_tables` · `guide_flows` · `guide_relations` · `guide_schemas` · `guide_functions` · `guide_overview` |
| `database_`            | ডেটাবেস সেকশন | `database_schemas` · `database_settings` · `database_migrations` · `database_health` |

### `user` টেবিল (এক ক্লিকে সবার সব তথ্য)

| কলাম | মানে |
| ---- | ---- |
| `Name` · `School name` · `Mobile` · `SSC Roll` · `Location` | পরিচয় ও যোগাযোগ |
| `Spouse` · `Child` | কতজন সঙ্গী, কতজন শিশু |
| `Amount` | মোট ফি (৳১৪৯৯ + ৳৫০০ + ৳২০০/শিশু) |
| `Payment method` · `Sender mobile` · `Transaction ID` | কে কোন মাধ্যমে পাঠাল |
| **`Verified`** | **true হলে পেমেন্ট যাচাই হয়ে গেছে** |
| `Status` · `Ticket number` · `Photo` · `Date` | অনুমোদনের অবস্থা, টিকিট নম্বর, ছবি, তারিখ |

`user` একটি **ভিউ** — ডেটা লেখা যায় না; আসল লেখা হয় `participants`, `registrations`, `payments`-এ
(এবং আপনি চাইলে অ্যাডমিন প্যানেল থেকেও)।

**গুরুত্বপূর্ণ:** বাইরে থেকে কেউ `public`-এর টেবিল পড়তে পারে না (RLS + REVOKE করা) —
সব কাজ অনুমোদিত RPC দরজাগুলো দিয়েই হয়। Dashboard-এ service_role দিয়ে সব দেখা যায়, তাই আপনার টেবিল দেখতে কোনো সমস্যা নেই।

## ২. টেবিল-থেকে-টেবিল সংযোগ (৩৬টি foreign key — Schema Visualizer-এ দেখা যায়)

```
event_events
   ├── event_fees            ফি-র হার (বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · শিশু ২০০)
   ├── event_contacts        হেল্পলাইন নম্বর
   ├── content_sections      পেজের ১৩টি সেকশন
   ├── content_schedule      ১৪ ধাপের সময়সূচি
   ├── payment_accounts      bKash/Nagad Send Money নম্বর (৮টি)
   ├── participants  অংশগ্রহণকারী (ছবির লিংক photo_url সহ)
   │      └── registrations  নিবন্ধন (কতজন, মোট ফি, অবস্থা)
   │             ├── user_links   গোপন টিকিট-লিংকের hash
   │             ├── payments     Send Money রেকর্ড (প্রেরক, TrxID, টাকা)
   │             │      └── refunds   রিফান্ড (আংশিকও হতে পারে)
   │             ├── gate_tickets         QR টিকিট
   │             └── gate_checkins        দরজার চেক-ইন
   ├── admin_devices         অনুমোদিত ফোন → gate_checkins.device_id
   └── admin_audit_logs      সব কাজের লগ

admin_users  ←  auth.users (Supabase-এর অ্যাকাউন্ট টেবিল)

ছবি রাখার জায়গা: Supabase **Storage → photos** bucket (Vercel-এ ফাইল স্থায়ীভাবে রাখা যায় না)।
যেকোনো সাইজের ছবি দিলেও অ্যাপ সেটি **৫১২×৫১২ স্কয়ার JPEG** (~৪০–৯০ KB) বানিয়ে তোলে;
`participants.photo_url`-এ সেই লিংক লেখা হয়। প্যানেল থেকে ছবি দেখতে:
Storage → photos → participants → তারিখ।
   ├── admin_devices         approved_by → admin_users
   ├── admin_login_events    কে কখন ঢুকল
   └── admin_password_resets / admin_email_outbox
```

Supabase-এ দেখার সহজ পথ: **Database → Schema Visualizer** — টেবিলগুলো ও তাদের তীর-সংযোগের ছবি একসাথে;
আর `select * from guide_relations;` দিলে ৩৬টি সম্পর্কের পুরো তালিকা।

---

## ৩. Action → Reaction (কেউ কিছু করলে স্বয়ংক্রিয়ভাবে যা ঘটে)

| কে করল         | কী করল                     | তার ফলে স্বয়ংক্রিয়ভাবে যা ঘটে                                                                                            | কোথায় লেখা হয়                                                                                     |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| প্রধাণ আয়োজক  | সঠিক পাসওয়ার্ডে লগইন      | প্যানেল খোলে; `log_login` ডাকে                                                                                             | `admin_login_events` (succeeded=true), `admin_users.last_login_at`, `login_count+1`                |
| যে কেউ         | ভুল পাসওয়ার্ড             | প্যানেল খোলে না                                                                                                            | `admin_login_events` (succeeded=false), `failed_logins+1`                                           |
| স্টাফ          | "পাসওয়ার্ড ভুলে গেছি"     | ইমেইল থাকলে Supabase Auth রিসেট-লিংক পাঠায়; **বাইরে সবসময় একই উত্তর** (তথ্য ফাঁস নয়)                                    | `admin_password_resets`, `admin_email_outbox`                                                       |
| অংশগ্রহণকারী   | নিবন্ধন জমা                | ফি snapshot হয়, গোপন ট্র্যাকিং কী তৈরি, অবস্থা `pending`                                                                  | `participants`, `registrations`, `payments`, `user_links` |
| অংশগ্রহণকারী   | নিজের ছবি দিয়ে নিবন্ধন    | ব্রাউজারে ছবি **৫১২×৫১২** ছোট হয় → `POST /api/photo` → **Supabase Storage (photos bucket)** → লিংক ফেরত → database-এ লেখা | Storage → photos, `participants.photo_url`                                             |
| অংশগ্রহণকারী   | ছবি না দিয়ে জমা           | সেটিং `app.photo_required=true` থাকলে আটকে দেয়, বাংলা বার্তা                                                              | — (প্যানেল থেকে ঐচ্ছিক করা যায়)                                                                    |
| অংশগ্রহণকারী   | একই মোবাইল/TrxID আবার      | ডেটাবেস আটকে দেয়, বাংলা বার্তা                                                                                            | —                                                                                                   |
| অ্যাডমিন       | পেমেন্ট **যাচাই**          | ① পেমেন্ট `verified` ② নিবন্ধন `approved` ③ **নতুন QR টিকিট তৈরি** ④ অডিট                                                  | `payments`, `registrations`, `gate_tickets`, `admin_audit_logs`                |
| অ্যাডমিন       | পেমেন্ট **প্রত্যাখ্যান**   | পেমেন্ট `rejected`, টিকিট `revoked`(চেক-ইন হলে আটকে যায়)                                                                  | `payments`, `gate_tickets`                                                                  |
| অ্যাডমিন       | **রিফান্ড**                | রিফান্ড রেকর্ড → পেমেন্ট `refunded` → নিবন্ধন `refunded` → **QR বাতিল**। জমার চেয়ে বেশি রিফান্ড আটকানো                    | `refunds`, `payments`, `registrations`, `gate_tickets`                 |
| স্টাফ          | QR স্ক্যান (অনুমোদিত ফোনে) | তিনটি শর্ত মিলতেই ঢুকবে (approved + verified + চালু টিকিট); একবারই; ফলাফলে **ছবি** আসে যাতে চিনতে পারে                     | `gate_checkins`, `admin_audit_logs`                                                                 |
| স্টাফ          | একই QR আবার                | দ্বিতীয় সারি হয় না — "আগেই চেক-ইন হয়েছে"                                                                                | —                                                                                                   |
| চলতি কাজ       | মোবাইল নম্বর লেখা          | যেকোনো রূপ → `01XXXXXXXXX`                                                                                                 | ট্রিগার                                                                                             |
| নতুন স্টাফ যোগ | `admin_users`-এ সারি      | auth.users থেকে ইমেইল ও নাম নিজে থেকে বসে                                                                                  | ট্রিগার `trg_admin_fill`                                                                            |
| অ্যাডমিন       | ফি/লেখা/নম্বর বদল          | নতুন ফি আগামী নিবন্ধনে; পুরোনোতে তখনকার snapshot অটুট                                                                      | `event_fees`, `content.*`                                                                           |

---

## ৪. শুরুর ডেটা (সিড)

| কী                  | সংখ্যা                                                     |
| ------------------- | ---------------------------------------------------------- |
| অনুষ্ঠান            | ১ (`rangpur-ssc96`) · ফি বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · শিশু ২০০ |
| পেজের সেকশন         | ১৩                                                         |
| সময়সূচি            | ১৪ ধাপ (সকাল ০৯:০০ – সন্ধ্যা ০৬:০০)                        |
| Send Money নম্বর    | ৮ (Tomal · Mahatab · Shohag · Arif — bKash ও Nagad)        |
| যোগাযোগ নম্বর       | ৪                                                          |
| গঠন-বর্ণনা          | ২৪ টেবিল + ১৬ কার্য-প্রবাহ                                 |
| নমুনা মানুষ/পেমেন্ট | **শূন্য** — আসল নিবন্ধন ছাড়া কিছু নেই                     |

---

## ৫. আসল ডেটাবেসে যাচাই করা ফল (সর্বশেষ)

```
public-এর টেবিল : ২৪  (সবগুলোতে RLS চালু ✅)
ভিউ            : ১৪  (৮টি রিপোর্ট + guide ৪টি + user + database_health)
SECURITY DEFINER ফাংশন : ১৩ (অনুমোদিত RPC দরজা)
ইনডেক্স ৫৯ · ট্রিগার ২৬ · সম্পর্ক ৩৬
টেবিল-বর্ণনা ৩৭ · কলাম-বর্ণনা ৪২
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
10_database · 11_event · 12_content · 13_user · 14_payment ·
15_admin · 16_gate · 17_report · 18_functions · 19_rules · 20_guide ·
21_api · 22_seed · 23_harden (নিরাপত্তা)
তারপর: 03_staff_setup.sql — আপনার ইমেইল বসিয়ে চালালেই admin_users ভরে যাবে
```

অথবা টোকেন দিয়ে: `node scripts/supabase-apply.mjs --ref mbuzwqsrnmergrtetwqq`

---

## ৭. মূল আয়োজকের কাজের নিয়ম

- **অ্যাডমিন টেবিল:** `admin_users` — শুধু একজনেরই `role='admin'` থাকতে পারে (unique index), বাকিরা `scanner`।
- কারও অনুমতি বাতিল: `update admin_users set is_active=false where user_id='…';`
- Supabase Auth-এ **পাবলিক সাইন-আপ বন্ধ** — বাইরের কেউ নিজে অ্যাকাউন্ট বানাতে পারে না।
- ⚠️ পাসওয়ার্ড `123456` দুর্বল — Authentication → Users থেকে যেকোনো সময় বদলে নিন।

## নিবন্ধন ফর্মের ঘর — `content_form_fields`

| কলাম | মানে |
| --- | --- |
| `field_key` | ছোট ইংরেজি কী (যেমন `blood_group`) — উত্তর এখানেই জমা হয় |
| `label_bn` | ফর্মে যা দেখাবে (বাংলা নাম) |
| `kind` | ঘরের ধরন: `text`, `textarea`, `select`, `number`, `tel`, `date`, `checkbox` |
| `options` | `select`-এর বিকল্পগুলো (JSON তালিকা) |
| `placeholder`, `help_bn` | ভেতরের ছায়া-লেখা ও ছোট সাহায্য |
| `max_length` | সর্বোচ্চ কত অক্ষর নেওয়া হবে |
| `is_required` | `true` হলে ফাঁকা রাখলে জমা হবে না |
| `is_visible` | `false` করলে ফর্মে দেখাবে না, মুছবে না |
| `sort_order` | ছোট আগে (উপর-নিচের ক্রম) |

**সংযোগ:** `content_form_fields` (কোন ঘর) → `registrations.custom_answers` (কার কী উত্তর)।
অ্যাডমিন প্যানেল `formField.save` / `formField.delete` / `formField.move` দিয়ে বদলায়;
পাবলিক সাইট `public_site() → formFields` পড়ে; জমা নেওয়ার সময়
`submit_registration()` বাধ্যতামূলক ঘর যাচাই করে; রিপোর্টে `form_field_stats()` কে কী
উত্তর দিয়েছে তা গুনে দেয়। খাবারের পছন্দ (`food_preference`) আর `notes` এখন ঐচ্ছিক —
ফর্মে আর নেই, তবে আগের ডেটা ও কলাম অক্ষত।

