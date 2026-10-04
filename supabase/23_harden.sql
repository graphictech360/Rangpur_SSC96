-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১২ | নিরাপত্তা: সব টেবিলে RLS চালু ও বাইরের অনুমতি প্রত্যাহার
-- কেন দরকার: সেকশন-স্কিমাগুলোতে কেউ ঢুকতে পারে না (স্কিমা-লেভেলে বন্ধ)।
-- তার উপর এই স্তরটা আরেকটু রক্ষা দেয় — কেউ ভুলে কোনো টেবিল/দৃশ্য
-- Data API-তে খুলে দিলেও কোনো সারি পড়তে/লিখতে পারবে না।
-- ব্যাখ্যা: policy নেই = "সব বন্ধ"; শুধু SECURITY DEFINER RPC-গুলোই
-- (অ্যাডমিন/স্টাফ হিসেব করে) তথ্য দেয়।
-- এই ফাইল বারবার চালানো নিরাপদ।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  sections text[] := ARRAY['database','admin','event','content','registration','payment','gate','guide'];
  t record;
  n_tables integer := 0;
BEGIN
  -- ১) প্রতিটি টেবিলে RLS চালু
  FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = ANY (sections) ORDER BY 1, 2 LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
    n_tables := n_tables + 1;
  END LOOP;
  RAISE NOTICE 'RLS চালু হলো %টি টেবিলে', n_tables;

  -- ২) টেবিল ও সিকোয়েন্সে বাইরের সব অনুমতি প্রত্যাহার
  FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = ANY (sections) LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon, authenticated', t.schemaname, t.tablename);
  END LOOP;
  FOR t IN SELECT sequence_schema, sequence_name FROM information_schema.sequences WHERE sequence_schema = ANY (sections) LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC, anon, authenticated', t.sequence_schema, t.sequence_name);
  END LOOP;

  -- ৩) report স্কিমার ভিউগুলো পড়া বন্ধ (রিপোর্ট প্যানেল RPC দিয়েই দেখে)
  FOR t IN SELECT table_schema, table_name FROM information_schema.views WHERE table_schema = 'report' LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon, authenticated', t.table_schema, t.table_name);
  END LOOP;

  -- ৪) guide স্কিমার টেবিল/ভিউও বন্ধ
  FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'guide' LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon, authenticated', t.schemaname, t.tablename);
  END LOOP;
END $$;

-- ৫) ভবিষ্যতে তৈরি হবে এমন টেবিল/ফাংশনেও যেন অনুমতি চলে না যায়
ALTER DEFAULT PRIVILEGES IN SCHEMA database, admin, event, content, registration, payment, gate, report, guide
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA database, admin, event, content, registration, payment, gate, report, guide
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

COMMIT;
