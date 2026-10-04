-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১০ | schema: public — অ্যাপের একমাত্র দরজা (RPC)
-- বাইরের কেউ সরাসরি কোনো টেবিল পড়তে/লিখতে পারে না। শুধু এই কয়টি
-- ফাংশনই দরজা — প্রতিটির অনুমতি আলাদা করে দেওয়া।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = pg_catalog, public;

-- ── সাধারণ ব্যবহারকারীর (লগইন ছাড়া) দরজা ─────────────────────────
CREATE OR REPLACE FUNCTION public.public_site() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, event, content AS $$
DECLARE e event.events;
BEGIN
  SELECT * INTO e FROM event.events WHERE slug = 'rangpur-ssc96';
  IF e.id IS NULL THEN RAISE EXCEPTION 'আগে 20_seed.sql চালান।'; END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'name', e.name, 'tagline', e.tagline, 'dateLabel', e.date_label,
      'isDummyDate', e.is_dummy_date, 'venue', e.venue, 'city', e.city, 'venueEnglish', e.venue_english,
      'registrationOpen', e.registration_open),
    'fees', (SELECT jsonb_object_agg(kind, amount) FROM event.fees WHERE event_id = e.id),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn) ORDER BY sort_order)
      FROM event.contacts WHERE event_id = e.id AND is_active), '[]'::jsonb),
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
      'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content.sections WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
      'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content.schedule WHERE event_id = e.id AND is_visible), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
      'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment.accounts WHERE event_id = e.id AND is_active), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.public_site() IS 'পাবলিক পেজের সব তথ্য: অনুষ্ঠান, ফি, যোগাযোগ নম্বর, সেকশন, সময়সূচি ও Send Money নম্বর। লগইন লাগে না।';

