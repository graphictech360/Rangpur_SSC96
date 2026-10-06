-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৩ | ছবি আপলোড (participant photo) — ফাইল রাখা হয় Supabase Storage-এ
-- কেন Storage: Vercel-এর serverless ফাংশনে ফাইল ধরে রাখা যায় না (প্রতি অনুরোধে
-- নতুন ইনস্ট্যান্স, ডিস্ক মুছে যায়)। Supabase Storage-এ রাখলে ছবি স্থায়ী হয়,
-- ড্যাশবোর্ড → Storage → photos-এ দেখা যায় এবং টিকিট/গেটে সরাসরি দেখানো যায়।
--
-- এই ফাইল যা করে:
--   ১) Storage bucket "photos" (পাবলিক পড়া, ১.৫ MB সীমা, শুধু ছবি)
--   ২) upload অনুমতি শুধু anon/authenticated-এর জন্য, শুধু participants/ ফোল্ডারে
--   ৩) participants.photo_url কলাম
--   ৪) public_site / submit_registration / registration_json / check_in — সবখানে ছবি
--   ৫) সেটিং app.photo_required (ছবি বাধ্যতামূলক কি না) + guide-এ নতুন প্রবাহ
-- নিরাপদে বারবার চালানো যায়।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;

-- ── ১. Storage bucket ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', true, 1500000, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 1500000,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ── ২. Storage অনুমতি (RLS) ────────────────────────────────────────
-- upload: যে কেউ নিবন্ধনের সময় ছবি দিতে পারবে — শুধু photos bucket-এর participants/ ফোল্ডারে
DROP POLICY IF EXISTS photos_upload_participants ON storage.objects;
CREATE POLICY photos_upload_participants ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = 'participants'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

-- কেউ ছবি মুছতে/বদলাতে পারবে না (অ্যাডমিন প্যানেল থেকে কখনো মুছে ফেলার দরকার হলে Dashboard ব্যবহার করুন)
DROP POLICY IF EXISTS photos_no_delete ON storage.objects;

-- ── ৩. ছবির কলাম ──────────────────────────────────────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT '';
DO $$
BEGIN
  ALTER TABLE participants
    ADD CONSTRAINT participants_photo_url_check
    CHECK (photo_url = '' OR (photo_url LIKE 'https://%' AND length(photo_url) <= 400));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON COLUMN participants.photo_url IS 'টিকিটে ও গেটে দেখানো ছবি — Supabase Storage-এর পাবলিক লিংক (photos bucket)।';

CREATE INDEX IF NOT EXISTS participants_with_photo
  ON participants(event_id) WHERE photo_url <> '';

-- ── ৪. নিয়ম: ছবি বাধ্যতামূলক কি না (প্যানেল থেকে বদলানো যাবে) ──────
INSERT INTO database_settings(key, value, note_bn)
VALUES ('app.photo_required', 'true',
        'true = নিবন্ধনে ছবি দেওয়া বাধ্যতামূলক (টিকিটে ছবি থাকবে, গেটে চেনা সহজ)। false করলে ছবি ঐচ্ছিক।')
ON CONFLICT (key) DO NOTHING;

-- ── ৫. public_site: photoRequired জানানো + ছবি-সংক্রান্ত তথ্য ───────
CREATE OR REPLACE FUNCTION public.public_site() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96';
  IF e.id IS NULL THEN RAISE EXCEPTION 'আগে ২২_seed.sql চালান।'; END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'name', e.name, 'tagline', e.tagline, 'dateLabel', e.date_label,
      'isDummyDate', e.is_dummy_date, 'venue', e.venue, 'city', e.city, 'venueEnglish', e.venue_english,
      'registrationOpen', e.registration_open,
      'photoRequired', coalesce((SELECT (value #>> '{}')::boolean FROM database_settings WHERE key = 'app.photo_required'), true)),
    'fees', (SELECT jsonb_object_agg(kind, amount) FROM event_fees WHERE event_id = e.id),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn) ORDER BY sort_order)
      FROM event_contacts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
      'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_sections WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
      'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_schedule WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
      'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment_accounts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'formFields', coalesce((SELECT jsonb_agg(form_field_json(id) || jsonb_build_object('texts', form_text_json(e.id, field_key))
        ORDER BY sort_order)
      FROM content_form_fields WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'formTexts', form_texts_json(e.id),
    'nav', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'label', label_bn, 'target', target,
        'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_nav_items WHERE event_id = e.id AND is_visible), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.public_site() IS 'পাবলিক পেজের সব তথ্য: অনুষ্ঠান (নিবন্ধন চালু/বন্ধ, ছবি বাধ্যতামূলক কি না), ফি, যোগাযোগ, সেকশন, সময়সূচি, Send Money নম্বর ও নিবন্ধন ফর্মের ঘরগুলো।';

