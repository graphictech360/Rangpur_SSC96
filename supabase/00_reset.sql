-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ০ | পুরোনো সব গঠন মুছে ফেলা (শুধু নতুন সেটআপের ঠিক আগে একবার)
-- নতুন গঠন: database · admin · event · content · registration ·
--           payment · gate · report · guide
-- ⚠️ অ্যাডমিন অ্যাকাউন্ট (auth.users) মুছে যায় না — শুধু তাঁর ভূমিকা
--    নতুন admin.admins টেবিলে আবার বসাতে হবে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

DROP SCHEMA IF EXISTS ssc96 CASCADE;      -- একেবারে প্রথম গঠন
DROP SCHEMA IF EXISTS database CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
DROP SCHEMA IF EXISTS content CASCADE;
DROP SCHEMA IF EXISTS people CASCADE;
DROP SCHEMA IF EXISTS money CASCADE;
DROP SCHEMA IF EXISTS ops CASCADE;
DROP SCHEMA IF EXISTS admin CASCADE;
DROP SCHEMA IF EXISTS event CASCADE;
DROP SCHEMA IF EXISTS registration CASCADE;
DROP SCHEMA IF EXISTS payment CASCADE;
DROP SCHEMA IF EXISTS gate CASCADE;
DROP SCHEMA IF EXISTS report CASCADE;
DROP SCHEMA IF EXISTS guide CASCADE;

DROP VIEW IF EXISTS public.ssc96_tables;
DROP VIEW IF EXISTS public.table_map;
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

COMMIT;
