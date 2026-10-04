-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১১ | শুরুর ডেটা (নিরাপদে বারবার চালানো যায় — অ্যাডমিনের বদলানো
-- লেখা কখনো মুছে যায় না, শুধু অনুপস্থিত সারি যোগ হয়)
-- ভেতরে আছে: স্কিমা-তালিকা, অ্যাপ সেটিংস, মাইগ্রেশন-হিসাব, অনুষ্ঠান ও ফি,
-- যোগাযোগ নম্বর, ১৩টি সেকশন, ১৪টি সময়সূচি, ৮টি Send Money নম্বর,
-- ২৫টি টেবিলের বর্ণনা এবং ১৬টি কার্য-প্রবাহ (action → reaction)।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;
SET search_path = pg_catalog, public;

-- ── ১. কোন স্কিমা কী কাজে ─────────────────────────────────────────
INSERT INTO database.schemas(name, section_bn, purpose_bn, sort_order) VALUES
 ('database', 'ডেটাবেস সেকশন', 'ডেটাবেস-স্তরের হিসাব: স্কিমা-তালিকা, সেটিংস, মাইগ্রেশন ও স্বাস্থ্য-ভিউ।', 1),
 ('admin', 'অ্যাডমিন সেকশন', 'অ্যাডমিন টেবিল, লগইন-হিসাব, পাসওয়ার্ড রিসেট, ইমেইল-আউটবক্স, অনুমোদিত ফোন ও অডিট-লগ।', 2),
 ('event', 'অনুষ্ঠান সেকশন', 'অনুষ্ঠানের পরিচয়, ফি-র হার ও প্রকাশ্য যোগাযোগ নম্বর।', 3),
 ('content', 'পেজের লেখা ও ছবি', 'ওয়েবসাইটের ১৩টি সেকশন ও ১৪ ধাপের সময়সূচি।', 4),
 ('registration', 'বন্ধু ও নিবন্ধন সেকশন', 'অংশগ্রহণকারী, নিবন্ধন ও গোপন টিকিট-লিংক।', 5),
 ('payment', 'পেমেন্ট সেকশন', 'Send Money নম্বর, প্রতি নিবন্ধনের পেমেন্ট রেকর্ড ও রিফান্ড।', 6),
 ('gate', 'গেট সেকশন', 'QR টিকিট ও দরজার চেক-ইন।', 7),
 ('report', 'রিপোর্ট সেকশন', 'হিসাবের ভিউ: মোট, স্কুলভিত্তিক, দিনভিত্তিক, উপস্থিতি, রিফান্ড ও সাইজ/খাবার।', 8),
 ('guide', 'গঠন-বর্ণনা', 'কোন টেবিল কী কাজে, কার সাথে সম্পর্ক, কোন কাজে কী ঘটে।', 9)
ON CONFLICT (name) DO UPDATE SET section_bn = excluded.section_bn, purpose_bn = excluded.purpose_bn, sort_order = excluded.sort_order;

-- ── ২. অ্যাপের সেটিংস ─────────────────────────────────────────────
INSERT INTO database.settings(key, value, note_bn) VALUES
 ('app.refunds_enabled', 'true', 'রিফান্ডের সুবিধা চালু/বন্ধ — বন্ধ করলে বোতাম দেখাবে না।'),
 ('app.checkin_requires_device', 'true', 'চেক-ইনের জন্য অ্যাডমিন-অনুমোদিত ফোন বাধ্যতামূলক।'),
 ('app.public_signup_closed', 'true', 'Supabase Auth-এ নতুন অ্যাকাউন্ট খোলা বন্ধ — শুধু আয়োজক ঢুকতে পারেন।'),
 ('app.password_reset_channel', '"supabase_auth"', 'পাসওয়ার্ড রিসেট ইমেইল পাঠায় Supabase Auth (ফ্রি টিয়ারে ঘণ্টায় সীমিত)।')
ON CONFLICT (key) DO NOTHING;

-- ── ৩. কোন ধাপ কখন চলল ────────────────────────────────────────────
INSERT INTO database.migrations(version, name_bn, note) VALUES
 ('10_database', 'database স্কিমা: সেটিংস, মাইগ্রেশন, স্বাস্থ্য', 'ডেটাবেস সেকশন'),
 ('11_event', 'event স্কিমা: অনুষ্ঠান, ফি, যোগাযোগ', 'অনুষ্ঠান সেকশন'),
 ('12_content', 'content স্কিমা: ১৩ সেকশন ও ১৪ সময়সূচি', 'পেজের লেখা'),
 ('13_registration', 'registration স্কিমা: অংশগ্রহণকারী, নিবন্ধন, গোপন লিংক', 'বন্ধু ও নিবন্ধন'),
 ('14_payment', 'payment স্কিমা: Send Money নম্বর, পেমেন্ট, রিফান্ড', 'পেমেন্ট সেকশন'),
 ('15_admin', 'admin স্কিমা: অ্যাডমিন টেবিল, লগইন, রিসেট, ডিভাইস, অডিট', 'অ্যাডমিন সেকশন'),
 ('16_gate', 'gate স্কিমা: QR টিকিট ও চেক-ইন', 'গেট সেকশন'),
 ('17_report', 'report স্কিমা: হিসাবের ভিউ', 'রিপোর্ট সেকশন'),
 ('18_functions', 'database টুলবক্স ও হিসাব-ইঞ্জিন', 'সহায়ক ফাংশন'),
 ('19_rules', 'নিয়ম ও প্রতিক্রিয়া (ট্রিগার)', 'action → reaction'),
 ('20_guide', 'guide স্কিমা: গঠন-বর্ণনা', 'ডকুমেন্টেশন'),
 ('21_api', 'public RPC দরজাগুলো', 'অ্যাপের চুক্তি'),
 ('22_seed', 'শুরুর ডেটা ও কার্য-প্রবাহ', 'নিরাপদে বারবার চালানো যায়')
