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
