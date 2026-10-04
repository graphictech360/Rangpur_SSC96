-- ═══════════════════════════════════════════════════════════════════
-- Rangpur SSC 96 Festival — সম্পূর্ণ সেটআপ (এক ফাইলে সব ধাপ)
-- ব্যবহার: Supabase Dashboard → SQL Editor → New query → পুরো ফাইল পেস্ট → Run
--
-- নতুন গঠন — ৯টি সেকশন-স্কিমা, প্রতিটির নিজের আলাদা টেবিল:
--   user        → participants · registrations · links
--   admin       → admins · login_events · password_resets · email_outbox · devices · audit_logs
--   event       → events · fees · contacts
--   content     → sections · schedule
--   payment     → accounts · payments · refunds
--   gate        → tickets · checkins
--   report      → হিসাবের ৮টি ভিউ
--   guide       → tables · flows (গঠন-বর্ণনা)
--   database    → schemas · settings · migrations · health
--
-- ⚠️ Table Editor-এ টেবিল দেখতে উপরের schema dropdown থেকে সেকশনের নাম বাছুন।
--    এক টেবিলে ক্লিক করলেই শুধু সেই টেবিলের ডেটা দেখাবে।
-- ⚠️ এই স্কিমাগুলো Data API-তে exposed করবেন না — সব কাজ RPC দিয়েই হয়।
-- ⚠️ admin.admins-এ ভূমিকা বসাতে শেষে 03_staff_setup.sql আলাদা করে চালান।
-- ═══════════════════════════════════════════════════════════════════



-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ০ | পুরোনো সব গঠন মুছে ফেলা (auth অ্যাকাউন্ট অটুট)  (00_reset.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ০ | পুরোনো সব গঠন মুছে ফেলা (শুধু নতুন সেটআপের ঠিক আগে একবার)
-- নতুন গঠন: সব টেবিল ও ভিউ একটিমাত্র স্কিমায় → public
--   নামের শুরুতে সেকশন বোঝা যায়: admin_* admin সেকশন, payment_* পেমেন্ট,
--   user-এর তথ্য: participants · registrations · user_links, ইত্যাদি।
-- ⚠️ অ্যাডমিন অ্যাকাউন্ট (auth.users) মুছে যায় না — শুধু তাঁর ভূমিকা
--    নতুন admin_users টেবিলে আবার বসাতে হবে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- ১) পুরোনো সেকশন-স্কিমাগুলো (এখন ব্যবহার হয় না)
DROP SCHEMA IF EXISTS database CASCADE;
DROP SCHEMA IF EXISTS event CASCADE;
DROP SCHEMA IF EXISTS content CASCADE;
DROP SCHEMA IF EXISTS "user" CASCADE;
DROP SCHEMA IF EXISTS payment CASCADE;
DROP SCHEMA IF EXISTS admin CASCADE;
DROP SCHEMA IF EXISTS gate CASCADE;
DROP SCHEMA IF EXISTS report CASCADE;
DROP SCHEMA IF EXISTS guide CASCADE;
DROP SCHEMA IF EXISTS registration CASCADE;

-- ২) public-এর টেবিল ও ভিউ
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.user_links CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.payment_accounts CASCADE;
DROP TABLE IF EXISTS public.refunds CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.admin_login_events CASCADE;
DROP TABLE IF EXISTS public.admin_password_resets CASCADE;
DROP TABLE IF EXISTS public.admin_email_outbox CASCADE;
DROP TABLE IF EXISTS public.admin_devices CASCADE;
DROP TABLE IF EXISTS public.admin_audit_logs CASCADE;
DROP TABLE IF EXISTS public.gate_tickets CASCADE;
DROP TABLE IF EXISTS public.gate_checkins CASCADE;
DROP TABLE IF EXISTS public.content_sections CASCADE;
DROP TABLE IF EXISTS public.content_schedule CASCADE;
DROP TABLE IF EXISTS public.content_form_fields CASCADE;
DROP TABLE IF EXISTS public.content_nav_items CASCADE;
DROP TABLE IF EXISTS public.content_form_texts CASCADE;
DROP TABLE IF EXISTS public.event_events CASCADE;
DROP TABLE IF EXISTS public.event_fees CASCADE;
DROP TABLE IF EXISTS public.event_contacts CASCADE;
DROP TABLE IF EXISTS public.guide_tables CASCADE;
DROP TABLE IF EXISTS public.guide_flows CASCADE;
DROP TABLE IF EXISTS public.database_schemas CASCADE;
DROP TABLE IF EXISTS public.database_settings CASCADE;
DROP TABLE IF EXISTS public.database_migrations CASCADE;

DROP VIEW IF EXISTS public."user" CASCADE;
DROP VIEW IF EXISTS public.report_summary CASCADE;
DROP VIEW IF EXISTS public.report_school_wise CASCADE;
DROP VIEW IF EXISTS public.report_daily CASCADE;
DROP VIEW IF EXISTS public.report_attendance CASCADE;
DROP VIEW IF EXISTS public.report_refunds CASCADE;
DROP VIEW IF EXISTS public.report_tshirt_sizes CASCADE;
DROP VIEW IF EXISTS public.report_food_preferences CASCADE;
DROP VIEW IF EXISTS public.report_collectors CASCADE;
DROP VIEW IF EXISTS public.guide_overview CASCADE;
DROP VIEW IF EXISTS public.guide_relations CASCADE;
DROP VIEW IF EXISTS public.guide_schemas CASCADE;
DROP VIEW IF EXISTS public.guide_functions CASCADE;
DROP VIEW IF EXISTS public.database_health CASCADE;

-- ৩) পুরোনো অনুমোদিত দরজাগুলো (RPC)
DROP FUNCTION IF EXISTS public.public_site();
DROP FUNCTION IF EXISTS public.submit_registration(jsonb);
DROP FUNCTION IF EXISTS public.ticket_status(text);
DROP FUNCTION IF EXISTS public.staff_identity();
DROP FUNCTION IF EXISTS public.admin_overview();
DROP FUNCTION IF EXISTS public.admin_mutate(text, jsonb);
DROP FUNCTION IF EXISTS public.register_device(text, text);
DROP FUNCTION IF EXISTS public.device_state(text);
DROP FUNCTION IF EXISTS public.check_in(text, text);
DROP FUNCTION IF EXISTS public.guide_overview();
DROP FUNCTION IF EXISTS public.log_login(text, boolean, text);
DROP FUNCTION IF EXISTS public.request_password_reset(text);
DROP FUNCTION IF EXISTS public.complete_password_reset(text, text);

-- ৪) অভ্যন্তরীণ ফাংশনগুলো (যেকোনো signature-তেই থাকলে মুছে ফেলা)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (ARRAY[
         'key_hash','random_token','normalize_mobile','set_updated_at','event_id','require_role',
         'log_action','device_json','registration_json','stats','live_counts',
         'normalize_participant','normalize_payment','normalize_account_mobile','guard_registration',
         'guard_ticket','on_payment_verified','on_payment_rejected','on_payment_refunded',
         'on_refund_inserted','guard_checkin','audit_checkin','fill_admin_fields'])
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
    RAISE NOTICE 'মুছে ফেলা হলো: %', r.sig;
  END LOOP;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১ | database — স্কিমা-তালিকা, সেটিংস, স্বাস্থ্য  (10_database.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১ | database_* — "ডেটাবেস সেকশন" (সব টেবিল public-এ)
-- এখানে থাকে ডেটাবেস-স্তরের সবকিছু: কোন স্কিমা কী কাজে, অ্যাপের সেটিংস,
-- কোন মাইগ্রেশন কখন চলল, আর পুরো ডেটাবেসের স্বাস্থ্য-ছবি।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. কোন স্কিমার কাজ কী (গঠনের মূল ঠিকানা-তালিকা) ───────────────
CREATE TABLE database_schemas (
  name         text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9_]{1,30}$'),
  purpose_bn   text NOT NULL CHECK (length(purpose_bn) BETWEEN 5 AND 300),
  section_bn   text NOT NULL CHECK (length(section_bn) BETWEEN 2 AND 80),
  sort_order   integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 99),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE database_schemas IS 'প্রতিটি সেকশনের উদ্দেশ্য — Table Editor-এ নামের শুরুর অংশ (prefix) অনুযায়ী।';
COMMENT ON COLUMN database_schemas.name IS 'সেকশনের নাম-প্রিফিক্স (database, admin, event, content, user, payment, gate, report, guide)।';
COMMENT ON COLUMN database_schemas.purpose_bn IS 'এই স্কিমা কী কাজে — বাংলায় এক লাইনে।';
COMMENT ON COLUMN database_schemas.section_bn IS 'অ্যাপের কোন সেকশন এই স্কিমা ব্যবহার করে।';

-- ── ২. অ্যাপের সেটিংস (চাবি → মান, যেকোনো সময় বদলানো যায়) ─────────
CREATE TABLE database_settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]{2,60}$'),
  value      jsonb NOT NULL,
  note_bn    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE database_settings IS 'অ্যাপের সমন্বয়-সেটিংস (নিবন্ধন চালু/বন্ধ, রিফান্ড অনুমতি, যোগাযোগ নম্বর ইত্যাদি)।';
COMMENT ON COLUMN database_settings.key IS 'সেটিংসের নাম, যেমন refunds_enabled।';
COMMENT ON COLUMN database_settings.value IS 'মান (jsonb) — true/false, সংখ্যা বা লেখা।';
COMMENT ON COLUMN database_settings.note_bn IS 'এই সেটিংস কী করে, বাংলায় ব্যাখ্যা।';

-- ── ৩. মাইগ্রেশন-হিসাব (কোন ধাপ কখন চলল) ─────────────────────────
CREATE TABLE database_migrations (
  version    text PRIMARY KEY CHECK (version ~ '^[0-9]{2}_[a-z0-9_]+$'),
  name_bn    text NOT NULL CHECK (length(name_bn) BETWEEN 3 AND 200),
  applied_at timestamptz NOT NULL DEFAULT now(),
  note       text NOT NULL DEFAULT ''
);
COMMENT ON TABLE database_migrations IS 'কোন SQL ধাপ কখন চালানো হয়েছে তার হিসাব — ভবিষ্যতে আপডেট করলে এখানে নতুন সারি যোগ হবে।';
COMMENT ON COLUMN database_migrations.version IS 'ফাইলের নাম, যেমন 13_people।';

-- ── ৪. স্বাস্থ্য-ভিউ: টেবিল, সেকশন, আকার, RLS, ইনডেক্স, ট্রিগার ──
CREATE OR REPLACE VIEW database_health AS
SELECT
  n.nspname                                   AS schema_name,
  CASE
    WHEN c.relname IN ('participants', 'registrations', 'user_links') THEN 'user'
    WHEN c.relname IN ('payments', 'payment_accounts', 'refunds')     THEN 'payment'
    WHEN c.relname LIKE 'admin\_%'    THEN 'admin'
    WHEN c.relname LIKE 'gate\_%'     THEN 'gate'
    WHEN c.relname LIKE 'content\_%'  THEN 'content'
    WHEN c.relname LIKE 'event\_%'    THEN 'event'
    WHEN c.relname LIKE 'report\_%'   THEN 'report'
    WHEN c.relname LIKE 'guide\_%'    THEN 'guide'
    WHEN c.relname LIKE 'database\_%' THEN 'database'
    ELSE 'public' END AS section,
  c.relname                                   AS table_name,
  GREATEST(c.reltuples, 0)::bigint            AS approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
  c.relrowsecurity                            AS rls_on,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policies,
  (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid)                                       AS indexes,
  (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal)               AS triggers
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN ('participants', 'registrations', 'user_links', 'payments', 'payment_accounts', 'refunds', 'admin_users', 'admin_login_events', 'admin_password_resets', 'admin_email_outbox', 'admin_devices', 'admin_audit_logs', 'gate_tickets', 'gate_checkins', 'content_sections', 'content_schedule', 'content_form_fields', 'content_nav_items', 'content_form_texts', 'event_events', 'event_fees', 'event_contacts', 'report_summary', 'report_school_wise', 'report_daily', 'report_attendance', 'report_refunds', 'report_tshirt_sizes', 'report_food_preferences', 'report_collectors', 'guide_tables', 'guide_flows', 'guide_overview', 'guide_relations', 'guide_schemas', 'guide_functions', 'database_schemas', 'database_settings', 'database_migrations', 'database_health')
ORDER BY section, c.relname;
COMMENT ON VIEW database_health IS 'প্রতিটি টেবিলের সেকশন, সারি-সংখ্যা, আকার, RLS, ইনডেক্স ও ট্রিগারের এক নজরের ছবি। Supabase SQL Editor-এ: select * from database_health;';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ২ | event — অনুষ্ঠান, ফি, যোগাযোগ  (11_event.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ২ | schema: event  —  অনুষ্ঠানের মূল সত্তা
-- একটাই অনুষ্ঠান, তার ফি এবং প্রকাশ্য যোগাযোগ নম্বর।
-- এই স্কিমার উপরেই বাকি সব স্কিমা নির্ভর করে (user → payment → gate)।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. অনুষ্ঠান ───────────────────────────────────────────────────
CREATE TABLE event_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  name                text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  tagline             text NOT NULL CHECK (length(tagline) BETWEEN 1 AND 200),
  date_label          text NOT NULL CHECK (length(date_label) BETWEEN 1 AND 60),
  is_dummy_date       boolean NOT NULL DEFAULT true,
  venue               text NOT NULL CHECK (length(venue) BETWEEN 1 AND 160),
  city                text NOT NULL CHECK (length(city) BETWEEN 1 AND 80),
  venue_english       text NOT NULL CHECK (length(venue_english) BETWEEN 1 AND 160),
  registration_open   boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE event_events IS 'অনুষ্ঠানের নাম, তারিখ, ভেন্যু ও নিবন্ধন চালু/বন্ধ — পুরো অ্যাপের কেন্দ্র।';
COMMENT ON COLUMN event_events.slug IS 'স্থির পরিচয় (rangpur-ssc96) — সব RPC এই slug ধরে অনুষ্ঠান খুঁজে পায়।';
COMMENT ON COLUMN event_events.is_dummy_date IS 'true = তারিখ এখন নমুনা; আসল তারিখ ঠিক হলে অ্যাডমিন প্যানেল থেকে বদলাবেন।';
COMMENT ON COLUMN event_events.registration_open IS 'false করলে নতুন নিবন্ধন বন্ধ, পুরোনো টিকিট অটুট থাকে।';

-- ── ২. ফি-র হার ───────────────────────────────────────────────────
CREATE TABLE event_fees (
  event_id  uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  kind      text NOT NULL CHECK (kind IN ('friend', 'spouse', 'child')),
  amount    numeric(10,0) NOT NULL CHECK (amount BETWEEN 0 AND 100000),
  currency  text NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, kind),
  CHECK (kind <> 'friend' OR amount > 0)
);
COMMENT ON TABLE event_fees IS 'বন্ধু, জীবনসঙ্গী ও প্রতি শিশুর পৃথক ফি (বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · শিশু ২০০)।';
COMMENT ON COLUMN event_fees.amount IS 'ফি বদলালেও পুরোনো নিবন্ধনে তখনকার ফি snapshot হিসেবে থেকে যায়।';

-- ── ৩. প্রকাশ্য যোগাযোগ নম্বর (হেল্পলাইন / আয়োজক) ────────────────
CREATE TABLE event_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(label) BETWEEN 2 AND 80),
  mobile      text NOT NULL CHECK (mobile ~ '^(01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})$'),
  note_bn     text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_active   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE event_contacts IS 'পাবলিক পেজে দেখানো যোগাযোগ নম্বর — আয়োজক/হেল্পলাইন।';
COMMENT ON COLUMN event_contacts.mobile IS 'একাদশ ডিজিটের বাংলাদেশি নম্বর (01XXXXXXXXX)।';

CREATE INDEX event_contacts_event ON event_contacts(event_id, sort_order) WHERE is_active;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৩ | content — পেজের সেকশন ও সময়সূচি  (12_content.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৩ | schema: content  —  পেজের লেখা, সময়সূচি ও টাকার নম্বর
-- অ্যাডমিন প্যানেল থেকে যা যা বদলানো যায়, সব এখানে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. পেজের সেকশন (hero, story, "user"...) ─────────────────
CREATE TABLE content_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  section_key text NOT NULL CHECK (section_key ~ '^[a-z0-9_-]{1,60}$'),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 250),
  subtitle    text NOT NULL DEFAULT '' CHECK (length(subtitle) <= 300),
  body        text NOT NULL DEFAULT '' CHECK (length(body) <= 3000),
  image_url   text NOT NULL DEFAULT '' CHECK (image_url = '' OR image_url LIKE '/assets/%' OR image_url LIKE 'https://%'),
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, section_key)
);
COMMENT ON TABLE content_sections IS 'পাবলিক পেজের প্রতিটি সেকশনের শিরোনাম, লেখা ও ছবি (১৩টি সেকশন)।';
COMMENT ON COLUMN content_sections.image_url IS 'একাধিক ছবি দিতে এক লাইনে একটি পাথ লিখুন — কলাজ/ব্যানারে ঘুরে ঘুরে দেখাবে।';
COMMENT ON COLUMN content_sections.is_visible IS 'false করলে সেকশনটি সাইটে দেখাবে না, মুছবে না।';

-- ── ২. সময়সূচি ───────────────────────────────────────────────────
CREATE TABLE content_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  start_time  time NOT NULL,
  period      text NOT NULL CHECK (period IN ('সকাল', 'দুপুর', 'বিকেল', 'সন্ধ্যা')),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 220),
  note        text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  sort_order  integer NOT NULL CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE content_schedule IS 'সেদিনের সময়সূচি — সকাল ৯টা থেকে সন্ধ্যা ৬টা পর্যন্ত ১৪টি ধাপ।';
COMMENT ON COLUMN content_schedule.period IS 'দিনের ভাগ: সকাল / দুপুর / বিকেল / সন্ধ্যা।';

CREATE INDEX schedule_event_order ON content_schedule(event_id, sort_order);

-- ── ৩. নিবন্ধন ফর্মের ঘর (অ্যাডমিন নিজে যোগ/বদল/মুছতে পারেন) ──────
-- এখানে যত ঘর থাকবে, পাবলিক নিবন্ধন ফর্মে ঠিক তত ঘরই দেখাবে।
CREATE TABLE content_form_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  field_key   text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]{2,30}$'),
  label_bn    text NOT NULL CHECK (length(label_bn) BETWEEN 2 AND 120),
  kind        text NOT NULL CHECK (kind IN ('text', 'textarea', 'select', 'number', 'tel', 'date', 'checkbox',
                                            'photo', 'tshirt', 'family')),
  options     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  placeholder text NOT NULL DEFAULT '' CHECK (length(placeholder) <= 200),
  help_bn     text NOT NULL DEFAULT '' CHECK (length(help_bn) <= 300),
  max_length  integer NOT NULL DEFAULT 200 CHECK (max_length BETWEEN 1 AND 2000),
  is_required boolean NOT NULL DEFAULT false,
  is_visible  boolean NOT NULL DEFAULT true,
  is_base     boolean NOT NULL DEFAULT false,
  is_locked   boolean NOT NULL DEFAULT false,
  step        smallint NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 2),
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, field_key)
);
COMMENT ON TABLE content_form_fields IS 'নিবন্ধন ফর্মের অতিরিক্ত ঘর — অ্যাডমিন প্যানেল থেকে যোগ, বদল, ক্রম বদল, লুকানো ও মুছে ফেলা যায়।';
COMMENT ON COLUMN content_form_fields.kind IS 'ঘরের ধরন: text (এক লাইন), textarea (বড় লেখা), select (তালিকা থেকে বাছাই), number, tel (মোবাইল), date (তারিখ), checkbox (হ্যাঁ/না)।';
COMMENT ON COLUMN content_form_fields.options IS 'select ঘরের বিকল্পগুলো — ["সাধারণ", "নিরামিষ"] আকারে।';
COMMENT ON COLUMN content_form_fields.is_visible IS 'false করলে ঘরটি ফর্মে দেখাবে না, মুছবে না (উত্তরগুলো আগের মতোই থাকে)।';
COMMENT ON COLUMN content_form_fields.is_required IS 'true হলে উত্তর না দিয়ে কেউ জমা দিতে পারবে না।';
COMMENT ON COLUMN content_form_fields.is_base IS 'true = ফর্মের মূল ঘর (নাম, মোবাইল, ছবি, টি-শার্ট…) — এগুলোও লেবেল/ক্রম বদলানো ও লুকানো যায়।';
COMMENT ON COLUMN content_form_fields.is_locked IS 'true = নাম ও মোবাইলের মতো অপরিহার্য ঘর — লুকানো বা মুছে ফেলা যায় না।';
COMMENT ON COLUMN content_form_fields.step IS 'ফর্মের কোন ধাপে ঘরটি দেখাবে (১ = পরিচয়, ২ = পরিবার)।';

CREATE INDEX form_fields_event_order ON content_form_fields(event_id, sort_order);

-- ── ৪. হেডার/মেনুর আইটেম (অ্যাডমিন নিজে বদলাতে পারেন) ──────────────
CREATE TABLE content_nav_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('section', 'ticket', 'link')),
  label_bn    text NOT NULL CHECK (length(label_bn) BETWEEN 1 AND 60),
  target      text NOT NULL DEFAULT '' CHECK (length(target) <= 400),
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE content_nav_items IS 'হেডারের মেনুর প্রতিটি লিংক/বোতাম — অ্যাডমিন প্যানেল থেকে যোগ, নাম বদল, ক্রম বদল, লুকানো ও মুছে ফেলা যায়।';
COMMENT ON COLUMN content_nav_items.kind IS 'section = পেজের কোন অংশে স্ক্রল করবে (target = সেকশনের কী), ticket = “আমার টিকিট” খুলবে, link = বাইরের লিংক।';
COMMENT ON COLUMN content_nav_items.target IS 'section ধরনের জন্য সেকশনের কী (যেমন registration), link ধরনের জন্য পুরো ঠিকানা (https://…)।';

CREATE INDEX nav_items_event_order ON content_nav_items(event_id, sort_order);

-- ── ৫. ফর্মের লেখা (শিরোনাম, ধাপের নাম, বার্তা — সব বদলানো যায়) ──
CREATE TABLE content_form_texts (
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  text_key    text NOT NULL CHECK (text_key ~ '^[a-z][a-z0-9_.]{2,40}$'),
  value_bn    text NOT NULL DEFAULT '' CHECK (length(value_bn) <= 400),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, text_key)
);
COMMENT ON TABLE content_form_texts IS 'নিবন্ধন কার্ডের সব লেখা — “YOUR SEAT IS WAITING”, ধাপের নাম, ফি-লেবেল, সম্মতির বাক্য। খালি রাখলে আগের লেখাই থাকে।';


COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৪ | user — অংশগ্রহণকারী, নিবন্ধন, গোপন লিংক  (13_user.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৪ | schema: user  —  অংশগ্রহণকারী, নিবন্ধন ও অ্যাকাউন্ট
-- কে নিবন্ধন করল, কতজন আসছে, গোপন টিকিট-লিংক, কে লগইন করল,
-- পাসওয়ার্ড ভুলে গেলে কী হলো, কোন ইমেইল পাঠানো হলো।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. অংশগ্রহণকারী (যিনি ফর্ম পূরণ করেন) ─────────────────────────
CREATE TABLE participants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES event_events,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  school_name      text NOT NULL CHECK (length(school_name) BETWEEN 1 AND 200),
  ssc_batch        integer NOT NULL DEFAULT 1996 CHECK (ssc_batch = 1996),
  ssc_roll         text NOT NULL CHECK (length(ssc_roll) BETWEEN 1 AND 30),
  ssc_registration text NOT NULL DEFAULT '' CHECK (length(ssc_registration) <= 40),
  mobile           text NOT NULL CHECK (mobile ~ '^01[3-9][0-9]{8}$'),
  current_location text NOT NULL CHECK (length(current_location) BETWEEN 1 AND 200),
  tshirt_size      text NOT NULL CHECK (tshirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  archived_at      timestamptz,
  UNIQUE (id, event_id)
);
COMMENT ON TABLE participants IS 'যিনি নিবন্ধন ফর্ম পূরণ করেন — নাম, স্কুল, SSC রোল, মোবাইল, এলাকা ও টি-শার্ট সাইজ।';
COMMENT ON COLUMN participants.mobile IS 'বাংলা বা ইংরেজি অঙ্কে লেখা হলেও ট্রিগারে ০১XXXXXXXXX আকারে সংরক্ষিত হয়।';
COMMENT ON COLUMN participants.archived_at IS 'মুছে ফেলা নয় — আর্কাইভ। অ্যাডমিন "বাদ দিন" চাপলে এই সময় বসে।';
CREATE UNIQUE INDEX participants_active_mobile ON participants(event_id, mobile) WHERE archived_at IS NULL;
CREATE INDEX participants_school ON participants(event_id, school_name);

-- ── ২. নিবন্ধন (পরিবারের সংখ্যা, ফি, অবস্থা) ──────────────────────
CREATE TABLE registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES event_events,
  participant_id  uuid NOT NULL UNIQUE,
  FOREIGN KEY (participant_id, event_id) REFERENCES participants(id, event_id),
  ticket_serial   bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  ticket_number   text GENERATED ALWAYS AS ('R96-' || lpad(ticket_serial::text, greatest(5, length(ticket_serial::text)), '0')) STORED UNIQUE,
  spouse_count    smallint NOT NULL DEFAULT 0 CHECK (spouse_count BETWEEN 0 AND 1),
  children_count  smallint NOT NULL DEFAULT 0 CHECK (children_count BETWEEN 0 AND 20),
  -- খাবার ও বিশেষ অনুরোধ আর বাধ্যতামূলক নয় (ফর্ম থেকে সরানো হয়েছে);
  -- চাইলে অ্যাডমিন প্যানেল থেকে আবার ঘর যোগ করা যায় — তখনই এগুলো ভরে।
  food_preference text CHECK (food_preference IN ('সাধারণ', 'নিরামিষ', 'বিশেষ অনুরোধ')),
  notes           text NOT NULL DEFAULT '' CHECK (length(notes) <= 600),
  custom_answers  jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(custom_answers) = 'object'),
  fee_friend      numeric(10,0) NOT NULL CHECK (fee_friend > 0),
  fee_spouse      numeric(10,0) NOT NULL CHECK (fee_spouse >= 0),
  fee_child       numeric(10,0) NOT NULL CHECK (fee_child >= 0),
  total_fee       numeric(10,0) GENERATED ALWAYS AS (fee_friend + spouse_count * fee_spouse + children_count * fee_child) STORED,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  refunded_at     timestamptz,
  archived_at     timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, event_id)
);
COMMENT ON TABLE registrations IS 'এক অংশগ্রহণকারীর এক নিবন্ধন — কতজন আসছে, মোট ফি ও অনুমোদনের অবস্থা (pending → approved → check-in)।';
COMMENT ON COLUMN registrations.custom_answers IS 'ফর্মের অতিরিক্ত ঘরগুলোর উত্তর — {"blood_group":"B+", "jersey_name":"রফিক"} আকারে।';
COMMENT ON COLUMN registrations.ticket_number IS 'স্বয়ংক্রিয় টিকিট নম্বর (R96-00001) — কাগজের টিকিটেও ছাপা হয়।';
COMMENT ON COLUMN registrations.total_fee IS 'স্বয়ংক্রিয় যোগফল = বন্ধু + (সঙ্গী × ৫০০) + (শিশু × ২০০)।';
COMMENT ON COLUMN registrations.status IS 'pending=যাচাই বাকি · approved=টিকিট চালু · rejected=প্রত্যাখ্যান · refunded=টাকা ফেরত · cancelled=বাদ দেওয়া।';
CREATE INDEX registrations_event_status ON registrations(event_id, status, created_at DESC);
CREATE INDEX registrations_pending ON registrations(event_id, created_at) WHERE status = 'pending';

-- ── ৩. গোপন টিকিট-লিংক (ট্র্যাকিং কী-এর hash) ─────────────────────
CREATE TABLE user_links (
  registration_id   uuid PRIMARY KEY REFERENCES registrations ON DELETE CASCADE,
  tracking_key_hash text NOT NULL UNIQUE CHECK (tracking_key_hash ~ '^[a-f0-9]{64}$'),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE user_links IS 'গোপন status/receipt লিংকের SHA-256 hash — ফোন নম্বর দিয়ে কেউ অন্যের টিকিট খুঁজতে পারে না।';
COMMENT ON COLUMN user_links.tracking_key_hash IS 'আসল কী কেবল নিবন্ধনের সময় একবারই দেখা যায়; ডেটাবেসে শুধু hash থাকে।';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৫ | payment — Send Money নম্বর, পেমেন্ট, রিফান্ড  (14_payment.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৫ | schema: payment  —  টাকার সব হিসাব
-- কে কত টাকা Send Money করল, কোন নম্বরে, অনুমোদন পেল কি না,
-- আর কেউ রিফান্ড চাইলে কী হলো — সব এখানে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ০. Send Money নম্বর (bKash/Nagad) ─────────────────────────────
CREATE TABLE payment_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  provider       text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
  collector_name text NOT NULL CHECK (length(collector_name) BETWEEN 1 AND 100),
  mobile         text NOT NULL CHECK (mobile ~ '^(01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})$'),
  sort_order     integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_active      boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, event_id)
);
COMMENT ON TABLE payment_accounts IS 'প্রকাশ্য ব্যক্তিগত Send Money নম্বর (Tomal · Mahatab · Shohag · Arif — bKash ও Nagad)।';
COMMENT ON COLUMN payment_accounts.is_active IS 'নিষ্ক্রিয় করলে নতুন নিবন্ধনে দেখাবে না, পুরোনো রেকর্ড অটুট থাকবে।';

-- ── ১. পেমেন্ট (প্রতি নিবন্ধনে একটি) ──────────────────────────────
CREATE TABLE payments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  uuid NOT NULL REFERENCES event_events,
  registration_id           uuid NOT NULL UNIQUE,
  FOREIGN KEY (registration_id, event_id) REFERENCES registrations(id, event_id),
  account_id                uuid NOT NULL,
  FOREIGN KEY (account_id, event_id) REFERENCES payment_accounts(id, event_id),
  provider                  text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
  collector_name_snapshot   text NOT NULL,
  collector_mobile_snapshot text NOT NULL CHECK (collector_mobile_snapshot ~ '^(01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})$'),
  sender_mobile             text NOT NULL CHECK (sender_mobile ~ '^01[3-9][0-9]{8}$'),
  transaction_id            text NOT NULL CHECK (transaction_id ~ '^[A-Za-z0-9-]{5,64}$'),
  normalized_transaction_id text GENERATED ALWAYS AS (upper(transaction_id)) STORED,
  submitted_amount          numeric(10,0) NOT NULL CHECK (submitted_amount > 0),
  status                    text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'refunded')),
  reviewed_by               uuid REFERENCES auth.users ON DELETE SET NULL,
  reviewed_at               timestamptz,
  rejection_reason          text NOT NULL DEFAULT '' CHECK (length(rejection_reason) <= 500),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider, normalized_transaction_id)
);
COMMENT ON TABLE payments IS 'প্রতি নিবন্ধনের নিজস্ব Send Money রেকর্ড — প্রেরকের নম্বর, TrxID ও টাকার পরিমাণ।';
COMMENT ON COLUMN payments.collector_name_snapshot IS 'কোন নম্বরে টাকা গেল তার তখনকার নাম — পরে নম্বর বদলালেও রেকর্ড ঠিক থাকে।';
COMMENT ON COLUMN payments.normalized_transaction_id IS 'বড় হাতের অক্ষরে স্বয়ংক্রিয় রূপ — একই TrxID দুইবার জমা দেওয়া যায় না।';
COMMENT ON COLUMN payments.status IS 'pending=যাচাই বাকি · verified=অনুমোদিত · rejected=প্রত্যাখ্যান · refunded=টাকা ফেরত দেওয়া হয়েছে।';
CREATE INDEX accounts_event_order ON payment_accounts(event_id, sort_order) WHERE is_active;
CREATE INDEX payments_status ON payments(event_id, status, created_at DESC);
CREATE INDEX payments_collector ON payments(account_id, status);

-- ── ২. রিফান্ড (এক পেমেন্টে একাধিক আংশিক রিফান্ড হতে পারে) ─────────
CREATE TABLE refunds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES event_events,
  payment_id    uuid NOT NULL REFERENCES payments ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES registrations ON DELETE CASCADE,
  amount        numeric(10,0) NOT NULL CHECK (amount > 0),
  reason_bn     text NOT NULL CHECK (length(reason_bn) BETWEEN 3 AND 500),
  method        text NOT NULL DEFAULT 'bkash' CHECK (method IN ('bkash', 'nagad', 'cash', 'other')),
  reference     text NOT NULL DEFAULT '' CHECK (length(reference) <= 80),
  marked_by     uuid REFERENCES auth.users ON DELETE SET NULL,
  refunded_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE refunds IS 'টাকা ফেরত দেওয়ার রেকর্ড — কত টাকা, কেন, কোন মাধ্যমে, কে অনুমোদন করল।';