ON CONFLICT (version) DO NOTHING;

INSERT INTO event.events(id,slug,name,tagline,date_label,is_dummy_date,venue,city,venue_english,registration_open) VALUES('05909aa7-d46a-4b83-a3f7-bd77b7352ce9','rangpur-ssc96','Rangpur SSC 96 Festival','পুরোনো বন্ধুত্ব, নতুন গল্প।','৩১ ডিসেম্বর',true,'ভিন্নজগৎ','রংপুর','Vinnojogot, Rangpur',true) ON CONFLICT(slug) DO NOTHING;
INSERT INTO event.fees(event_id,kind,amount) SELECT id,'friend',1499 FROM event.events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;
INSERT INTO event.fees(event_id,kind,amount) SELECT id,'spouse',500 FROM event.events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;
INSERT INTO event.fees(event_id,kind,amount) SELECT id,'child',200 FROM event.events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;

INSERT INTO content.sections(event_id,id,section_key,title,subtitle,body,image_url,sort_order,is_visible)
SELECT e.id,x.id,x.section_key,x.title,x.subtitle,x.body,x.image_url,x.sort_order,x.is_visible
FROM event.events e CROSS JOIN jsonb_to_recordset($seed$[
  {
    "id": "2546d24d-9565-4431-a914-5602f96df2f3",
    "section_key": "hero",
    "title": "স্কুলের সেই দিনগুলো,\nআবার ফিরে আসুক।",
    "subtitle": "রংপুর এসএসসি ব্যাচ ১৯৯৬",
    "body": "শেষ বেঞ্চের আড্ডা, টিফিনের ভাগ আর প্রিয় মুখগুলো। একদিনের জন্য ফিরে যাই আমাদের সেই চিরচেনা সময়ে।",
    "image_url": "/assets/friends-forever.webp\n/assets/friends-together.webp",
    "sort_order": 0,
    "is_visible": true
  },
  {
    "id": "e8379cf6-60bd-4dfe-a470-9bf3138f2545",
    "section_key": "story",
    "title": "বয়স বাড়ে।\nবন্ধুত্ব নয়।",
    "subtitle": "একটা ব্যাচ। একটা পরিবার।",
    "body": "স্কুলের ঘণ্টা অনেক আগেই থেমেছে। কিন্তু আমাদের গল্পগুলো থামেনি। পিঠার ঘ্রাণ, প্রাণখোলা আড্ডা আর আপন মানুষগুলোকে নিয়ে সাজানো এই দিন—শুধু আমাদের জন্য।",
    "image_url": "",
    "sort_order": 1,
    "is_visible": true
  },
  {
    "id": "db38c6b1-1fbe-4839-a0b3-589ba6a0d923",
    "section_key": "registration",
    "title": "তোমাকে ছাড়া\nআড্ডা জমবে না!",
    "subtitle": "চলো, আবার একসাথে",
    "body": "বন্ধু, জীবনসঙ্গী আর ছোট্ট অতিথিদের নিয়ে চলে এসো। নিচের ফর্ম পূরণ করে তোমার জায়গাটি নিশ্চিত করো।",
    "image_url": "",
    "sort_order": 2,
    "is_visible": true
  },
  {
    "id": "4ba14f36-49db-45ce-add2-6671df01b44e",
    "section_key": "schedule",
    "title": "একদিন। অনেক আনন্দ।",
    "subtitle": "দিনভর আমাদের আয়োজন",
    "body": "পিঠা দিয়ে শুরু, স্মৃতি নিয়ে বাড়ি ফেরা। সময়সূচি আপাতত খসড়া—চূড়ান্ত আয়োজনের আগে আপডেট হবে।",
    "image_url": "",
    "sort_order": 3,
    "is_visible": true
  },
  {
    "id": "bc372b3b-eac3-4ea3-a7ad-2a56d5dd2b48",
    "section_key": "footer",
    "title": "দেখা হবে, বন্ধু!",
    "subtitle": "Friends forever. Since 1996.",
    "body": "রংপুর এসএসসি ব্যাচ ১৯৯৬-এর বন্ধুদের আয়োজনে।",
    "image_url": "",
    "sort_order": 4,
    "is_visible": true
  },
  {
    "id": "e0039420-da82-4e1b-ab28-148959956c6b",
    "section_key": "branding",
    "title": "RANGPUR SSC 96",
    "subtitle": "বন্ধুত্বের উৎসব",
    "body": "",
    "image_url": "/assets/ssc96-logo.webp",
    "sort_order": 5,
    "is_visible": true
  },
  {
    "id": "f0778793-986f-444f-ae9b-7246d3515c08",
    "section_key": "marquee",
    "title": "উৎসবের চলমান লেখা",
    "subtitle": "",
    "body": "পিঠা উৎসব|পুরোনো বন্ধু|নতুন স্মৃতি|FRIENDS FOREVER",
    "image_url": "",
    "sort_order": 6,
    "is_visible": true
  },
  {
    "id": "9ed4ddee-9973-4ce7-a0ae-7e2e79b980a0",
    "section_key": "festival",
    "title": "বন্ধুর সাথে, পরিবারও আসুক।",
    "subtitle": "সবার জন্য একটু আনন্দ",
    "body": "ফি-র হিসাব একদম সহজ।\nতোমার পরিবারের সংখ্যা অনুযায়ী মোট ফি দেখাবে।",
    "image_url": "",
    "sort_order": 7,
    "is_visible": true
  },
  {
    "id": "e24c0fe9-de7f-4de1-aac7-0217522efb8a",
    "section_key": "faq",
    "title": "মনে প্রশ্ন আছে?",
    "subtitle": "একটু জেনে রাখি",
    "body": "উৎসবের আগে প্রয়োজনীয় কয়েকটি কথা।",
    "image_url": "",
    "sort_order": 8,
    "is_visible": true
  },
  {
    "id": "48ccc580-b9cf-454b-a31e-3dba27371673",
    "section_key": "faq_01",
    "title": "পেমেন্ট করার পর কি সঙ্গে সঙ্গে QR পাব?",
    "subtitle": "",
    "body": "না। আয়োজকেরা পেমেন্ট যাচাই করে অনুমোদন দেওয়ার পর তোমার সংরক্ষিত টিকিটের লিংকে QR ও ডিজিটাল রিসিপ্ট পাওয়া যাবে।",
    "image_url": "",
    "sort_order": 9,
    "is_visible": true
  },
  {
    "id": "90917699-9420-4c11-a1b8-4ec41c824cba",
    "section_key": "faq_02",
    "title": "টিকিট কোথায় পাব?",
    "subtitle": "",
    "body": "এখানে এসএমএস পাঠানো হয় না। নিবন্ধনের পর পাওয়া গোপন লিংক কপি করে রাখো। একই ব্রাউজারে “আমার টিকিট” থেকেও স্ট্যাটাস দেখা যাবে। লিংক হারালে আয়োজকদের সাহায্য নাও।",
    "image_url": "",
    "sort_order": 10,
    "is_visible": true
  },
  {
    "id": "dcdaa12f-1c81-4af5-a269-c9f0da5ea234",
    "section_key": "faq_03",
    "title": "পরিবারের জন্য আলাদা QR লাগবে?",
    "subtitle": "",
    "body": "একটি নিবন্ধনের QR-এ বন্ধু ও নিবন্ধিত পরিবারের সবাই একসঙ্গে চেক-ইন করবে। পরিবারের মোট সদস্যসংখ্যা টিকিটে থাকবে।",
    "image_url": "",
    "sort_order": 11,
    "is_visible": true
  },
  {
    "id": "c169a235-4b46-42b3-adcc-846ce22e1c93",
    "section_key": "faq_04",
    "title": "আমি নিজের ফোন দিয়ে চেক-ইন করতে পারব?",
    "subtitle": "",
    "body": "না। QR পড়া গেলেও চেক-ইন সম্পন্ন করতে অনুমোদিত আয়োজক/স্টাফ লগইন ও অনুমোদিত ব্রাউজার-সেশন প্রয়োজন। গেটে স্টাফ তোমার টিকিট স্ক্যান করবেন।",
    "image_url": "",
    "sort_order": 12,
    "is_visible": true
  }
]$seed$::jsonb) AS x(id uuid,section_key text,title text,subtitle text,body text,image_url text,sort_order integer,is_visible boolean)
WHERE e.slug='rangpur-ssc96' ON CONFLICT(event_id,section_key) DO NOTHING;

