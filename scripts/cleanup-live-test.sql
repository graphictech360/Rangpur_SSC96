-- পরীক্ষার (tests/supabase-live.mjs) তৈরি নমুনা নিবন্ধন মুছে ফেলার স্ক্রিপ্ট।
-- Supabase SQL Editor-এ চালান। শুধু পরীক্ষার রেকর্ড মুছে, আসল নিবন্ধন অপরিবর্তিত থাকে।
-- চেনার উপায়: নাম ('লাইভ পরীক্ষা বন্ধু','গঠন পরীক্ষা') অথবা পরীক্ষার মোবাইল prefix 01718…
BEGIN;
CREATE TEMP TABLE IF NOT EXISTS _live_test_targets AS
  SELECT r.id AS rid, r.participant_id AS pid
  FROM ssc96.registrations r
  JOIN ssc96.participants u ON u.id = r.participant_id
  WHERE u.name IN ('লাইভ পরীক্ষা বন্ধু', 'গঠন পরীক্ষা')
     OR u.mobile LIKE '01718%';

DELETE FROM ssc96.payments WHERE registration_id IN (SELECT rid FROM _live_test_targets);
DELETE FROM ssc96.tickets WHERE registration_id IN (SELECT rid FROM _live_test_targets);
DELETE FROM ssc96.checkins WHERE registration_id IN (SELECT rid FROM _live_test_targets);
DELETE FROM ssc96.registration_access WHERE registration_id IN (SELECT rid FROM _live_test_targets);
DELETE FROM ssc96.audit_logs WHERE record_id IN (SELECT rid FROM _live_test_targets);
DELETE FROM ssc96.registrations WHERE id IN (SELECT rid FROM _live_test_targets);
DELETE FROM ssc96.participants WHERE id IN (SELECT pid FROM _live_test_targets);

DROP TABLE _live_test_targets;
COMMIT;

SELECT (SELECT count(*) FROM ssc96.participants)  AS participants,
       (SELECT count(*) FROM ssc96.registrations) AS registrations,
       (SELECT count(*) FROM ssc96.content_sections) AS content,
       (SELECT count(*) FROM ssc96.event_schedule)   AS schedule,
       (SELECT count(*) FROM ssc96.payment_accounts) AS accounts;