COMMENT ON COLUMN refunds.amount IS 'আংশিক রিফান্ডও সম্ভব; মোট রিফান্ড পেমেন্টের টাকার বেশি হতে পারে না (ট্রিগারে আটকানো)।';
COMMENT ON COLUMN refunds.reference IS 'রিফান্ডের TrxID বা সাক্ষীর নোট (ঐচ্ছিক)।';
CREATE INDEX refunds_time ON refunds(event_id, refunded_at DESC);

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৬ | admin — অ্যাডমিন, লগইন, রিসেট, ডিভাইস, অডিট  (15_admin.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৬ | schema: admin  —  অ্যাডমিন সেকশন
-- একটি মূল **admin table** (কে অ্যাডমিন, কে গেট স্টাফ), তার সাথে
-- লগইন-হিসাব, পাসওয়ার্ড রিসেট, ইমেইল-আউটবক্স, অনুমোদিত ফোন ও অডিট-লগ।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. অ্যাডমিন টেবিল (একটাই মূল টেবিল — কে কী) ───────────────────
CREATE TABLE admin_users (
  user_id       uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email         text NOT NULL DEFAULT '' CHECK (length(email) <= 200),
  display_name  text NOT NULL DEFAULT '' CHECK (length(display_name) <= 120),
  role          text NOT NULL DEFAULT 'scanner' CHECK (role IN ('admin', 'scanner')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  login_count   integer NOT NULL DEFAULT 0 CHECK (login_count >= 0),
  failed_logins integer NOT NULL DEFAULT 0 CHECK (failed_logins >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_users IS 'অ্যাডমিনের মূল টেবিল — কে অ্যাডমিন, কে গেট স্টাফ, সক্রিয় কি না, কতবার লগইন করেছে। এখানে সারি না থাকলে কেউ প্যানেলে ঢুকতে পারে না।';
COMMENT ON COLUMN admin_users.role IS 'admin = পুরো প্যানেল ও সব কাজ · scanner = শুধু গেট চেক-ইন।';
COMMENT ON COLUMN admin_users.is_active IS 'false করলে অ্যাকাউন্ট থাকলেও প্যানেল/চেক-ইন বন্ধ — বাতিলের সবচেয়ে সহজ পথ।';
COMMENT ON COLUMN admin_users.email IS 'auth.users থেকে স্বয়ংক্রিয়ভাবে বসে (ট্রিগার); দরকারে হাতে লেখাও যায়।';
CREATE UNIQUE INDEX admins_only_one_active_admin ON admin_users((true)) WHERE role = 'admin' AND is_active;
CREATE INDEX admins_active ON admin_users(role, is_active);

-- ── ২. লগইন-ইভেন্ট (সফল ও ব্যর্থ) ─────────────────────────────────
CREATE TABLE admin_login_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL CHECK (length(email) BETWEEN 5 AND 200),
  user_id    uuid REFERENCES admin_users(user_id) ON DELETE SET NULL,
  succeeded  boolean NOT NULL,
  note_bn    text NOT NULL DEFAULT '' CHECK (length(note_bn) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_login_events IS 'প্রতিটি অ্যাডমিন/স্টাফ লগইনের হিসাব — সফল ও ব্যর্থ দুটোই, সাথে বাংলা টীকা।';
COMMENT ON COLUMN admin_login_events.succeeded IS 'false = ভুল পাসওয়ার্ড বা অননুমোদিত চেষ্টা — নিরাপত্তার খোঁজে কাজে লাগে।';
CREATE INDEX login_events_time ON admin_login_events(created_at DESC);

-- ── ৩. পাসওয়ার্ড ভুলে যাওয়ার অনুরোধ ─────────────────────────────
CREATE TABLE admin_password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL CHECK (length(email) BETWEEN 5 AND 200),
  user_id      uuid REFERENCES admin_users(user_id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'email_sent', 'completed', 'unknown_email', 'rate_limited')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  note_bn      text NOT NULL DEFAULT '' CHECK (length(note_bn) <= 300)
);
COMMENT ON TABLE admin_password_resets IS '"পাসওয়ার্ড ভুলে গেছি" চাপলে কী হলো — ইমেইল পাঠানো হলো কি না, কখন সম্পন্ন হলো।';
COMMENT ON COLUMN admin_password_resets.status IS 'requested → email_sent → completed; unknown_email = এই ইমেইলে অ্যাকাউন্ট নেই (বাইরে একই বার্তা দেখানো হয়)।';
CREATE INDEX password_resets_time ON admin_password_resets(requested_at DESC);

-- ── ৪. ইমেইল-আউটবক্স ─────────────────────────────────────────────
CREATE TABLE admin_email_outbox (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('password_reset', 'welcome', 'ticket', 'reminder', 'other')),
  to_email   text NOT NULL CHECK (length(to_email) BETWEEN 5 AND 200),
  subject_bn text NOT NULL CHECK (length(subject_bn) BETWEEN 3 AND 200),
  provider   text NOT NULL DEFAULT 'supabase_auth',
  status     text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  note_bn    text NOT NULL DEFAULT '' CHECK (length(note_bn) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_email_outbox IS 'কোন ইমেইল কখন কাকে পাঠানো হলো (পাসওয়ার্ড রিসেট এখন Supabase Auth পাঠায়)।';
CREATE INDEX email_outbox_time ON admin_email_outbox(created_at DESC);

-- ── ৫. অনুমোদিত ফোন/ব্রাউজার ─────────────────────────────────────
CREATE TABLE admin_devices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events,
  user_id     uuid NOT NULL REFERENCES admin_users(user_id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(label) BETWEEN 2 AND 100),
  token_hash  text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  approved_by uuid REFERENCES admin_users(user_id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, token_hash),
  UNIQUE (id, event_id)
);
COMMENT ON TABLE admin_devices IS 'স্টাফ ডিভাইস ট্যাবের টেবিল — গেটে কোন ফোন/ব্রাউজার অনুমোদিত, কে অনুমোদন দিল।';
COMMENT ON COLUMN admin_devices.token_hash IS 'ব্রাউজারে থাকা গোপন টোকেনের hash; ফোন হারালে অ্যাডমিন বাতিল করতে পারেন।';
CREATE INDEX devices_event ON admin_devices(event_id, status);

-- ── ৬. অডিট-লগ ───────────────────────────────────────────────────
CREATE TABLE admin_audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES event_events,
  actor_id   uuid REFERENCES auth.users ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT 'public' CHECK (length(actor_name) BETWEEN 1 AND 120),
  action     text NOT NULL CHECK (length(action) BETWEEN 3 AND 80),
  record_id  uuid,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_audit_logs IS 'কে কী করল তার অডিট-লগ — নিবন্ধন, অনুমোদন, রিফান্ড, রিফান্ড-বাতিল, চেক-ইন সব কাজ এখানে লেখা হয়।';
COMMENT ON COLUMN admin_audit_logs.metadata IS 'বাড়তি তথ্য (যেমন আগের পেমেন্ট, রিফান্ডের কারণ) jsonb আকারে।';
CREATE INDEX audit_event_time ON admin_audit_logs(event_id, created_at DESC);

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৭ | gate — QR টিকিট ও চেক-ইন  (16_gate.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৭ | schema: gate  —  গেট সেকশন
-- দরজার সবকিছু: QR টিকিট ও চেক-ইন। টিকিট অনুমোদনের পর তৈরি হয়,
-- চেক-ইন এক নিবন্ধনে একবারই।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. QR টিকিট ───────────────────────────────────────────────────
CREATE TABLE gate_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL UNIQUE REFERENCES registrations ON DELETE CASCADE,
  qr_secret       text NOT NULL CHECK (qr_secret ~ '^[a-f0-9]{64}$'),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_by       uuid REFERENCES auth.users ON DELETE SET NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz
);
COMMENT ON TABLE gate_tickets IS 'QR টিকিট টেবিল — পেমেন্ট যাচাইয়ের পর স্বয়ংক্রিয়ভাবে তৈরি, রিফান্ড/প্রত্যাখ্যানে বাতিল।';
COMMENT ON COLUMN gate_tickets.qr_secret IS 'QR-এ থাকা এলোমেলো ৬৪ অক্ষরের কোড; QR-এ ব্যক্তিগত তথ্য নেই।';
COMMENT ON COLUMN gate_tickets.status IS 'active = চালু · revoked = বাতিল (রিফান্ড/প্রত্যাখ্যান/বাদ দেওয়া)।';
CREATE INDEX tickets_status ON gate_tickets(status) WHERE status = 'active';

-- ── ২. দরজার চেক-ইন ───────────────────────────────────────────────
CREATE TABLE gate_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES event_events,
  registration_id uuid NOT NULL UNIQUE,
  FOREIGN KEY (registration_id, event_id) REFERENCES registrations(id, event_id),
  device_id       uuid NOT NULL,
  FOREIGN KEY (device_id, event_id) REFERENCES admin_devices(id, event_id),
  operator_id     uuid NOT NULL REFERENCES auth.users,
  group_size      integer NOT NULL CHECK (group_size BETWEEN 1 AND 22),
  checked_in_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE gate_checkins IS 'দরজার চেক-ইন টেবিল — কতজন ঢুকল, কোন ফোনে, কে চালাল। এক নিবন্ধনে একবারই (UNIQUE)।';
COMMENT ON COLUMN gate_checkins.group_size IS 'যিনি এসেছেন + সঙ্গী + শিশু — একসাথে কতজন ঢুকল।';
CREATE INDEX checkins_event_time ON gate_checkins(event_id, checked_in_at DESC);

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৮ | report — হিসাবের ভিউ  (17_report.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৮ | schema: report  —  রিপোর্ট সেকশন
-- এখানে ডেটা রাখা হয় না — টেবিলগুলো নিজে থেকেই সব হিসাব দেখায়।
-- Supabase Table Editor-এ report স্কিমা খুললেই মোট হিসাব, স্কুলভিত্তিক,
-- দিনভিত্তিক, উপস্থিতি ও রিফান্ডের ছবি দেখা যাবে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. মোট হিসাব (এক সারিতে পুরো উৎসব) ───────────────────────────
CREATE OR REPLACE VIEW report_summary AS
SELECT
  (SELECT count(*) FROM registrations WHERE archived_at IS NULL)                              AS registrations,
  (SELECT count(*) FROM registrations WHERE archived_at IS NULL AND status = 'approved')       AS approved,
  (SELECT count(*) FROM registrations WHERE archived_at IS NULL AND status = 'pending')        AS pending,
  (SELECT count(*) FROM registrations WHERE archived_at IS NULL AND status = 'refunded')       AS refunded,
  (SELECT count(*) FROM registrations WHERE archived_at IS NOT NULL)                           AS archived,
  (SELECT count(*) + coalesce(sum(spouse_count), 0) + coalesce(sum(children_count), 0)
     FROM registrations WHERE archived_at IS NULL)                                            AS people,
  (SELECT coalesce(sum(total_fee), 0) FROM registrations WHERE archived_at IS NULL)            AS expected_amount,
  (SELECT coalesce(sum(p.submitted_amount), 0) FROM payments p
     JOIN registrations r ON r.id = p.registration_id
    WHERE r.archived_at IS NULL AND p.status = 'verified')                                                  AS verified_amount,
  (SELECT coalesce(sum(f.amount), 0) FROM refunds f
     JOIN registrations r ON r.id = f.registration_id WHERE r.archived_at IS NULL)             AS refunded_amount,
  (SELECT count(*) FROM gate_checkins c
     JOIN registrations r ON r.id = c.registration_id WHERE r.archived_at IS NULL)             AS checked_in,
  (SELECT coalesce(sum(c.group_size), 0) FROM gate_checkins c
     JOIN registrations r ON r.id = c.registration_id WHERE r.archived_at IS NULL)             AS checked_in_people,
  (SELECT count(*) FROM registrations r
    WHERE r.archived_at IS NULL AND r.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM gate_checkins c WHERE c.registration_id = r.id))                       AS absent,
  (SELECT coalesce(sum(1 + r.spouse_count + r.children_count), 0) FROM registrations r
    WHERE r.archived_at IS NULL AND r.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM gate_checkins c WHERE c.registration_id = r.id))                       AS absent_people,
  (SELECT coalesce(sum(p.submitted_amount), 0) FROM payments p
     JOIN registrations r ON r.id = p.registration_id
    WHERE r.archived_at IS NULL AND p.status = 'pending')                                                   AS pending_payments_amount;
COMMENT ON VIEW report_summary IS 'এক সারিতে পুরো উৎসবের হিসাব: নিবন্ধন, মানুষ, প্রত্যাশিত/যাচাইকৃত/রিফান্ড টাকা, উপস্থিতি ও অনুপস্থিত।';

-- ── ২. স্কুলভিত্তিক হিসাব ─────────────────────────────────────────
CREATE OR REPLACE VIEW report_school_wise AS
SELECT
  u.school_name                         AS school,
  count(*)                              AS registrations,
  count(*) FILTER (WHERE r.status = 'approved') AS approved,
  count(*) + coalesce(sum(r.spouse_count), 0) + coalesce(sum(r.children_count), 0) AS people,
  coalesce(sum(r.total_fee), 0)         AS expected_amount,
  coalesce(sum(r.total_fee) FILTER (WHERE p.status = 'verified'), 0) AS verified_amount,
  count(*) FILTER (WHERE c.id IS NOT NULL) AS checked_in,
  coalesce(sum(c.group_size) FILTER (WHERE c.id IS NOT NULL), 0)     AS checked_in_people,
  count(*) FILTER (WHERE r.status = 'approved' AND c.id IS NULL)     AS absent
FROM registrations r
JOIN participants u ON u.id = r.participant_id
LEFT JOIN payments p ON p.registration_id = r.id
LEFT JOIN gate_checkins c ON c.registration_id = r.id
WHERE r.archived_at IS NULL
GROUP BY u.school_name
ORDER BY count(*) DESC, u.school_name;
COMMENT ON VIEW report_school_wise IS 'প্রতিটি স্কুল থেকে কতজন নিবন্ধন করল, কত টাকা এল, কতজন এল, কতজন অনুপস্থিত।';

-- ── ৩. দিনভিত্তিক নিবন্ধন (শেষ ৩০ দিন) ───────────────────────────
CREATE OR REPLACE VIEW report_daily AS
SELECT
  (r.created_at AT TIME ZONE 'Asia/Dhaka')::date          AS day,
  count(*)                                                AS registrations,
  count(*) FILTER (WHERE r.status = 'approved')           AS approved,
  coalesce(sum(r.total_fee), 0)                           AS expected_amount
FROM registrations r
WHERE r.archived_at IS NULL AND r.created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
COMMENT ON VIEW report_daily IS 'দিনভিত্তিক নিবন্ধন — শেষ ৩০ দিনের ধারা (বাংলাদেশ সময় অনুযায়ী)।';

-- ── ৪. উপস্থিতি (অনুমোদিত সবার নাম-ধামসহ) ────────────────────────
CREATE OR REPLACE VIEW report_attendance AS
SELECT
  r.ticket_number                                   AS ticket,
  u.name, u.school_name AS school, u.mobile,
  r.spouse_count AS spouse, r.children_count AS children,
  r.status,
  CASE WHEN c.id IS NULL THEN 'অনুপস্থিত' ELSE 'উপস্থিত' END AS attendance,
  c.group_size AS checked_in_people,
  c.checked_in_at,
  a.display_name AS checked_in_by
FROM registrations r
JOIN participants u ON u.id = r.participant_id
LEFT JOIN gate_checkins c ON c.registration_id = r.id
LEFT JOIN admin_users a ON a.user_id = c.operator_id
WHERE r.archived_at IS NULL AND r.status = 'approved'
ORDER BY (c.id IS NULL) DESC, u.name;
COMMENT ON VIEW report_attendance IS 'অনুমোদিত প্রত্যেকের উপস্থিতি-তালিকা — কে এসেছে, কে অনুপস্থিত, কে চেক-ইন করাল।';

-- ── ৫. রিফান্ড-তালিকা ─────────────────────────────────────────────
CREATE OR REPLACE VIEW report_refunds AS
SELECT
  f.refunded_at, f.amount, f.reason_bn AS reason, f.method,
  r.ticket_number AS ticket, u.name, u.school_name AS school,
  a.display_name AS marked_by
FROM refunds f
JOIN registrations r ON r.id = f.registration_id
JOIN participants u ON u.id = r.participant_id
LEFT JOIN admin_users a ON a.user_id = f.marked_by
ORDER BY f.refunded_at DESC;
COMMENT ON VIEW report_refunds IS 'যত রিফান্ড হয়েছে তার তালিকা — কত টাকা, কেন, কে অনুমোদন করল।';

-- ── ৬. মিডিয়া/সাইজ/খাবার হিসাব (পর্দায় দেখানোর ছোট ছবি) ─────────
CREATE OR REPLACE VIEW report_tshirt_sizes AS
SELECT u.tshirt_size AS size, count(*) AS count
FROM registrations r JOIN participants u ON u.id = r.participant_id
WHERE r.archived_at IS NULL GROUP BY u.tshirt_size ORDER BY count(*) DESC;
COMMENT ON VIEW report_tshirt_sizes IS 'কোন টি-শার্ট সাইজ কতটি লাগবে।';

CREATE OR REPLACE VIEW report_food_preferences AS
SELECT r.food_preference AS preference, count(*) AS count
FROM registrations r WHERE r.archived_at IS NULL AND r.food_preference IS NOT NULL
GROUP BY r.food_preference ORDER BY count(*) DESC;
COMMENT ON VIEW report_food_preferences IS 'সাধারণ/নিরামিষ/বিশেষ — কতটি খাবার লাগবে।';

CREATE OR REPLACE VIEW report_collectors AS
SELECT p.provider, p.collector_name_snapshot AS collector, p.collector_mobile_snapshot AS mobile,
       count(*) AS registrations, coalesce(sum(p.submitted_amount), 0) AS amount,
       coalesce(sum(p.submitted_amount) FILTER (WHERE p.status = 'verified'), 0) AS verified_amount
FROM payments p JOIN registrations r ON r.id = p.registration_id
WHERE r.archived_at IS NULL
GROUP BY 1, 2, 3 ORDER BY amount DESC;
COMMENT ON VIEW report_collectors IS 'কে (Tomal/Mahatab/Shohag/Arif) কত টাকা Received করেছেন।';


COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৯ | হিসাব-ইঞ্জিন ও টুলবক্স  (18_functions.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৭ | সাধারণ টুলবক্স — অভ্যন্তরীণ ফাংশন (সব public-এ)
-- এই ফাংশনগুলো কেউ সরাসরি ডাকতে পারে না; শুধু public API ও ট্রিগার
-- এগুলো ব্যবহার করে। এখানেই আছে হিসাব-নিকাশের আসল ইঞ্জিন।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;

-- ── ছোট সহায়ক ফাংশন ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.key_hash(v text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS
$$ SELECT encode(sha256(convert_to(v, 'UTF8')), 'hex') $$;
COMMENT ON FUNCTION key_hash(text) IS 'গোপন কী/টোকেনের SHA-256 hash — ডেটাবেসে আসল কী কখনো রাখা হয় না।';

CREATE OR REPLACE FUNCTION public.random_token() RETURNS text
LANGUAGE sql VOLATILE SET search_path = pg_catalog, public AS
$$ SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;
COMMENT ON FUNCTION random_token() IS '৬৪ অক্ষরের এলোমেলো গোপন টোকেন (QR secret, tracking key)।';

CREATE OR REPLACE FUNCTION public.normalize_mobile(v text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS
$$ SELECT regexp_replace(regexp_replace(translate(v, '০১২৩৪৫৬৭৮৯', '0123456789'), '[\s()-]', '', 'g'), '^\+?880', '0') $$;
COMMENT ON FUNCTION normalize_mobile(text) IS 'বাংলা/ইংরেজি অঙ্ক, +880 বা ফাঁকা-সহ যেকোনো মোবাইল নম্বরকে 01XXXXXXXXX আকারে আনে।';

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS
$$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
COMMENT ON FUNCTION set_updated_at() IS 'যে টেবিলে বসানো হয়, সেখানে প্রতিটি পরিবর্তনে updated_at স্বয়ংক্রিয়ভাবে হালনাগাদ করে।';

CREATE OR REPLACE FUNCTION public.event_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS
$$ SELECT id FROM event_events WHERE slug = 'rangpur-ssc96' $$;
COMMENT ON FUNCTION event_id() IS 'চলতি অনুষ্ঠানের আইডি — সব RPC এই একটি ফাংশন দিয়ে অনুষ্ঠান খুঁজে পায়।';

-- ── অনুমতি যাচাই ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.require_role(p_admin_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s admin_users;
BEGIN
  SELECT * INTO s FROM admin_users WHERE user_id = auth.uid() AND is_active;
  IF s.user_id IS NULL OR (p_admin_only AND s.role <> 'admin') THEN
    RAISE EXCEPTION 'অনুমোদিত স্টাফ/অ্যাডমিন লগইন প্রয়োজন।' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('id', s.user_id, 'role', s.role, 'name', s.display_name, 'adminOnly', p_admin_only);
END $$;
COMMENT ON FUNCTION require_role(boolean) IS 'লগইন করা ব্যবহারকারী স্টাফ কি না (এবং দরকার হলে অ্যাডমিন কি না) যাচাই করে; নাহলে 42501 ত্রুটি দেয়।';

-- ── অডিট-লগ লেখা ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_action(p_event uuid, p_action text, p_record uuid, p_meta jsonb DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO admin_audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (p_event, auth.uid(),
          coalesce((SELECT display_name FROM admin_users WHERE user_id = auth.uid()), 'public'),
          p_action, p_record, p_meta);
END $$;
COMMENT ON FUNCTION log_action(uuid, text, uuid, jsonb) IS 'কে কী করল তা admin_audit_logs-এ লিখে রাখে।';

-- ── টিকিট ও ডিভাইসের JSON ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.device_json(did uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT jsonb_build_object(
  'id', d.id, 'userId', d.user_id, 'staffName', s.display_name, 'label', d.label,
  'status', d.status, 'createdAt', d.created_at, 'updatedAt', d.updated_at, 'approvedBy', a.display_name)
FROM admin_devices d
JOIN admin_users s ON s.user_id = d.user_id
LEFT JOIN admin_users a ON a.user_id = d.approved_by
WHERE d.id = did $$;
COMMENT ON FUNCTION device_json(uuid) IS 'একটি ডিভাইসের তথ্য jsonb আকারে — অ্যাডমিন প্যানেলে দেখানোর জন্য।';

CREATE OR REPLACE FUNCTION public.form_field_json(fid uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT jsonb_build_object(
  'id', f.id, 'key', f.field_key, 'label', f.label_bn, 'kind', f.kind, 'options', f.options,
  'placeholder', f.placeholder, 'help', f.help_bn, 'maxLength', f.max_length,
  'required', f.is_required, 'visible', f.is_visible, 'order', f.sort_order, 'step', f.step,
  'isBase', f.is_base, 'isLocked', f.is_locked)
FROM content_form_fields f WHERE f.id = fid $$;
COMMENT ON FUNCTION form_field_json(uuid) IS 'নিবন্ধন ফর্মের একটি ঘরের তথ্য jsonb আকারে (পাবলিক সাইট ও প্যানেল দুটোই এই আকার দেখে)।';

CREATE OR REPLACE FUNCTION public.form_texts_json(p_event uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT coalesce(jsonb_object_agg(text_key, value_bn), '{}'::jsonb)
FROM content_form_texts WHERE event_id = p_event AND value_bn <> '' $$;
COMMENT ON FUNCTION form_texts_json(uuid) IS 'নিবন্ধন কার্ডের লেখাগুলোর বদলে দেওয়া মান — { "card.title": "…" } আকারে; খালি মান বাদ যায়।';

CREATE OR REPLACE FUNCTION public.form_text_json(p_event uuid, p_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT jsonb_build_object(
  'label', (SELECT value_bn FROM content_form_texts WHERE event_id = p_event AND text_key = p_key || '.label' AND value_bn <> ''),
  'help',  (SELECT value_bn FROM content_form_texts WHERE event_id = p_event AND text_key = p_key || '.help'  AND value_bn <> ''),
  'placeholder', (SELECT value_bn FROM content_form_texts WHERE event_id = p_event AND text_key = p_key || '.placeholder' AND value_bn <> '')) $$;
COMMENT ON FUNCTION form_text_json(uuid, text) IS 'একটি মূল ঘরের লেবেল/সাহায্য/ছায়া-লেখার বদলে দেওয়া মান (থাকলে)।';

CREATE OR REPLACE FUNCTION public.form_field_stats(p_event uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb) FROM (
  SELECT f.sort_order AS ord,
    jsonb_build_object(
      'key', f.field_key, 'label', f.label_bn, 'kind', f.kind, 'order', f.sort_order,
      'answered', (SELECT count(*) FROM registrations r WHERE r.event_id = f.event_id
                    AND r.archived_at IS NULL AND coalesce(r.custom_answers->>f.field_key, '') <> ''),
      'top', coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'count', n) ORDER BY n DESC, v)
          FROM (SELECT r.custom_answers->>f.field_key AS v, count(*) AS n FROM registrations r
                 WHERE r.event_id = f.event_id AND r.archived_at IS NULL
                   AND coalesce(r.custom_answers->>f.field_key, '') <> ''
                 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8) t), '[]'::jsonb)) AS j
  FROM content_form_fields f WHERE f.event_id = p_event AND f.is_visible AND NOT f.is_base) x $$;
COMMENT ON FUNCTION form_field_stats(uuid) IS 'নিবন্ধন ফর্মের প্রতিটি ঘরে কতজন কী উত্তর দিয়েছে — রিপোর্ট পেজের জন্য।';

CREATE OR REPLACE FUNCTION public.registration_json(rid uuid, include_qr boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT jsonb_build_object(
  'id', r.id, 'ticketNumber', r.ticket_number,
  'participant', jsonb_build_object('name', u.name, 'school', u.school_name, 'sscRoll', u.ssc_roll,
    'sscRegistration', u.ssc_registration, 'mobile', u.mobile, 'location', u.current_location, 'tshirt', u.tshirt_size),
  'spouse', r.spouse_count, 'children', r.children_count, 'food', coalesce(r.food_preference, ''), 'notes', r.notes,
  'answers', r.custom_answers,
  'feeSnapshot', jsonb_build_object('friend', r.fee_friend, 'spouse', r.fee_spouse, 'child', r.fee_child),
  'total', r.total_fee, 'status', r.status,
  'payment', jsonb_build_object('id', p.id, 'provider', p.provider, 'accountId', p.account_id,
    'collectorName', p.collector_name_snapshot, 'collectorMobile', p.collector_mobile_snapshot,
    'senderMobile', p.sender_mobile, 'transactionId', p.transaction_id, 'amount', p.submitted_amount,
    'status', p.status, 'reviewedAt', p.reviewed_at, 'reason', p.rejection_reason),
  'refund', (SELECT to_jsonb(x) FROM (
      SELECT coalesce(sum(f.amount), 0) AS amount, count(*) AS count, max(f.refunded_at) AS lastAt
      FROM refunds f WHERE f.registration_id = r.id) x
    WHERE EXISTS (SELECT 1 FROM refunds f WHERE f.registration_id = r.id)),
  'createdAt', r.created_at, 'approvedAt', r.approved_at, 'refundedAt', r.refunded_at,
  'checkedInAt', c.checked_in_at, 'archivedAt', r.archived_at, 'source', 'live',
  'qrPayload', CASE WHEN include_qr AND r.status = 'approved' AND r.archived_at IS NULL AND t.status = 'active'
    THEN 'R96:' || r.id::text || ':' || t.qr_secret ELSE NULL END)
FROM registrations r
JOIN participants u ON u.id = r.participant_id
JOIN payments p ON p.registration_id = r.id
LEFT JOIN gate_tickets t ON t.registration_id = r.id
LEFT JOIN gate_checkins c ON c.registration_id = r.id
WHERE r.id = rid $$;
COMMENT ON FUNCTION registration_json(uuid, boolean) IS 'একটি নিবন্ধনের সম্পূর্ণ ছবি jsonb আকারে (টিকিট নম্বর, পেমেন্ট, রিফান্ড, চেক-ইন, QR)।';

-- ── হিসাব-নিকাশের ইঞ্জিন (রিপোর্টের সব সংখ্যা এখান থেকে) ──────────
CREATE OR REPLACE FUNCTION public.stats() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
WITH reg AS (
  SELECT r.id, r.status, r.total_fee, r.spouse_count, r.children_count, r.created_at, r.archived_at,
         p.status AS pay_status, p.submitted_amount, p.provider,
         (c.id IS NOT NULL) AS checked, coalesce(c.group_size, 0) AS group_size,
         u.school_name AS school, u.tshirt_size AS tshirt, r.food_preference AS food,
         p.collector_name_snapshot AS collector, p.collector_mobile_snapshot AS collector_mobile,
         r.ticket_number,
         coalesce((SELECT sum(f.amount) FROM refunds f WHERE f.registration_id = r.id), 0) AS refunded
  FROM registrations r
  JOIN participants u ON u.id = r.participant_id
  LEFT JOIN payments p ON p.registration_id = r.id
  LEFT JOIN gate_checkins c ON c.registration_id = r.id
), live AS (SELECT * FROM reg WHERE archived_at IS NULL)
SELECT jsonb_build_object(
  'generatedAt', now(),
  'totals', (SELECT jsonb_build_object(
      'registrations', count(*),
      'approved', count(*) FILTER (WHERE status = 'approved'),
      'pending', count(*) FILTER (WHERE status = 'pending'),
      'rejected', count(*) FILTER (WHERE status = 'rejected'),
      'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
      'refunded', count(*) FILTER (WHERE status = 'refunded'),
      'refundedCount', count(*) FILTER (WHERE refunded > 0),
      'families', count(*) FILTER (WHERE status = 'approved'),
      'spouses', coalesce(sum(spouse_count), 0),
      'children', coalesce(sum(children_count), 0),
      'people', count(*) + coalesce(sum(spouse_count), 0) + coalesce(sum(children_count), 0),
      'approvedPeople', coalesce(sum(1 + spouse_count + children_count) FILTER (WHERE status = 'approved'), 0),
      'expectedAmount', coalesce(sum(total_fee), 0),
      'verifiedAmount', coalesce(sum(total_fee) FILTER (WHERE pay_status = 'verified'), 0),
      'refundedAmount', coalesce(sum(refunded), 0),
      'netAmount', coalesce(sum(total_fee) FILTER (WHERE pay_status = 'verified'), 0) - coalesce(sum(refunded), 0),
      'pendingAmount', coalesce(sum(total_fee) FILTER (WHERE pay_status IS DISTINCT FROM 'verified' AND pay_status IS DISTINCT FROM 'refunded'), 0),
      'checkedIn', count(*) FILTER (WHERE checked),
      'checkedInPeople', coalesce(sum(group_size) FILTER (WHERE checked), 0),
      'absent', count(*) FILTER (WHERE status = 'approved' AND NOT checked),
      'absentPeople', coalesce(sum(1 + spouse_count + children_count) FILTER (WHERE status = 'approved' AND NOT checked), 0),
      'checkInPercent', CASE WHEN count(*) FILTER (WHERE status = 'approved') = 0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE checked) / count(*) FILTER (WHERE status = 'approved')) END
    ) FROM live),
  'archived', (SELECT count(*) FROM reg WHERE archived_at IS NOT NULL),
  'schools', coalesce((SELECT jsonb_agg(x ORDER BY (x ->> 'registrations')::int DESC, x ->> 'school') FROM (
      SELECT jsonb_build_object(
        'school', school,
        'registrations', count(*),
        'approved', count(*) FILTER (WHERE status = 'approved'),
        'people', count(*) + coalesce(sum(spouse_count), 0) + coalesce(sum(children_count), 0),
        'expectedAmount', coalesce(sum(total_fee), 0),
        'verifiedAmount', coalesce(sum(total_fee) FILTER (WHERE pay_status = 'verified'), 0),
        'checkedIn', count(*) FILTER (WHERE checked),
        'checkedInPeople', coalesce(sum(group_size) FILTER (WHERE checked), 0),
        'absent', count(*) FILTER (WHERE status = 'approved' AND NOT checked)
      ) AS x FROM live GROUP BY school) s), '[]'::jsonb),
  'tshirts', coalesce((SELECT jsonb_agg(jsonb_build_object('size', tshirt, 'count', n) ORDER BY n DESC, tshirt)
      FROM (SELECT tshirt, count(*) AS n FROM live GROUP BY tshirt) t), '[]'::jsonb),
  'foods', coalesce((SELECT jsonb_agg(jsonb_build_object('preference', food, 'count', n) ORDER BY n DESC, food)
      FROM (SELECT food, count(*) AS n FROM live WHERE coalesce(food, '') <> '' GROUP BY food) t), '[]'::jsonb),
  'formFields', form_field_stats((SELECT id FROM event_events WHERE slug = 'rangpur-ssc96')),
  'providers', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'provider', provider, 'count', n, 'amount', amount, 'verifiedAmount', verified) ORDER BY amount DESC)
      FROM (SELECT provider, count(*) AS n, coalesce(sum(submitted_amount), 0) AS amount,
                   coalesce(sum(submitted_amount) FILTER (WHERE pay_status = 'verified'), 0) AS verified
            FROM live GROUP BY provider) t), '[]'::jsonb),
  'collectors', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'provider', provider, 'name', collector, 'mobile', collector_mobile, 'count', n, 'amount', amount) ORDER BY amount DESC)
      FROM (SELECT provider, collector, collector_mobile, count(*) AS n, coalesce(sum(submitted_amount), 0) AS amount
            FROM live GROUP BY provider, collector, collector_mobile) t), '[]'::jsonb),
  'refunds', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'date', f.refunded_at, 'amount', f.amount, 'reason', f.reason_bn, 'method', f.method,
        'ticketNumber', r.ticket_number, 'name', u.name, 'school', u.school_name) ORDER BY f.refunded_at DESC) FROM (
      SELECT rf.* FROM refunds rf JOIN registrations rr ON rr.id = rf.registration_id
      WHERE rr.archived_at IS NULL ORDER BY rf.refunded_at DESC LIMIT 50) f
    JOIN registrations r ON r.id = f.registration_id
    JOIN participants u ON u.id = r.participant_id), '[]'::jsonb),
  'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', n) ORDER BY d) FROM (
      SELECT (created_at AT TIME ZONE 'Asia/Dhaka')::date AS d, count(*) AS n
      FROM live WHERE created_at >= now() - interval '14 days' GROUP BY 1) t), '[]'::jsonb)
) $$;
COMMENT ON FUNCTION stats() IS 'রিপোর্টের সব সংখ্যা: মোট নিবন্ধন/মানুষ/টাকা (প্রত্যাশিত-যাচাইকৃত-রিফান্ড), উপস্থিতি-অনুপস্থিতি, স্কুলভিত্তিক হিসাব, টি-শার্ট, খাবার, বিকাশ/নগদ ও গ্রহণকারীভিত্তিক জমা।';

