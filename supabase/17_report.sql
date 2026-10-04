-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৮ | schema: report  —  রিপোর্ট সেকশন
-- এখানে ডেটা রাখা হয় না — টেবিলগুলো নিজে থেকেই সব হিসাব দেখায়।
-- Supabase Table Editor-এ report স্কিমা খুললেই মোট হিসাব, স্কুলভিত্তিক,
-- দিনভিত্তিক, উপস্থিতি ও রিফান্ডের ছবি দেখা যাবে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS report;
REVOKE ALL ON SCHEMA report FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA report IS 'রিপোর্ট সেকশন: সব হিসাব দেখানোর ভিউ (টেবিলের মতোই Table Editor-এ দেখা যায়)।';

-- ── ১. মোট হিসাব (এক সারিতে পুরো উৎসব) ───────────────────────────
CREATE OR REPLACE VIEW report.summary AS
SELECT
  (SELECT count(*) FROM registration.registrations WHERE archived_at IS NULL)                              AS registrations,
  (SELECT count(*) FROM registration.registrations WHERE archived_at IS NULL AND status = 'approved')       AS approved,
  (SELECT count(*) FROM registration.registrations WHERE archived_at IS NULL AND status = 'pending')        AS pending,
  (SELECT count(*) FROM registration.registrations WHERE archived_at IS NULL AND status = 'refunded')       AS refunded,
  (SELECT count(*) FROM registration.registrations WHERE archived_at IS NOT NULL)                           AS archived,
  (SELECT count(*) + coalesce(sum(spouse_count), 0) + coalesce(sum(children_count), 0)
     FROM registration.registrations WHERE archived_at IS NULL)                                            AS people,
  (SELECT coalesce(sum(total_fee), 0) FROM registration.registrations WHERE archived_at IS NULL)            AS expected_amount,
  (SELECT coalesce(sum(p.submitted_amount), 0) FROM payment.payments p
     JOIN registration.registrations r ON r.id = p.registration_id
    WHERE r.archived_at IS NULL AND p.status = 'verified')                                                  AS verified_amount,
  (SELECT coalesce(sum(f.amount), 0) FROM payment.refunds f
     JOIN registration.registrations r ON r.id = f.registration_id WHERE r.archived_at IS NULL)             AS refunded_amount,
  (SELECT count(*) FROM gate.checkins c
     JOIN registration.registrations r ON r.id = c.registration_id WHERE r.archived_at IS NULL)             AS checked_in,
  (SELECT coalesce(sum(c.group_size), 0) FROM gate.checkins c
     JOIN registration.registrations r ON r.id = c.registration_id WHERE r.archived_at IS NULL)             AS checked_in_people,
  (SELECT count(*) FROM registration.registrations r
    WHERE r.archived_at IS NULL AND r.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM gate.checkins c WHERE c.registration_id = r.id))                       AS absent,
  (SELECT coalesce(sum(1 + r.spouse_count + r.children_count), 0) FROM registration.registrations r
    WHERE r.archived_at IS NULL AND r.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM gate.checkins c WHERE c.registration_id = r.id))                       AS absent_people,
  (SELECT coalesce(sum(p.submitted_amount), 0) FROM payment.payments p
     JOIN registration.registrations r ON r.id = p.registration_id
    WHERE r.archived_at IS NULL AND p.status = 'pending')                                                   AS pending_payments_amount;
COMMENT ON VIEW report.summary IS 'এক সারিতে পুরো উৎসবের হিসাব: নিবন্ধন, মানুষ, প্রত্যাশিত/যাচাইকৃত/রিফান্ড টাকা, উপস্থিতি ও অনুপস্থিত।';

-- ── ২. স্কুলভিত্তিক হিসাব ─────────────────────────────────────────
CREATE OR REPLACE VIEW report.school_wise AS
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
FROM registration.registrations r
JOIN registration.participants u ON u.id = r.participant_id
LEFT JOIN payment.payments p ON p.registration_id = r.id
LEFT JOIN gate.checkins c ON c.registration_id = r.id
WHERE r.archived_at IS NULL
GROUP BY u.school_name
ORDER BY count(*) DESC, u.school_name;
COMMENT ON VIEW report.school_wise IS 'প্রতিটি স্কুল থেকে কতজন নিবন্ধন করল, কত টাকা এল, কতজন এল, কতজন অনুপস্থিত।';