INSERT INTO content.schedule(event_id,id,start_time,period,title,note,sort_order,is_visible)
SELECT e.id,x.id,x.start_time,x.period,x.title,x.note,x.sort_order,x.is_visible
FROM event.events e CROSS JOIN jsonb_to_recordset($seed$[
  {
    "id": "1e46c95a-c902-4a60-a386-5d38ae01d483",
    "start_time": "09:00",
    "period": "সকাল",
    "title": "নিবন্ধন ও পিঠা উৎসব",
    "note": "নিবন্ধন কাউন্টার দুপুর ১২টায় বন্ধ হবে।",
    "sort_order": 0,
    "is_visible": true
  },
  {
    "id": "7f0df506-63c7-41a0-ad51-df142089c584",
    "start_time": "10:00",
    "period": "সকাল",
    "title": "স্বাগত পর্ব",
    "note": "",
    "sort_order": 1,
    "is_visible": true
  },
  {
    "id": "6e8a73fe-c150-450f-abc5-0b64b814a03e",
    "start_time": "10:15",
    "period": "সকাল",
    "title": "ব্যাচের পুনর্মিলনী ছবি",
    "note": "",
    "sort_order": 2,
    "is_visible": true
  },
  {
    "id": "3eb95756-cc9d-4049-ae94-0b96bc392705",
    "start_time": "10:30",
    "period": "সকাল",
    "title": "পরিচিতি পর্ব",
    "note": "",
    "sort_order": 3,
    "is_visible": true
  },
  {
    "id": "809795c4-8e2b-486b-a63f-960d6509b2a9",
    "start_time": "11:00",
    "period": "সকাল",
    "title": "সাংস্কৃতিক অনুষ্ঠান",
    "note": "",
    "sort_order": 4,
    "is_visible": true
  },
  {
    "id": "d1d63664-7339-4471-af78-12e555bfca07",
    "start_time": "12:00",
    "period": "দুপুর",
    "title": "স্কুলভিত্তিক বন্ধুত্বের আড্ডা",
    "note": "",
    "sort_order": 5,
    "is_visible": true
  },
  {
    "id": "eb3d98ae-a5cf-49a1-a0d8-eb9f598f7fde",
    "start_time": "13:30",
    "period": "দুপুর",
    "title": "নামাজের বিরতি",
    "note": "",
    "sort_order": 6,
    "is_visible": true
  },
  {
    "id": "040ab99e-8af9-4fc2-a400-1248477f9b63",
    "start_time": "14:00",
    "period": "দুপুর",
    "title": "দুপুরের খাবার",
    "note": "",
    "sort_order": 7,
    "is_visible": true
  },
  {
    "id": "096e28dc-93e1-480c-afa3-cad2005823b2",
    "start_time": "15:00",
    "period": "বিকেল",
    "title": "সবার জন্য খেলাধুলা",
    "note": "",
    "sort_order": 8,
    "is_visible": true
  },
  {
    "id": "516f0675-dce2-44d8-a68b-825afa0bfec7",
    "start_time": "16:00",
    "period": "বিকেল",
    "title": "স্মৃতিচারণ ও প্রয়াত বন্ধুদের স্মরণ",
    "note": "",
    "sort_order": 9,
    "is_visible": true
  },
  {
    "id": "a211ba7a-d7e8-47bb-a154-d376b490ce63",
    "start_time": "16:30",
    "period": "বিকেল",
    "title": "শিক্ষক সম্মাননা",
    "note": "",
    "sort_order": 10,
    "is_visible": true
  },
  {
    "id": "f6b1b1dc-7a72-4cde-acc7-3f875eb38422",
    "start_time": "17:00",
    "period": "বিকেল",
    "title": "পুরস্কার ও উপহার",
    "note": "শুধু বন্ধুদের জন্য।",
    "sort_order": 11,
    "is_visible": true
  },
  {
    "id": "ad6f81d5-12d7-4b99-a536-936e14087526",
    "start_time": "17:30",
    "period": "বিকেল",
    "title": "গ্রুপ ছবি",
    "note": "",
    "sort_order": 12,
    "is_visible": true
  },
  {
    "id": "a4211290-228a-4572-a513-657d39299c75",
    "start_time": "18:00",
    "period": "সন্ধ্যা",
    "title": "সমাপনী",
    "note": "",
    "sort_order": 13,
    "is_visible": true
  }
]$seed$::jsonb) AS x(id uuid,start_time time,period text,title text,note text,sort_order integer,is_visible boolean)
WHERE e.slug='rangpur-ssc96' ON CONFLICT(id) DO NOTHING;

