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