CREATE OR REPLACE FUNCTION public.submit_registration(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, event, content, people, money AS $$
DECLARE e event.events; a payment.accounts; f jsonb; u jsonb := p_data->'participant'; p jsonb := p_data->'payment';
        rid uuid; uid uuid; r registration.registrations; access_key text; spouse integer; children integer;
BEGIN
  SELECT * INTO e FROM event.events WHERE slug = 'rangpur-ssc96' FOR SHARE;
  IF e.id IS NULL OR NOT e.registration_open THEN RAISE EXCEPTION 'নিবন্ধন আপাতত বন্ধ আছে।'; END IF;
  IF coalesce((p_data->>'consent')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'শর্তে সম্মতি প্রয়োজন।'; END IF;
  spouse := (p_data->>'spouse')::integer; children := (p_data->>'children')::integer;
  IF spouse IS NULL OR children IS NULL OR spouse NOT BETWEEN 0 AND 1 OR children NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'পরিবারের সদস্যসংখ্যা সঠিক নয়।'; END IF;
  IF EXISTS (SELECT 1 FROM registration.participants WHERE event_id = e.id AND mobile = database.normalize_mobile(u->>'mobile') AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'এই মোবাইল নম্বরে ইতিমধ্যে নিবন্ধন আছে। গোপন টিকিটের লিংক ব্যবহার করুন।'; END IF;
  SELECT * INTO a FROM payment.accounts
   WHERE id = (p->>'accountId')::uuid AND event_id = e.id AND provider = p->>'provider' AND is_active;
  IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;

  SELECT jsonb_object_agg(kind, amount) INTO f FROM event.fees WHERE event_id = e.id;
  INSERT INTO registration.participants(event_id, name, school_name, ssc_roll, ssc_registration, mobile, current_location, tshirt_size)
  VALUES (e.id, btrim(u->>'name'), btrim(u->>'school'), btrim(u->>'sscRoll'), coalesce(btrim(u->>'sscRegistration'), ''),
          database.normalize_mobile(u->>'mobile'), btrim(u->>'location'), u->>'tshirt')
  RETURNING id INTO uid;

  INSERT INTO registration.registrations(event_id, participant_id, spouse_count, children_count, food_preference, notes,
      fee_friend, fee_spouse, fee_child)
  VALUES (e.id, uid, spouse, children, p_data->>'food', coalesce(p_data->>'notes', ''),
          (f->>'friend')::numeric, (f->>'spouse')::numeric, (f->>'child')::numeric)
  RETURNING * INTO r;

  rid := r.id;
  IF (p->>'amount')::numeric IS DISTINCT FROM r.total_fee THEN
    RAISE EXCEPTION 'ফি পরিবর্তিত হয়েছে বা টাকার পরিমাণ মেলেনি। সঠিক ফি যাচাই করুন।'; END IF;

  INSERT INTO payment.payments(event_id, registration_id, account_id, provider, collector_name_snapshot,
      collector_mobile_snapshot, sender_mobile, transaction_id, submitted_amount)
  VALUES (e.id, rid, a.id, a.provider, a.collector_name, a.mobile, database.normalize_mobile(p->>'senderMobile'),
          btrim(p->>'transactionId'), (p->>'amount')::numeric);

  access_key := database.random_token();
  INSERT INTO registration.links(registration_id, tracking_key_hash) VALUES (rid, database.key_hash(access_key));
  PERFORM database.log_action(e.id, 'registration.created', rid);
  RETURN jsonb_build_object('registration', database.registration_json(rid), 'trackingKey', access_key);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল নম্বর অথবা ট্রানজেকশন আইডি আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.submit_registration(jsonb) IS 'নতুন নিবন্ধন জমা নেয়: অংশগ্রহণকারী + পরিবারের সংখ্যা + পেমেন্ট রেকর্ড + গোপন ট্র্যাকিং লিংক। অবস্থা থাকে pending।';

CREATE OR REPLACE FUNCTION public.ticket_status(p_tracking_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, registration AS $$
DECLARE rid uuid;
BEGIN
  IF p_tracking_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'সঠিক গোপন লিংক বা রিকভারি কোড দিন।'; END IF;
  SELECT a.registration_id INTO rid FROM registration.links a
    JOIN registration.registrations r ON r.id = a.registration_id
   WHERE a.tracking_key_hash = database.key_hash(p_tracking_key) AND r.archived_at IS NULL;
  IF rid IS NULL THEN RAISE EXCEPTION 'নিবন্ধন পাওয়া যায়নি বা বাতিল হয়েছে।'; END IF;
  RETURN database.registration_json(rid, true);
END $$;
COMMENT ON FUNCTION public.ticket_status(text) IS 'গোপন লিংকের কী দিয়ে নিজের নিবন্ধন ও QR টিকিট দেখায় — ফোন নম্বর দিয়ে অন্যের টিকিট দেখা যায় না।';

-- ── স্টাফ/অ্যাডমিনের দরজা ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_identity() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, gate AS $$
DECLARE s jsonb;
BEGIN
  s := database.require_role();
  RETURN jsonb_build_object('id', s->>'id', 'name', s->>'name', 'role', s->>'role');
END $$;
COMMENT ON FUNCTION public.staff_identity() IS 'লগইন করা স্টাফ নিজের পরিচয় ও ভূমিকা (admin/scanner) জানতে পারে।';

CREATE OR REPLACE FUNCTION public.admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, event, content, people, ops AS $$
DECLARE e event.events; site jsonb;
BEGIN
  PERFORM database.require_role(true);
  SELECT * INTO e FROM event.events WHERE slug = 'rangpur-ssc96';
  site := public.public_site();
  RETURN site || jsonb_build_object(
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'key', section_key, 'title', title, 'subtitle', subtitle,
        'body', body, 'imageUrl', image_url, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content.sections WHERE event_id = e.id), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'time', to_char(start_time, 'HH24:MI'), 'title', title,
        'note', note, 'period', period, 'order', sort_order, 'visible', is_visible) ORDER BY sort_order)
      FROM content.schedule WHERE event_id = e.id), '[]'::jsonb),
    'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'provider', provider, 'name', collector_name,
        'mobile', mobile, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM payment.accounts WHERE event_id = e.id), '[]'::jsonb),
    'contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'label', label, 'mobile', mobile, 'note', note_bn, 'order', sort_order, 'active', is_active) ORDER BY sort_order)
      FROM event.contacts WHERE event_id = e.id), '[]'::jsonb),
    'registrations', coalesce((SELECT jsonb_agg(database.registration_json(id) ORDER BY created_at DESC)
      FROM registration.registrations WHERE event_id = e.id), '[]'::jsonb),
    'devices', coalesce((SELECT jsonb_agg(database.device_json(id) ORDER BY created_at DESC)
      FROM admin.devices WHERE event_id = e.id), '[]'::jsonb),
    'stats', database.stats(),
    'logins', coalesce((SELECT jsonb_agg(jsonb_build_object('email', email, 'ok', succeeded, 'note', note_bn, 'at', created_at)
        ORDER BY created_at DESC) FROM (SELECT * FROM admin.login_events ORDER BY created_at DESC LIMIT 20) l), '[]'::jsonb),
    'audit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'user', actor_name, 'action', action, 'recordId', record_id,
        'metadata', metadata, 'createdAt', created_at) ORDER BY created_at DESC)
      FROM (SELECT * FROM admin.audit_logs WHERE event_id = e.id ORDER BY created_at DESC LIMIT 100) a), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION public.admin_overview() IS 'অ্যাডমিন প্যানেলের সব তথ্য: সেকশন, সময়সূচি, নম্বর, নিবন্ধন, ডিভাইস, রিপোর্ট-হিসাব, লগইন-হিসাব ও অডিট-লগ। শুধু অ্যাডমিন।';