INSERT INTO payment.accounts(event_id,id,provider,collector_name,mobile,sort_order,is_active)
SELECT e.id,x.id,x.provider,x.collector_name,x.mobile,x.sort_order,x.is_active
FROM event.events e CROSS JOIN jsonb_to_recordset($seed$[
  {
    "id": "465b03d1-c09c-49bb-a571-808782653269",
    "provider": "bkash",
    "collector_name": "Tomal",
    "mobile": "+8801773539721",
    "sort_order": 0,
    "is_active": true
  },
  {
    "id": "d171a91f-31d0-4ae0-a9c7-14275309d012",
    "provider": "bkash",
    "collector_name": "Mahatab",
    "mobile": "+8801712836444",
    "sort_order": 1,
    "is_active": true
  },
  {
    "id": "9952d224-3a16-4b7d-a635-a62e6b0e6535",
    "provider": "bkash",
    "collector_name": "Shohag",
    "mobile": "+8801721764479",
    "sort_order": 2,
    "is_active": true
  },
  {
    "id": "3a1b5e15-973a-4328-a248-a0116736c68c",
    "provider": "bkash",
    "collector_name": "Arif",
    "mobile": "+8801787898951",
    "sort_order": 3,
    "is_active": true
  },
  {
    "id": "bc8914ba-b3fc-434a-a7d8-1b3a3bdf0ec8",
    "provider": "nagad",
    "collector_name": "Tomal",
    "mobile": "+8801773539721",
    "sort_order": 0,
    "is_active": true
  },
  {
    "id": "86791396-cf36-4f29-a84c-d25e98f89762",
    "provider": "nagad",
    "collector_name": "Mahatab",
    "mobile": "+8801712836444",
    "sort_order": 1,
    "is_active": true
  },
  {
    "id": "a327632d-1bb6-440f-a90d-e18bc4a33f1b",
    "provider": "nagad",
    "collector_name": "Shohag",
    "mobile": "+8801721764479",
    "sort_order": 2,
    "is_active": true
  },
  {
    "id": "f9ed9078-c337-4d7d-a7e5-4b7e4215e456",
    "provider": "nagad",
    "collector_name": "Arif",
    "mobile": "+8801787898951",
    "sort_order": 3,
    "is_active": true
  }
]$seed$::jsonb) AS x(id uuid,provider text,collector_name text,mobile text,sort_order integer,is_active boolean)
WHERE e.slug='rangpur-ssc96' ON CONFLICT(id) DO NOTHING;


-- ── ৫. প্রকাশ্য যোগাযোগ নম্বর (হেল্পলাইন) ─────────────────────────
INSERT INTO event.contacts(event_id, label, mobile, note_bn, sort_order)
SELECT e.id, x.label, x.mobile, x.note_bn, x.sort_order
FROM event.events e CROSS JOIN jsonb_to_recordset($contacts$[
  {"label":"Tomol (আয়োজক)","mobile":"01773539721","note_bn":"টাকা পাঠানো ও যেকোনো প্রশ্নে","sort_order":1},
  {"label":"Mahatab (আয়োজক)","mobile":"01712836444","note_bn":"নিবন্ধন সহায়তা","sort_order":2},
  {"label":"Shohag (আয়োজক)","mobile":"01721764479","note_bn":"টিকিট ও চেক-ইন সংক্রান্ত","sort_order":3},
  {"label":"Arif (আয়োজক)","mobile":"01787898951","note_bn":"সাধারণ জিজ্ঞাসা","sort_order":4}
]$contacts$) AS x(label text, mobile text, note_bn text, sort_order integer)
WHERE NOT EXISTS (SELECT 1 FROM event.contacts c WHERE c.event_id = e.id AND c.label = x.label);