-- অভ্যন্তরীণ ফাংশনগুলো বাইরের কারও ডাকার বিষয় নয় — 23_harden.sql-এ বিস্তারিত বন্ধ করা হয়।

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১০ | নিয়ম ও স্বয়ংক্রিয় প্রতিক্রিয়া  (19_rules.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৮ | নিয়ম ও প্রতিক্রিয়া (ট্রিগার)
-- এখানেই লেখা থাকে "কিছু ঘটলে স্বয়ংক্রিয়ভাবে কী হবে":
--   • পেমেন্ট যাচাই → নিবন্ধন অনুমোদিত → QR টিকিট তৈরি → অডিট
--   • পেমেন্ট প্রত্যাখ্যান → টিকিট বাতিল
--   • রিফান্ড → টিকিট বাতিল + পেমেন্ট refunded
--   • চেক-ইন → শর্ত যাচাই → অডিট
--   • মোবাইল নম্বর → সবসময় 01XXXXXXXXX আকারে
--   • admin_users-এ নতুন সারি → auth.users থেকে ইমেইল/নাম বসে
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;

-- ── ১. মোবাইল নম্বর পরিষ্কার করা (লেখার আগে) ───────────────────────
CREATE OR REPLACE FUNCTION public.normalize_participant() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN NEW.mobile := normalize_mobile(NEW.mobile); RETURN NEW; END $$;
COMMENT ON FUNCTION normalize_participant() IS 'অংশগ্রহণকারীর মোবাইল নম্বর সবসময় 01XXXXXXXXX আকারে লিখে রাখে।';

CREATE OR REPLACE FUNCTION public.normalize_payment() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN NEW.sender_mobile := normalize_mobile(NEW.sender_mobile); RETURN NEW; END $$;
COMMENT ON FUNCTION normalize_payment() IS 'টাকা পাঠানোর নম্বরও একই আকারে সংরক্ষণ করে — যাচাই সহজ হয়।';

CREATE OR REPLACE FUNCTION public.normalize_account_mobile() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN NEW.mobile := normalize_mobile(NEW.mobile); RETURN NEW; END $$;
COMMENT ON FUNCTION normalize_account_mobile() IS 'প্রকাশ্য bKash/Nagad ও যোগাযোগ নম্বরের আকার ঠিক রাখে।';

-- ── ২. নিবন্ধনের নিয়ম ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_registration() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধনের অবস্থা আর বদলানো যাবে না।';
  END IF;
  IF OLD.status = 'approved' AND NEW.status = 'approved'
     AND (NEW.spouse_count IS DISTINCT FROM OLD.spouse_count OR NEW.children_count IS DISTINCT FROM OLD.children_count) THEN
    RAISE EXCEPTION 'অনুমোদিত টিকিটের সদস্যসংখ্যা সরাসরি বদলানো যাবে না।';
  END IF;
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
     AND NEW.status IN ('approved', 'pending') THEN
    NEW.status := 'cancelled';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION guard_registration() IS 'বাদ দেওয়া নিবন্ধন বদলানো বা অনুমোদিত টিকিটের সদস্যসংখ্যা নীরবে বদলানো আটকায়।';

-- ── ৩. টিকিটের নিয়ম (অনুমোদন ছাড়া QR চালু নয়) ────────────────────
CREATE OR REPLACE FUNCTION public.guard_ticket() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'active' AND NOT EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.id = NEW.registration_id AND r.status = 'approved' AND r.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'অনুমোদিত নিবন্ধন ছাড়া QR টিকিট চালু করা যাবে না।';
  END IF;
  IF NEW.status = 'revoked' AND NEW.revoked_at IS NULL THEN NEW.revoked_at := now(); END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION guard_ticket() IS 'টিকিট কেবল অনুমোদিত নিবন্ধনের জন্য চালু হতে পারে; বাতিলের সময় সময়-ছাপ বসায়।';

-- ── ৪. পেমেন্ট → নিবন্ধন → টিকিট (মূল প্রতিক্রিয়া) ────────────────
CREATE OR REPLACE FUNCTION public.on_payment_verified() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE who text;
BEGIN
  UPDATE registrations
     SET status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
   WHERE id = NEW.registration_id AND status <> 'approved' AND archived_at IS NULL;

  INSERT INTO gate_tickets(registration_id, qr_secret, status, issued_by)
  VALUES (NEW.registration_id, random_token(), 'active', auth.uid())
  ON CONFLICT (registration_id) DO UPDATE
     SET qr_secret = excluded.qr_secret, status = 'active', issued_by = excluded.issued_by,
         issued_at = now(), revoked_at = NULL;

  who := coalesce((SELECT display_name FROM admin_users WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin_audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'payment.verified', NEW.registration_id,
          jsonb_build_object('amount', NEW.submitted_amount, 'provider', NEW.provider, 'ticketIssued', true));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION on_payment_verified() IS 'পেমেন্ট verified হলে নিবন্ধন অনুমোদন করে, নতুন QR টিকিট দেয় এবং অডিট লেখে — এক ধাপেই।';

CREATE OR REPLACE FUNCTION public.on_payment_rejected() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE who text;
BEGIN
  UPDATE registrations SET status = 'rejected', updated_at = now()
   WHERE id = NEW.registration_id AND archived_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM gate_checkins c WHERE c.registration_id = NEW.registration_id);

  UPDATE gate_tickets SET status = 'revoked', revoked_at = now()
   WHERE registration_id = NEW.registration_id AND status = 'active';

  who := coalesce((SELECT display_name FROM admin_users WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin_audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'payment.rejected', NEW.registration_id,
          jsonb_build_object('reason', NEW.rejection_reason, 'ticketRevoked', true));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION on_payment_rejected() IS 'পেমেন্ট প্রত্যাখ্যাত হলে টিকিট বাতিল করে; চেক-ইন হয়ে গেলে নিবন্ধন আর বদলায় না।';

CREATE OR REPLACE FUNCTION public.on_payment_refunded() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE who text;
BEGIN
  UPDATE registrations SET status = 'refunded', refunded_at = coalesce(refunded_at, now()), updated_at = now()
   WHERE id = NEW.registration_id AND archived_at IS NULL;

  UPDATE gate_tickets SET status = 'revoked', revoked_at = now()
   WHERE registration_id = NEW.registration_id AND status = 'active';

  who := coalesce((SELECT display_name FROM admin_users WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin_audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'payment.refunded', NEW.registration_id,
          jsonb_build_object('refundAmount', NEW.submitted_amount, 'ticketRevoked', true));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION on_payment_refunded() IS 'টাকা ফেরত দেওয়া হলে নিবন্ধন "refunded" করে ও টিকিট বাতিল করে।';

-- ── ৫. রিফান্ড লেখার নিয়ম ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_refund_inserted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE paid numeric; total numeric; who text;
BEGIN
  SELECT submitted_amount INTO paid FROM payments WHERE id = NEW.payment_id;
  IF paid IS NULL THEN RAISE EXCEPTION 'পেমেন্ট পাওয়া যায়নি।'; END IF;
  SELECT coalesce(sum(amount), 0) INTO total FROM refunds WHERE payment_id = NEW.payment_id;
  IF total > paid THEN RAISE EXCEPTION 'রিফান্ডের মোট টাকা (%) জমা দেওয়া টাকার (%) চেয়ে বেশি হতে পারে না।', total, paid; END IF;

  UPDATE payments SET status = 'refunded', updated_at = now()
   WHERE id = NEW.payment_id AND status <> 'refunded';

  who := coalesce((SELECT display_name FROM admin_users WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin_audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'refund.created', NEW.registration_id,
          jsonb_build_object('amount', NEW.amount, 'method', NEW.method, 'reason', NEW.reason_bn));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION on_refund_inserted() IS 'রিফান্ড যোগ হলে হিসাব মিলিয়ে পেমেন্টকে refunded করে — তারপরেই টিকিট বাতিলের ধাপ চলে।';

-- ── ৬. চেক-ইনের নিয়ম ও অডিট ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_checkin() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM registrations r
    JOIN payments p ON p.registration_id = r.id
    JOIN gate_tickets t ON t.registration_id = r.id
    WHERE r.id = NEW.registration_id AND r.status = 'approved' AND r.archived_at IS NULL
      AND p.status = 'verified' AND t.status = 'active'
  ) THEN
    RAISE EXCEPTION 'টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION guard_checkin() IS 'অনুমোদিত + যাচাইকৃত + চালু টিকিট ছাড়া দরজা খোলে না (তিন স্তরের শর্ত)।';

CREATE OR REPLACE FUNCTION public.audit_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE who text;
BEGIN
  SELECT display_name INTO who FROM admin_users WHERE user_id = NEW.operator_id;
  INSERT INTO admin_audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, NEW.operator_id, coalesce(who, 'staff'), 'ticket.checkin', NEW.registration_id,
          jsonb_build_object('deviceId', NEW.device_id, 'people', NEW.group_size));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION audit_checkin() IS 'প্রতিটি সফল চেক-ইন অডিট-লগে লিখে রাখে (কোন ডিভাইস, কতজন)।';

-- ── ৭. অ্যাডমিন টেবিলের নিয়ম ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fill_admin_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.email = '' THEN
    SELECT coalesce(u.email, '') INTO NEW.email FROM auth.users u WHERE u.id = NEW.user_id;
  END IF;
  IF NEW.display_name = '' THEN NEW.display_name := coalesce(nullif(split_part(NEW.email, '@', 1), ''), 'স্টাফ'); END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION fill_admin_fields() IS 'admin_users-এ নতুন সারি যোগ হলে auth.users থেকে ইমেইল ও নাম স্বয়ংক্রিয়ভাবে বসায়।';

-- ═══════════════ ট্রিগার বসানো ═══════════════
-- ১. হালনাগাদের সময়-ছাপ
CREATE TRIGGER trg_touch_events         BEFORE UPDATE ON event_events            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_fees           BEFORE UPDATE ON event_fees        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_contacts       BEFORE UPDATE ON event_contacts    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_sections       BEFORE UPDATE ON content_sections       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_schedule       BEFORE UPDATE ON content_schedule       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_accounts       BEFORE UPDATE ON payment_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_participants   BEFORE UPDATE ON participants    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_registrations  BEFORE UPDATE ON registrations   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_access         BEFORE UPDATE ON user_links FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_profiles       BEFORE UPDATE ON admin_users        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_payments       BEFORE UPDATE ON payments         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_devices        BEFORE UPDATE ON admin_devices      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_touch_settings       BEFORE UPDATE ON database_settings      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ২. মোবাইল নম্বর পরিষ্কার
CREATE TRIGGER trg_norm_participant     BEFORE INSERT OR UPDATE ON participants FOR EACH ROW EXECUTE FUNCTION normalize_participant();
CREATE TRIGGER trg_norm_payment         BEFORE INSERT OR UPDATE ON payments      FOR EACH ROW EXECUTE FUNCTION normalize_payment();
CREATE TRIGGER trg_norm_account_mobile  BEFORE INSERT OR UPDATE ON payment_accounts FOR EACH ROW EXECUTE FUNCTION normalize_account_mobile();
CREATE TRIGGER trg_norm_contact_mobile  BEFORE INSERT OR UPDATE ON event_contacts FOR EACH ROW EXECUTE FUNCTION normalize_account_mobile();

-- ৩. নিয়ম-শৃঙ্খলা
CREATE TRIGGER trg_guard_registration   BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION guard_registration();
CREATE TRIGGER trg_guard_ticket         BEFORE INSERT OR UPDATE ON gate_tickets FOR EACH ROW EXECUTE FUNCTION guard_ticket();
CREATE TRIGGER trg_guard_checkin        BEFORE INSERT ON gate_checkins        FOR EACH ROW EXECUTE FUNCTION guard_checkin();

-- ৪. মূল প্রতিক্রিয়া-শৃঙ্খল
CREATE TRIGGER trg_payment_verified     AFTER UPDATE OF status ON payments FOR EACH ROW
  WHEN (NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified') EXECUTE FUNCTION on_payment_verified();
CREATE TRIGGER trg_payment_rejected     AFTER UPDATE OF status ON payments FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected') EXECUTE FUNCTION on_payment_rejected();
CREATE TRIGGER trg_payment_refunded     AFTER UPDATE OF status ON payments FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded') EXECUTE FUNCTION on_payment_refunded();
CREATE TRIGGER trg_refund_inserted      AFTER INSERT ON refunds FOR EACH ROW EXECUTE FUNCTION on_refund_inserted();
CREATE TRIGGER trg_checkin_audit        AFTER INSERT ON gate_checkins FOR EACH ROW EXECUTE FUNCTION audit_checkin();
CREATE TRIGGER trg_admin_fill           BEFORE INSERT OR UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION fill_admin_fields();

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১১ | guide — গঠন-বর্ণনা  (20_guide.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৯ | schema: guide  —  মানুষের পড়ার জন্য গঠন-বর্ণনা
-- এখানে ডেটা নয়, ব্যাখ্যা থাকে: কোন টেবিল কী কাজে, কার সাথে কার
-- সম্পর্ক, আর কোনো কাজ করলে কী ঘটে (action → reaction)।
-- guide_relations ও guide_functions পুরোটাই স্বয়ংক্রিয় — ডেটাবেস
-- বদলালে এগুলোও নিজে থেকে ঠিক হয়ে যায়।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;


-- ── ১. প্রতিটি টেবিলের পরিচয় ও উদ্দেশ্য ──────────────────────────
CREATE TABLE IF NOT EXISTS guide_tables (
  schema_name  text NOT NULL,
  table_name   text NOT NULL,
  purpose_bn   text NOT NULL CHECK (length(purpose_bn) BETWEEN 5 AND 300),
  written_by   text NOT NULL CHECK (length(written_by) BETWEEN 2 AND 120),
  key_columns  text NOT NULL CHECK (length(key_columns) BETWEEN 2 AND 200),
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (schema_name, table_name)
);
COMMENT ON TABLE guide_tables IS '২৫টি টেবিলের এক-লাইনের বাংলা পরিচয়: কী কাজে, কে লেখে, মূল কলাম কোনগুলো।';
COMMENT ON COLUMN guide_tables.written_by IS 'এই টেবিলে কে লিখতে পারে — যেমন "অংশগ্রহণকারীর ফর্ম (RPC)" বা "অ্যাডমিন প্যানেল"।';
COMMENT ON COLUMN guide_tables.key_columns IS 'এই টেবিলের সবচেয়ে জরুরি কলামগুলো।';

-- ── ২. কোনো কাজ করলে কী ঘটে (action → reaction) ───────────────────
CREATE TABLE IF NOT EXISTS guide_flows (
  id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{3,40}$'),
  title_bn   text NOT NULL CHECK (length(title_bn) BETWEEN 3 AND 120),
  actor_bn   text NOT NULL CHECK (length(actor_bn) BETWEEN 3 AND 80),
  trigger_bn text NOT NULL CHECK (length(trigger_bn) BETWEEN 3 AND 200),
  steps      jsonb NOT NULL DEFAULT '[]'::jsonb,
  effects    jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE guide_flows IS 'প্রতিটি কাজের ধাপে ধাপে ফলাফল — লগইন, পাসওয়ার্ড রিসেট, পেমেন্ট, রিফান্ড, চেক-ইন সহ ১৫টি প্রবাহ।';
COMMENT ON COLUMN guide_flows.steps IS 'যে ধাপগুলো একের পর এক ঘটে (বাংলা লেখার তালিকা)।';
COMMENT ON COLUMN guide_flows.effects IS 'কোন টেবিলে কী লেখা/বদল হয় — {"schema.table", "কী হয়"} আকারে।';

-- ── ৩. টেবিল-থেকে-টেবিল সম্পর্ক (স্বয়ংক্রিয়, foreign key থেকে) ────
CREATE VIEW guide_relations AS
SELECT
  ns.nspname  AS child_schema,
  cl.relname  AS child_table,
  a.attname   AS child_column,
  ns2.nspname AS parent_schema,
  cl2.relname AS parent_table,
  a2.attname  AS parent_column,
  CASE con.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'r' THEN 'RESTRICT'
       WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END AS on_delete,
  con.conname AS constraint_name
FROM pg_constraint con
JOIN pg_class cl  ON cl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cl.relnamespace
JOIN pg_class cl2 ON cl2.oid = con.confrelid
JOIN pg_namespace ns2 ON ns2.oid = cl2.relnamespace
JOIN unnest(con.conkey)  WITH ORDINALITY AS k(attnum, ord) ON true
JOIN unnest(con.confkey) WITH ORDINALITY AS f(attnum, ord) ON f.ord = k.ord
JOIN pg_attribute a  ON a.attrelid = cl.oid  AND a.attnum = k.attnum
JOIN pg_attribute a2 ON a2.attrelid = cl2.oid AND a2.attnum = f.attnum
WHERE con.contype = 'f'
  AND ns.nspname = 'public' AND ns2.nspname = 'public'
ORDER BY 1, 2, 3;
COMMENT ON VIEW guide_relations IS 'প্রতিটি foreign key সম্পর্ক — কোন টেবিলের কোন কলাম কার সাথে জোড়া, মুছলে কী হয়। স্বয়ংক্রিয়ভাবে তৈরি।';

-- ── ৪. কোন ফাংশন কে ডাকতে পারে (স্বয়ংক্রিয়) ─────────────────────
CREATE VIEW guide_functions AS
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  obj_description(p.oid, 'pg_proc') AS purpose_bn,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS public_can_call,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS staff_can_call
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY n.nspname, p.proname;
COMMENT ON VIEW guide_functions IS 'সব ফাংশনের তালিকা — কে ডাকতে পারে (সাধারণ ব্যবহারকারী/স্টাফ) ও কী কাজে।';

-- ── ৫. প্রতিটি টেবিলে এখন কত সারি (সঠিক গণনা) ────────────────────
CREATE OR REPLACE FUNCTION public.live_counts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE t record; out jsonb := '{}'::jsonb; n bigint;
BEGIN
  FOR t IN SELECT table_name FROM guide_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.table_name) INTO n;
    out := out || jsonb_build_object(t.table_name, n);
  END LOOP;
  RETURN out;
END $$;
COMMENT ON FUNCTION live_counts() IS 'প্রতিটি টেবিলে এই মুহূর্তে কতটি সারি আছে — অ্যাডমিন প্যানেলের গঠন-পর্দায় দেখানো হয়।';

-- ── ৬. স্কিমা-তালিকা (হালনাগাদ টেবিল-সংখ্যাসহ) ────────────────────
CREATE OR REPLACE VIEW guide_schemas AS
SELECT s.name, s.section_bn, s.purpose_bn, s.sort_order,
       (SELECT count(*) FROM guide_tables t WHERE t.schema_name = s.name) AS table_count,
       (SELECT coalesce(sum(h.approx_rows), 0) FROM database_health h WHERE h.schema_name = s.name) AS approx_rows
FROM database_schemas s
ORDER BY s.sort_order, s.name;
COMMENT ON VIEW guide_schemas IS 'প্রতিটি স্কিমার উদ্দেশ্য ও কতটি টেবিল আছে — এক নজরে।';

-- ── ৭. সবকিছু একসাথে: অ্যাডমিন প্যানেলের "ডেটাবেস গঠন" পর্দা ──────
DROP VIEW IF EXISTS guide_overview CASCADE;  -- কলামের গঠন বদলালে ভিউ নতুন করে বানাতে হয়
CREATE VIEW guide_overview AS
SELECT jsonb_build_object(
  'generatedAt', now(),
  'counts', jsonb_build_object(
    'schemas', (SELECT count(*) FROM database_schemas),
    'tables', (SELECT count(*) FROM guide_tables),
    'relations', (SELECT count(*) FROM guide_relations),
    'flows', (SELECT count(*) FROM guide_flows),
    'functions', (SELECT count(*) FROM guide_functions WHERE schema_name = 'public'),
    'indexes', (SELECT count(*) FROM database_health),
    'triggers', (SELECT coalesce(sum(triggers), 0) FROM database_health)),
  'schemas', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'name', name, 'section', section_bn, 'purpose', purpose_bn, 'tables', table_count) ORDER BY sort_order, name)
    FROM guide_schemas), '[]'::jsonb),
  'tables', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'schema', t.schema_name, 'table', t.table_name, 'purpose', t.purpose_bn, 'writtenBy', t.written_by,
      'keyColumns', t.key_columns, 'rows', coalesce((live_counts() ->> t.table_name)::bigint, 0),
      'indexes', coalesce((SELECT h.indexes FROM database_health h WHERE h.schema_name = t.schema_name AND h.table_name = t.table_name), 0),
      'triggers', coalesce((SELECT h.triggers FROM database_health h WHERE h.schema_name = t.schema_name AND h.table_name = t.table_name), 0),
      'rls', coalesce((SELECT h.rls_on FROM database_health h WHERE h.schema_name = t.schema_name AND h.table_name = t.table_name), false))
      ORDER BY t.schema_name, t.table_name) FROM guide_tables t), '[]'::jsonb),
  'relations', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM guide_relations r), '[]'::jsonb),
  'flows', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'title', title_bn, 'actor', actor_bn, 'trigger', trigger_bn, 'steps', steps, 'effects', effects)
      ORDER BY sort_order) FROM guide_flows), '[]'::jsonb),
  'functions', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'schema', schema_name, 'name', function_name, 'args', arguments, 'purpose', purpose_bn,
      'publicCanCall', public_can_call, 'staffCanCall', staff_can_call) ORDER BY schema_name, function_name)
    FROM guide_functions), '[]'::jsonb),
  'health', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.schema_name, h.table_name) FROM database_health h), '[]'::jsonb)
 ) AS data;
COMMENT ON VIEW guide_overview IS 'অ্যাডমিন প্যানেলের "ডেটাবেস গঠন" ট্যাবের পুরো তথ্য এক jsonb-তে।';


COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১২ | public RPC দরজাগুলো  (21_api.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১০ | schema: public — অ্যাপের একমাত্র দরজা (RPC)
-- বাইরের কেউ সরাসরি কোনো টেবিল পড়তে/লিখতে পারে না। শুধু এই কয়টি
-- ফাংশনই দরজা — প্রতিটির অনুমতি আলাদা করে দেওয়া।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;

-- ── সাধারণ ব্যবহারকারীর (লগইন ছাড়া) দরজা ─────────────────────────
CREATE OR REPLACE FUNCTION public.public_site() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96';
  IF e.id IS NULL THEN RAISE EXCEPTION 'আগে 20_seed.sql চালান।'; END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'name', e.name, 'tagline', e.tagline, 'dateLabel', e.date_label,
      'isDummyDate', e.is_dummy_date, 'venue', e.venue, 'city', e.city, 'venueEnglish', e.venue_english,
      'registrationOpen', e.registration_open),
    'fees', (SELECT jsonb_object_agg(kind, amount) FROM event_fees WHERE event_id = e.id),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn) ORDER BY sort_order)
      FROM event_contacts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
      'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_sections WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
      'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_schedule WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
      'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment_accounts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'formFields', coalesce((SELECT jsonb_agg(form_field_json(id) || jsonb_build_object('texts', form_text_json(e.id, field_key))
        ORDER BY sort_order)
      FROM content_form_fields WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'formTexts', form_texts_json(e.id),
    'nav', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'label', label_bn, 'target', target,
        'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_nav_items WHERE event_id = e.id AND is_visible), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.public_site() IS 'পাবলিক পেজের সব তথ্য: অনুষ্ঠান, ফি, যোগাযোগ নম্বর, সেকশন, সময়সূচি, Send Money নম্বর ও নিবন্ধন ফর্মের ঘরগুলো। লগইন লাগে না।';