-- ── ৬. submit_registration: ছবির লিংক জমা ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_registration(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; a payment_accounts; f jsonb; u jsonb := p_data->'participant'; p jsonb := p_data->'payment';
        rid uuid; uid uuid; r registrations; access_key text; spouse integer; children integer;
        v_photo text := coalesce(btrim(u->>'photoUrl'), ''); v_required boolean;
        answers jsonb; ff content_form_fields;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96' FOR SHARE;
  IF e.id IS NULL OR NOT e.registration_open THEN RAISE EXCEPTION 'নিবন্ধন আপাতত বন্ধ আছে।'; END IF;
  IF coalesce((p_data->>'consent')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'শর্তে সম্মতি প্রয়োজন।'; END IF;

  v_required := coalesce((SELECT (value #>> '{}')::boolean FROM database_settings WHERE key = 'app.photo_required'), true);
  IF v_required AND v_photo = '' THEN RAISE EXCEPTION 'নিজের একটি ছবি আপলোড করুন — ছবি ছাড়া টিকিট তৈরি হবে না।'; END IF;
  IF v_photo <> '' AND (v_photo !~ '^https://' OR length(v_photo) > 400) THEN
    RAISE EXCEPTION 'ছবির লিংক সঠিক নয়।'; END IF;

  spouse := (p_data->>'spouse')::integer; children := (p_data->>'children')::integer;
  IF spouse IS NULL OR children IS NULL OR spouse NOT BETWEEN 0 AND 1 OR children NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'পরিবারের সদস্যসংখ্যা সঠিক নয়।'; END IF;
  IF EXISTS (SELECT 1 FROM participants WHERE event_id = e.id AND mobile = normalize_mobile(u->>'mobile') AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'এই মোবাইল নম্বরে ইতিমধ্যে নিবন্ধন আছে। গোপন টিকিটের লিংক ব্যবহার করুন।'; END IF;
  SELECT * INTO a FROM payment_accounts
   WHERE id = (p->>'accountId')::uuid AND event_id = e.id AND provider = p->>'provider' AND is_active;
  IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;

  -- ফর্মের অতিরিক্ত ঘরের উত্তর যাচাই: বাধ্যতামূলক ঘর ফাঁকা হলে আটকে দিই,
  -- অজানা/লুকানো ঘরের উত্তর বাদ দিই, বড় লেখা কেটে দিই।
  answers := coalesce(p_data->'answers', '{}'::jsonb);
  IF jsonb_typeof(answers) <> 'object' THEN answers := '{}'::jsonb; END IF;
  SELECT coalesce(jsonb_object_agg(cff.field_key, left(btrim(answers->>cff.field_key), cff.max_length)), '{}'::jsonb)
    INTO answers
    FROM content_form_fields cff
   WHERE cff.event_id = e.id AND cff.is_visible AND coalesce(btrim(answers->>cff.field_key), '') <> '';
  -- মূল ঘরগুলো (নাম, ছবি, টি-শার্ট…) অ্যাপ ও সার্ভার নিজের কনফিগ অনুযায়ী যাচাই করে,
  -- কারণ লুকানো থাকলে সেগুলো চাওয়াই উচিত নয়; এখানে শুধু অ্যাডমিনের যোগ করা ঘর।
  FOR ff IN SELECT * FROM content_form_fields fld
             WHERE fld.event_id = e.id AND fld.is_visible AND fld.is_required
               AND NOT fld.is_base ORDER BY fld.sort_order LOOP
    IF coalesce(answers->>ff.field_key, '') = '' THEN
      RAISE EXCEPTION 'ফর্মের ঘরটি পূরণ করুন: %', ff.label_bn;
    END IF;
  END LOOP;

  SELECT jsonb_object_agg(kind, amount) INTO f FROM event_fees WHERE event_id = e.id;
  INSERT INTO participants(event_id, name, school_name, ssc_roll, ssc_registration, mobile, current_location, tshirt_size, photo_url)
  VALUES (e.id, btrim(u->>'name'), btrim(u->>'school'), btrim(u->>'sscRoll'), coalesce(btrim(u->>'sscRegistration'), ''),
          normalize_mobile(u->>'mobile'), btrim(u->>'location'), u->>'tshirt', v_photo)
  RETURNING id INTO uid;

  INSERT INTO registrations(event_id, participant_id, spouse_count, children_count, food_preference, notes,
      custom_answers, fee_friend, fee_spouse, fee_child)
  VALUES (e.id, uid, spouse, children, nullif(coalesce(btrim(p_data->>'food'), ''), ''),
          coalesce(p_data->>'notes', ''), answers,
          (f->>'friend')::numeric, (f->>'spouse')::numeric, (f->>'child')::numeric)
  RETURNING * INTO r;

  rid := r.id;
  IF (p->>'amount')::numeric IS DISTINCT FROM r.total_fee THEN
    RAISE EXCEPTION 'ফি পরিবর্তিত হয়েছে বা টাকার পরিমাণ মেলেনি। সঠিক ফি যাচাই করুন।'; END IF;

  INSERT INTO payments(event_id, registration_id, account_id, provider, collector_name_snapshot,
      collector_mobile_snapshot, sender_mobile, transaction_id, submitted_amount)
  VALUES (e.id, rid, a.id, a.provider, a.collector_name, a.mobile, normalize_mobile(p->>'senderMobile'),
          btrim(p->>'transactionId'), (p->>'amount')::numeric);

  access_key := random_token();
  INSERT INTO user_links(registration_id, tracking_key_hash) VALUES (rid, key_hash(access_key));
  PERFORM log_action(e.id, 'registration.created', rid, jsonb_build_object('photo', v_photo <> ''));
  RETURN jsonb_build_object('registration', registration_json(rid), 'trackingKey', access_key);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল নম্বর অথবা ট্রানজেকশন আইডি আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.submit_registration(jsonb) IS 'নতুন নিবন্ধন (ছবির লিংকসহ) জমা নেয়: অংশগ্রহণকারী + পরিবার + পেমেন্ট + গোপন ট্র্যাকিং লিংক; অবস্থা pending।';

-- ── ৭. registration_json: টিকিটে ছবি আসবে ─────────────────────────
CREATE OR REPLACE FUNCTION public.registration_json(rid uuid, include_qr boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
SELECT jsonb_build_object(
  'id', r.id, 'ticketNumber', r.ticket_number,
  'participant', jsonb_build_object('name', u.name, 'school', u.school_name, 'sscRoll', u.ssc_roll,
    'sscRegistration', u.ssc_registration, 'mobile', u.mobile, 'location', u.current_location,
    'tshirt', u.tshirt_size, 'photoUrl', u.photo_url),
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
COMMENT ON FUNCTION registration_json(uuid, boolean) IS 'একটি নিবন্ধনের সম্পূর্ণ ছবি jsonb আকারে — টিকিটে অংশগ্রহণকারীর ছবিসহ।';

-- ── ৮. check_in: গেটে ছবি দেখানো (চেনার জন্য) ─────────────────────
CREATE OR REPLACE FUNCTION public.check_in(p_input text, p_device_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e uuid; s jsonb; d admin_devices; r registrations; u participants;
        c gate_checkins; parts text[]; inserted_id uuid; already boolean := false;
BEGIN
  s := require_role(); e := event_id();
  SELECT * INTO d FROM admin_devices
   WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = key_hash(p_device_token)
     AND status = 'approved' FOR SHARE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'এই ব্রাউজার/ডিভাইস চেক-ইনের জন্য অনুমোদিত নয়।' USING ERRCODE = '42501'; END IF;

  IF p_input LIKE 'R96:%' THEN
    parts := string_to_array(p_input, ':');
    IF array_length(parts, 1) <> 3 OR parts[2] !~ '^[0-9a-f-]{36}$' OR parts[3] !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয়।'; END IF;
    SELECT * INTO r FROM registrations WHERE id = parts[2]::uuid AND event_id = e FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM gate_tickets WHERE registration_id = r.id AND qr_secret = parts[3] AND status = 'active') THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয় বা বাতিল হয়েছে।'; END IF;
  ELSIF upper(p_input) ~ '^R96-[0-9]{5,}$' THEN
    SELECT * INTO r FROM registrations WHERE ticket_number = upper(p_input) AND event_id = e FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'এই উৎসবের সঠিক QR বা টিকিট নম্বর দিন।';
  END IF;

  IF r.id IS NULL OR r.status <> 'approved' OR r.archived_at IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM payments WHERE registration_id = r.id AND status = 'verified') THEN
    RAISE EXCEPTION 'টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।' USING ERRCODE = '42501'; END IF;

  INSERT INTO gate_checkins(event_id, registration_id, device_id, operator_id, group_size)
  VALUES (e, r.id, d.id, (s->>'id')::uuid, 1 + r.spouse_count + r.children_count)
  ON CONFLICT (registration_id) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN already := true; END IF;

  SELECT * INTO c FROM gate_checkins WHERE registration_id = r.id;
  SELECT * INTO u FROM participants WHERE id = r.participant_id;
  RETURN jsonb_build_object('alreadyCheckedIn', already, 'ticketNumber', r.ticket_number, 'name', u.name,
    'school', u.school_name, 'photoUrl', u.photo_url, 'people', c.group_size, 'spouse', r.spouse_count,
    'children', r.children_count, 'checkedInAt', c.checked_in_at);
END $$;
COMMENT ON FUNCTION public.check_in(text, text) IS 'গেটে QR/টিকিট নম্বর মিলিয়ে চেক-ইন করে; ফলাফলে অংশগ্রহণকারীর ছবি আসে যাতে স্টাফ চিনতে পারে।';

-- ── ৯. guide হালনাগাদ ─────────────────────────────────────────────
UPDATE guide_tables
   SET purpose_bn = 'যিনি নিবন্ধন করেন — নাম, স্কুল, SSC রোল, মোবাইল, ছবি ও টি-শার্ট সাইজ।',
       key_columns = 'name, school_name, mobile, photo_url, tshirt_size'
 WHERE schema_name = 'user' AND table_name = 'participants';

INSERT INTO guide_flows(id, title_bn, actor_bn, trigger_bn, steps, effects, sort_order)
VALUES ('photo_upload', 'নিবন্ধনে ছবি আপলোড', 'অংশগ্রহণকারী', 'ফর্মের পরিচয় ধাপে নিজের ছবি দেওয়া',
  '["ব্রাউজারে ছবি ছোট করা হয় (সর্বোচ্চ ১২৮০ পিক্সেল, JPEG ~৭০০ KB)","অ্যাপ ছবিটি সার্ভারে পাঠায়, সার্ভার Supabase Storage-এর photos bucket-এ রাখে","ফিরে আসা লিংক নিবন্ধনের সঙ্গে database-এ লেখা হয়","অনুমোদনের পর টিকিটে ও গেটের পর্দায় ছবিটি দেখা যায়"]'::jsonb,
  '[{"table":"storage.photos","change":"ছবি ফাইল জমা হয় (bucket: photos/participants/…)"},{"table":"\"user\".participants","change":"photo_url কলামে লিংক লেখা হয়"},{"table":"gate_checkins","change":"চেক-ইনের ফলাফলে ছবি আসে — স্টাফ চিনতে পারে"}]'::jsonb, 17)
ON CONFLICT (id) DO UPDATE SET title_bn = excluded.title_bn, actor_bn = excluded.actor_bn,
  trigger_bn = excluded.trigger_bn, steps = excluded.steps, effects = excluded.effects, sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════════════
-- ৯. "user" — ব্যবহারকারীর সম্পূর্ণ তালিকা — ব্যবহারকারীর সম্পূর্ণ তালিকা (এক ক্লিকে সবার সব তথ্য)
-- Table Editor → public → user খুললেই প্রতি বন্ধুর নাম, স্কুল, সঙ্গী,
-- শিশু, মোট টাকা আর verified (যাচাই হয়েছে কি না) একসাথে দেখা যাবে।
-- এখানে ডেটা লেখা যায় না — মূল টেবিলগুলোই আসল জায়গা (participants,
-- registrations, payments)।
-- ═══════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public."user" CASCADE;
CREATE VIEW public."user" AS
SELECT
  p.name                                      AS "Name",
  p.school_name                               AS "School name",
  p.mobile                                    AS "Mobile",
  p.ssc_roll                                  AS "SSC Roll",
  p.current_location                          AS "Location",
  r.spouse_count                              AS "Spouse",
  r.children_count                            AS "Child",
  r.total_fee                                 AS "Amount",
  pay.provider                                AS "Payment method",
  pay.sender_mobile                           AS "Sender mobile",
  pay.transaction_id                          AS "Transaction ID",
  (pay.status = 'verified')                   AS "Verified",
  r.status                                    AS "Status",
  r.ticket_number                             AS "Ticket number",
  p.photo_url                                 AS "Photo",
  r.created_at                                AS "Date",
  r.archived_at                               AS "Archived at"
FROM participants p
JOIN registrations r ON r.participant_id = p.id
LEFT JOIN LATERAL (
  SELECT x.* FROM payments x WHERE x.registration_id = r.id
   ORDER BY x.created_at DESC LIMIT 1
) pay ON true;
COMMENT ON VIEW public."user" IS 'এক ক্লিকে সবার সব তথ্য: নাম, স্কুল, সঙ্গী, শিশু, টাকা, কোন মাধ্যমে পাঠানো, TrxID, Verified (যাচাই হয়েছে কি না), টিকিট নম্বর ও ছবি।';

-- ভিউটি বাইরে থেকে পড়া বন্ধ (প্যানেল ও Table Editorservice_role দিয়ে দেখে)
REVOKE ALL ON TABLE public."user" FROM PUBLIC, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════
-- হেডারের লোগো: অ্যাডমিন প্যানেল থেকে নতুন লোগো আপলোড করা যাবে
-- ══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS photos_upload_branding ON storage.objects;
CREATE POLICY photos_upload_branding ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'photos'
    AND (storage.foldername(name))[1] = 'branding'
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp']));

COMMIT;