-- ═══════════════════════════════════════════════════════════════════
-- ২৪টি টেবিলের পরিচয় (ব্যাখ্যা)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO guide.tables(schema_name, table_name, purpose_bn, written_by, key_columns, sort_order)
SELECT x.schema_name, x.table_name, x.purpose_bn, x.written_by, x.key_columns, x.sort_order
FROM jsonb_to_recordset($tables$[
 {
  "schema_name": "database",
  "table_name": "schemas",
  "purpose_bn": "কোন স্কিমা জীবনের কোন সেকশনের তথ্য রাখে তার ঠিকানা-তালিকা।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "name, section_bn, purpose_bn",
  "sort_order": 1
 },
 {
  "schema_name": "database",
  "table_name": "settings",
  "purpose_bn": "অ্যাপের সমন্বয়-সেটিংস: রিফান্ড চালু/বন্ধ, চেক-ইনের শর্ত ইত্যাদি।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "key, value, note_bn",
  "sort_order": 2
 },
 {
  "schema_name": "database",
  "table_name": "migrations",
  "purpose_bn": "কোন SQL ধাপ কখন চালানো হয়েছে তার হিসাব।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "version, applied_at",
  "sort_order": 3
 },
 {
  "schema_name": "admin",
  "table_name": "admins",
  "purpose_bn": "অ্যাডমিন টেবিল — কে অ্যাডমিন, কে গেট স্টাফ, কতবার লগইন করেছে।",
  "written_by": "সেটআপ + লগইন হিসাব",
  "key_columns": "user_id, role, is_active, last_login_at",
  "sort_order": 4
 },
 {
  "schema_name": "admin",
  "table_name": "login_events",
  "purpose_bn": "প্রতিটি লগইনের হিসাব — সফল ও ব্যর্থ।",
  "written_by": "লগইন প্রক্রিয়া (RPC)",
  "key_columns": "email, succeeded, created_at",
  "sort_order": 5
 },
 {
  "schema_name": "admin",
  "table_name": "password_resets",
  "purpose_bn": "পাসওয়ার্ড ভুলে যাওয়ার অনুরোধ ও তার ফল।",
  "written_by": "ভুলে গেছি (RPC)",
  "key_columns": "email, status, requested_at",
  "sort_order": 6
 },
 {
  "schema_name": "admin",
  "table_name": "email_outbox",
  "purpose_bn": "কোন ইমেইল কখন কাকে পাঠানো হলো।",
  "written_by": "সিস্টেম (RPC)",
  "key_columns": "kind, to_email, status",
  "sort_order": 7
 },
 {
  "schema_name": "admin",
  "table_name": "devices",
  "purpose_bn": "গেটে অনুমোদিত ফোন/ব্রাউজার।",
  "written_by": "স্টাফ নিবন্ধন + অ্যাডমিন অনুমোদন",
  "key_columns": "token_hash, status",
  "sort_order": 8
 },
 {
  "schema_name": "admin",
  "table_name": "audit_logs",
  "purpose_bn": "কে কী করল — সব কাজের অডিট-লগ।",
  "written_by": "সিস্টেম (ট্রিগার ও RPC)",
  "key_columns": "action, actor_name, created_at",
  "sort_order": 9
 },
 {
  "schema_name": "event",
  "table_name": "events",
  "purpose_bn": "অনুষ্ঠানের নাম, তারিখ, ভেন্যু ও নিবন্ধন চালু/বন্ধ।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "id, slug, date_label, registration_open",
  "sort_order": 10
 },
 {
  "schema_name": "event",
  "table_name": "fees",
  "purpose_bn": "বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · প্রতি শিশু ২০০ — ফি-র হার।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "kind, amount",
  "sort_order": 11
 },
 {
  "schema_name": "event",
  "table_name": "contacts",
  "purpose_bn": "পাবলিক পেজের যোগাযোগ/হেল্পলাইন নম্বর।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "label, mobile",
  "sort_order": 12
 },
 {
  "schema_name": "content",
  "table_name": "sections",
  "purpose_bn": "পেজের প্রতিটি সেকশনের শিরোনাম, লেখা ও ছবি (১৩টি)।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "section_key, title, image_url",
  "sort_order": 13
 },
 {
  "schema_name": "content",
  "table_name": "schedule",
  "purpose_bn": "সকাল ৯টা থেকে সন্ধ্যা ৬টা পর্যন্ত ১৪টি ধাপের সময়সূচি।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "start_time, period, title",
  "sort_order": 14
 },
 {
  "schema_name": "registration",
  "table_name": "participants",
  "purpose_bn": "যিনি নিবন্ধন করেন — নাম, স্কুল, SSC রোল, মোবাইল, টি-শার্ট সাইজ।",
  "written_by": "নিবন্ধন ফর্ম (RPC)",
  "key_columns": "name, school_name, mobile, tshirt_size",
  "sort_order": 15
 },
 {
  "schema_name": "registration",
  "table_name": "registrations",
  "purpose_bn": "এক নিবন্ধন: কতজন আসছে, মোট ফি ও অনুমোদনের অবস্থা।",
  "written_by": "নিবন্ধন ফর্ম + অ্যাডমিন",
  "key_columns": "ticket_number, total_fee, status",
  "sort_order": 16
 },
 {
  "schema_name": "registration",
  "table_name": "links",
  "purpose_bn": "গোপন status/receipt লিংকের SHA-256 hash।",
  "written_by": "সিস্টেম (RPC)",
  "key_columns": "registration_id, tracking_key_hash",
  "sort_order": 17
 },
 {
  "schema_name": "payment",
  "table_name": "accounts",
  "purpose_bn": "bKash/Nagad Send Money নম্বর (Tomal · Mahatab · Shohag · Arif)।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "provider, collector_name, mobile",
  "sort_order": 18
 },
 {
  "schema_name": "payment",
  "table_name": "payments",
  "purpose_bn": "প্রতি নিবন্ধনের Send Money রেকর্ড: প্রেরকের নম্বর, TrxID, টাকা।",
  "written_by": "নিবন্ধন ফর্ম + অ্যাডমিন যাচাই",
  "key_columns": "transaction_id, submitted_amount, status",
  "sort_order": 19
 },
 {
  "schema_name": "payment",
  "table_name": "refunds",
  "purpose_bn": "টাকা ফেরত দেওয়ার রেকর্ড: কত, কেন, কোন মাধ্যমে।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "amount, reason_bn, method",
  "sort_order": 20
 },
 {
  "schema_name": "gate",
  "table_name": "tickets",
  "purpose_bn": "QR টিকিট — অনুমোদনের পর তৈরি, রিফান্ডে বাতিল।",
  "written_by": "সিস্টেম (ট্রিগার)",
  "key_columns": "qr_secret, status, issued_at",
  "sort_order": 21
 },
 {
  "schema_name": "gate",
  "table_name": "checkins",
  "purpose_bn": "দরজার চেক-ইন — এক নিবন্ধনে একবারই।",
  "written_by": "গেট স্ক্যানার",
  "key_columns": "registration_id, group_size, device_id",
  "sort_order": 22
 },
 {
  "schema_name": "guide",
  "table_name": "tables",
  "purpose_bn": "এই তালিকা নিজেই: ২৪টি টেবিলের পরিচয়।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "schema_name, table_name",
  "sort_order": 23
 },
 {
  "schema_name": "guide",
  "table_name": "flows",
  "purpose_bn": "কোন কাজ করলে কী ঘটে — ১৬টি প্রবাহের বর্ণনা।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "id, title_bn, steps, effects",
  "sort_order": 24
 }
]$tables$) AS x(schema_name text, table_name text, purpose_bn text, written_by text, key_columns text, sort_order integer)
ON CONFLICT (schema_name, table_name) DO UPDATE SET purpose_bn = excluded.purpose_bn, written_by = excluded.written_by,
  key_columns = excluded.key_columns, sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════════════
