-- ══════════════════════════════════════════════════════════════════
-- শুধু পরীক্ষার নমুনা নিবন্ধন মোছে — আসল নিবন্ধনে হাত পড়ে না।
--
-- ⚠️ কখনো `TRUNCATE … CASCADE` দিয়ে পুরো টেবিল খালি করবেন না —
--    তাতে আসল বন্ধুদের নিবন্ধন, ছবি ও টিকিট সব একসাথে মুছে যায়।
--    এই স্ক্রিপ্ট নাম আর চেনা মোবাইল-প্রিফিক্স দেখে বেছে বেছে মোছে।
--
-- চেনার নিয়ম: পরীক্ষার স্ক্রিপ্টগুলো যে নামগুলো ব্যবহার করে —
--   'লাইভ পরীক্ষা বন্ধু', 'গঠন পরীক্ষা বন্ধু', 'লাইভ ছবি পরীক্ষা',
--   'ফর্ম ঘর পরীক্ষা', 'মোবাইল খাপ পরীক্ষা', 'গোপনীয়তা-ক/খ-…',
--   'মেইল পরীক্ষা…', 'ইমেইল পরীক্ষা…'
-- ⚠️ চালানোর আগে ১ ধাপের SELECT-এ তালিকা দেখে নিন।
-- ══════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _test_targets ON COMMIT DROP AS
  SELECT r.id AS rid, r.participant_id AS pid, p.name, p.mobile, p.photo_url
  FROM public.registrations r
  JOIN public.participants p ON p.id = r.participant_id
  WHERE p.name IN ('লাইভ পরীক্ষা বন্ধু', 'লাইভ ছবি পরীক্ষা')
     OR p.name LIKE 'গঠন পরীক্ষা%'
     OR p.name LIKE 'ফর্ম ঘর পরীক্ষা%'
     OR p.name LIKE 'মোবাইল খাপ পরীক্ষা%'
     OR p.name LIKE 'গোপনীয়তা-%'
     OR p.name LIKE 'মেইল পরীক্ষা%'
     OR p.name LIKE 'ইমেইল পরীক্ষা%'
     OR p.mobile LIKE '01718%'
     OR p.mobile LIKE '01717000%'
     OR EXISTS (
       SELECT 1 FROM public.payments pay
       WHERE pay.registration_id = r.id
         AND (pay.transaction_id LIKE 'LIVE-TEST%' OR pay.transaction_id LIKE 'R96LIVE-TEST%'
              OR pay.transaction_id LIKE 'MAIL-TEST%' OR pay.transaction_id LIKE 'CHAIN%'
              OR pay.transaction_id LIKE 'FORMFIELD%' OR pay.transaction_id LIKE 'LIVEFIELD%')
     );

-- ১) কী কী মোছা হবে — আগে চোখে দেখে নিন।
--    নামগুলো আসল বন্ধুর মনে হলে COMMIT-এর আগে ROLLBACK চালান।
SELECT name, mobile, photo_url FROM _test_targets ORDER BY name;

-- ২) নিবন্ধনের সাথে জড়িত সব সারি
DELETE FROM public.gate_checkins WHERE registration_id IN (SELECT rid FROM _test_targets);
DELETE FROM public.gate_tickets  WHERE registration_id IN (SELECT rid FROM _test_targets);
DELETE FROM public.refunds       WHERE registration_id IN (SELECT rid FROM _test_targets);
DELETE FROM public.user_links    WHERE registration_id IN (SELECT rid FROM _test_targets);
DELETE FROM public.payments      WHERE registration_id IN (SELECT rid FROM _test_targets);
DELETE FROM public.admin_audit_logs WHERE record_id IN (SELECT rid FROM _test_targets);
DELETE FROM public.registrations WHERE id IN (SELECT rid FROM _test_targets);
DELETE FROM public.participants  WHERE id IN (SELECT pid FROM _test_targets);

COMMIT;

-- ── ছবি মোছা (Storage) ────────────────────────────────────────────
-- ছবি ডেটাবেস থেকে মোছা যায় না। মোছার আগে তালিকা দেখুন:
--   SELECT name FROM storage.objects WHERE bucket_id = 'photos';
-- তারপর Supabase ড্যাশবোর্ড → Storage → photos বাকেট → ফাইল বাছাই করে Delete,
-- অথবা নিচের মতো অস্থায়ী অনুমতি দিয়ে Storage REST API দিয়ে মুছুন:
--   CREATE POLICY tmp_c1 ON storage.objects FOR DELETE TO anon USING (bucket_id='photos');
--   (তারপর DELETE https://<ref>.supabase.co/storage/v1/object/photos/<name> …)
--   DROP POLICY tmp_c1 ON storage.objects;
