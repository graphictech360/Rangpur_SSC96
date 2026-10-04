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
