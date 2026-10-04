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
