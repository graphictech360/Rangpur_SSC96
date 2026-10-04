-- ═══════════════════════════════════════════════════════════════════
-- শেষ ধাপ | অ্যাডমিন টেবিল ভরা (admin.admins)
-- আগে Supabase → Authentication → Users-এ অ্যাকাউন্ট বানান, তারপর
-- নিচের YOUR_ADMIN_EMAIL_HERE / YOUR_STAFF_EMAIL_HERE বদলে Run করুন।
-- ⚠️ অ্যাপে কখনো পাসওয়ার্ড লেখা থাকে না — শুধু ভূমিকা এখানে দেওয়া হয়।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;
SET search_path = pg_catalog, public;

-- প্রধান অ্যাডমিন (একজনই) — আবশ্যক
INSERT INTO admin.admins(user_id, role, display_name, is_active)
SELECT id, 'admin', 'প্রধান আয়োজক', true
FROM auth.users WHERE lower(email) = lower('YOUR_ADMIN_EMAIL_HERE')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', display_name = excluded.display_name, is_active = true;

-- গেট স্টাফ — প্রত্যেকের জন্য আলাদা অ্যাকাউন্টে আলাদা সারি
INSERT INTO admin.admins(user_id, role, display_name, is_active)
SELECT id, 'scanner', 'গেট স্টাফ ১', true
FROM auth.users WHERE lower(email) = lower('YOUR_STAFF_EMAIL_HERE')
ON CONFLICT (user_id) DO UPDATE SET role = 'scanner', display_name = excluded.display_name, is_active = true;

-- যাচাই: ইমেইল বসানোর পর এখানে অ্যাডমিন/স্টাফের সারি দেখা উচিত
SELECT user_id, email, display_name, role, is_active, login_count FROM admin.admins ORDER BY role;

-- কারও অনুমতি বাতিল করতে (UUID বসিয়ে):
-- UPDATE admin.admins SET is_active = false WHERE user_id = 'USER_UUID';
-- সাথে অ্যাডমিন প্যানেল → স্টাফ ডিভাইস থেকে তাঁর ফোনও বাতিল করুন।

-- Table Editor-এ schema dropdown থেকে admin / event / content / registration /
-- payment / gate / report / guide / database বাছুন। এই স্কিমাগুলো Data API-তে
-- exposed রাখবেন না — সব কাজ RPC দিয়েই হয়।
COMMIT;