-- ১৬টি কার্য-প্রবাহ: কোনো কাজ করলে কী ঘটে (action → reaction)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO guide.flows(id, title_bn, actor_bn, trigger_bn, steps, effects, sort_order)
SELECT x.id, x.title_bn, x.actor_bn, x.trigger_bn, x.steps, x.effects, x.sort_order
FROM jsonb_to_recordset($flows$[
 {
  "id": "admin_login_ok",
  "title_bn": "অ্যাডমিন লগইন (সফল)",
  "actor_bn": "প্রধান আয়োজক",
  "trigger_bn": "সঠিক ইমেইল ও পাসওয়ার্ড দিয়ে লগইন",
  "steps": [
   "অ্যাপ Supabase Auth-এ ইমেইল/পাসওয়ার্ড পাঠায়",
   "সফল হলে অ্যাপ public.log_login() ডাকে",
   "প্যানেল খুলে admin_overview() ডাকে",
   "ডেটাবেস require_role(true) দিয়ে যাচাই করে — অ্যাডমিন কি না"
  ],
  "effects": [
   {
    "table": "admin.login_events",
    "change": "সফল লগইনের সারি লেখা হয়"
   },
   {
    "table": "admin.admins",
    "change": "last_login_at ও login_count হালনাগাদ"
   },
   {
    "table": "admin.audit_logs",
    "change": "প্যানেলে করা কাজগুলো নজরে থাকে"
   }
  ],
  "sort_order": 1
 },
 {
  "id": "admin_login_fail",
  "title_bn": "অ্যাডমিন লগইন (ভুল পাসওয়ার্ড)",
  "actor_bn": "অননুমোদিত চেষ্টা",
  "trigger_bn": "ভুল পাসওয়ার্ড বা ভুল ইমেইল",
  "steps": [
   "Supabase Auth লগইন প্রত্যাখ্যান করে",
   "অ্যাপ public.log_login(false) ডাকে",
   "প্যানেল খোলে না — admin_overview() 401 দেয়"
  ],
  "effects": [
   {
    "table": "admin.login_events",
    "change": "ব্যর্থ লগইন succeeded=false হয়ে লেখা হয়"
   },
   {
    "table": "admin.admins",
    "change": "failed_logins এক বাড়ে"
   }
  ],
  "sort_order": 2
 },
 {
  "id": "forgot_password",
  "title_bn": "পাসওয়ার্ড ভুলে যাওয়া",
  "actor_bn": "অ্যাডমিন/স্টাফ",
  "trigger_bn": "লগইন পেজে \"পাসওয়ার্ড ভুলে গেছি\" চাপা",
  "steps": [
   "অ্যাপ public.request_password_reset(email) ডাকে",
   "ইমেইল থাকলে Supabase Auth রিসেট-লিংক পাঠায়",
   "বাইরে সবসময় একই বার্তা দেখানো হয় — কেউ বুঝতে পারে না ইমেইল আছে কি নেই"
  ],
  "effects": [
   {
    "table": "admin.password_resets",
    "change": "status=email_sent বা unknown_email"
   },
   {
    "table": "admin.email_outbox",
    "change": "পাঠানোর রেকর্ড queued"
   }
  ],
  "sort_order": 3
 },
 {
  "id": "reset_password_done",
  "title_bn": "নতুন পাসওয়ার্ড বসানো",
  "actor_bn": "অ্যাডমিন/স্টাফ",
  "trigger_bn": "ইমেইলের লিংকে ক্লিক করে নতুন পাসওয়ার্ড দেওয়া",
  "steps": [
   "অ্যাপ /admin/reset পর্দা খোলে",
   "নতুন পাসওয়ার্ড Supabase Auth-এ পাঠানো হয়",
   "সফল হলে রিসেট সম্পন্ন হিসেবে লেখা হয়"
  ],
  "effects": [
   {
    "table": "admin.password_resets",
    "change": "status=completed, completed_at বসে"
   },
   {
    "table": "admin.admins",
    "change": "পরের লগইনেই last_login_at হালনাগাদ"
   }
  ],
  "sort_order": 4
 },
 {
  "id": "registration_created",
  "title_bn": "নতুন নিবন্ধন জমা",
  "actor_bn": "অংশগ্রহণকারী",
  "trigger_bn": "ফর্ম পূরণ করে টাকা পাঠিয়ে জমা দেওয়া",
  "steps": [
   "public.submit_registration() সব তথ্য একসাথে লেখে",
   "ফি snapshot হিসেবে নিবন্ধনে বসে",
   "গোপন ট্র্যাকিং কী তৈরি হয় — শুধু একবার দেখানো হয়",
   "অবস্থা থাকে pending"
  ],
  "effects": [
   {
    "table": "registration.participants",
    "change": "নতুন সারি"
   },
   {
    "table": "registration.registrations",
    "change": "total_fee হিসাব করে status=pending"
   },
   {
    "table": "payment.payments",
    "change": "status=pending"
   },
   {
    "table": "registration.links",
    "change": "গোপন লিংকের hash"
   },
   {
    "table": "admin.audit_logs",
    "change": "registration.created"
   }
  ],
  "sort_order": 5
 },
 {
  "id": "duplicate_blocked",
  "title_bn": "একই মোবাইল বা TrxID দ্বিতীয়বার",
  "actor_bn": "অংশগ্রহণকারী",
  "trigger_bn": "একই নম্বর/ট্রানজেকশন আইডি দিয়ে আবার জমা",
  "steps": [
   "ডেটাবেস unique নিয়মে আটকে দেয়",
   "স্পষ্ট বাংলা বার্তা দেখানো হয়: আগেই নিবন্ধন আছে"
  ],
  "effects": [
   {
    "table": "registration.participants",
    "change": "কোনো নতুন সারি হয় না (মোবাইল সক্রিয় সীমা)"
   },
   {
    "table": "payment.payments",
    "change": "কোনো নতুন সারি হয় না (provider+TrxID একবার)"
   }
  ],
  "sort_order": 6
 },
 {
  "id": "payment_verified",
  "title_bn": "অ্যাডমিন পেমেন্ট যাচাই করল",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "পেমেন্ট যাচাই ট্যাবে \"যাচাই করে অনুমোদন\"",
  "steps": [
   "admin_mutate('registration.approve') টাকার পরিমাণ মিলিয়ে দেখে",
   "পেমেন্ট status=verified লেখা হয়",
   "ট্রিগার এক ধাপেই নিবন্ধন approved করে ও নতুন QR টিকিট বানায়"
  ],
  "effects": [
   {
    "table": "payment.payments",
    "change": "status=verified, reviewed_by/at"
   },
   {
    "table": "registration.registrations",
    "change": "status=approved, approved_at"
   },
   {
    "table": "gate.tickets",
    "change": "নতুন qr_secret দিয়ে active টিকিট"
   },
   {
    "table": "admin.audit_logs",
    "change": "payment.verified"
   }
  ],
  "sort_order": 7
 },
 {
  "id": "payment_rejected",
  "title_bn": "পেমেন্ট প্রত্যাখ্যান",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "টাকা মেলেনি বা রেকর্ডে পাওয়া গেল না — কারণ লিখে প্রত্যাখ্যান",
  "steps": [
   "কারণ লেখা বাধ্যতামূলক (৩–৫০০ অক্ষর)",
   "চেক-ইন হয়ে গেলে প্রত্যাখ্যান আটকে যায়",
   "পেমেন্ট rejected হলে ট্রিগার টিকিট বাতিল করে"
  ],
  "effects": [
   {
    "table": "payment.payments",
    "change": "status=rejected, rejection_reason"
   },
   {
    "table": "registration.registrations",
    "change": "status=rejected"
   },
   {
    "table": "gate.tickets",
    "change": "status=revoked, revoked_at"
   },
   {
    "table": "admin.audit_logs",
    "change": "payment.rejected"
   }
  ],
  "sort_order": 8
 },
 {
  "id": "refund_created",
  "title_bn": "রিফান্ড দেওয়া হলো",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "যাচাইকৃত পেমেন্টে \"রিফান্ড\" চেপে কারণ ও টাকার পরিমাণ লেখা",
  "steps": [
   "admin_mutate('payment.refund') রিফান্ডের সারি লেখে",
   "মোট রিফান্ড জমা টাকার বেশি হতে পারে না",
   "পেমেন্ট refunded → ট্রিগার নিবন্ধন refunded ও টিকিট বাতিল করে",
   "ওই QR আর দরজায় চলবে না"
  ],
  "effects": [
   {
    "table": "payment.refunds",
    "change": "নতুন রিফান্ড সারি"
   },
   {
    "table": "payment.payments",
    "change": "status=refunded"
   },
   {
    "table": "registration.registrations",
    "change": "status=refunded, refunded_at"
   },
   {
    "table": "gate.tickets",
    "change": "status=revoked"
   },
   {
    "table": "admin.audit_logs",
    "change": "refund.created এবং payment.refunded"
   }
  ],
  "sort_order": 9
 },
 {
  "id": "checkin_ok",
  "title_bn": "গেটে চেক-ইন (সফল)",
  "actor_bn": "গেট স্টাফ",
  "trigger_bn": "অনুমোদিত ফোনে QR স্ক্যান বা টিকিট নম্বর লেখা",
  "steps": [
   "ফোন অনুমোদিত কি না দেখা হয়",
   "টিকিট approved + পেমেন্ট verified + QR চালু — তিনটি শর্ত একসাথে",
   "এক নিবন্ধনে একবারই ঢোকে; কতজন ঢুকল তা group_size-এ লেখা হয়"
  ],
  "effects": [
   {
    "table": "gate.checkins",
    "change": "নতুন সারি (কতজন, কোন ডিভাইস, কে চালাল)"
   },
   {
    "table": "admin.audit_logs",
    "change": "ticket.checkin"
   }
  ],
  "sort_order": 10
 },
 {
  "id": "checkin_duplicate",
  "title_bn": "দ্বিতীয়বার একই QR স্ক্যান",
  "actor_bn": "গেট স্টাফ",
  "trigger_bn": "একই QR আবার স্ক্যান হওয়া",
  "steps": [
   "ডেটাবেস unique নিয়ম দ্বিতীয় সারি আটকায়",
   "স্ক্রিনে দেখায় \"আগেই চেক-ইন হয়েছে\" এবং আগের সময়",
   "প্রবেশ আটকানো অভিভাবকীয় সিদ্ধান্ত স্টাফের হাতে"
  ],
  "effects": [
   {
    "table": "gate.checkins",
    "change": "নতুন সারি হয় না — পুরোনোটাই দেখানো হয়"
   }
  ],
  "sort_order": 11
 },
 {
  "id": "device_register",
  "title_bn": "গেটের ফোন নিবন্ধন",
  "actor_bn": "স্টাফ/অ্যাডমিন",
  "trigger_bn": "চেক-ইন পেজ খুললে ব্রাউজার নিজের টোকেন পাঠায়",
  "steps": [
   "public.register_device() টোকেনের hash রাখে",
   "অ্যাডমিনের ফোন সঙ্গে সঙ্গে approved",
   "স্টাফের ফোন pending — অ্যাডমিন অনুমোদন দিলে চালু"
  ],
  "effects": [
   {
    "table": "admin.devices",
    "change": "status=approved বা pending"
   },
   {
    "table": "admin.audit_logs",
    "change": "device.register"
   }
  ],
  "sort_order": 12
 },
 {
  "id": "device_approve",
  "title_bn": "অ্যাডমিন ফোন অনুমোদন",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "স্টাফ ডিভাইস ট্যাবে অনুমোদন/বাতিল",
  "steps": [
   "ডিভাইস approved হলে ওই ফোনেই চেক-ইন সম্ভব",
   "বাতিল করলে সঙ্গে সঙ্গে বন্ধ",
   "ফোন হারালে এই পথেই বন্ধ করা যায়"
  ],
  "effects": [
   {
    "table": "admin.devices",
    "change": "status=approved/revoked, approved_by"
   },
   {
    "table": "admin.audit_logs",
    "change": "device.update"
   }
  ],
  "sort_order": 13
 },
 {
  "id": "content_edit",
  "title_bn": "পেজের লেখা, ছবি বা ফি বদল",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "প্যানেলে যেকোনো সেকশন সম্পাদনা বা ফি হালনাগাদ",
  "steps": [
   "পরিবর্তন সঙ্গে সঙ্গে পাবলিক পেজে দেখা যায়",
   "আগের নিবন্ধনে তখনকার ফি snapshot হিসেবে অটুট থাকে"
  ],
  "effects": [
   {
    "table": "content.sections",
    "change": "লেখা/ছবি হালনাগাদ"
   },
   {
    "table": "content.schedule",
    "change": "সময়সূচি হালনাগাদ"
   },
   {
    "table": "event.fees",
    "change": "নতুন ফি আগামী নিবন্ধনে লাগে"
   },
   {
    "table": "admin.audit_logs",
    "change": "section.save / fees.save"
   }
  ],
  "sort_order": 14
 },
 {
  "id": "participant_removed",
  "title_bn": "অংশগ্রহণকারী বাদ দেওয়া",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "বন্ধু ও নিবন্ধন তালিকা থেকে \"বাদ দিন\"",
  "steps": [
   "নিবন্ধন মুছে যায় না — archived_at বসে (তথ্য অটুট থাকে)",
   "টিকিট বাতিল হয়, মোবাইল নম্বর আবার ব্যবহারযোগ্য হয়"
  ],
  "effects": [
   {
    "table": "registration.registrations",
    "change": "status=cancelled, archived_at"
   },
   {
    "table": "registration.participants",
    "change": "archived_at"
   },
   {
    "table": "gate.tickets",
    "change": "status=revoked"
   },
   {
    "table": "admin.audit_logs",
    "change": "registration.remove"
   }
  ],
  "sort_order": 15
 },
 {
  "id": "link_reissue",
  "title_bn": "গোপন টিকিট-লিংক নতুন করে দেওয়া",
  "actor_bn": "অ্যাডমিন",
  "trigger_bn": "নিবন্ধন বিস্তারিত পর্দায় \"নতুন লিংক\"",
  "steps": [
   "নতুন ট্র্যাকিং কী তৈরি হয়, পুরোনোটির hash মুছে যায়",
   "পুরোনো লিংক সঙ্গে সঙ্গে অচল — নতুন লিংক অংশগ্রহণকারীকে পাঠাতে হয়"
  ],
  "effects": [
   {
    "table": "registration.links",
    "change": "নতুন tracking_key_hash"
   },
   {
    "table": "admin.audit_logs",
    "change": "registration.reissue"
   }
  ],
  "sort_order": 16
 }
]$flows$) AS x(id text, title_bn text, actor_bn text, trigger_bn text, steps jsonb, effects jsonb, sort_order integer)
ON CONFLICT (id) DO UPDATE SET title_bn = excluded.title_bn, actor_bn = excluded.actor_bn, trigger_bn = excluded.trigger_bn,
  steps = excluded.steps, effects = excluded.effects, sort_order = excluded.sort_order;

COMMIT;