-- ── ৩. দিনভিত্তিক নিবন্ধন (শেষ ৩০ দিন) ───────────────────────────
CREATE OR REPLACE VIEW report.daily AS
SELECT
  (r.created_at AT TIME ZONE 'Asia/Dhaka')::date          AS day,
  count(*)                                                AS registrations,
  count(*) FILTER (WHERE r.status = 'approved')           AS approved,
  coalesce(sum(r.total_fee), 0)                           AS expected_amount
FROM registration.registrations r
WHERE r.archived_at IS NULL AND r.created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
COMMENT ON VIEW report.daily IS 'দিনভিত্তিক নিবন্ধন — শেষ ৩০ দিনের ধারা (বাংলাদেশ সময় অনুযায়ী)।';

-- ── ৪. উপস্থিতি (অনুমোদিত সবার নাম-ধামসহ) ────────────────────────
CREATE OR REPLACE VIEW report.attendance AS
SELECT
  r.ticket_number                                   AS ticket,
  u.name, u.school_name AS school, u.mobile,
  r.spouse_count AS spouse, r.children_count AS children,
  r.status,
  CASE WHEN c.id IS NULL THEN 'অনুপস্থিত' ELSE 'উপস্থিত' END AS attendance,
  c.group_size AS checked_in_people,
  c.checked_in_at,
  a.display_name AS checked_in_by
FROM registration.registrations r
JOIN registration.participants u ON u.id = r.participant_id
LEFT JOIN gate.checkins c ON c.registration_id = r.id
LEFT JOIN admin.admins a ON a.user_id = c.operator_id
WHERE r.archived_at IS NULL AND r.status = 'approved'
ORDER BY (c.id IS NULL) DESC, u.name;
COMMENT ON VIEW report.attendance IS 'অনুমোদিত প্রত্যেকের উপস্থিতি-তালিকা — কে এসেছে, কে অনুপস্থিত, কে চেক-ইন করাল।';

-- ── ৫. রিফান্ড-তালিকা ─────────────────────────────────────────────
CREATE OR REPLACE VIEW report.refunds AS
SELECT
  f.refunded_at, f.amount, f.reason_bn AS reason, f.method,
  r.ticket_number AS ticket, u.name, u.school_name AS school,
  a.display_name AS marked_by
FROM payment.refunds f
JOIN registration.registrations r ON r.id = f.registration_id
JOIN registration.participants u ON u.id = r.participant_id
LEFT JOIN admin.admins a ON a.user_id = f.marked_by
ORDER BY f.refunded_at DESC;
COMMENT ON VIEW report.refunds IS 'যত রিফান্ড হয়েছে তার তালিকা — কত টাকা, কেন, কে অনুমোদন করল।';

-- ── ৬. মিডিয়া/সাইজ/খাবার হিসাব (পর্দায় দেখানোর ছোট ছবি) ─────────
CREATE OR REPLACE VIEW report.tshirt_sizes AS
SELECT u.tshirt_size AS size, count(*) AS count
FROM registration.registrations r JOIN registration.participants u ON u.id = r.participant_id
WHERE r.archived_at IS NULL GROUP BY u.tshirt_size ORDER BY count(*) DESC;
COMMENT ON VIEW report.tshirt_sizes IS 'কোন টি-শার্ট সাইজ কতটি লাগবে।';

CREATE OR REPLACE VIEW report.food_preferences AS
SELECT r.food_preference AS preference, count(*) AS count
FROM registration.registrations r WHERE r.archived_at IS NULL
GROUP BY r.food_preference ORDER BY count(*) DESC;
COMMENT ON VIEW report.food_preferences IS 'সাধারণ/নিরামিষ/বিশেষ — কতটি খাবার লাগবে।';

CREATE OR REPLACE VIEW report.collectors AS
SELECT p.provider, p.collector_name_snapshot AS collector, p.collector_mobile_snapshot AS mobile,
       count(*) AS registrations, coalesce(sum(p.submitted_amount), 0) AS amount,
       coalesce(sum(p.submitted_amount) FILTER (WHERE p.status = 'verified'), 0) AS verified_amount
FROM payment.payments p JOIN registration.registrations r ON r.id = p.registration_id
WHERE r.archived_at IS NULL
GROUP BY 1, 2, 3 ORDER BY amount DESC;
COMMENT ON VIEW report.collectors IS 'কে (Tomal/Mahatab/Shohag/Arif) কত টাকা Received করেছেন।';

REVOKE ALL ON ALL TABLES IN SCHEMA report FROM PUBLIC, anon, authenticated;

COMMIT;