CREATE OR REPLACE FUNCTION public.submit_registration(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; a payment_accounts; f jsonb; u jsonb := p_data->'participant'; p jsonb := p_data->'payment';
        rid uuid; uid uuid; r registrations; access_key text; spouse integer; children integer;
        answers jsonb; ff content_form_fields;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96' FOR SHARE;
  IF e.id IS NULL OR NOT e.registration_open THEN RAISE EXCEPTION 'নিবন্ধন আপাতত বন্ধ আছে।'; END IF;
  IF coalesce((p_data->>'consent')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'শর্তে সম্মতি প্রয়োজন।'; END IF;
  spouse := (p_data->>'spouse')::integer; children := (p_data->>'children')::integer;
  IF spouse IS NULL OR children IS NULL OR spouse NOT BETWEEN 0 AND 1 OR children NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'পরিবারের সদস্যসংখ্যা সঠিক নয়।'; END IF;
  IF EXISTS (SELECT 1 FROM participants WHERE event_id = e.id AND mobile = normalize_mobile(u->>'mobile') AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'এই মোবাইল নম্বরে ইতিমধ্যে নিবন্ধন আছে। গোপন টিকিটের লিংক ব্যবহার করুন।'; END IF;
  SELECT * INTO a FROM payment_accounts
   WHERE id = (p->>'accountId')::uuid AND event_id = e.id AND provider = p->>'provider' AND is_active;
  IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;

  SELECT jsonb_object_agg(kind, amount) INTO f FROM event_fees WHERE event_id = e.id;
  INSERT INTO participants(event_id, name, school_name, ssc_roll, ssc_registration, mobile, current_location, tshirt_size)
  VALUES (e.id, btrim(u->>'name'), btrim(u->>'school'), btrim(u->>'sscRoll'), coalesce(btrim(u->>'sscRegistration'), ''),
          normalize_mobile(u->>'mobile'), btrim(u->>'location'), u->>'tshirt')
  RETURNING id INTO uid;

  -- ফর্মের অতিরিক্ত ঘরের উত্তর যাচাই: বাধ্যতামূলক ঘর ফাঁকা থাকলে আটকে দিই,
  -- অজানা/লুকানো ঘরের উত্তর বাদ দিই, বড় লেখা কেটে দিই।
  answers := coalesce(p_data->'answers', '{}'::jsonb);
  IF jsonb_typeof(answers) <> 'object' THEN answers := '{}'::jsonb; END IF;
  SELECT coalesce(jsonb_object_agg(cff.field_key, left(btrim(answers->>cff.field_key), cff.max_length)), '{}'::jsonb)
    INTO answers
    FROM content_form_fields cff
   WHERE cff.event_id = e.id AND cff.is_visible AND coalesce(btrim(answers->>cff.field_key), '') <> '';
  FOR ff IN SELECT * FROM content_form_fields fld
             WHERE fld.event_id = e.id AND fld.is_visible AND fld.is_required
               AND NOT fld.is_base ORDER BY fld.sort_order LOOP
    IF coalesce(answers->>ff.field_key, '') = '' THEN
      RAISE EXCEPTION 'ফর্মের ঘরটি পূরণ করুন: %', ff.label_bn;
    END IF;
  END LOOP;

  INSERT INTO registrations(event_id, participant_id, spouse_count, children_count, food_preference, notes,
      custom_answers, fee_friend, fee_spouse, fee_child)
  VALUES (e.id, uid, spouse, children, nullif(coalesce(btrim(p_data->>'food'), ''), ''),
          coalesce(p_data->>'notes', ''), answers,
          (f->>'friend')::numeric, (f->>'spouse')::numeric, (f->>'child')::numeric)
  RETURNING * INTO r;

  rid := r.id;
  IF (p->>'amount')::numeric IS DISTINCT FROM r.total_fee THEN
    RAISE EXCEPTION 'ফি পরিবর্তিত হয়েছে বা টাকার পরিমাণ মেলেনি। সঠিক ফি যাচাই করুন।'; END IF;

  INSERT INTO payments(event_id, registration_id, account_id, provider, collector_name_snapshot,
      collector_mobile_snapshot, sender_mobile, transaction_id, submitted_amount)
  VALUES (e.id, rid, a.id, a.provider, a.collector_name, a.mobile, normalize_mobile(p->>'senderMobile'),
          btrim(p->>'transactionId'), (p->>'amount')::numeric);

  access_key := random_token();
  INSERT INTO user_links(registration_id, tracking_key_hash) VALUES (rid, key_hash(access_key));
  PERFORM log_action(e.id, 'registration.created', rid);
  RETURN jsonb_build_object('registration', registration_json(rid), 'trackingKey', access_key);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল নম্বর অথবা ট্রানজেকশন আইডি আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.submit_registration(jsonb) IS 'নতুন নিবন্ধন জমা নেয়: অংশগ্রহণকারী + পরিবারের সংখ্যা + পেমেন্ট রেকর্ড + গোপন ট্র্যাকিং লিংক। অবস্থা থাকে pending।';

CREATE OR REPLACE FUNCTION public.ticket_status(p_tracking_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE rid uuid;
BEGIN
  IF p_tracking_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'সঠিক গোপন লিংক বা রিকভারি কোড দিন।'; END IF;
  SELECT a.registration_id INTO rid FROM user_links a
    JOIN registrations r ON r.id = a.registration_id
   WHERE a.tracking_key_hash = key_hash(p_tracking_key) AND r.archived_at IS NULL;
  IF rid IS NULL THEN RAISE EXCEPTION 'নিবন্ধন পাওয়া যায়নি বা বাতিল হয়েছে।'; END IF;
  RETURN registration_json(rid, true);
END $$;
COMMENT ON FUNCTION public.ticket_status(text) IS 'গোপন লিংকের কী দিয়ে নিজের নিবন্ধন ও QR টিকিট দেখায় — ফোন নম্বর দিয়ে অন্যের টিকিট দেখা যায় না।';

-- ── স্টাফ/অ্যাডমিনের দরজা ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_identity() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s jsonb;
BEGIN
  s := require_role();
  RETURN jsonb_build_object('id', s->>'id', 'name', s->>'name', 'role', s->>'role');
END $$;
COMMENT ON FUNCTION public.staff_identity() IS 'লগইন করা স্টাফ নিজের পরিচয় ও ভূমিকা (admin/scanner) জানতে পারে।';

CREATE OR REPLACE FUNCTION public.admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; site jsonb;
BEGIN
  PERFORM require_role(true);
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96';
  site := public.public_site();
  RETURN site || jsonb_build_object(
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
        'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_sections WHERE event_id = e.id), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
        'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_schedule WHERE event_id = e.id), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
        'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment_accounts WHERE event_id = e.id), '[]'::jsonb),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM event_contacts WHERE event_id = e.id), '[]'::jsonb),
    'formFields', coalesce((SELECT jsonb_agg(form_field_json(id) || jsonb_build_object('visible', is_visible) ORDER BY sort_order)
      FROM content_form_fields WHERE event_id = e.id), '[]'::jsonb),
    'formFieldStats', form_field_stats(e.id),
    'formTexts', coalesce((SELECT jsonb_object_agg(text_key, value_bn) FROM content_form_texts WHERE event_id = e.id),
      '{}'::jsonb),
    'nav', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'label', label_bn, 'target', target,
        'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_nav_items WHERE event_id = e.id), '[]'::jsonb),
    'registrations', coalesce((SELECT jsonb_agg(registration_json(id) ORDER BY created_at DESC)
      FROM registrations WHERE event_id = e.id), '[]'::jsonb),
    'devices', coalesce((SELECT jsonb_agg(device_json(id) ORDER BY created_at DESC)
      FROM admin_devices WHERE event_id = e.id), '[]'::jsonb),
    'stats', stats(),
    'logins', coalesce((SELECT jsonb_agg(jsonb_build_object('email', email, 'ok', succeeded, 'note', note_bn, 'at', created_at)
        ORDER BY created_at DESC) FROM (SELECT * FROM admin_login_events ORDER BY created_at DESC LIMIT 20) l), '[]'::jsonb),
    'audit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'user', actor_name, 'action', action, 'recordId', record_id,
        'metadata', metadata, 'createdAt', created_at) ORDER BY created_at DESC)
      FROM (SELECT * FROM admin_audit_logs WHERE event_id = e.id ORDER BY created_at DESC LIMIT 100) a), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.admin_overview() IS 'অ্যাডমিন প্যানেলের সব তথ্য: সেকশন, সময়সূচি, নম্বর, নিবন্ধন, ডিভাইস, রিপোর্ট-হিসাব, লগইন-হিসাব ও অডিট-লগ। শুধু অ্যাডমিন।';

CREATE OR REPLACE FUNCTION public.admin_mutate(p_action text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; s jsonb; r registrations; p payments; a payment_accounts; acct_id uuid;
        obj_id uuid; secret text; result jsonb := '{"ok":true}'; meta jsonb := '{}'; amt numeric; reg_id uuid;
BEGIN
  s := require_role(true);
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96' FOR UPDATE;
  obj_id := nullif(p_payload->>'id', '')::uuid;

  IF p_action LIKE 'registration.%' OR p_action IN ('participant.save', 'payment.save', 'payment.refund') THEN
    SELECT * INTO r FROM registrations WHERE id = obj_id AND event_id = e.id FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'নিবন্ধন পাওয়া যায়নি।'; END IF;
  END IF;

  CASE p_action
    WHEN 'event.save' THEN
      UPDATE event_events SET name = btrim(p_payload->>'name'), tagline = btrim(p_payload->>'tagline'),
        date_label = btrim(p_payload->>'dateLabel'), is_dummy_date = (p_payload->>'isDummyDate')::boolean,
        venue = btrim(p_payload->>'venue'), city = btrim(p_payload->>'city'),
        venue_english = btrim(p_payload->>'venueEnglish'), registration_open = (p_payload->>'registrationOpen')::boolean
      WHERE id = e.id;

    WHEN 'fees.save' THEN
      INSERT INTO event_fees(event_id, kind, amount)
      SELECT e.id, key, value::numeric FROM jsonb_each_text(p_payload) WHERE key IN ('friend', 'spouse', 'child')
      ON CONFLICT (event_id, kind) DO UPDATE SET amount = excluded.amount, updated_at = now();

    WHEN 'section.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content_sections(id, event_id, section_key, title, subtitle, body, image_url, sort_order, is_visible)
      VALUES (obj_id, e.id, p_payload->>'key', btrim(p_payload->>'title'), coalesce(p_payload->>'subtitle', ''),
              coalesce(p_payload->>'body', ''), coalesce(p_payload->>'imageUrl', ''), (p_payload->>'order')::integer,
              (p_payload->>'visible')::boolean)
      ON CONFLICT (id) DO UPDATE SET section_key = excluded.section_key, title = excluded.title, subtitle = excluded.subtitle,
        body = excluded.body, image_url = excluded.image_url, sort_order = excluded.sort_order,
        is_visible = excluded.is_visible, updated_at = now() WHERE content_sections.event_id = e.id;

    WHEN 'section.delete' THEN DELETE FROM content_sections WHERE id = obj_id AND event_id = e.id;

    WHEN 'schedule.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content_schedule(id, event_id, start_time, period, title, note, sort_order, is_visible)
      VALUES (obj_id, e.id, (p_payload->>'time')::time, p_payload->>'period', btrim(p_payload->>'title'),
              coalesce(p_payload->>'note', ''), (p_payload->>'order')::integer, (p_payload->>'visible')::boolean)
      ON CONFLICT (id) DO UPDATE SET start_time = excluded.start_time, period = excluded.period, title = excluded.title,
        note = excluded.note, sort_order = excluded.sort_order, is_visible = excluded.is_visible, updated_at = now()
      WHERE content_schedule.event_id = e.id;

    WHEN 'schedule.delete' THEN DELETE FROM content_schedule WHERE id = obj_id AND event_id = e.id;

    WHEN 'account.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO payment_accounts(id, event_id, provider, collector_name, mobile, sort_order, is_active)
      VALUES (obj_id, e.id, p_payload->>'provider', btrim(p_payload->>'name'), normalize_mobile(p_payload->>'mobile'),
              (p_payload->>'order')::integer, (p_payload->>'active')::boolean)
      ON CONFLICT (id) DO UPDATE SET provider = excluded.provider, collector_name = excluded.collector_name,
        mobile = excluded.mobile, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
      WHERE payment_accounts.event_id = e.id;

    WHEN 'account.delete' THEN
      UPDATE payment_accounts SET is_active = false, updated_at = now() WHERE id = obj_id AND event_id = e.id;

    WHEN 'participant.save' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন পরিবর্তন করা যাবে না।'; END IF;
      UPDATE participants SET name = btrim(p_payload->'participant'->>'name'),
        school_name = btrim(p_payload->'participant'->>'school'), ssc_roll = btrim(p_payload->'participant'->>'sscRoll'),
        ssc_registration = coalesce(p_payload->'participant'->>'sscRegistration', ''),
        mobile = normalize_mobile(p_payload->'participant'->>'mobile'),
        current_location = btrim(p_payload->'participant'->>'location'),
        tshirt_size = p_payload->'participant'->>'tshirt',
        -- ছবি: প্যানেল থেকে নতুন ছবি দিলে সেটি বসে, খালি পাঠালে আগেরটাই থাকে
        photo_url = CASE
          WHEN p_payload->'participant'->>'photoUrl' IS NULL THEN photo_url
          WHEN btrim(p_payload->'participant'->>'photoUrl') = '' THEN photo_url
          ELSE btrim(p_payload->'participant'->>'photoUrl') END
      WHERE id = r.participant_id;
      UPDATE registrations SET spouse_count = (p_payload->>'spouse')::integer,
        children_count = (p_payload->>'children')::integer, food_preference = p_payload->>'food',
        notes = coalesce(p_payload->>'notes', '') WHERE id = r.id;

    WHEN 'payment.save' THEN
      IF r.status = 'approved' OR r.archived_at IS NOT NULL
         OR EXISTS (SELECT 1 FROM gate_checkins WHERE registration_id = r.id) THEN
        RAISE EXCEPTION 'অনুমোদিত বা বাতিল পেমেন্ট সরাসরি বদলানো যাবে না।'; END IF;
      SELECT * INTO a FROM payment_accounts
       WHERE id = (p_payload->>'accountId')::uuid AND provider = p_payload->>'provider' AND event_id = e.id AND is_active;
      IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;
      SELECT * INTO p FROM payments WHERE registration_id = r.id;
      meta := jsonb_build_object('previousPayment', to_jsonb(p));
      UPDATE payments SET provider = a.provider, account_id = a.id, collector_name_snapshot = a.collector_name,
        collector_mobile_snapshot = a.mobile, sender_mobile = normalize_mobile(p_payload->>'senderMobile'),
        transaction_id = btrim(p_payload->>'transactionId'), submitted_amount = (p_payload->>'amount')::numeric,
        status = 'pending', reviewed_at = NULL, reviewed_by = NULL, rejection_reason = ''
      WHERE registration_id = r.id;
      UPDATE registrations SET status = 'pending' WHERE id = r.id;

    WHEN 'registration.approve' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন অনুমোদন করা যাবে না।'; END IF;
      IF r.status = 'refunded' THEN RAISE EXCEPTION 'রিফান্ড হওয়া নিবন্ধন আবার অনুমোদন করা যায় না।'; END IF;
      IF coalesce((p_payload->>'verified')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'নিজের লেনদেনের রেকর্ড মিলিয়ে নিশ্চিত করুন।'; END IF;
      IF r.status = 'approved' THEN RETURN result; END IF;
      SELECT * INTO p FROM payments WHERE registration_id = r.id;
      IF p.submitted_amount IS DISTINCT FROM r.total_fee THEN
        RAISE EXCEPTION 'জমা দেওয়া টাকার পরিমাণ নির্ধারিত ফি-র সঙ্গে মিলছে না।'; END IF;
      -- নিচের একটি লাইনই যথেষ্ট: ট্রিগার নিবন্ধন অনুমোদন + নতুন QR টিকিট + অডিট করে দেয়
      UPDATE payments SET status = 'verified', reviewed_at = now(), reviewed_by = (s->>'id')::uuid,
        rejection_reason = '' WHERE registration_id = r.id;

    WHEN 'registration.reject' THEN
      IF EXISTS (SELECT 1 FROM gate_checkins WHERE registration_id = r.id) THEN
        RAISE EXCEPTION 'চেক-ইন হওয়া টিকিট প্রত্যাখ্যান করা যাবে না।'; END IF;
      IF length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'প্রত্যাখ্যানের কারণ লিখুন।'; END IF;
      UPDATE payments SET status = 'rejected', rejection_reason = btrim(p_payload->>'reason'),
        reviewed_by = (s->>'id')::uuid, reviewed_at = now() WHERE registration_id = r.id;

    WHEN 'payment.refund' THEN
      SELECT * INTO p FROM payments WHERE registration_id = r.id;
      IF p.status <> 'verified' THEN RAISE EXCEPTION 'শুধু অনুমোদিত (verified) পেমেন্ট রিফান্ড করা যায়।'; END IF;
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন রিফান্ড করা যাবে না।'; END IF;
      amt := coalesce(nullif(p_payload->>'amount', '')::numeric, r.total_fee);
      IF amt <= 0 THEN RAISE EXCEPTION 'রিফান্ডের টাকা শূন্যের বেশি হতে হবে।'; END IF;
      IF length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'রিফান্ডের কারণ লিখুন।'; END IF;
      INSERT INTO refunds(event_id, payment_id, registration_id, amount, reason_bn, method, reference, marked_by)
      VALUES (e.id, p.id, r.id, amt, btrim(p_payload->>'reason'), coalesce(p_payload->>'method', p.provider),
              coalesce(btrim(p_payload->>'reference'), ''), (s->>'id')::uuid);
      result := jsonb_build_object('ok', true, 'refunded', amt);

    WHEN 'registration.remove' THEN
      UPDATE registrations SET status = 'cancelled', archived_at = now() WHERE id = r.id;
      UPDATE participants SET archived_at = now() WHERE id = r.participant_id;
      UPDATE gate_tickets SET status = 'revoked', revoked_at = now() WHERE registration_id = r.id AND status = 'active';

    WHEN 'registration.restore' THEN
      UPDATE registrations SET archived_at = NULL, status = 'pending' WHERE id = r.id;
      UPDATE participants SET archived_at = NULL WHERE id = r.participant_id;

    WHEN 'registration.reissue' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাতিল নিবন্ধনের লিংক তৈরি করা যাবে না।'; END IF;
      secret := random_token();
      UPDATE user_links SET tracking_key_hash = key_hash(secret), updated_at = now()
      WHERE registration_id = r.id;
      result := jsonb_build_object('trackingKey', secret);

    WHEN 'formField.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      -- মূল (base) ঘর হলে কী ও ধরন বদলানো যায় না; লক করা ঘর লুকানো/ঐচ্ছিকও করা যায় না
      IF EXISTS (SELECT 1 FROM content_form_fields x WHERE x.id = obj_id AND x.event_id = e.id AND x.is_base) THEN
        UPDATE content_form_fields SET
          label_bn = coalesce(nullif(btrim(p_payload->>'label'), ''), label_bn),
          placeholder = coalesce(p_payload->>'placeholder', placeholder),
          help_bn = coalesce(p_payload->>'help', help_bn),
          step = coalesce((p_payload->>'step')::smallint, step),
          max_length = coalesce((p_payload->>'maxLength')::integer, max_length),
          is_required = CASE WHEN is_locked THEN is_required ELSE coalesce((p_payload->>'required')::boolean, is_required) END,
          is_visible  = CASE WHEN is_locked THEN is_visible  ELSE coalesce((p_payload->>'visible')::boolean, is_visible) END,
          sort_order = coalesce((p_payload->>'order')::integer, sort_order),
          updated_at = now()
        WHERE id = obj_id AND event_id = e.id;
      ELSE
        INSERT INTO content_form_fields(id, event_id, field_key, label_bn, kind, options, placeholder, help_bn,
            max_length, is_required, is_visible, step, sort_order)
        VALUES (obj_id, e.id, p_payload->>'key', btrim(p_payload->>'label'), p_payload->>'kind',
                coalesce(p_payload->'options', '[]'::jsonb), coalesce(p_payload->>'placeholder', ''),
                coalesce(p_payload->>'help', ''), coalesce((p_payload->>'maxLength')::integer, 200),
                coalesce((p_payload->>'required')::boolean, false), coalesce((p_payload->>'visible')::boolean, true),
                coalesce((p_payload->>'step')::smallint, 2), coalesce((p_payload->>'order')::integer, 50))
        ON CONFLICT (id) DO UPDATE SET field_key = excluded.field_key, label_bn = excluded.label_bn,
          kind = excluded.kind, options = excluded.options, placeholder = excluded.placeholder,
          help_bn = excluded.help_bn, max_length = excluded.max_length, is_required = excluded.is_required,
          is_visible = excluded.is_visible, step = excluded.step, sort_order = excluded.sort_order, updated_at = now()
        WHERE content_form_fields.event_id = e.id;
      END IF;
      meta := jsonb_build_object('label', btrim(p_payload->>'label'), 'kind', p_payload->>'kind');

    WHEN 'navItem.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content_nav_items(id, event_id, kind, label_bn, target, sort_order, is_visible)
      VALUES (obj_id, e.id, p_payload->>'kind', btrim(p_payload->>'label'), coalesce(btrim(p_payload->>'target'), ''),
              coalesce((p_payload->>'order')::integer, 50), coalesce((p_payload->>'visible')::boolean, true))
      ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, label_bn = excluded.label_bn, target = excluded.target,
        sort_order = excluded.sort_order, is_visible = excluded.is_visible, updated_at = now()
      WHERE content_nav_items.event_id = e.id;
      meta := jsonb_build_object('label', btrim(p_payload->>'label'));

    WHEN 'navItem.delete' THEN
      DELETE FROM content_nav_items WHERE id = obj_id AND event_id = e.id;

    WHEN 'navItem.move' THEN
      UPDATE content_nav_items SET sort_order = (p_payload->>'order')::integer, updated_at = now()
      WHERE id = obj_id AND event_id = e.id;

    WHEN 'formText.save' THEN
      INSERT INTO content_form_texts(event_id, text_key, value_bn)
      VALUES (e.id, p_payload->>'key', coalesce(btrim(p_payload->>'value'), ''))
      ON CONFLICT (event_id, text_key) DO UPDATE SET value_bn = excluded.value_bn, updated_at = now();

    WHEN 'formField.reorder' THEN
      -- ড্র্যাগ করে সাজানোর পর এক কলেই সব ঘরের নতুন ক্রম
      UPDATE content_form_fields cff SET sort_order = (item->>'order')::integer, updated_at = now()
      FROM jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item
      WHERE cff.id = (item->>'id')::uuid AND cff.event_id = e.id;
      meta := jsonb_build_object('count', coalesce(jsonb_array_length(p_payload->'items'), 0));

    WHEN 'navItem.reorder' THEN
      UPDATE content_nav_items cni SET sort_order = (item->>'order')::integer, updated_at = now()
      FROM jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item
      WHERE cni.id = (item->>'id')::uuid AND cni.event_id = e.id;
      meta := jsonb_build_object('count', coalesce(jsonb_array_length(p_payload->'items'), 0));

    WHEN 'formField.delete' THEN
      IF EXISTS (SELECT 1 FROM content_form_fields x WHERE x.id = obj_id AND x.event_id = e.id AND x.is_base) THEN
        RAISE EXCEPTION 'ফর্মের মূল ঘর মুছে ফেলা যায় না — চাইলে “লুকাও” দিয়ে ফর্ম থেকে সরান।';
      END IF;
      DELETE FROM content_form_fields WHERE id = obj_id AND event_id = e.id;
      meta := jsonb_build_object('deleted', true);

    WHEN 'formField.move' THEN
      UPDATE content_form_fields SET sort_order = (p_payload->>'order')::integer, updated_at = now()
      WHERE id = obj_id AND event_id = e.id;

    WHEN 'contact.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO event_contacts(id, event_id, label, mobile, note_bn, sort_order, is_active)
      VALUES (obj_id, e.id, btrim(p_payload->>'label'), normalize_mobile(p_payload->>'mobile'),
              coalesce(p_payload->>'note', ''), (p_payload->>'order')::integer, coalesce((p_payload->>'active')::boolean, true))
      ON CONFLICT (id) DO UPDATE SET label = excluded.label, mobile = excluded.mobile, note_bn = excluded.note_bn,
        sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
      WHERE event_contacts.event_id = e.id;

    WHEN 'contact.delete' THEN
      DELETE FROM event_contacts WHERE id = obj_id AND event_id = e.id;

    WHEN 'setting.save' THEN
      INSERT INTO database_settings(key, value, note_bn)
      VALUES (p_payload->>'key', coalesce(p_payload->'value', 'true'::jsonb), coalesce(p_payload->>'note', ''))
      ON CONFLICT (key) DO UPDATE SET value = excluded.value,
        note_bn = CASE WHEN excluded.note_bn = '' THEN database_settings.note_bn ELSE excluded.note_bn END;

    WHEN 'device.update' THEN
      IF p_payload->>'status' NOT IN ('approved', 'revoked') THEN RAISE EXCEPTION 'ডিভাইসের অনুমতি সঠিক নয়।'; END IF;
      UPDATE admin_devices SET status = p_payload->>'status', approved_by = (s->>'id')::uuid
      WHERE id = obj_id AND event_id = e.id;

    ELSE RAISE EXCEPTION 'অজানা অ্যাডমিন অ্যাকশন।';
  END CASE;

  PERFORM log_action(e.id, p_action, coalesce(obj_id, e.id), meta);
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল, ট্রানজেকশন আইডি অথবা সেকশন কী আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.admin_mutate(text, jsonb) IS 'অ্যাডমিনের সব পরিবর্তন এক দরজায়: ইভেন্ট, ফি, সেকশন, সময়সূচি, নম্বর, যোগাযোগ, নিবন্ধন ফর্মের ঘর (যোগ/বদল/মুছে ফেলা/ক্রম), নিবন্ধন সম্পাদনা, অনুমোদন, প্রত্যাখ্যান, রিফান্ড, বাদ দেওয়া ও ডিভাইস অনুমোদন।';

-- ── পরিচয়-হিসাব ও পাসওয়ার্ড রিসেট (লগইন ছাড়াও ডাকা যায়) ────────
CREATE OR REPLACE FUNCTION public.log_login(p_email text, p_ok boolean, p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid; last_at timestamptz;
BEGIN
  IF p_email IS NULL OR length(btrim(p_email)) NOT BETWEEN 5 AND 200 THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT user_id, created_at INTO uid, last_at FROM admin_login_events
   WHERE lower(email) = lower(btrim(p_email)) ORDER BY created_at DESC LIMIT 1;
  IF last_at IS NOT NULL AND last_at > now() - interval '5 seconds' THEN RETURN jsonb_build_object('ok', true, 'skipped', true); END IF;

  INSERT INTO admin_login_events(email, user_id, succeeded, note_bn)
  VALUES (lower(btrim(p_email)), uid, p_ok, coalesce(p_note, ''));

  UPDATE admin_users SET last_login_at = CASE WHEN p_ok THEN now() ELSE last_login_at END,
         login_count = login_count + CASE WHEN p_ok THEN 1 ELSE 0 END,
         failed_logins = failed_logins + CASE WHEN p_ok THEN 0 ELSE 1 END
   WHERE lower(email) = lower(btrim(p_email));
  RETURN jsonb_build_object('ok', true);
END $$;
COMMENT ON FUNCTION public.log_login(text, boolean, text) IS '"কে কখন লগইন করল / ব্যর্থ হলো" — admin_login_events-এ লেখে ও admin_users-এ গণনা বাড়ায়।';

CREATE OR REPLACE FUNCTION public.request_password_reset(p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE mail text := lower(btrim(coalesce(p_email, ''))); known boolean; recent integer;
BEGIN
  IF length(mail) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION 'সঠিক ইমেইল ঠিকানা দিন।'; END IF;
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = mail) INTO known;
  SELECT count(*) INTO recent FROM admin_password_resets
   WHERE email = mail AND requested_at > now() - interval '2 minutes';

  INSERT INTO admin_password_resets(email, user_id, status, note_bn)
  SELECT mail, (SELECT id FROM auth.users WHERE lower(email) = mail),
         CASE WHEN NOT known THEN 'unknown_email' WHEN recent >= 3 THEN 'rate_limited' ELSE 'email_sent' END,
         CASE WHEN NOT known THEN 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই; বাইরে একই বার্তা দেখানো হয় (তথ্য ফাঁস নয়)।'
              WHEN recent >= 3 THEN 'খুব বেশি অনুরোধ — কিছুক্ষণ পরে আবার চেষ্টা করুন।'
              ELSE 'Supabase Auth রিসেট-ইমেইল পাঠানোর অনুরোধ পেয়েছে।' END;

  IF known AND recent < 3 THEN
    INSERT INTO admin_email_outbox(kind, to_email, subject_bn, status, note_bn)
    VALUES ('password_reset', mail, 'Rangpur SSC 96 — পাসওয়ার্ড রিসেট লিংক', 'queued',
            'Supabase Auth-এর ডিফল্ট ইমেইল সেবা পাঠাবে (ফ্রি টিয়ারে ঘণ্টায় সীমিত সংখ্যক)।');
  END IF;

  -- বাইরে সবসময় একই উত্তর: ইমেইল আছে কি নেই তা কেউ বুঝতে পারে না।
  RETURN jsonb_build_object('ok', true,
    'message', 'আপনার ইমেইলে থাকলে রিসেট লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।');
END $$;
COMMENT ON FUNCTION public.request_password_reset(text) IS '"পাসওয়ার্ড ভুলে গেছি" — ইমেইল আছে কি না তা ফাঁস না করে রিসেট-ইমেইল পাঠায় ও হিসাব রাখে।';

CREATE OR REPLACE FUNCTION public.complete_password_reset(p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n integer;
BEGIN
  -- রিসেট-লিংক কাজ করার পরেই ডাকা হয় (টোকেনধারী প্রমাণ করেছেন)
  UPDATE admin_password_resets SET status = 'completed', completed_at = now()
   WHERE id = (SELECT id FROM admin_password_resets
               WHERE lower(email) = lower(btrim(coalesce(p_email, '')))
               ORDER BY requested_at DESC LIMIT 1)
     AND status <> 'completed';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'marked', n);
END $$;
COMMENT ON FUNCTION public.complete_password_reset(text) IS 'নতুন পাসওয়ার্ড সফলভাবে বসলে admin_password_resets-এ "completed" লেখে — কে কখন পাসওয়ার্ড বদলাল তা হিসাবে থাকে।';

CREATE OR REPLACE FUNCTION public.guide_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM require_role(true);
  RETURN (SELECT data FROM guide_overview);
END $$;
COMMENT ON FUNCTION public.guide_overview() IS 'ডেটাবেসের গঠন-বর্ণনা: ৭টি স্কিমা, ২৫টি টেবিল, সব সম্পর্ক, ১৫টি কার্য-প্রবাহ ও ফাংশনের তালিকা। শুধু অ্যাডমিন।';

-- ── ফোন ও টিকিট (গেট) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_device(p_label text, p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e uuid; s jsonb; did uuid; role text;
BEGIN
  s := require_role(); role := s->>'role'; e := event_id();
  IF p_token !~ '^[a-f0-9]{64}$' OR length(btrim(p_label)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'ডিভাইসের পরিচয় সঠিক নয়।'; END IF;
  INSERT INTO admin_devices(event_id, user_id, label, token_hash, status, approved_by)
  VALUES (e, (s->>'id')::uuid, btrim(p_label), key_hash(p_token),
          CASE WHEN role = 'admin' THEN 'approved' ELSE 'pending' END,
          CASE WHEN role = 'admin' THEN (s->>'id')::uuid ELSE NULL END)
  ON CONFLICT (event_id, user_id, token_hash) DO NOTHING RETURNING id INTO did;
  IF did IS NOT NULL THEN
    PERFORM log_action(e, 'device.register', did);
  ELSE
    SELECT id INTO did FROM admin_devices
     WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = key_hash(p_token);
  END IF;
  RETURN device_json(did);
END $$;
COMMENT ON FUNCTION public.register_device(text, text) IS 'গেটের ফোন/ব্রাউজার নিবন্ধন করে — অ্যাডমিনের ফোন সঙ্গে সঙ্গে অনুমোদিত, স্টাফের ফোন অ্যাডমিনের অনুমোদনের অপেক্ষায়।';

CREATE OR REPLACE FUNCTION public.device_state(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE did uuid; s jsonb;
BEGIN
  s := require_role();
  SELECT d.id INTO did FROM admin_devices d JOIN event_events e ON e.id = d.event_id
   WHERE e.slug = 'rangpur-ssc96' AND d.user_id = (s->>'id')::uuid AND d.token_hash = key_hash(p_token);
  RETURN device_json(did);
END $$;
COMMENT ON FUNCTION public.device_state(text) IS 'এই ব্রাউজার/ফোনটি চেক-ইনের জন্য অনুমোদিত কি না তা জানায়।';

CREATE OR REPLACE FUNCTION public.check_in(p_input text, p_device_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e uuid; s jsonb; d admin_devices; r registrations; u participants;
        c gate_checkins; parts text[]; inserted_id uuid; already boolean := false;
BEGIN
  s := require_role(); e := event_id();
  SELECT * INTO d FROM admin_devices
   WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = key_hash(p_device_token)
     AND status = 'approved' FOR SHARE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'এই ব্রাউজার/ডিভাইস চেক-ইনের জন্য অনুমোদিত নয়।' USING ERRCODE = '42501'; END IF;

  IF p_input LIKE 'R96:%' THEN
    parts := string_to_array(p_input, ':');
    IF array_length(parts, 1) <> 3 OR parts[2] !~ '^[0-9a-f-]{36}$' OR parts[3] !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয়।'; END IF;
    SELECT * INTO r FROM registrations WHERE id = parts[2]::uuid AND event_id = e FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM gate_tickets WHERE registration_id = r.id AND qr_secret = parts[3] AND status = 'active') THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয় বা বাতিল হয়েছে।'; END IF;
  ELSIF upper(p_input) ~ '^R96-[0-9]{5,}$' THEN
    SELECT * INTO r FROM registrations WHERE ticket_number = upper(p_input) AND event_id = e FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'এই উৎসবের সঠিক QR বা টিকিট নম্বর দিন।';
  END IF;

  IF r.id IS NULL OR r.status <> 'approved' OR r.archived_at IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM payments WHERE registration_id = r.id AND status = 'verified') THEN
    RAISE EXCEPTION 'টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।' USING ERRCODE = '42501'; END IF;

  INSERT INTO gate_checkins(event_id, registration_id, device_id, operator_id, group_size)
  VALUES (e, r.id, d.id, (s->>'id')::uuid, 1 + r.spouse_count + r.children_count)
  ON CONFLICT (registration_id) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN already := true; END IF;

  SELECT * INTO c FROM gate_checkins WHERE registration_id = r.id;
  SELECT * INTO u FROM participants WHERE id = r.participant_id;
  RETURN jsonb_build_object('alreadyCheckedIn', already, 'ticketNumber', r.ticket_number, 'name', u.name,
    'school', u.school_name, 'people', c.group_size, 'spouse', r.spouse_count, 'children', r.children_count,
    'checkedInAt', c.checked_in_at);
END $$;
COMMENT ON FUNCTION public.check_in(text, text) IS 'গেটে QR/টিকিট নম্বর মিলিয়ে চেক-ইন করে; এক নিবন্ধনে একবারই — দ্বিতীয়বার স্ক্যানে "আগেই হয়েছে" জানায়।';

-- ── অনুমতির তালিকা (কে কোন দরজা দিয়ে ঢুকতে পারে) ─────────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_site(), public.submit_registration(jsonb), public.ticket_status(text),
  public.log_login(text, boolean, text), public.request_password_reset(text),
  public.complete_password_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_identity(), public.admin_overview(), public.admin_mutate(text, jsonb),
  public.register_device(text, text), public.device_state(text), public.check_in(text, text),
  public.guide_overview() TO authenticated;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৩ | শুরুর ডেটা, টেবিল-বর্ণনা ও কার্য-প্রবাহ  (22_seed.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১১ | শুরুর ডেটা (নিরাপদে বারবার চালানো যায় — অ্যাডমিনের বদলানো
-- লেখা কখনো মুছে যায় না, শুধু অনুপস্থিত সারি যোগ হয়)
-- ভেতরে আছে: স্কিমা-তালিকা, অ্যাপ সেটিংস, মাইগ্রেশন-হিসাব, অনুষ্ঠান ও ফি,
-- যোগাযোগ নম্বর, ১৩টি সেকশন, ১৪টি সময়সূচি, ৮টি Send Money নম্বর,
-- ২৫টি টেবিলের বর্ণনা এবং ১৬টি কার্য-প্রবাহ (action → reaction)।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;
SET search_path = public, pg_catalog;

-- ── ১. কোন সেকশন (নামের শুরু) কী কাজে ───────────────────────────
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)
INSERT INTO database_schemas(name, section_bn, purpose_bn, sort_order) VALUES
 ('database', 'ডেটাবেস সেকশন', 'database_* — ডেটাবেস-স্তরের হিসাব: সেকশন-তালিকা, সেটিংস, মাইগ্রেশন ও স্বাস্থ্য-ভিউ।', 1),
 ('admin', 'অ্যাডমিন সেকশন', 'admin_* — অ্যাডমিন টেবিল, লগইন-হিসাব, পাসওয়ার্ড রিসেট, ইমেইল-আউটবক্স, অনুমোদিত ফোন ও অডিট-লগ।', 2),
 ('event', 'অনুষ্ঠান সেকশন', 'event_* — অনুষ্ঠানের পরিচয়, ফি-র হার ও প্রকাশ্য যোগাযোগ নম্বর।', 3),
 ('content', 'পেজের লেখা ও ছবি', 'content_* — ওয়েবসাইটের ১৩টি সেকশন ও ১৪ ধাপের সময়সূচি।', 4),
 ('user', 'ব্যবহারকারী (বন্ধু) ও নিবন্ধন সেকশন', 'participants · registrations · user_links — অংশগ্রহণকারী, নিবন্ধন ও গোপন টিকিট-লিংক (আপনার "user" সেকশন)।', 5),
 ('payment', 'পেমেন্ট সেকশন', 'payments · payment_accounts · refunds — Send Money নম্বর, প্রতি নিবন্ধনের পেমেন্ট রেকর্ড ও রিফান্ড।', 6),
 ('gate', 'গেট সেকশন', 'gate_* — QR টিকিট ও দরজার চেক-ইন।', 7),
 ('report', 'রিপোর্ট সেকশন', 'report_* — হিসাবের ভিউ: মোট, স্কুলভিত্তিক, দিনভিত্তিক, উপস্থিতি, রিফান্ড ও সাইজ/খাবার।', 8),
 ('guide', 'গঠন-বর্ণনা', 'guide_* — কোন টেবিল কী কাজে, কার সাথে সম্পর্ক, কোন কাজে কী ঘটে।', 9)
ON CONFLICT (name) DO UPDATE SET section_bn = excluded.section_bn, purpose_bn = excluded.purpose_bn, sort_order = excluded.sort_order;

-- ── ২. অ্যাপের সেটিংস ─────────────────────────────────────────────
INSERT INTO database_settings(key, value, note_bn) VALUES
 ('app.refunds_enabled', 'true', 'রিফান্ডের সুবিধা চালু/বন্ধ — বন্ধ করলে বোতাম দেখাবে না।'),
 ('app.checkin_requires_device', 'true', 'চেক-ইনের জন্য অ্যাডমিন-অনুমোদিত ফোন বাধ্যতামূলক।'),
 ('app.public_signup_closed', 'true', 'Supabase Auth-এ নতুন অ্যাকাউন্ট খোলা বন্ধ — শুধু আয়োজক ঢুকতে পারেন।'),
 ('app.password_reset_channel', '"supabase_auth"', 'পাসওয়ার্ড রিসেট ইমেইল পাঠায় Supabase Auth (ফ্রি টিয়ারে ঘণ্টায় সীমিত)।')
ON CONFLICT (key) DO NOTHING;

-- ── ৩. কোন ধাপ কখন চলল ────────────────────────────────────────────
INSERT INTO database_migrations(version, name_bn, note) VALUES
 ('10_database', 'database স্কিমা: সেটিংস, মাইগ্রেশন, স্বাস্থ্য', 'ডেটাবেস সেকশন'),
 ('11_event', 'event স্কিমা: অনুষ্ঠান, ফি, যোগাযোগ', 'অনুষ্ঠান সেকশন'),
 ('12_content', 'content স্কিমা: ১৩ সেকশন ও ১৪ সময়সূচি', 'পেজের লেখা'),
 ('13_user', 'user স্কিমা: অংশগ্রহণকারী, নিবন্ধন, গোপন লিংক', 'বন্ধু ও নিবন্ধন'),
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

INSERT INTO event_events(id,slug,name,tagline,date_label,is_dummy_date,venue,city,venue_english,registration_open) VALUES('05909aa7-d46a-4b83-a3f7-bd77b7352ce9','rangpur-ssc96','Rangpur SSC 96 Festival','পুরোনো বন্ধুত্ব, নতুন গল্প।','৩১ ডিসেম্বর',true,'ভিন্নজগৎ','রংপুর','Vinnojogot, Rangpur',true) ON CONFLICT(slug) DO NOTHING;
INSERT INTO event_fees(event_id,kind,amount) SELECT id,'friend',1499 FROM event_events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;
INSERT INTO event_fees(event_id,kind,amount) SELECT id,'spouse',500 FROM event_events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;
INSERT INTO event_fees(event_id,kind,amount) SELECT id,'child',200 FROM event_events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;

INSERT INTO content_sections(event_id,id,section_key,title,subtitle,body,image_url,sort_order,is_visible)
SELECT e.id,x.id,x.section_key,x.title,x.subtitle,x.body,x.image_url,x.sort_order,x.is_visible
FROM event_events e CROSS JOIN jsonb_to_recordset($seed$[
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
    "body": "এখানে এসএমএস পাঠানো হয় না। নিবন্ধন শেষ হওয়ামাত্র স্ক্রিনে গোপন লিংক ও ৬৪ অক্ষরের রিকভারি কোড দেখানো হয় — কপি করে বা স্ক্রিনশট নিয়ে রাখো। একই ব্রাউজারে “আমার টিকিট” খুললে নিজে থেকেই দেখা যাবে। কোনোটাই না থাকলে আয়োজককে মোবাইল নম্বর ও TrxID জানাও — তিনি নতুন গোপন লিংক দেবেন, পুরোনোটা তখন বাতিল হয়ে যাবে।",
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

INSERT INTO content_schedule(event_id,id,start_time,period,title,note,sort_order,is_visible)
SELECT e.id,x.id,x.start_time,x.period,x.title,x.note,x.sort_order,x.is_visible
FROM event_events e CROSS JOIN jsonb_to_recordset($seed$[
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

INSERT INTO payment_accounts(event_id,id,provider,collector_name,mobile,sort_order,is_active)
SELECT e.id,x.id,x.provider,x.collector_name,x.mobile,x.sort_order,x.is_active
FROM event_events e CROSS JOIN jsonb_to_recordset($seed$[
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
INSERT INTO event_contacts(event_id, label, mobile, note_bn, sort_order)
SELECT e.id, x.label, x.mobile, x.note_bn, x.sort_order
FROM event_events e CROSS JOIN jsonb_to_recordset($contacts$[
  {"label":"Tomol (আয়োজক)","mobile":"01773539721","note_bn":"টাকা পাঠানো ও যেকোনো প্রশ্নে","sort_order":1},
  {"label":"Mahatab (আয়োজক)","mobile":"01712836444","note_bn":"নিবন্ধন সহায়তা","sort_order":2},
  {"label":"Shohag (আয়োজক)","mobile":"01721764479","note_bn":"টিকিট ও চেক-ইন সংক্রান্ত","sort_order":3},
  {"label":"Arif (আয়োজক)","mobile":"01787898951","note_bn":"সাধারণ জিজ্ঞাসা","sort_order":4}
]$contacts$) AS x(label text, mobile text, note_bn text, sort_order integer)
WHERE NOT EXISTS (SELECT 1 FROM event_contacts c WHERE c.event_id = e.id AND c.label = x.label);

-- ═══════════════════════════════════════════════════════════════════
-- ২৪+ টেবিলের পরিচয় (ব্যাখ্যা)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO guide_tables(schema_name, table_name, purpose_bn, written_by, key_columns, sort_order)
SELECT x.schema_name, x.table_name, x.purpose_bn, x.written_by, x.key_columns, x.sort_order
FROM jsonb_to_recordset($tables$[
 {
  "schema_name": "database",
  "table_name": "database_schemas",
  "purpose_bn": "কোন স্কিমা জীবনের কোন সেকশনের তথ্য রাখে তার ঠিকানা-তালিকা।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "name, section_bn, purpose_bn",
  "sort_order": 1
 },
 {
  "schema_name": "database",
  "table_name": "database_settings",
  "purpose_bn": "অ্যাপের সমন্বয়-সেটিংস: রিফান্ড চালু/বন্ধ, চেক-ইনের শর্ত ইত্যাদি।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "key, value, note_bn",
  "sort_order": 2
 },
 {
  "schema_name": "database",
  "table_name": "database_migrations",
  "purpose_bn": "কোন SQL ধাপ কখন চালানো হয়েছে তার হিসাব।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "version, applied_at",
  "sort_order": 3
 },
 {
  "schema_name": "admin",
  "table_name": "admin_users",
  "purpose_bn": "অ্যাডমিন টেবিল — কে অ্যাডমিন, কে গেট স্টাফ, কতবার লগইন করেছে।",
  "written_by": "সেটআপ + লগইন হিসাব",
  "key_columns": "user_id, role, is_active, last_login_at",
  "sort_order": 4
 },
 {
  "schema_name": "admin",
  "table_name": "admin_login_events",
  "purpose_bn": "প্রতিটি লগইনের হিসাব — সফল ও ব্যর্থ।",
  "written_by": "লগইন প্রক্রিয়া (RPC)",
  "key_columns": "email, succeeded, created_at",
  "sort_order": 5
 },
 {
  "schema_name": "admin",
  "table_name": "admin_password_resets",
  "purpose_bn": "পাসওয়ার্ড ভুলে যাওয়ার অনুরোধ ও তার ফল।",
  "written_by": "ভুলে গেছি (RPC)",
  "key_columns": "email, status, requested_at",
  "sort_order": 6
 },
 {
  "schema_name": "admin",
  "table_name": "admin_email_outbox",
  "purpose_bn": "কোন ইমেইল কখন কাকে পাঠানো হলো।",
  "written_by": "সিস্টেম (RPC)",
  "key_columns": "kind, to_email, status",
  "sort_order": 7
 },
 {
  "schema_name": "admin",
  "table_name": "admin_devices",
  "purpose_bn": "গেটে অনুমোদিত ফোন/ব্রাউজার।",
  "written_by": "স্টাফ নিবন্ধন + অ্যাডমিন অনুমোদন",
  "key_columns": "token_hash, status",
  "sort_order": 8
 },
 {
  "schema_name": "admin",
  "table_name": "admin_audit_logs",
  "purpose_bn": "কে কী করল — সব কাজের অডিট-লগ।",
  "written_by": "সিস্টেম (ট্রিগার ও RPC)",
  "key_columns": "action, actor_name, created_at",
  "sort_order": 9
 },
 {
  "schema_name": "event",
  "table_name": "event_events",
  "purpose_bn": "অনুষ্ঠানের নাম, তারিখ, ভেন্যু ও নিবন্ধন চালু/বন্ধ।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "id, slug, date_label, registration_open",
  "sort_order": 10
 },
 {
  "schema_name": "event",
  "table_name": "event_fees",
  "purpose_bn": "বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · প্রতি শিশু ২০০ — ফি-র হার।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "kind, amount",
  "sort_order": 11
 },
 {
  "schema_name": "event",
  "table_name": "event_contacts",
  "purpose_bn": "পাবলিক পেজের যোগাযোগ/হেল্পলাইন নম্বর।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "label, mobile",
  "sort_order": 12
 },
 {
  "schema_name": "content",
  "table_name": "content_sections",
  "purpose_bn": "পেজের প্রতিটি সেকশনের শিরোনাম, লেখা ও ছবি (১৩টি)।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "section_key, title, image_url",
  "sort_order": 13
 },
 {
  "schema_name": "content",
  "table_name": "content_form_fields",
  "purpose_bn": "নিবন্ধন ফর্মের ঘর — অ্যাডমিন নিজে যোগ, বদল, ক্রম-বদল, লুকানো ও মুছে ফেলতে পারেন।",
  "written_by": "অ্যাডমিন প্যানেল (formField.save / formField.delete / formField.move)",
  "key_columns": "field_key, label_bn, kind, options, is_required, is_visible, sort_order",
  "sort_order": 15
 },
 {
  "schema_name": "content",
  "table_name": "content_schedule",
  "purpose_bn": "সকাল ৯টা থেকে সন্ধ্যা ৬টা পর্যন্ত ১৪টি ধাপের সময়সূচি।",
  "written_by": "অ্যাডমিন প্যানেল",
  "key_columns": "start_time, period, title",
  "sort_order": 14
 },
 {
  "schema_name": "user",
  "table_name": "user",
  "purpose_bn": "এক ক্লিকে সবার সব তথ্য — নাম, স্কুল, সঙ্গী, শিশু, মোট টাকা, Verified ও টিকিট নম্বর (ভিউ)।",
  "written_by": "স্বয়ংক্রিয় (মূল টেবিল থেকে)",
  "key_columns": "Name, School name, Spouse, Child, Amount, Verified",
  "sort_order": 16
 },
 {
  "schema_name": "user",
  "table_name": "participants",
  "purpose_bn": "যিনি নিবন্ধন করেন — নাম, স্কুল, SSC রোল, মোবাইল, টি-শার্ট সাইজ।",
  "written_by": "নিবন্ধন ফর্ম (RPC)",
  "key_columns": "name, school_name, mobile, tshirt_size",
  "sort_order": 15
 },
 {
  "schema_name": "user",
  "table_name": "registrations",
  "purpose_bn": "এক নিবন্ধন: কতজন আসছে, মোট ফি ও অনুমোদনের অবস্থা।",
  "written_by": "নিবন্ধন ফর্ম + অ্যাডমিন",
  "key_columns": "ticket_number, total_fee, status",
  "sort_order": 16
 },
 {
  "schema_name": "user",
  "table_name": "user_links",
  "purpose_bn": "গোপন status/receipt লিংকের SHA-256 hash।",
  "written_by": "সিস্টেম (RPC)",
  "key_columns": "registration_id, tracking_key_hash",
  "sort_order": 17
 },
 {
  "schema_name": "payment",
  "table_name": "payment_accounts",
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
  "table_name": "gate_tickets",
  "purpose_bn": "QR টিকিট — অনুমোদনের পর তৈরি, রিফান্ডে বাতিল।",
  "written_by": "সিস্টেম (ট্রিগার)",
  "key_columns": "qr_secret, status, issued_at",
  "sort_order": 21
 },
 {
  "schema_name": "gate",
  "table_name": "gate_checkins",
  "purpose_bn": "দরজার চেক-ইন — এক নিবন্ধনে একবারই।",
  "written_by": "গেট স্ক্যানার",
  "key_columns": "registration_id, group_size, device_id",
  "sort_order": 22
 },
 {
  "schema_name": "guide",
  "table_name": "guide_tables",
  "purpose_bn": "এই তালিকা নিজেই: ২৪টি টেবিলের পরিচয়।",
  "written_by": "সেটআপ স্ক্রিপ্ট",
  "key_columns": "schema_name, table_name",
  "sort_order": 23
 },
 {
  "schema_name": "guide",
  "table_name": "guide_flows",
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
INSERT INTO guide_flows(id, title_bn, actor_bn, trigger_bn, steps, effects, sort_order)
SELECT x.id, x.title_bn, x.actor_bn, x.trigger_bn, x.steps, x.effects, x.sort_order
FROM jsonb_to_recordset($flows$[
 {
  "id": "form_field_save",
  "title_bn": "নিবন্ধন ফর্মে নতুন ঘর যোগ/বদল/মুছে ফেলা",
  "actor_bn": "প্রধান আয়োজক",
  "trigger_bn": "প্যানেলের “ফর্মের ঘর” পেজ থেকে ঘর যোগ, বদল, লুকানো, ক্রম বদল বা মুছে ফেলা",
  "steps": [
   "প্যানেল public.admin_mutate() ডাকে (formField.save / formField.delete / formField.move)",
   "ঘরটি content_form_fields-এ লেখা হয় (field_key দিয়ে চেনা হয়, তাই আগের উত্তর হারায় না)",
   "পাবলিক পেজ public_site() থেকে হালনাগাদ ঘরের তালিকা নেয় — ফর্মে সঙ্গে সঙ্গে দেখা যায়",
   "কেউ জমা দিলে public.submit_registration() বাধ্যতামূলক ঘর ফাঁকা কি না যাচাই করে",
   "উত্তরগুলো registrations.custom_answers-এ JSON আকারে জমা হয়",
   "প্যানেলে প্রতিটি ঘরে কতজন কী উত্তর দিয়েছে তা form_field_stats() থেকে দেখা যায়"
  ],
  "effects": [
   {
    "table": "content_form_fields",
    "change": "ঘরের সারি যোগ / বদল / মুছে ফেলা হয়"
   },
   {
    "table": "registrations",
    "change": "নতুন জমার উত্তর custom_answers-এ লেখা হয়"
   },
   {
    "table": "admin_audit_logs",
    "change": "কোন ঘর কে বদলাল তা লগ হয়"
   }
  ],
  "sort_order": 19
 },
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
    "table": "admin_login_events",
    "change": "সফল লগইনের সারি লেখা হয়"
   },
   {
    "table": "admin_users",
    "change": "last_login_at ও login_count হালনাগাদ"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "admin_login_events",
    "change": "ব্যর্থ লগইন succeeded=false হয়ে লেখা হয়"
   },
   {
    "table": "admin_users",
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
    "table": "admin_password_resets",
    "change": "status=email_sent বা unknown_email"
   },
   {
    "table": "admin_email_outbox",
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
    "table": "admin_password_resets",
    "change": "status=completed, completed_at বসে"
   },
   {
    "table": "admin_users",
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
    "table": "participants",
    "change": "নতুন সারি"
   },
   {
    "table": "registrations",
    "change": "total_fee হিসাব করে status=pending"
   },
   {
    "table": "payments",
    "change": "status=pending"
   },
   {
    "table": "user_links",
    "change": "গোপন লিংকের hash"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "participants",
    "change": "কোনো নতুন সারি হয় না (মোবাইল সক্রিয় সীমা)"
   },
   {
    "table": "payments",
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
    "table": "payments",
    "change": "status=verified, reviewed_by/at"
   },
   {
    "table": "registrations",
    "change": "status=approved, approved_at"
   },
   {
    "table": "gate_tickets",
    "change": "নতুন qr_secret দিয়ে active টিকিট"
   },
   {
    "table": "admin_audit_logs",
    "change": "payments-এ status = verified"
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
    "table": "payments",
    "change": "status=rejected, rejection_reason"
   },
   {
    "table": "registrations",
    "change": "status=rejected"
   },
   {
    "table": "gate_tickets",
    "change": "status=revoked, revoked_at"
   },
   {
    "table": "admin_audit_logs",
    "change": "payments-এ status = rejected"
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
    "table": "refunds",
    "change": "নতুন রিফান্ড সারি"
   },
   {
    "table": "payments",
    "change": "status=refunded"
   },
   {
    "table": "registrations",
    "change": "status=refunded, refunded_at"
   },
   {
    "table": "gate_tickets",
    "change": "status=revoked"
   },
   {
    "table": "admin_audit_logs",
    "change": "refunds-এ নতুন সারি, payments-এ status = refunded"
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
    "table": "gate_checkins",
    "change": "নতুন সারি (কতজন, কোন ডিভাইস, কে চালাল)"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "gate_checkins",
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
    "table": "admin_devices",
    "change": "status=approved বা pending"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "admin_devices",
    "change": "status=approved/revoked, approved_by"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "content_sections",
    "change": "লেখা/ছবি হালনাগাদ"
   },
   {
    "table": "content_schedule",
    "change": "সময়সূচি হালনাগাদ"
   },
   {
    "table": "event_fees",
    "change": "নতুন ফি আগামী নিবন্ধনে লাগে"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "registrations",
    "change": "status=cancelled, archived_at"
   },
   {
    "table": "participants",
    "change": "archived_at"
   },
   {
    "table": "gate_tickets",
    "change": "status=revoked"
   },
   {
    "table": "admin_audit_logs",
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
    "table": "user_links",
    "change": "নতুন tracking_key_hash"
   },
   {
    "table": "admin_audit_logs",
    "change": "registration.reissue"
   }
  ],
  "sort_order": 16
 }
]$flows$) AS x(id text, title_bn text, actor_bn text, trigger_bn text, steps jsonb, effects jsonb, sort_order integer)
ON CONFLICT (id) DO UPDATE SET title_bn = excluded.title_bn, actor_bn = excluded.actor_bn, trigger_bn = excluded.trigger_bn,
  steps = excluded.steps, effects = excluded.effects, sort_order = excluded.sort_order;



-- ═══════════════════════════════════════════════════════════════════
-- প্রধান অ্যাডমিনের ভূমিকা — auth.users-এ অ্যাকাউন্ট থাকলে নিজে থেকেই বসে।
-- কেন দরকার: সেটআপ আবার চালালে admin_users খালি হয়ে যায়, তখন কেউ
-- প্যানেলে ঢুকতে পারে না। এই অংশ বারবার চালানো নিরাপদ (idempotent)।
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO admin_users(user_id, role, display_name, is_active)
SELECT id, 'admin', 'প্রধান আয়োজক', true
FROM auth.users WHERE lower(email) = lower('graphictech360@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = true,
  display_name = excluded.display_name;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM admin_users WHERE role = 'admin' AND is_active;
  RAISE NOTICE 'সক্রিয় অ্যাডমিন: % জন', n;
END $$;



-- ═══════════════════════════════════════════════════════════════════
-- নিবন্ধন ফর্মের মূল ঘরগুলো — অ্যাডমিন এগুলোও এডিট/লুকাতে পারেন
-- (যেমন কিছু অনুষ্ঠানে টি-শার্ট লাগে না → “লুকাও” চাপলেই হবে)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO content_form_fields(event_id, field_key, label_bn, kind, placeholder, help_bn, is_required,
    is_visible, is_base, is_locked, step, sort_order)
SELECT e.id, x.field_key, x.label_bn, x.kind, x.placeholder, x.help_bn, x.is_required,
       x.is_visible, true, x.is_locked, x.step, x.sort_order
FROM event_events e,
jsonb_to_recordset($fields$[
 {"field_key":"photo","label_bn":"নিজের ছবি","kind":"photo","placeholder":"","help_bn":"","is_required":true,"is_visible":true,"is_locked":false,"step":1,"sort_order":10},
 {"field_key":"name","label_bn":"নাম","kind":"text","placeholder":"তোমার পুরো নাম","help_bn":"","is_required":true,"is_visible":true,"is_locked":true,"step":1,"sort_order":20},
 {"field_key":"school","label_bn":"স্কুলের নাম","kind":"text","placeholder":"যে স্কুল থেকে এসএসসি পাস করেছ","help_bn":"","is_required":true,"is_visible":true,"is_locked":false,"step":1,"sort_order":30},
 {"field_key":"ssc_roll","label_bn":"এসএসসি রোল","kind":"text","placeholder":"এসএসসি ১৯৯৬ রোল","help_bn":"","is_required":true,"is_visible":true,"is_locked":false,"step":1,"sort_order":40},
 {"field_key":"ssc_registration","label_bn":"এসএসসি রেজিস্ট্রেশন","kind":"text","placeholder":"রেজিস্ট্রেশন নম্বর","help_bn":"","is_required":false,"is_visible":true,"is_locked":false,"step":1,"sort_order":50},
 {"field_key":"mobile","label_bn":"মোবাইল নম্বর","kind":"tel","placeholder":"01XXXXXXXXX","help_bn":"","is_required":true,"is_visible":true,"is_locked":true,"step":1,"sort_order":60},
 {"field_key":"location","label_bn":"বর্তমান অবস্থান","kind":"text","placeholder":"শহর / দেশ","help_bn":"","is_required":true,"is_visible":true,"is_locked":false,"step":1,"sort_order":70},
 {"field_key":"family","label_bn":"কারা আসছো একসাথে?","kind":"family","placeholder":"","help_bn":"","is_required":false,"is_visible":true,"is_locked":false,"step":2,"sort_order":80},
 {"field_key":"tshirt","label_bn":"তোমার টি-শার্টের সাইজ","kind":"tshirt","placeholder":"","help_bn":"এই সাইজটি মূল অংশগ্রহণকারী বন্ধুর জন্য।","is_required":true,"is_visible":true,"is_locked":false,"step":2,"sort_order":90}
]$fields$) AS x(field_key text, label_bn text, kind text, placeholder text, help_bn text,
              is_required boolean, is_visible boolean, is_locked boolean, step smallint, sort_order integer)
WHERE e.slug = 'rangpur-ssc96'
ON CONFLICT (event_id, field_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- হেডার/মেনুর আইটেম — অ্যাডমিন নিজে বদলাতে পারেন
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO content_nav_items(event_id, kind, label_bn, target, sort_order, is_visible)
SELECT e.id, x.kind, x.label_bn, x.target, x.sort_order, true
FROM event_events e,
jsonb_to_recordset($nav$[
 {"kind":"section","label_bn":"আমাদের গল্প","target":"memories","sort_order":10},
 {"kind":"section","label_bn":"আয়োজন","target":"festival","sort_order":20},
 {"kind":"section","label_bn":"সময়সূচি","target":"schedule","sort_order":30},
 {"kind":"section","label_bn":"নিবন্ধন","target":"registration","sort_order":40},
 {"kind":"ticket","label_bn":"আমার টিকিট","target":"","sort_order":50}
]$nav$) AS x(kind text, label_bn text, target text, sort_order integer)
WHERE e.slug = 'rangpur-ssc96'
  AND NOT EXISTS (SELECT 1 FROM content_nav_items n WHERE n.event_id = e.id);

-- ═══════════════════════════════════════════════════════════════════
-- নিবন্ধন কার্ডের লেখা (অ্যাডমিন বদলাতে পারেন; খালি = কোডের লেখাই থাকবে)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO content_form_texts(event_id, text_key, value_bn)
SELECT e.id, x.text_key, x.value_bn
FROM event_events e,
jsonb_to_recordset($texts$[
 {"text_key":"card.eyebrow","value_bn":"YOUR SEAT IS WAITING"},
 {"text_key":"card.title","value_bn":"বন্ধু, নামটা লিখে ফেলো!"},
 {"text_key":"step1.label","value_bn":"পরিচয়"},
 {"text_key":"step1.title","value_bn":"০১ / তোমার পরিচয়"},
 {"text_key":"step2.label","value_bn":"পরিবার"},
 {"text_key":"step2.title","value_bn":"০২ / কারা আসছো একসাথে?"},
 {"text_key":"step3.label","value_bn":"পেমেন্ট"},
 {"text_key":"step3.title","value_bn":"০৩ / পেমেন্টের তথ্য"},
 {"text_key":"fee.label","value_bn":"মোট নিবন্ধন ফি"},
 {"text_key":"payment.sender_mobile","value_bn":"যে নম্বর থেকে টাকা পাঠিয়েছ"},
 {"text_key":"payment.sender_mobile_hint","value_bn":"যে নম্বর থেকে পাঠিয়েছ"},
 {"text_key":"payment.transaction_id","value_bn":"ট্রানজেকশন আইডি"},
 {"text_key":"payment.transaction_id_hint","value_bn":"যেমন: A7B8C9D0EF"},
 {"text_key":"family.total","value_bn":"মোট পরিবারের সদস্য"},
 {"text_key":"family.spouse","value_bn":"জীবনসঙ্গী আসবেন?"},
 {"text_key":"family.children","value_bn":"কতজন ছোট্ট অতিথি?"},
 {"text_key":"privacy.note","value_bn":"তথ্য শুধু আয়োজন ও পেমেন্ট যাচাইয়ের জন্য ব্যবহৃত হবে।"},
 {"text_key":"consent.text","value_bn":"প্রদত্ত তথ্য সঠিক এবং আমি আয়োজনের নিয়ম মেনে চলব।"}
]$texts$) AS x(text_key text, value_bn text)
WHERE e.slug = 'rangpur-ssc96'
ON CONFLICT (event_id, text_key) DO NOTHING;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৪ | নিরাপত্তা: RLS ও অনুমতি বন্ধ  (23_harden.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৩ | নিরাপত্তা: public-এর সব টেবিলে RLS চালু ও বাইরের অনুমতি প্রত্যাহার
-- কেন দরকার: টেবিলগুলো এখন public-এ (Table Editor-এ সহজে দেখার জন্য),
-- কিন্তু Data API-তে কেউ কোনো সারি পড়তে/লিখতে পারবে না —
-- শুধু অনুমোদিত RPC দরজাগুলোই তথ্য দেয়।
-- ব্যাখ্যা: policy নেই = "সব বন্ধ"।
-- ⚠️ public-এর ফাংশন (RPC) স্পর্শ করা হয় না — anon কেবল অনুমোদিতগুলোই ডাকতে পারে।
-- এই ফাইল বারবার চালানো নিরাপদ।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  names text[] := ARRAY['participants', 'registrations', 'user_links', 'payments', 'payment_accounts', 'refunds', 'admin_users', 'admin_login_events', 'admin_password_resets', 'admin_email_outbox', 'admin_devices', 'admin_audit_logs', 'gate_tickets', 'gate_checkins', 'content_sections', 'content_schedule', 'content_form_fields', 'content_nav_items', 'content_form_texts', 'event_events', 'event_fees', 'event_contacts', 'report_summary', 'report_school_wise', 'report_daily', 'report_attendance', 'report_refunds', 'report_tshirt_sizes', 'report_food_preferences', 'report_collectors', 'guide_tables', 'guide_flows', 'guide_overview', 'guide_relations', 'guide_schemas', 'guide_functions', 'database_schemas', 'database_settings', 'database_migrations', 'database_health'];
  t record;
  n_tables integer := 0;
  n_views integer := 0;
BEGIN
  -- ১) প্রতিটি টেবিলে RLS চালু
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY (names) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    n_tables := n_tables + 1;
  END LOOP;
  RAISE NOTICE 'RLS চালু হলো %টি টেবিলে', n_tables;

  -- ২) টেবিলে বাইরের সব অনুমতি প্রত্যাহার
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY (names) LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t.relname);
  END LOOP;

  -- ৩) রিপোর্ট/বর্ণনার ভিউগুলোও পড়া বন্ধ (প্যানেল RPC দিয়েই দেখে)
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname = ANY (names) LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t.relname);
    n_views := n_views + 1;
  END LOOP;
  RAISE NOTICE 'ভিউ বন্ধ হলো %টিতে', n_views;

  -- ৪) সিকোয়েন্স (থাকলে)
  FOR t IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', t.sequence_name);
  END LOOP;
END $$;

-- ৫) ভবিষ্যতে তৈরি হবে এমন টেবিল/সিকোয়েন্সেও যেন অনুমতি চলে না যায়
--    (ALTER DEFAULT PRIVILEGES শুধু বর্তমান রোলের তৈরি জিনিসে খাটে, তাই তথ্য-সুরক্ষার মূল ভরসা RLS)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৫ | ছবি: Storage bucket, photo_url কলাম ও ছবিসহ RPC  (24_photos.sql)
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৩ | ছবি আপলোড (participant photo) — ফাইল রাখা হয় Supabase Storage-এ
-- কেন Storage: Vercel-এর serverless ফাংশনে ফাইল ধরে রাখা যায় না (প্রতি অনুরোধে
-- নতুন ইনস্ট্যান্স, ডিস্ক মুছে যায়)। Supabase Storage-এ রাখলে ছবি স্থায়ী হয়,
-- ড্যাশবোর্ড → Storage → photos-এ দেখা যায় এবং টিকিট/গেটে সরাসরি দেখানো যায়।
--
-- এই ফাইল যা করে:
--   ১) Storage bucket "photos" (পাবলিক পড়া, ১.৫ MB সীমা, শুধু ছবি)
--   ২) upload অনুমতি শুধু anon/authenticated-এর জন্য, শুধু participants/ ফোল্ডারে
--   ৩) participants.photo_url কলাম
--   ৪) public_site / submit_registration / registration_json / check_in — সবখানে ছবি
--   ৫) সেটিং app.photo_required (ছবি বাধ্যতামূলক কি না) + guide-এ নতুন প্রবাহ
-- নিরাপদে বারবার চালানো যায়।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;

-- ── ১. Storage bucket ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', true, 1500000, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 1500000,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ── ২. Storage অনুমতি (RLS) ────────────────────────────────────────
-- upload: যে কেউ নিবন্ধনের সময় ছবি দিতে পারবে — শুধু photos bucket-এর participants/ ফোল্ডারে
DROP POLICY IF EXISTS photos_upload_participants ON storage.objects;
CREATE POLICY photos_upload_participants ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = 'participants'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

-- কেউ ছবি মুছতে/বদলাতে পারবে না (অ্যাডমিন প্যানেল থেকে কখনো মুছে ফেলার দরকার হলে Dashboard ব্যবহার করুন)
DROP POLICY IF EXISTS photos_no_delete ON storage.objects;

-- ── ৩. ছবির কলাম ──────────────────────────────────────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT '';
DO $$
BEGIN
  ALTER TABLE participants
    ADD CONSTRAINT participants_photo_url_check
    CHECK (photo_url = '' OR (photo_url LIKE 'https://%' AND length(photo_url) <= 400));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON COLUMN participants.photo_url IS 'টিকিটে ও গেটে দেখানো ছবি — Supabase Storage-এর পাবলিক লিংক (photos bucket)।';

CREATE INDEX IF NOT EXISTS participants_with_photo
  ON participants(event_id) WHERE photo_url <> '';

-- ── ৪. নিয়ম: ছবি বাধ্যতামূলক কি না (প্যানেল থেকে বদলানো যাবে) ──────
INSERT INTO database_settings(key, value, note_bn)
VALUES ('app.photo_required', 'true',
        'true = নিবন্ধনে ছবি দেওয়া বাধ্যতামূলক (টিকিটে ছবি থাকবে, গেটে চেনা সহজ)। false করলে ছবি ঐচ্ছিক।')
ON CONFLICT (key) DO NOTHING;

-- ── ৫. public_site: photoRequired জানানো + ছবি-সংক্রান্ত তথ্য ───────
CREATE OR REPLACE FUNCTION public.public_site() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96';
  IF e.id IS NULL THEN RAISE EXCEPTION 'আগে ২২_seed.sql চালান।'; END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'name', e.name, 'tagline', e.tagline, 'dateLabel', e.date_label,
      'isDummyDate', e.is_dummy_date, 'venue', e.venue, 'city', e.city, 'venueEnglish', e.venue_english,
      'registrationOpen', e.registration_open,
      'photoRequired', coalesce((SELECT (value #>> '{}')::boolean FROM database_settings WHERE key = 'app.photo_required'), true)),
    'fees', (SELECT jsonb_object_agg(kind, amount) FROM event_fees WHERE event_id = e.id),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn) ORDER BY sort_order)
      FROM event_contacts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
      'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_sections WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
      'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_schedule WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
      'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment_accounts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'formFields', coalesce((SELECT jsonb_agg(form_field_json(id) || jsonb_build_object('texts', form_text_json(e.id, field_key))
        ORDER BY sort_order)
      FROM content_form_fields WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'formTexts', form_texts_json(e.id),
    'nav', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'label', label_bn, 'target', target,
        'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_nav_items WHERE event_id = e.id AND is_visible), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.public_site() IS 'পাবলিক পেজের সব তথ্য: অনুষ্ঠান (নিবন্ধন চালু/বন্ধ, ছবি বাধ্যতামূলক কি না), ফি, যোগাযোগ, সেকশন, সময়সূচি, Send Money নম্বর ও নিবন্ধন ফর্মের ঘরগুলো।';

-- ── ৬. submit_registration: ছবির লিংক জমা ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_registration(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; a payment_accounts; f jsonb; u jsonb := p_data->'participant'; p jsonb := p_data->'payment';
        rid uuid; uid uuid; r registrations; access_key text; spouse integer; children integer;
        v_photo text := coalesce(btrim(u->>'photoUrl'), ''); v_required boolean;
        answers jsonb; ff content_form_fields;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96' FOR SHARE;
  IF e.id IS NULL OR NOT e.registration_open THEN RAISE EXCEPTION 'নিবন্ধন আপাতত বন্ধ আছে।'; END IF;
  IF coalesce((p_data->>'consent')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'শর্তে সম্মতি প্রয়োজন।'; END IF;

  v_required := coalesce((SELECT (value #>> '{}')::boolean FROM database_settings WHERE key = 'app.photo_required'), true);
  IF v_required AND v_photo = '' THEN RAISE EXCEPTION 'নিজের একটি ছবি আপলোড করুন — ছবি ছাড়া টিকিট তৈরি হবে না।'; END IF;
  IF v_photo <> '' AND (v_photo !~ '^https://' OR length(v_photo) > 400) THEN
    RAISE EXCEPTION 'ছবির লিংক সঠিক নয়।'; END IF;

  spouse := (p_data->>'spouse')::integer; children := (p_data->>'children')::integer;
  IF spouse IS NULL OR children IS NULL OR spouse NOT BETWEEN 0 AND 1 OR children NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'পরিবারের সদস্যসংখ্যা সঠিক নয়।'; END IF;
  IF EXISTS (SELECT 1 FROM participants WHERE event_id = e.id AND mobile = normalize_mobile(u->>'mobile') AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'এই মোবাইল নম্বরে ইতিমধ্যে নিবন্ধন আছে। গোপন টিকিটের লিংক ব্যবহার করুন।'; END IF;
  SELECT * INTO a FROM payment_accounts
   WHERE id = (p->>'accountId')::uuid AND event_id = e.id AND provider = p->>'provider' AND is_active;
  IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;

  -- ফর্মের অতিরিক্ত ঘরের উত্তর যাচাই: বাধ্যতামূলক ঘর ফাঁকা হলে আটকে দিই,
  -- অজানা/লুকানো ঘরের উত্তর বাদ দিই, বড় লেখা কেটে দিই।
  answers := coalesce(p_data->'answers', '{}'::jsonb);
  IF jsonb_typeof(answers) <> 'object' THEN answers := '{}'::jsonb; END IF;
  SELECT coalesce(jsonb_object_agg(cff.field_key, left(btrim(answers->>cff.field_key), cff.max_length)), '{}'::jsonb)
    INTO answers
    FROM content_form_fields cff
   WHERE cff.event_id = e.id AND cff.is_visible AND coalesce(btrim(answers->>cff.field_key), '') <> '';
  -- মূল ঘরগুলো (নাম, ছবি, টি-শার্ট…) অ্যাপ ও সার্ভার নিজের কনফিগ অনুযায়ী যাচাই করে,
  -- কারণ লুকানো থাকলে সেগুলো চাওয়াই উচিত নয়; এখানে শুধু অ্যাডমিনের যোগ করা ঘর।
  FOR ff IN SELECT * FROM content_form_fields fld
             WHERE fld.event_id = e.id AND fld.is_visible AND fld.is_required
               AND NOT fld.is_base ORDER BY fld.sort_order LOOP
    IF coalesce(answers->>ff.field_key, '') = '' THEN
      RAISE EXCEPTION 'ফর্মের ঘরটি পূরণ করুন: %', ff.label_bn;
    END IF;
  END LOOP;

  SELECT jsonb_object_agg(kind, amount) INTO f FROM event_fees WHERE event_id = e.id;
  INSERT INTO participants(event_id, name, school_name, ssc_roll, ssc_registration, mobile, current_location, tshirt_size, photo_url)
  VALUES (e.id, btrim(u->>'name'), btrim(u->>'school'), btrim(u->>'sscRoll'), coalesce(btrim(u->>'sscRegistration'), ''),
          normalize_mobile(u->>'mobile'), btrim(u->>'location'), u->>'tshirt', v_photo)
  RETURNING id INTO uid;

  INSERT INTO registrations(event_id, participant_id, spouse_count, children_count, food_preference, notes,
      custom_answers, fee_friend, fee_spouse, fee_child)
  VALUES (e.id, uid, spouse, children, nullif(coalesce(btrim(p_data->>'food'), ''), ''),
          coalesce(p_data->>'notes', ''), answers,
          (f->>'friend')::numeric, (f->>'spouse')::numeric, (f->>'child')::numeric)
  RETURNING * INTO r;

  rid := r.id;
  IF (p->>'amount')::numeric IS DISTINCT FROM r.total_fee THEN
    RAISE EXCEPTION 'ফি পরিবর্তিত হয়েছে বা টাকার পরিমাণ মেলেনি। সঠিক ফি যাচাই করুন।'; END IF;

  INSERT INTO payments(event_id, registration_id, account_id, provider, collector_name_snapshot,
      collector_mobile_snapshot, sender_mobile, transaction_id, submitted_amount)
  VALUES (e.id, rid, a.id, a.provider, a.collector_name, a.mobile, normalize_mobile(p->>'senderMobile'),
          btrim(p->>'transactionId'), (p->>'amount')::numeric);

  access_key := random_token();
  INSERT INTO user_links(registration_id, tracking_key_hash) VALUES (rid, key_hash(access_key));
  PERFORM log_action(e.id, 'registration.created', rid, jsonb_build_object('photo', v_photo <> ''));
  RETURN jsonb_build_object('registration', registration_json(rid), 'trackingKey', access_key);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল নম্বর অথবা ট্রানজেকশন আইডি আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.submit_registration(jsonb) IS 'নতুন নিবন্ধন (ছবির লিংকসহ) জমা নেয়: অংশগ্রহণকারী + পরিবার + পেমেন্ট + গোপন ট্র্যাকিং লিংক; অবস্থা pending।';

-- ── ৭. registration_json: টিকিটে ছবি আসবে ─────────────────────────
CREATE OR REPLACE FUNCTION public.registration_json(rid uuid, include_qr boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT jsonb_build_object(
  'id', r.id, 'ticketNumber', r.ticket_number,
  'participant', jsonb_build_object('name', u.name, 'school', u.school_name, 'sscRoll', u.ssc_roll,
    'sscRegistration', u.ssc_registration, 'mobile', u.mobile, 'location', u.current_location,
    'tshirt', u.tshirt_size, 'photoUrl', u.photo_url),
  'spouse', r.spouse_count, 'children', r.children_count, 'food', coalesce(r.food_preference, ''), 'notes', r.notes,
  'answers', r.custom_answers,
  'feeSnapshot', jsonb_build_object('friend', r.fee_friend, 'spouse', r.fee_spouse, 'child', r.fee_child),
  'total', r.total_fee, 'status', r.status,
  'payment', jsonb_build_object('id', p.id, 'provider', p.provider, 'accountId', p.account_id,
    'collectorName', p.collector_name_snapshot, 'collectorMobile', p.collector_mobile_snapshot,
    'senderMobile', p.sender_mobile, 'transactionId', p.transaction_id, 'amount', p.submitted_amount,
    'status', p.status, 'reviewedAt', p.reviewed_at, 'reason', p.rejection_reason),
  'refund', (SELECT to_jsonb(x) FROM (
      SELECT coalesce(sum(f.amount), 0) AS amount, count(*) AS count, max(f.refunded_at) AS lastAt
      FROM refunds f WHERE f.registration_id = r.id) x
    WHERE EXISTS (SELECT 1 FROM refunds f WHERE f.registration_id = r.id)),
  'createdAt', r.created_at, 'approvedAt', r.approved_at, 'refundedAt', r.refunded_at,
  'checkedInAt', c.checked_in_at, 'archivedAt', r.archived_at, 'source', 'live',
  'qrPayload', CASE WHEN include_qr AND r.status = 'approved' AND r.archived_at IS NULL AND t.status = 'active'
    THEN 'R96:' || r.id::text || ':' || t.qr_secret ELSE NULL END)
FROM registrations r
JOIN participants u ON u.id = r.participant_id
JOIN payments p ON p.registration_id = r.id
LEFT JOIN gate_tickets t ON t.registration_id = r.id
LEFT JOIN gate_checkins c ON c.registration_id = r.id
WHERE r.id = rid $$;
COMMENT ON FUNCTION registration_json(uuid, boolean) IS 'একটি নিবন্ধনের সম্পূর্ণ ছবি jsonb আকারে — টিকিটে অংশগ্রহণকারীর ছবিসহ।';

-- ── ৮. check_in: গেটে ছবি দেখানো (চেনার জন্য) ─────────────────────
CREATE OR REPLACE FUNCTION public.check_in(p_input text, p_device_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e uuid; s jsonb; d admin_devices; r registrations; u participants;
        c gate_checkins; parts text[]; inserted_id uuid; already boolean := false;
BEGIN
  s := require_role(); e := event_id();
  SELECT * INTO d FROM admin_devices
   WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = key_hash(p_device_token)
     AND status = 'approved' FOR SHARE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'এই ব্রাউজার/ডিভাইস চেক-ইনের জন্য অনুমোদিত নয়।' USING ERRCODE = '42501'; END IF;

  IF p_input LIKE 'R96:%' THEN
    parts := string_to_array(p_input, ':');
    IF array_length(parts, 1) <> 3 OR parts[2] !~ '^[0-9a-f-]{36}$' OR parts[3] !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয়।'; END IF;
    SELECT * INTO r FROM registrations WHERE id = parts[2]::uuid AND event_id = e FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM gate_tickets WHERE registration_id = r.id AND qr_secret = parts[3] AND status = 'active') THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয় বা বাতিল হয়েছে।'; END IF;
  ELSIF upper(p_input) ~ '^R96-[0-9]{5,}$' THEN
    SELECT * INTO r FROM registrations WHERE ticket_number = upper(p_input) AND event_id = e FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'এই উৎসবের সঠিক QR বা টিকিট নম্বর দিন।';
  END IF;

  IF r.id IS NULL OR r.status <> 'approved' OR r.archived_at IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM payments WHERE registration_id = r.id AND status = 'verified') THEN
    RAISE EXCEPTION 'টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।' USING ERRCODE = '42501'; END IF;

  INSERT INTO gate_checkins(event_id, registration_id, device_id, operator_id, group_size)
  VALUES (e, r.id, d.id, (s->>'id')::uuid, 1 + r.spouse_count + r.children_count)
  ON CONFLICT (registration_id) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN already := true; END IF;

  SELECT * INTO c FROM gate_checkins WHERE registration_id = r.id;
  SELECT * INTO u FROM participants WHERE id = r.participant_id;
  RETURN jsonb_build_object('alreadyCheckedIn', already, 'ticketNumber', r.ticket_number, 'name', u.name,
    'school', u.school_name, 'photoUrl', u.photo_url, 'people', c.group_size, 'spouse', r.spouse_count,
    'children', r.children_count, 'checkedInAt', c.checked_in_at);
END $$;
COMMENT ON FUNCTION public.check_in(text, text) IS 'গেটে QR/টিকিট নম্বর মিলিয়ে চেক-ইন করে; ফলাফলে অংশগ্রহণকারীর ছবি আসে যাতে স্টাফ চিনতে পারে।';

-- ── ৯. guide হালনাগাদ ─────────────────────────────────────────────
UPDATE guide_tables
   SET purpose_bn = 'যিনি নিবন্ধন করেন — নাম, স্কুল, SSC রোল, মোবাইল, ছবি ও টি-শার্ট সাইজ।',
       key_columns = 'name, school_name, mobile, photo_url, tshirt_size'
 WHERE schema_name = 'user' AND table_name = 'participants';

INSERT INTO guide_flows(id, title_bn, actor_bn, trigger_bn, steps, effects, sort_order)
VALUES ('photo_upload', 'নিবন্ধনে ছবি আপলোড', 'অংশগ্রহণকারী', 'ফর্মের পরিচয় ধাপে নিজের ছবি দেওয়া',
  '["ব্রাউজারে ছবি ছোট করা হয় (সর্বোচ্চ ১২৮০ পিক্সেল, JPEG ~৭০০ KB)","অ্যাপ ছবিটি সার্ভারে পাঠায়, সার্ভার Supabase Storage-এর photos bucket-এ রাখে","ফিরে আসা লিংক নিবন্ধনের সঙ্গে database-এ লেখা হয়","অনুমোদনের পর টিকিটে ও গেটের পর্দায় ছবিটি দেখা যায়"]'::jsonb,
  '[{"table":"storage.photos","change":"ছবি ফাইল জমা হয় (bucket: photos/participants/…)"},{"table":"\"user\".participants","change":"photo_url কলামে লিংক লেখা হয়"},{"table":"gate_checkins","change":"চেক-ইনের ফলাফলে ছবি আসে — স্টাফ চিনতে পারে"}]'::jsonb, 17)
ON CONFLICT (id) DO UPDATE SET title_bn = excluded.title_bn, actor_bn = excluded.actor_bn,
  trigger_bn = excluded.trigger_bn, steps = excluded.steps, effects = excluded.effects, sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════════════
-- ৯. "user" — ব্যবহারকারীর সম্পূর্ণ তালিকা — ব্যবহারকারীর সম্পূর্ণ তালিকা (এক ক্লিকে সবার সব তথ্য)
-- Table Editor → public → user খুললেই প্রতি বন্ধুর নাম, স্কুল, সঙ্গী,
-- শিশু, মোট টাকা আর verified (যাচাই হয়েছে কি না) একসাথে দেখা যাবে।
-- এখানে ডেটা লেখা যায় না — মূল টেবিলগুলোই আসল জায়গা (participants,
-- registrations, payments)।
-- ═══════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public."user" CASCADE;
CREATE VIEW public."user" AS
SELECT
  p.name                                      AS "Name",
  p.school_name                               AS "School name",
  p.mobile                                    AS "Mobile",
  p.ssc_roll                                  AS "SSC Roll",
  p.current_location                          AS "Location",
  r.spouse_count                              AS "Spouse",
  r.children_count                            AS "Child",
  r.total_fee                                 AS "Amount",
  pay.provider                                AS "Payment method",
  pay.sender_mobile                           AS "Sender mobile",
  pay.transaction_id                          AS "Transaction ID",
  (pay.status = 'verified')                   AS "Verified",
  r.status                                    AS "Status",
  r.ticket_number                             AS "Ticket number",
  p.photo_url                                 AS "Photo",
  r.created_at                                AS "Date",
  r.archived_at                               AS "Archived at"
FROM participants p
JOIN registrations r ON r.participant_id = p.id
LEFT JOIN LATERAL (
  SELECT x.* FROM payments x WHERE x.registration_id = r.id
   ORDER BY x.created_at DESC LIMIT 1
) pay ON true;
COMMENT ON VIEW public."user" IS 'এক ক্লিকে সবার সব তথ্য: নাম, স্কুল, সঙ্গী, শিশু, টাকা, কোন মাধ্যমে পাঠানো, TrxID, Verified (যাচাই হয়েছে কি না), টিকিট নম্বর ও ছবি।';

-- ভিউটি বাইরে থেকে পড়া বন্ধ (প্যানেল ও Table Editorservice_role দিয়ে দেখে)
REVOKE ALL ON TABLE public."user" FROM PUBLIC, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════
-- হেডারের লোগো: অ্যাডমিন প্যানেল থেকে নতুন লোগো আপলোড করা যাবে
-- ══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS photos_upload_branding ON storage.objects;
CREATE POLICY photos_upload_branding ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'photos'
    AND (storage.foldername(name))[1] = 'branding'
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp']));

COMMIT;
