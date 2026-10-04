-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১০ | schema: public — অ্যাপের একমাত্র দরজা (RPC)
-- বাইরের কেউ সরাসরি কোনো টেবিল পড়তে/লিখতে পারে না। শুধু এই কয়টি
-- ফাংশনই দরজা — প্রতিটির অনুমতি আলাদা করে দেওয়া।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;

-- ── সাধারণ ব্যবহারকারীর (লগইন ছাড়া) দরজা ─────────────────────────
CREATE OR REPLACE FUNCTION public.public_site() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96';
  IF e.id IS NULL THEN RAISE EXCEPTION 'আগে 20_seed.sql চালান।'; END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'name', e.name, 'tagline', e.tagline, 'dateLabel', e.date_label,
      'isDummyDate', e.is_dummy_date, 'venue', e.venue, 'city', e.city, 'venueEnglish', e.venue_english,
      'registrationOpen', e.registration_open),
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
COMMENT ON FUNCTION public.public_site() IS 'পাবলিক পেজের সব তথ্য: অনুষ্ঠান, ফি, যোগাযোগ নম্বর, সেকশন, সময়সূচি, Send Money নম্বর ও নিবন্ধন ফর্মের ঘরগুলো। লগইন লাগে না।';

CREATE OR REPLACE FUNCTION public.submit_registration(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; a payment_accounts; f jsonb; u jsonb := p_data->'participant'; p jsonb := p_data->'payment';
        rid uuid; uid uuid; r registrations; access_key text; spouse integer; children integer;
        answers jsonb; ff content_form_fields;
BEGIN
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96' FOR SHARE;
  IF e.id IS NULL OR NOT e.registration_open THEN RAISE EXCEPTION 'নিবন্ধন আপাতত বন্ধ আছে।'; END IF;
  IF coalesce((p_data->>'consent')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'শর্তে সম্মতি প্রয়োজন।'; END IF;
  spouse := (p_data->>'spouse')::integer; children := (p_data->>'children')::integer;
  IF spouse IS NULL OR children IS NULL OR spouse NOT BETWEEN 0 AND 1 OR children NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'পরিবারের সদস্যসংখ্যা সঠিক নয়।'; END IF;
  IF EXISTS (SELECT 1 FROM participants WHERE event_id = e.id AND mobile = normalize_mobile(u->>'mobile') AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'এই মোবাইল নম্বরে ইতিমধ্যে নিবন্ধন আছে। গোপন টিকিটের লিংক ব্যবহার করুন।'; END IF;
  SELECT * INTO a FROM payment_accounts
   WHERE id = (p->>'accountId')::uuid AND event_id = e.id AND provider = p->>'provider' AND is_active;
  IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;

  SELECT jsonb_object_agg(kind, amount) INTO f FROM event_fees WHERE event_id = e.id;
  INSERT INTO participants(event_id, name, school_name, ssc_roll, ssc_registration, mobile, current_location, tshirt_size)
  VALUES (e.id, btrim(u->>'name'), btrim(u->>'school'), btrim(u->>'sscRoll'), coalesce(btrim(u->>'sscRegistration'), ''),
          normalize_mobile(u->>'mobile'), btrim(u->>'location'), u->>'tshirt')
  RETURNING id INTO uid;

  -- ফর্মের অতিরিক্ত ঘরের উত্তর যাচাই: বাধ্যতামূলক ঘর ফাঁকা থাকলে আটকে দিই,
  -- অজানা/লুকানো ঘরের উত্তর বাদ দিই, বড় লেখা কেটে দিই।
  answers := coalesce(p_data->'answers', '{}'::jsonb);
  IF jsonb_typeof(answers) <> 'object' THEN answers := '{}'::jsonb; END IF;
  SELECT coalesce(jsonb_object_agg(cff.field_key, left(btrim(answers->>cff.field_key), cff.max_length)), '{}'::jsonb)
    INTO answers
    FROM content_form_fields cff
   WHERE cff.event_id = e.id AND cff.is_visible AND coalesce(btrim(answers->>cff.field_key), '') <> '';
  FOR ff IN SELECT * FROM content_form_fields fld
             WHERE fld.event_id = e.id AND fld.is_visible AND fld.is_required
               AND NOT fld.is_base ORDER BY fld.sort_order LOOP
    IF coalesce(answers->>ff.field_key, '') = '' THEN
      RAISE EXCEPTION 'ফর্মের ঘরটি পূরণ করুন: %', ff.label_bn;
    END IF;
  END LOOP;

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
  PERFORM log_action(e.id, 'registration.created', rid);
  RETURN jsonb_build_object('registration', registration_json(rid), 'trackingKey', access_key);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল নম্বর অথবা ট্রানজেকশন আইডি আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.submit_registration(jsonb) IS 'নতুন নিবন্ধন জমা নেয়: অংশগ্রহণকারী + পরিবারের সংখ্যা + পেমেন্ট রেকর্ড + গোপন ট্র্যাকিং লিংক। অবস্থা থাকে pending।';

CREATE OR REPLACE FUNCTION public.ticket_status(p_tracking_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE rid uuid;
BEGIN
  IF p_tracking_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'সঠিক গোপন লিংক বা রিকভারি কোড দিন।'; END IF;
  SELECT a.registration_id INTO rid FROM user_links a
    JOIN registrations r ON r.id = a.registration_id
   WHERE a.tracking_key_hash = key_hash(p_tracking_key) AND r.archived_at IS NULL;
  IF rid IS NULL THEN RAISE EXCEPTION 'নিবন্ধন পাওয়া যায়নি বা বাতিল হয়েছে।'; END IF;
  RETURN registration_json(rid, true);
END $$;
COMMENT ON FUNCTION public.ticket_status(text) IS 'গোপন লিংকের কী দিয়ে নিজের নিবন্ধন ও QR টিকিট দেখায় — ফোন নম্বর দিয়ে অন্যের টিকিট দেখা যায় না।';

-- ── স্টাফ/অ্যাডমিনের দরজা ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_identity() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s jsonb;
BEGIN
  s := require_role();
  RETURN jsonb_build_object('id', s->>'id', 'name', s->>'name', 'role', s->>'role');
END $$;
COMMENT ON FUNCTION public.staff_identity() IS 'লগইন করা স্টাফ নিজের পরিচয় ও ভূমিকা (admin/scanner) জানতে পারে।';

CREATE OR REPLACE FUNCTION public.admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; site jsonb;
BEGIN
  PERFORM require_role(true);
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96';
  site := public.public_site();
  RETURN site || jsonb_build_object(
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
        'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_sections WHERE event_id = e.id), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
        'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_schedule WHERE event_id = e.id), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
        'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment_accounts WHERE event_id = e.id), '[]'::jsonb),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM event_contacts WHERE event_id = e.id), '[]'::jsonb),
    'formFields', coalesce((SELECT jsonb_agg(form_field_json(id) || jsonb_build_object('visible', is_visible) ORDER BY sort_order)
      FROM content_form_fields WHERE event_id = e.id), '[]'::jsonb),
    'formFieldStats', form_field_stats(e.id),
    'formTexts', coalesce((SELECT jsonb_object_agg(text_key, value_bn) FROM content_form_texts WHERE event_id = e.id),
      '{}'::jsonb),
    'nav', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'label', label_bn, 'target', target,
        'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content_nav_items WHERE event_id = e.id), '[]'::jsonb),
    'registrations', coalesce((SELECT jsonb_agg(registration_json(id) ORDER BY created_at DESC)
      FROM registrations WHERE event_id = e.id), '[]'::jsonb),
    'devices', coalesce((SELECT jsonb_agg(device_json(id) ORDER BY created_at DESC)
      FROM admin_devices WHERE event_id = e.id), '[]'::jsonb),
    'stats', stats(),
    'logins', coalesce((SELECT jsonb_agg(jsonb_build_object('email', email, 'ok', succeeded, 'note', note_bn, 'at', created_at)
        ORDER BY created_at DESC) FROM (SELECT * FROM admin_login_events ORDER BY created_at DESC LIMIT 20) l), '[]'::jsonb),
    'audit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'user', actor_name, 'action', action, 'recordId', record_id,
        'metadata', metadata, 'createdAt', created_at) ORDER BY created_at DESC)
      FROM (SELECT * FROM admin_audit_logs WHERE event_id = e.id ORDER BY created_at DESC LIMIT 100) a), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.admin_overview() IS 'অ্যাডমিন প্যানেলের সব তথ্য: সেকশন, সময়সূচি, নম্বর, নিবন্ধন, ডিভাইস, রিপোর্ট-হিসাব, লগইন-হিসাব ও অডিট-লগ। শুধু অ্যাডমিন।';

CREATE OR REPLACE FUNCTION public.admin_mutate(p_action text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e event_events; s jsonb; r registrations; p payments; a payment_accounts; acct_id uuid;
        obj_id uuid; secret text; result jsonb := '{"ok":true}'; meta jsonb := '{}'; amt numeric; reg_id uuid;
BEGIN
  s := require_role(true);
  SELECT * INTO e FROM event_events WHERE slug = 'rangpur-ssc96' FOR UPDATE;
  obj_id := nullif(p_payload->>'id', '')::uuid;

  IF p_action LIKE 'registration.%' OR p_action IN ('participant.save', 'payment.save', 'payment.refund') THEN
    SELECT * INTO r FROM registrations WHERE id = obj_id AND event_id = e.id FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'নিবন্ধন পাওয়া যায়নি।'; END IF;
  END IF;

  CASE p_action
    WHEN 'event.save' THEN
      UPDATE event_events SET name = btrim(p_payload->>'name'), tagline = btrim(p_payload->>'tagline'),
        date_label = btrim(p_payload->>'dateLabel'), is_dummy_date = (p_payload->>'isDummyDate')::boolean,
        venue = btrim(p_payload->>'venue'), city = btrim(p_payload->>'city'),
        venue_english = btrim(p_payload->>'venueEnglish'), registration_open = (p_payload->>'registrationOpen')::boolean
      WHERE id = e.id;

    WHEN 'fees.save' THEN
      INSERT INTO event_fees(event_id, kind, amount)
      SELECT e.id, key, value::numeric FROM jsonb_each_text(p_payload) WHERE key IN ('friend', 'spouse', 'child')
      ON CONFLICT (event_id, kind) DO UPDATE SET amount = excluded.amount, updated_at = now();

    WHEN 'section.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content_sections(id, event_id, section_key, title, subtitle, body, image_url, sort_order, is_visible)
      VALUES (obj_id, e.id, p_payload->>'key', btrim(p_payload->>'title'), coalesce(p_payload->>'subtitle', ''),
              coalesce(p_payload->>'body', ''), coalesce(p_payload->>'imageUrl', ''), (p_payload->>'order')::integer,
              (p_payload->>'visible')::boolean)
      ON CONFLICT (id) DO UPDATE SET section_key = excluded.section_key, title = excluded.title, subtitle = excluded.subtitle,
        body = excluded.body, image_url = excluded.image_url, sort_order = excluded.sort_order,
        is_visible = excluded.is_visible, updated_at = now() WHERE content_sections.event_id = e.id;

    WHEN 'section.delete' THEN DELETE FROM content_sections WHERE id = obj_id AND event_id = e.id;

    WHEN 'schedule.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content_schedule(id, event_id, start_time, period, title, note, sort_order, is_visible)
      VALUES (obj_id, e.id, (p_payload->>'time')::time, p_payload->>'period', btrim(p_payload->>'title'),
              coalesce(p_payload->>'note', ''), (p_payload->>'order')::integer, (p_payload->>'visible')::boolean)
      ON CONFLICT (id) DO UPDATE SET start_time = excluded.start_time, period = excluded.period, title = excluded.title,
        note = excluded.note, sort_order = excluded.sort_order, is_visible = excluded.is_visible, updated_at = now()
      WHERE content_schedule.event_id = e.id;

    WHEN 'schedule.delete' THEN DELETE FROM content_schedule WHERE id = obj_id AND event_id = e.id;

    WHEN 'account.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO payment_accounts(id, event_id, provider, collector_name, mobile, sort_order, is_active)
      VALUES (obj_id, e.id, p_payload->>'provider', btrim(p_payload->>'name'), normalize_mobile(p_payload->>'mobile'),
              (p_payload->>'order')::integer, (p_payload->>'active')::boolean)
      ON CONFLICT (id) DO UPDATE SET provider = excluded.provider, collector_name = excluded.collector_name,
        mobile = excluded.mobile, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
      WHERE payment_accounts.event_id = e.id;

    WHEN 'account.delete' THEN
      UPDATE payment_accounts SET is_active = false, updated_at = now() WHERE id = obj_id AND event_id = e.id;

    WHEN 'participant.save' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন পরিবর্তন করা যাবে না।'; END IF;
      UPDATE participants SET name = btrim(p_payload->'participant'->>'name'),
        school_name = btrim(p_payload->'participant'->>'school'), ssc_roll = btrim(p_payload->'participant'->>'sscRoll'),
        ssc_registration = coalesce(p_payload->'participant'->>'sscRegistration', ''),
        mobile = normalize_mobile(p_payload->'participant'->>'mobile'),
        current_location = btrim(p_payload->'participant'->>'location'),
        tshirt_size = p_payload->'participant'->>'tshirt',
        -- ছবি: প্যানেল থেকে নতুন ছবি দিলে সেটি বসে, খালি পাঠালে আগেরটাই থাকে
        photo_url = CASE
          WHEN p_payload->'participant'->>'photoUrl' IS NULL THEN photo_url
          WHEN btrim(p_payload->'participant'->>'photoUrl') = '' THEN photo_url
          ELSE btrim(p_payload->'participant'->>'photoUrl') END
      WHERE id = r.participant_id;
      UPDATE registrations SET spouse_count = (p_payload->>'spouse')::integer,
        children_count = (p_payload->>'children')::integer, food_preference = p_payload->>'food',
        notes = coalesce(p_payload->>'notes', '') WHERE id = r.id;

    WHEN 'payment.save' THEN
      IF r.status = 'approved' OR r.archived_at IS NOT NULL
         OR EXISTS (SELECT 1 FROM gate_checkins WHERE registration_id = r.id) THEN
        RAISE EXCEPTION 'অনুমোদিত বা বাতিল পেমেন্ট সরাসরি বদলানো যাবে না।'; END IF;
      SELECT * INTO a FROM payment_accounts
       WHERE id = (p_payload->>'accountId')::uuid AND provider = p_payload->>'provider' AND event_id = e.id AND is_active;
      IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;
      SELECT * INTO p FROM payments WHERE registration_id = r.id;
      meta := jsonb_build_object('previousPayment', to_jsonb(p));
      UPDATE payments SET provider = a.provider, account_id = a.id, collector_name_snapshot = a.collector_name,
        collector_mobile_snapshot = a.mobile, sender_mobile = normalize_mobile(p_payload->>'senderMobile'),
        transaction_id = btrim(p_payload->>'transactionId'), submitted_amount = (p_payload->>'amount')::numeric,
        status = 'pending', reviewed_at = NULL, reviewed_by = NULL, rejection_reason = ''
      WHERE registration_id = r.id;
      UPDATE registrations SET status = 'pending' WHERE id = r.id;

    WHEN 'registration.approve' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন অনুমোদন করা যাবে না।'; END IF;
      IF r.status = 'refunded' THEN RAISE EXCEPTION 'রিফান্ড হওয়া নিবন্ধন আবার অনুমোদন করা যায় না।'; END IF;
      IF coalesce((p_payload->>'verified')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'নিজের লেনদেনের রেকর্ড মিলিয়ে নিশ্চিত করুন।'; END IF;
      IF r.status = 'approved' THEN RETURN result; END IF;
      SELECT * INTO p FROM payments WHERE registration_id = r.id;
      IF p.submitted_amount IS DISTINCT FROM r.total_fee THEN
        RAISE EXCEPTION 'জমা দেওয়া টাকার পরিমাণ নির্ধারিত ফি-র সঙ্গে মিলছে না।'; END IF;
      -- নিচের একটি লাইনই যথেষ্ট: ট্রিগার নিবন্ধন অনুমোদন + নতুন QR টিকিট + অডিট করে দেয়
      UPDATE payments SET status = 'verified', reviewed_at = now(), reviewed_by = (s->>'id')::uuid,
        rejection_reason = '' WHERE registration_id = r.id;

    WHEN 'registration.reject' THEN
      IF EXISTS (SELECT 1 FROM gate_checkins WHERE registration_id = r.id) THEN
        RAISE EXCEPTION 'চেক-ইন হওয়া টিকিট প্রত্যাখ্যান করা যাবে না।'; END IF;
      IF length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'প্রত্যাখ্যানের কারণ লিখুন।'; END IF;
      UPDATE payments SET status = 'rejected', rejection_reason = btrim(p_payload->>'reason'),
        reviewed_by = (s->>'id')::uuid, reviewed_at = now() WHERE registration_id = r.id;

    WHEN 'payment.refund' THEN
      SELECT * INTO p FROM payments WHERE registration_id = r.id;
      IF p.status <> 'verified' THEN RAISE EXCEPTION 'শুধু অনুমোদিত (verified) পেমেন্ট রিফান্ড করা যায়।'; END IF;
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন রিফান্ড করা যাবে না।'; END IF;
      amt := coalesce(nullif(p_payload->>'amount', '')::numeric, r.total_fee);
      IF amt <= 0 THEN RAISE EXCEPTION 'রিফান্ডের টাকা শূন্যের বেশি হতে হবে।'; END IF;
      IF length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'রিফান্ডের কারণ লিখুন।'; END IF;
      INSERT INTO refunds(event_id, payment_id, registration_id, amount, reason_bn, method, reference, marked_by)
      VALUES (e.id, p.id, r.id, amt, btrim(p_payload->>'reason'), coalesce(p_payload->>'method', p.provider),
              coalesce(btrim(p_payload->>'reference'), ''), (s->>'id')::uuid);
      result := jsonb_build_object('ok', true, 'refunded', amt);

    WHEN 'registration.remove' THEN
      UPDATE registrations SET status = 'cancelled', archived_at = now() WHERE id = r.id;
      UPDATE participants SET archived_at = now() WHERE id = r.participant_id;
      UPDATE gate_tickets SET status = 'revoked', revoked_at = now() WHERE registration_id = r.id AND status = 'active';

    WHEN 'registration.restore' THEN
      UPDATE registrations SET archived_at = NULL, status = 'pending' WHERE id = r.id;
      UPDATE participants SET archived_at = NULL WHERE id = r.participant_id;

    WHEN 'registration.reissue' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাতিল নিবন্ধনের লিংক তৈরি করা যাবে না।'; END IF;
      secret := random_token();
      UPDATE user_links SET tracking_key_hash = key_hash(secret), updated_at = now()
      WHERE registration_id = r.id;
      result := jsonb_build_object('trackingKey', secret);

    WHEN 'formField.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      -- মূল (base) ঘর হলে কী ও ধরন বদলানো যায় না; লক করা ঘর লুকানো/ঐচ্ছিকও করা যায় না
      IF EXISTS (SELECT 1 FROM content_form_fields x WHERE x.id = obj_id AND x.event_id = e.id AND x.is_base) THEN
        UPDATE content_form_fields SET
          label_bn = coalesce(nullif(btrim(p_payload->>'label'), ''), label_bn),
          placeholder = coalesce(p_payload->>'placeholder', placeholder),
          help_bn = coalesce(p_payload->>'help', help_bn),
          step = coalesce((p_payload->>'step')::smallint, step),
          max_length = coalesce((p_payload->>'maxLength')::integer, max_length),
          is_required = CASE WHEN is_locked THEN is_required ELSE coalesce((p_payload->>'required')::boolean, is_required) END,
          is_visible  = CASE WHEN is_locked THEN is_visible  ELSE coalesce((p_payload->>'visible')::boolean, is_visible) END,
          sort_order = coalesce((p_payload->>'order')::integer, sort_order),
          updated_at = now()
        WHERE id = obj_id AND event_id = e.id;
      ELSE
        INSERT INTO content_form_fields(id, event_id, field_key, label_bn, kind, options, placeholder, help_bn,
            max_length, is_required, is_visible, step, sort_order)
        VALUES (obj_id, e.id, p_payload->>'key', btrim(p_payload->>'label'), p_payload->>'kind',
                coalesce(p_payload->'options', '[]'::jsonb), coalesce(p_payload->>'placeholder', ''),
                coalesce(p_payload->>'help', ''), coalesce((p_payload->>'maxLength')::integer, 200),
                coalesce((p_payload->>'required')::boolean, false), coalesce((p_payload->>'visible')::boolean, true),
                coalesce((p_payload->>'step')::smallint, 2), coalesce((p_payload->>'order')::integer, 50))
        ON CONFLICT (id) DO UPDATE SET field_key = excluded.field_key, label_bn = excluded.label_bn,
          kind = excluded.kind, options = excluded.options, placeholder = excluded.placeholder,
          help_bn = excluded.help_bn, max_length = excluded.max_length, is_required = excluded.is_required,
          is_visible = excluded.is_visible, step = excluded.step, sort_order = excluded.sort_order, updated_at = now()
        WHERE content_form_fields.event_id = e.id;
      END IF;
      meta := jsonb_build_object('label', btrim(p_payload->>'label'), 'kind', p_payload->>'kind');

    WHEN 'navItem.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content_nav_items(id, event_id, kind, label_bn, target, sort_order, is_visible)
      VALUES (obj_id, e.id, p_payload->>'kind', btrim(p_payload->>'label'), coalesce(btrim(p_payload->>'target'), ''),
              coalesce((p_payload->>'order')::integer, 50), coalesce((p_payload->>'visible')::boolean, true))
      ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, label_bn = excluded.label_bn, target = excluded.target,
        sort_order = excluded.sort_order, is_visible = excluded.is_visible, updated_at = now()
      WHERE content_nav_items.event_id = e.id;
      meta := jsonb_build_object('label', btrim(p_payload->>'label'));

    WHEN 'navItem.delete' THEN
      DELETE FROM content_nav_items WHERE id = obj_id AND event_id = e.id;

    WHEN 'navItem.move' THEN
      UPDATE content_nav_items SET sort_order = (p_payload->>'order')::integer, updated_at = now()
      WHERE id = obj_id AND event_id = e.id;

    WHEN 'formText.save' THEN
      INSERT INTO content_form_texts(event_id, text_key, value_bn)
      VALUES (e.id, p_payload->>'key', coalesce(btrim(p_payload->>'value'), ''))
      ON CONFLICT (event_id, text_key) DO UPDATE SET value_bn = excluded.value_bn, updated_at = now();

    WHEN 'formField.reorder' THEN
      -- ড্র্যাগ করে সাজানোর পর এক কলেই সব ঘরের নতুন ক্রম
      UPDATE content_form_fields cff SET sort_order = (item->>'order')::integer, updated_at = now()
      FROM jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item
      WHERE cff.id = (item->>'id')::uuid AND cff.event_id = e.id;
      meta := jsonb_build_object('count', coalesce(jsonb_array_length(p_payload->'items'), 0));

    WHEN 'navItem.reorder' THEN
      UPDATE content_nav_items cni SET sort_order = (item->>'order')::integer, updated_at = now()
      FROM jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item
      WHERE cni.id = (item->>'id')::uuid AND cni.event_id = e.id;
      meta := jsonb_build_object('count', coalesce(jsonb_array_length(p_payload->'items'), 0));

    WHEN 'formField.delete' THEN
      IF EXISTS (SELECT 1 FROM content_form_fields x WHERE x.id = obj_id AND x.event_id = e.id AND x.is_base) THEN
        RAISE EXCEPTION 'ফর্মের মূল ঘর মুছে ফেলা যায় না — চাইলে “লুকাও” দিয়ে ফর্ম থেকে সরান।';
      END IF;
      DELETE FROM content_form_fields WHERE id = obj_id AND event_id = e.id;
      meta := jsonb_build_object('deleted', true);

    WHEN 'formField.move' THEN
      UPDATE content_form_fields SET sort_order = (p_payload->>'order')::integer, updated_at = now()
      WHERE id = obj_id AND event_id = e.id;

    WHEN 'contact.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO event_contacts(id, event_id, label, mobile, note_bn, sort_order, is_active)
      VALUES (obj_id, e.id, btrim(p_payload->>'label'), normalize_mobile(p_payload->>'mobile'),
              coalesce(p_payload->>'note', ''), (p_payload->>'order')::integer, coalesce((p_payload->>'active')::boolean, true))
      ON CONFLICT (id) DO UPDATE SET label = excluded.label, mobile = excluded.mobile, note_bn = excluded.note_bn,
        sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
      WHERE event_contacts.event_id = e.id;

    WHEN 'contact.delete' THEN
      DELETE FROM event_contacts WHERE id = obj_id AND event_id = e.id;

    WHEN 'setting.save' THEN
      INSERT INTO database_settings(key, value, note_bn)
      VALUES (p_payload->>'key', coalesce(p_payload->'value', 'true'::jsonb), coalesce(p_payload->>'note', ''))
      ON CONFLICT (key) DO UPDATE SET value = excluded.value,
        note_bn = CASE WHEN excluded.note_bn = '' THEN database_settings.note_bn ELSE excluded.note_bn END;

    WHEN 'device.update' THEN
      IF p_payload->>'status' NOT IN ('approved', 'revoked') THEN RAISE EXCEPTION 'ডিভাইসের অনুমতি সঠিক নয়।'; END IF;
      UPDATE admin_devices SET status = p_payload->>'status', approved_by = (s->>'id')::uuid
      WHERE id = obj_id AND event_id = e.id;

    ELSE RAISE EXCEPTION 'অজানা অ্যাডমিন অ্যাকশন।';
  END CASE;

  PERFORM log_action(e.id, p_action, coalesce(obj_id, e.id), meta);
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল, ট্রানজেকশন আইডি অথবা সেকশন কী আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.admin_mutate(text, jsonb) IS 'অ্যাডমিনের সব পরিবর্তন এক দরজায়: ইভেন্ট, ফি, সেকশন, সময়সূচি, নম্বর, যোগাযোগ, নিবন্ধন ফর্মের ঘর (যোগ/বদল/মুছে ফেলা/ক্রম), নিবন্ধন সম্পাদনা, অনুমোদন, প্রত্যাখ্যান, রিফান্ড, বাদ দেওয়া ও ডিভাইস অনুমোদন।';

-- ── পরিচয়-হিসাব ও পাসওয়ার্ড রিসেট (লগইন ছাড়াও ডাকা যায়) ────────
CREATE OR REPLACE FUNCTION public.log_login(p_email text, p_ok boolean, p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid; last_at timestamptz;
BEGIN
  IF p_email IS NULL OR length(btrim(p_email)) NOT BETWEEN 5 AND 200 THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT user_id, created_at INTO uid, last_at FROM admin_login_events
   WHERE lower(email) = lower(btrim(p_email)) ORDER BY created_at DESC LIMIT 1;
  IF last_at IS NOT NULL AND last_at > now() - interval '5 seconds' THEN RETURN jsonb_build_object('ok', true, 'skipped', true); END IF;

  INSERT INTO admin_login_events(email, user_id, succeeded, note_bn)
  VALUES (lower(btrim(p_email)), uid, p_ok, coalesce(p_note, ''));

  UPDATE admin_users SET last_login_at = CASE WHEN p_ok THEN now() ELSE last_login_at END,
         login_count = login_count + CASE WHEN p_ok THEN 1 ELSE 0 END,
         failed_logins = failed_logins + CASE WHEN p_ok THEN 0 ELSE 1 END
   WHERE lower(email) = lower(btrim(p_email));
  RETURN jsonb_build_object('ok', true);
END $$;
COMMENT ON FUNCTION public.log_login(text, boolean, text) IS '"কে কখন লগইন করল / ব্যর্থ হলো" — admin_login_events-এ লেখে ও admin_users-এ গণনা বাড়ায়।';

CREATE OR REPLACE FUNCTION public.request_password_reset(p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE mail text := lower(btrim(coalesce(p_email, ''))); known boolean; recent integer;
BEGIN
  IF length(mail) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION 'সঠিক ইমেইল ঠিকানা দিন।'; END IF;
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = mail) INTO known;
  SELECT count(*) INTO recent FROM admin_password_resets
   WHERE email = mail AND requested_at > now() - interval '2 minutes';

  INSERT INTO admin_password_resets(email, user_id, status, note_bn)
  SELECT mail, (SELECT id FROM auth.users WHERE lower(email) = mail),
         CASE WHEN NOT known THEN 'unknown_email' WHEN recent >= 3 THEN 'rate_limited' ELSE 'email_sent' END,
         CASE WHEN NOT known THEN 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই; বাইরে একই বার্তা দেখানো হয় (তথ্য ফাঁস নয়)।'
              WHEN recent >= 3 THEN 'খুব বেশি অনুরোধ — কিছুক্ষণ পরে আবার চেষ্টা করুন।'
              ELSE 'Supabase Auth রিসেট-ইমেইল পাঠানোর অনুরোধ পেয়েছে।' END;

  IF known AND recent < 3 THEN
    INSERT INTO admin_email_outbox(kind, to_email, subject_bn, status, note_bn)
    VALUES ('password_reset', mail, 'Rangpur SSC 96 — পাসওয়ার্ড রিসেট লিংক', 'queued',
            'Supabase Auth-এর ডিফল্ট ইমেইল সেবা পাঠাবে (ফ্রি টিয়ারে ঘণ্টায় সীমিত সংখ্যক)।');
  END IF;

  -- বাইরে সবসময় একই উত্তর: ইমেইল আছে কি নেই তা কেউ বুঝতে পারে না।
  RETURN jsonb_build_object('ok', true,
    'message', 'আপনার ইমেইলে থাকলে রিসেট লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।');
END $$;
COMMENT ON FUNCTION public.request_password_reset(text) IS '"পাসওয়ার্ড ভুলে গেছি" — ইমেইল আছে কি না তা ফাঁস না করে রিসেট-ইমেইল পাঠায় ও হিসাব রাখে।';

CREATE OR REPLACE FUNCTION public.complete_password_reset(p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n integer;
BEGIN
  -- রিসেট-লিংক কাজ করার পরেই ডাকা হয় (টোকেনধারী প্রমাণ করেছেন)
  UPDATE admin_password_resets SET status = 'completed', completed_at = now()
   WHERE id = (SELECT id FROM admin_password_resets
               WHERE lower(email) = lower(btrim(coalesce(p_email, '')))
               ORDER BY requested_at DESC LIMIT 1)
     AND status <> 'completed';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'marked', n);
END $$;
COMMENT ON FUNCTION public.complete_password_reset(text) IS 'নতুন পাসওয়ার্ড সফলভাবে বসলে admin_password_resets-এ "completed" লেখে — কে কখন পাসওয়ার্ড বদলাল তা হিসাবে থাকে।';

CREATE OR REPLACE FUNCTION public.guide_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM require_role(true);
  RETURN (SELECT data FROM guide_overview);
END $$;
COMMENT ON FUNCTION public.guide_overview() IS 'ডেটাবেসের গঠন-বর্ণনা: ৭টি স্কিমা, ২৫টি টেবিল, সব সম্পর্ক, ১৫টি কার্য-প্রবাহ ও ফাংশনের তালিকা। শুধু অ্যাডমিন।';

-- ── ফোন ও টিকিট (গেট) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_device(p_label text, p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE e uuid; s jsonb; did uuid; role text;
BEGIN
  s := require_role(); role := s->>'role'; e := event_id();
  IF p_token !~ '^[a-f0-9]{64}$' OR length(btrim(p_label)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'ডিভাইসের পরিচয় সঠিক নয়।'; END IF;
  INSERT INTO admin_devices(event_id, user_id, label, token_hash, status, approved_by)
  VALUES (e, (s->>'id')::uuid, btrim(p_label), key_hash(p_token),
          CASE WHEN role = 'admin' THEN 'approved' ELSE 'pending' END,
          CASE WHEN role = 'admin' THEN (s->>'id')::uuid ELSE NULL END)
  ON CONFLICT (event_id, user_id, token_hash) DO NOTHING RETURNING id INTO did;
  IF did IS NOT NULL THEN
    PERFORM log_action(e, 'device.register', did);
  ELSE
    SELECT id INTO did FROM admin_devices
     WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = key_hash(p_token);
  END IF;
  RETURN device_json(did);
END $$;
COMMENT ON FUNCTION public.register_device(text, text) IS 'গেটের ফোন/ব্রাউজার নিবন্ধন করে — অ্যাডমিনের ফোন সঙ্গে সঙ্গে অনুমোদিত, স্টাফের ফোন অ্যাডমিনের অনুমোদনের অপেক্ষায়।';

CREATE OR REPLACE FUNCTION public.device_state(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE did uuid; s jsonb;
BEGIN
  s := require_role();
  SELECT d.id INTO did FROM admin_devices d JOIN event_events e ON e.id = d.event_id
   WHERE e.slug = 'rangpur-ssc96' AND d.user_id = (s->>'id')::uuid AND d.token_hash = key_hash(p_token);
  RETURN device_json(did);
END $$;
COMMENT ON FUNCTION public.device_state(text) IS 'এই ব্রাউজার/ফোনটি চেক-ইনের জন্য অনুমোদিত কি না তা জানায়।';

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
    'school', u.school_name, 'people', c.group_size, 'spouse', r.spouse_count, 'children', r.children_count,
    'checkedInAt', c.checked_in_at);
END $$;
COMMENT ON FUNCTION public.check_in(text, text) IS 'গেটে QR/টিকিট নম্বর মিলিয়ে চেক-ইন করে; এক নিবন্ধনে একবারই — দ্বিতীয়বার স্ক্যানে "আগেই হয়েছে" জানায়।';

-- ── অনুমতির তালিকা (কে কোন দরজা দিয়ে ঢুকতে পারে) ─────────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_site(), public.submit_registration(jsonb), public.ticket_status(text),
  public.log_login(text, boolean, text), public.request_password_reset(text),
  public.complete_password_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_identity(), public.admin_overview(), public.admin_mutate(text, jsonb),
  public.register_device(text, text), public.device_state(text), public.check_in(text, text),
  public.guide_overview() TO authenticated;

COMMIT;
