-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১ | schema: database  —  "ডেটাবেস সেকশন"
-- এখানে থাকে ডেটাবেস-স্তরের সবকিছু: কোন স্কিমা কী কাজে, অ্যাপের সেটিংস,
-- কোন মাইগ্রেশন কখন চলল, আর পুরো ডেটাবেসের স্বাস্থ্য-ছবি।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS database;
REVOKE ALL ON SCHEMA database FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA database REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON SCHEMA database IS 'ডেটাবেস-স্তরের হিসাব: স্কিমা-তালিকা, অ্যাপ সেটিংস, মাইগ্রেশন এবং স্বাস্থ্য-ভিউ। বাইরের কারও প্রবেশ নেই।';

-- ── ১. কোন স্কিমার কাজ কী (গঠনের মূল ঠিকানা-তালিকা) ───────────────
CREATE TABLE database.schemas (
  name         text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9_]{1,30}$'),
  purpose_bn   text NOT NULL CHECK (length(purpose_bn) BETWEEN 5 AND 300),
  section_bn   text NOT NULL CHECK (length(section_bn) BETWEEN 2 AND 80),
  sort_order   integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 99),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE database.schemas IS 'প্রতিটি স্কিমার উদ্দেশ্য — কোন স্কিমা জীবনের কোন সেকশনের তথ্য রাখে।';
COMMENT ON COLUMN database.schemas.name IS 'স্কিমার নাম (database, admin, event, content, registration, payment, gate, report, guide)।';
COMMENT ON COLUMN database.schemas.purpose_bn IS 'এই স্কিমা কী কাজে — বাংলায় এক লাইনে।';
COMMENT ON COLUMN database.schemas.section_bn IS 'অ্যাপের কোন সেকশন এই স্কিমা ব্যবহার করে।';

-- ── ২. অ্যাপের সেটিংস (চাবি → মান, যেকোনো সময় বদলানো যায়) ─────────
CREATE TABLE database.settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]{2,60}$'),
  value      jsonb NOT NULL,
  note_bn    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE database.settings IS 'অ্যাপের সমন্বয়-সেটিংস (নিবন্ধন চালু/বন্ধ, রিফান্ড অনুমতি, যোগাযোগ নম্বর ইত্যাদি)।';
COMMENT ON COLUMN database.settings.key IS 'সেটিংসের নাম, যেমন refunds_enabled।';
COMMENT ON COLUMN database.settings.value IS 'মান (jsonb) — true/false, সংখ্যা বা লেখা।';
COMMENT ON COLUMN database.settings.note_bn IS 'এই সেটিংস কী করে, বাংলায় ব্যাখ্যা।';

-- ── ৩. মাইগ্রেশন-হিসাব (কোন ধাপ কখন চলল) ─────────────────────────
CREATE TABLE database.migrations (
  version    text PRIMARY KEY CHECK (version ~ '^[0-9]{2}_[a-z0-9_]+$'),
  name_bn    text NOT NULL CHECK (length(name_bn) BETWEEN 3 AND 200),
  applied_at timestamptz NOT NULL DEFAULT now(),
  note       text NOT NULL DEFAULT ''
);
COMMENT ON TABLE database.migrations IS 'কোন SQL ধাপ কখন চালানো হয়েছে তার হিসাব — ভবিষ্যতে আপডেট করলে এখানে নতুন সারি যোগ হবে।';
COMMENT ON COLUMN database.migrations.version IS 'ফাইলের নাম, যেমন 13_people।';

-- ── ৪. স্বাস্থ্য-ভিউ: টেবিল, আকার, RLS, ইনডেক্স, ট্রিগার ──────────
CREATE VIEW database.health AS
SELECT
  n.nspname                                   AS schema_name,
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
  AND n.nspname IN ('database', 'event', 'content', 'registration', 'payment', 'admin', 'gate', 'report', 'guide')
ORDER BY n.nspname, c.relname;
COMMENT ON VIEW database.health IS 'প্রতিটি টেবিলের সারি-সংখ্যা, আকার, RLS, ইনডেক্স ও ট্রিগারের এক নজরের ছবি। Supabase SQL Editor-এ: select * from database.health;';

COMMIT;