CREATE OR REPLACE FUNCTION public.admin_mutate(p_action text, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, event, content, people, money, ops AS $$
DECLARE e event.events; s jsonb; r registration.registrations; p payment.payments; a payment.accounts; acct_id uuid;
        obj_id uuid; secret text; result jsonb := '{"ok":true}'; meta jsonb := '{}'; amt numeric; reg_id uuid;
BEGIN
  s := database.require_role(true);
  SELECT * INTO e FROM event.events WHERE slug = 'rangpur-ssc96' FOR UPDATE;
  obj_id := nullif(p_payload->>'id', '')::uuid;

  IF p_action LIKE 'registration.%' OR p_action IN ('participant.save', 'payment.save', 'payment.refund') THEN
    SELECT * INTO r FROM registration.registrations WHERE id = obj_id AND event_id = e.id FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'নিবন্ধন পাওয়া যায়নি।'; END IF;
  END IF;

  CASE p_action
    WHEN 'event.save' THEN
      UPDATE event.events SET name = btrim(p_payload->>'name'), tagline = btrim(p_payload->>'tagline'),
        date_label = btrim(p_payload->>'dateLabel'), is_dummy_date = (p_payload->>'isDummyDate')::boolean,
        venue = btrim(p_payload->>'venue'), city = btrim(p_payload->>'city'),
        venue_english = btrim(p_payload->>'venueEnglish'), registration_open = (p_payload->>'registrationOpen')::boolean
      WHERE id = e.id;

    WHEN 'fees.save' THEN
      INSERT INTO event.fees(event_id, kind, amount)
      SELECT e.id, key, value::numeric FROM jsonb_each_text(p_payload) WHERE key IN ('friend', 'spouse', 'child')
      ON CONFLICT (event_id, kind) DO UPDATE SET amount = excluded.amount, updated_at = now();

    WHEN 'section.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content.sections(id, event_id, section_key, title, subtitle, body, image_url, sort_order, is_visible)
      VALUES (obj_id, e.id, p_payload->>'key', btrim(p_payload->>'title'), coalesce(p_payload->>'subtitle', ''),
              coalesce(p_payload->>'body', ''), coalesce(p_payload->>'imageUrl', ''), (p_payload->>'order')::integer,
              (p_payload->>'visible')::boolean)
      ON CONFLICT (id) DO UPDATE SET section_key = excluded.section_key, title = excluded.title, subtitle = excluded.subtitle,
        body = excluded.body, image_url = excluded.image_url, sort_order = excluded.sort_order,
        is_visible = excluded.is_visible, updated_at = now() WHERE content.sections.event_id = e.id;

    WHEN 'section.delete' THEN DELETE FROM content.sections WHERE id = obj_id AND event_id = e.id;

    WHEN 'schedule.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO content.schedule(id, event_id, start_time, period, title, note, sort_order, is_visible)
      VALUES (obj_id, e.id, (p_payload->>'time')::time, p_payload->>'period', btrim(p_payload->>'title'),
              coalesce(p_payload->>'note', ''), (p_payload->>'order')::integer, (p_payload->>'visible')::boolean)
      ON CONFLICT (id) DO UPDATE SET start_time = excluded.start_time, period = excluded.period, title = excluded.title,
        note = excluded.note, sort_order = excluded.sort_order, is_visible = excluded.is_visible, updated_at = now()
      WHERE content.schedule.event_id = e.id;

    WHEN 'schedule.delete' THEN DELETE FROM content.schedule WHERE id = obj_id AND event_id = e.id;

    WHEN 'account.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO payment.accounts(id, event_id, provider, collector_name, mobile, sort_order, is_active)
      VALUES (obj_id, e.id, p_payload->>'provider', btrim(p_payload->>'name'), database.normalize_mobile(p_payload->>'mobile'),
              (p_payload->>'order')::integer, (p_payload->>'active')::boolean)
      ON CONFLICT (id) DO UPDATE SET provider = excluded.provider, collector_name = excluded.collector_name,
        mobile = excluded.mobile, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
      WHERE payment.accounts.event_id = e.id;

    WHEN 'account.delete' THEN
      UPDATE payment.accounts SET is_active = false, updated_at = now() WHERE id = obj_id AND event_id = e.id;

    WHEN 'participant.save' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন পরিবর্তন করা যাবে না।'; END IF;
      UPDATE registration.participants SET name = btrim(p_payload->'participant'->>'name'),
        school_name = btrim(p_payload->'participant'->>'school'), ssc_roll = btrim(p_payload->'participant'->>'sscRoll'),
        ssc_registration = coalesce(p_payload->'participant'->>'sscRegistration', ''),
        mobile = database.normalize_mobile(p_payload->'participant'->>'mobile'),
        current_location = btrim(p_payload->'participant'->>'location'),
        tshirt_size = p_payload->'participant'->>'tshirt'
      WHERE id = r.participant_id;
      UPDATE registration.registrations SET spouse_count = (p_payload->>'spouse')::integer,
        children_count = (p_payload->>'children')::integer, food_preference = p_payload->>'food',
        notes = coalesce(p_payload->>'notes', '') WHERE id = r.id;

    WHEN 'payment.save' THEN
      IF r.status = 'approved' OR r.archived_at IS NOT NULL
         OR EXISTS (SELECT 1 FROM gate.checkins WHERE registration_id = r.id) THEN
        RAISE EXCEPTION 'অনুমোদিত বা বাতিল পেমেন্ট সরাসরি বদলানো যাবে না।'; END IF;
      SELECT * INTO a FROM payment.accounts
       WHERE id = (p_payload->>'accountId')::uuid AND provider = p_payload->>'provider' AND event_id = e.id AND is_active;
      IF a.id IS NULL THEN RAISE EXCEPTION 'সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।'; END IF;
      SELECT * INTO p FROM payment.payments WHERE registration_id = r.id;
      meta := jsonb_build_object('previousPayment', to_jsonb(p));
      UPDATE payment.payments SET provider = a.provider, account_id = a.id, collector_name_snapshot = a.collector_name,
        collector_mobile_snapshot = a.mobile, sender_mobile = database.normalize_mobile(p_payload->>'senderMobile'),
        transaction_id = btrim(p_payload->>'transactionId'), submitted_amount = (p_payload->>'amount')::numeric,
        status = 'pending', reviewed_at = NULL, reviewed_by = NULL, rejection_reason = ''
      WHERE registration_id = r.id;
      UPDATE registration.registrations SET status = 'pending' WHERE id = r.id;

    WHEN 'registration.approve' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন অনুমোদন করা যাবে না।'; END IF;
      IF r.status = 'refunded' THEN RAISE EXCEPTION 'রিফান্ড হওয়া নিবন্ধন আবার অনুমোদন করা যায় না।'; END IF;
      IF coalesce((p_payload->>'verified')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'নিজের লেনদেনের রেকর্ড মিলিয়ে নিশ্চিত করুন।'; END IF;
      IF r.status = 'approved' THEN RETURN result; END IF;
      SELECT * INTO p FROM payment.payments WHERE registration_id = r.id;
      IF p.submitted_amount IS DISTINCT FROM r.total_fee THEN
        RAISE EXCEPTION 'জমা দেওয়া টাকার পরিমাণ নির্ধারিত ফি-র সঙ্গে মিলছে না।'; END IF;
      -- নিচের একটি লাইনই যথেষ্ট: ট্রিগার নিবন্ধন অনুমোদন + নতুন QR টিকিট + অডিট করে দেয়
      UPDATE payment.payments SET status = 'verified', reviewed_at = now(), reviewed_by = (s->>'id')::uuid,
        rejection_reason = '' WHERE registration_id = r.id;

    WHEN 'registration.reject' THEN
      IF EXISTS (SELECT 1 FROM gate.checkins WHERE registration_id = r.id) THEN
        RAISE EXCEPTION 'চেক-ইন হওয়া টিকিট প্রত্যাখ্যান করা যাবে না।'; END IF;
      IF length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'প্রত্যাখ্যানের কারণ লিখুন।'; END IF;
      UPDATE payment.payments SET status = 'rejected', rejection_reason = btrim(p_payload->>'reason'),
        reviewed_by = (s->>'id')::uuid, reviewed_at = now() WHERE registration_id = r.id;

    WHEN 'payment.refund' THEN
      SELECT * INTO p FROM payment.payments WHERE registration_id = r.id;
      IF p.status <> 'verified' THEN RAISE EXCEPTION 'শুধু অনুমোদিত (verified) পেমেন্ট রিফান্ড করা যায়।'; END IF;
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধন রিফান্ড করা যাবে না।'; END IF;
      amt := coalesce(nullif(p_payload->>'amount', '')::numeric, r.total_fee);
      IF amt <= 0 THEN RAISE EXCEPTION 'রিফান্ডের টাকা শূন্যের বেশি হতে হবে।'; END IF;
      IF length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'রিফান্ডের কারণ লিখুন।'; END IF;
      INSERT INTO payment.refunds(event_id, payment_id, registration_id, amount, reason_bn, method, reference, marked_by)
      VALUES (e.id, p.id, r.id, amt, btrim(p_payload->>'reason'), coalesce(p_payload->>'method', p.provider),
              coalesce(btrim(p_payload->>'reference'), ''), (s->>'id')::uuid);
      result := jsonb_build_object('ok', true, 'refunded', amt);

    WHEN 'registration.remove' THEN
      UPDATE registration.registrations SET status = 'cancelled', archived_at = now() WHERE id = r.id;
      UPDATE registration.participants SET archived_at = now() WHERE id = r.participant_id;
      UPDATE gate.tickets SET status = 'revoked', revoked_at = now() WHERE registration_id = r.id AND status = 'active';

    WHEN 'registration.restore' THEN
      UPDATE registration.registrations SET archived_at = NULL, status = 'pending' WHERE id = r.id;
      UPDATE registration.participants SET archived_at = NULL WHERE id = r.participant_id;

    WHEN 'registration.reissue' THEN
      IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'বাতিল নিবন্ধনের লিংক তৈরি করা যাবে না।'; END IF;
      secret := database.random_token();
      UPDATE registration.links SET tracking_key_hash = database.key_hash(secret), updated_at = now()
      WHERE registration_id = r.id;
      result := jsonb_build_object('trackingKey', secret);

    WHEN 'contact.save' THEN
      obj_id := coalesce(obj_id, gen_random_uuid());
      INSERT INTO event.contacts(id, event_id, label, mobile, note_bn, sort_order, is_active)
      VALUES (obj_id, e.id, btrim(p_payload->>'label'), database.normalize_mobile(p_payload->>'mobile'),
              coalesce(p_payload->>'note', ''), (p_payload->>'order')::integer, coalesce((p_payload->>'active')::boolean, true))
      ON CONFLICT (id) DO UPDATE SET label = excluded.label, mobile = excluded.mobile, note_bn = excluded.note_bn,
        sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
      WHERE event.contacts.event_id = e.id;

    WHEN 'contact.delete' THEN
      DELETE FROM event.contacts WHERE id = obj_id AND event_id = e.id;

    WHEN 'setting.save' THEN
      INSERT INTO database.settings(key, value, note_bn)
      VALUES (p_payload->>'key', coalesce(p_payload->'value', 'true'::jsonb), coalesce(p_payload->>'note', ''))
      ON CONFLICT (key) DO UPDATE SET value = excluded.value,
        note_bn = CASE WHEN excluded.note_bn = '' THEN database.settings.note_bn ELSE excluded.note_bn END;

    WHEN 'device.update' THEN
      IF p_payload->>'status' NOT IN ('approved', 'revoked') THEN RAISE EXCEPTION 'ডিভাইসের অনুমতি সঠিক নয়।'; END IF;
      UPDATE admin.devices SET status = p_payload->>'status', approved_by = (s->>'id')::uuid
      WHERE id = obj_id AND event_id = e.id;

    ELSE RAISE EXCEPTION 'অজানা অ্যাডমিন অ্যাকশন।';
  END CASE;

  PERFORM database.log_action(e.id, p_action, coalesce(obj_id, e.id), meta);
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'মোবাইল, ট্রানজেকশন আইডি অথবা সেকশন কী আগে ব্যবহৃত হয়েছে।';
END $$;
COMMENT ON FUNCTION public.admin_mutate(text, jsonb) IS 'অ্যাডমিনের সব পরিবর্তন এক দরজায়: ইভেন্ট, ফি, সেকশন, সময়সূচি, নম্বর, যোগাযোগ, নিবন্ধন সম্পাদনা, অনুমোদন, প্রত্যাখ্যান, রিফান্ড, বাদ দেওয়া ও ডিভাইস অনুমোদন।';

-- ── পরিচয়-হিসাব ও পাসওয়ার্ড রিসেট (লগইন ছাড়াও ডাকা যায়) ────────
CREATE OR REPLACE FUNCTION public.log_login(p_email text, p_ok boolean, p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, registration AS $$
DECLARE uid uuid; last_at timestamptz;
BEGIN
  IF p_email IS NULL OR length(btrim(p_email)) NOT BETWEEN 5 AND 200 THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT user_id, created_at INTO uid, last_at FROM admin.login_events
   WHERE lower(email) = lower(btrim(p_email)) ORDER BY created_at DESC LIMIT 1;
  IF last_at IS NOT NULL AND last_at > now() - interval '5 seconds' THEN RETURN jsonb_build_object('ok', true, 'skipped', true); END IF;

  INSERT INTO admin.login_events(email, user_id, succeeded, note_bn)
  VALUES (lower(btrim(p_email)), uid, p_ok, coalesce(p_note, ''));

  UPDATE admin.admins SET last_login_at = CASE WHEN p_ok THEN now() ELSE last_login_at END,
         login_count = login_count + CASE WHEN p_ok THEN 1 ELSE 0 END,
         failed_logins = failed_logins + CASE WHEN p_ok THEN 0 ELSE 1 END
   WHERE lower(email) = lower(btrim(p_email));
  RETURN jsonb_build_object('ok', true);
END $$;
COMMENT ON FUNCTION public.log_login(text, boolean, text) IS '"কে কখন লগইন করল / ব্যর্থ হলো" — admin.login_events-এ লেখে ও admin.admins-এ গণনা বাড়ায়।';

CREATE OR REPLACE FUNCTION public.request_password_reset(p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, registration AS $$
DECLARE mail text := lower(btrim(coalesce(p_email, ''))); known boolean; recent integer;
BEGIN
  IF length(mail) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION 'সঠিক ইমেইল ঠিকানা দিন।'; END IF;
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = mail) INTO known;
  SELECT count(*) INTO recent FROM admin.password_resets
   WHERE email = mail AND requested_at > now() - interval '2 minutes';

  INSERT INTO admin.password_resets(email, user_id, status, note_bn)
  SELECT mail, (SELECT id FROM auth.users WHERE lower(email) = mail),
         CASE WHEN NOT known THEN 'unknown_email' WHEN recent >= 3 THEN 'rate_limited' ELSE 'email_sent' END,
         CASE WHEN NOT known THEN 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই; বাইরে একই বার্তা দেখানো হয় (তথ্য ফাঁস নয়)।'
              WHEN recent >= 3 THEN 'খুব বেশি অনুরোধ — কিছুক্ষণ পরে আবার চেষ্টা করুন।'
              ELSE 'Supabase Auth রিসেট-ইমেইল পাঠানোর অনুরোধ পেয়েছে।' END;

  IF known AND recent < 3 THEN
    INSERT INTO admin.email_outbox(kind, to_email, subject_bn, status, note_bn)
    VALUES ('password_reset', mail, 'Rangpur SSC 96 — পাসওয়ার্ড রিসেট লিংক', 'queued',
            'Supabase Auth-এর ডিফল্ট ইমেইল সেবা পাঠাবে (ফ্রি টিয়ারে ঘণ্টায় সীমিত সংখ্যক)।');
  END IF;

  -- বাইরে সবসময় একই উত্তর: ইমেইল আছে কি নেই তা কেউ বুঝতে পারে না।
  RETURN jsonb_build_object('ok', true,
    'message', 'আপনার ইমেইলে থাকলে রিসেট লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।');
END $$;
COMMENT ON FUNCTION public.request_password_reset(text) IS '"পাসওয়ার্ড ভুলে গেছি" — ইমেইল আছে কি না তা ফাঁস না করে রিসেট-ইমেইল পাঠায় ও হিসাব রাখে।';

CREATE OR REPLACE FUNCTION public.complete_password_reset(p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, admin AS $$
DECLARE n integer;
BEGIN
  -- রিসেট-লিংক কাজ করার পরেই ডাকা হয় (টোকেনধারী প্রমাণ করেছেন)
  UPDATE admin.password_resets SET status = 'completed', completed_at = now()
   WHERE id = (SELECT id FROM admin.password_resets
               WHERE lower(email) = lower(btrim(coalesce(p_email, '')))
               ORDER BY requested_at DESC LIMIT 1)
     AND status <> 'completed';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'marked', n);
END $$;
COMMENT ON FUNCTION public.complete_password_reset(text) IS 'নতুন পাসওয়ার্ড সফলভাবে বসলে admin.password_resets-এ "completed" লেখে — কে কখন পাসওয়ার্ড বদলাল তা হিসাবে থাকে।';

CREATE OR REPLACE FUNCTION public.guide_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, guide AS $$
BEGIN
  PERFORM database.require_role(true);
  RETURN (SELECT data FROM guide.overview);
END $$;
COMMENT ON FUNCTION public.guide_overview() IS 'ডেটাবেসের গঠন-বর্ণনা: ৭টি স্কিমা, ২৫টি টেবিল, সব সম্পর্ক, ১৫টি কার্য-প্রবাহ ও ফাংশনের তালিকা। শুধু অ্যাডমিন।';

-- ── ফোন ও টিকিট (গেট) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_device(p_label text, p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, gate AS $$
DECLARE e uuid; s jsonb; did uuid; role text;
BEGIN
  s := database.require_role(); role := s->>'role'; e := database.event_id();
  IF p_token !~ '^[a-f0-9]{64}$' OR length(btrim(p_label)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'ডিভাইসের পরিচয় সঠিক নয়।'; END IF;
  INSERT INTO admin.devices(event_id, user_id, label, token_hash, status, approved_by)
  VALUES (e, (s->>'id')::uuid, btrim(p_label), database.key_hash(p_token),
          CASE WHEN role = 'admin' THEN 'approved' ELSE 'pending' END,
          CASE WHEN role = 'admin' THEN (s->>'id')::uuid ELSE NULL END)
  ON CONFLICT (event_id, user_id, token_hash) DO NOTHING RETURNING id INTO did;
  IF did IS NOT NULL THEN
    PERFORM database.log_action(e, 'device.register', did);
  ELSE
    SELECT id INTO did FROM admin.devices
     WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = database.key_hash(p_token);
  END IF;
  RETURN database.device_json(did);
END $$;
COMMENT ON FUNCTION public.register_device(text, text) IS 'গেটের ফোন/ব্রাউজার নিবন্ধন করে — অ্যাডমিনের ফোন সঙ্গে সঙ্গে অনুমোদিত, স্টাফের ফোন অ্যাডমিনের অনুমোদনের অপেক্ষায়।';

CREATE OR REPLACE FUNCTION public.device_state(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, gate AS $$
DECLARE did uuid; s jsonb;
BEGIN
  s := database.require_role();
  SELECT d.id INTO did FROM admin.devices d JOIN event.events e ON e.id = d.event_id
   WHERE e.slug = 'rangpur-ssc96' AND d.user_id = (s->>'id')::uuid AND d.token_hash = database.key_hash(p_token);
  RETURN database.device_json(did);
END $$;
COMMENT ON FUNCTION public.device_state(text) IS 'এই ব্রাউজার/ফোনটি চেক-ইনের জন্য অনুমোদিত কি না তা জানায়।';

CREATE OR REPLACE FUNCTION public.check_in(p_input text, p_device_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, registration, payment, gate AS $$
DECLARE e uuid; s jsonb; d admin.devices; r registration.registrations; u registration.participants;
        c gate.checkins; parts text[]; inserted_id uuid; already boolean := false;
BEGIN
  s := database.require_role(); e := database.event_id();
  SELECT * INTO d FROM admin.devices
   WHERE event_id = e AND user_id = (s->>'id')::uuid AND token_hash = database.key_hash(p_device_token)
     AND status = 'approved' FOR SHARE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'এই ব্রাউজার/ডিভাইস চেক-ইনের জন্য অনুমোদিত নয়।' USING ERRCODE = '42501'; END IF;

  IF p_input LIKE 'R96:%' THEN
    parts := string_to_array(p_input, ':');
    IF array_length(parts, 1) <> 3 OR parts[2] !~ '^[0-9a-f-]{36}$' OR parts[3] !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয়।'; END IF;
    SELECT * INTO r FROM registration.registrations WHERE id = parts[2]::uuid AND event_id = e FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM gate.tickets WHERE registration_id = r.id AND qr_secret = parts[3] AND status = 'active') THEN
      RAISE EXCEPTION 'QR টিকিট সঠিক নয় বা বাতিল হয়েছে।'; END IF;
  ELSIF upper(p_input) ~ '^R96-[0-9]{5,}$' THEN
    SELECT * INTO r FROM registration.registrations WHERE ticket_number = upper(p_input) AND event_id = e FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'এই উৎসবের সঠিক QR বা টিকিট নম্বর দিন।';
  END IF;

  IF r.id IS NULL OR r.status <> 'approved' OR r.archived_at IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM payment.payments WHERE registration_id = r.id AND status = 'verified') THEN
    RAISE EXCEPTION 'টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।' USING ERRCODE = '42501'; END IF;

  INSERT INTO gate.checkins(event_id, registration_id, device_id, operator_id, group_size)
  VALUES (e, r.id, d.id, (s->>'id')::uuid, 1 + r.spouse_count + r.children_count)
  ON CONFLICT (registration_id) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN already := true; END IF;

  SELECT * INTO c FROM gate.checkins WHERE registration_id = r.id;
  SELECT * INTO u FROM registration.participants WHERE id = r.participant_id;
  RETURN jsonb_build_object('alreadyCheckedIn', already, 'ticketNumber', r.ticket_number, 'name', u.name,
    'school', u.school_name, 'people', c.group_size, 'spouse', r.spouse_count, 'children', r.children_count,
    'checkedInAt', c.checked_in_at);
END $$;
COMMENT ON FUNCTION public.check_in(text, text) IS 'গেটে QR/টিকিট নম্বর মিলিয়ে চেক-ইন করে; এক নিবন্ধনে একবারই — দ্বিতীয়বার স্ক্যানে "আগেই হয়েছে" জানায়।';

-- ── Table Editor-এ চোখে পড়ার জন্য গঠনের সংক্ষিপ্ত ভিউ ────────────
CREATE OR REPLACE VIEW public.table_map AS
SELECT t.schema_name, t.table_name, t.purpose_bn AS purpose_bn, t.written_by, t.key_columns
FROM guide.tables t ORDER BY t.schema_name, t.table_name;
COMMENT ON VIEW public.table_map IS 'সুপাবেস Table Editor-এ "public" খুললেই ২৫টি টেবিলের তালিকা ও কাজ দেখতে পাবেন। আসল টেবিল অন্য স্কিমায় (database/core/content/people/money/ops/guide)।';
REVOKE ALL ON public.table_map FROM PUBLIC, anon, authenticated;

-- ── অনুমতির তালিকা (কে কোন দরজা দিয়ে ঢুকতে পারে) ─────────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_site(), public.submit_registration(jsonb), public.ticket_status(text),
  public.log_login(text, boolean, text), public.request_password_reset(text),
  public.complete_password_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_identity(), public.admin_overview(), public.admin_mutate(text, jsonb),
  public.register_device(text, text), public.device_state(text), public.check_in(text, text),
  public.guide_overview() TO authenticated;

COMMIT;
