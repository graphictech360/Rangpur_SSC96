-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৮ | নিয়ম ও প্রতিক্রিয়া (ট্রিগার)
-- এখানেই লেখা থাকে "কিছু ঘটলে স্বয়ংক্রিয়ভাবে কী হবে":
--   • পেমেন্ট যাচাই → নিবন্ধন অনুমোদিত → QR টিকিট তৈরি → অডিট
--   • পেমেন্ট প্রত্যাখ্যান → টিকিট বাতিল
--   • রিফান্ড → টিকিট বাতিল + পেমেন্ট refunded
--   • চেক-ইন → শর্ত যাচাই → অডিট
--   • মোবাইল নম্বর → সবসময় 01XXXXXXXXX আকারে
--   • admin.admins-এ নতুন সারি → auth.users থেকে ইমেইল/নাম বসে
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = pg_catalog, public;

-- ── ১. মোবাইল নম্বর পরিষ্কার করা (লেখার আগে) ───────────────────────
CREATE OR REPLACE FUNCTION registration.normalize_participant() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, database AS $$
BEGIN NEW.mobile := database.normalize_mobile(NEW.mobile); RETURN NEW; END $$;
COMMENT ON FUNCTION registration.normalize_participant() IS 'অংশগ্রহণকারীর মোবাইল নম্বর সবসময় 01XXXXXXXXX আকারে লিখে রাখে।';

CREATE OR REPLACE FUNCTION payment.normalize_payment() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, database AS $$
BEGIN NEW.sender_mobile := database.normalize_mobile(NEW.sender_mobile); RETURN NEW; END $$;
COMMENT ON FUNCTION payment.normalize_payment() IS 'টাকা পাঠানোর নম্বরও একই আকারে সংরক্ষণ করে — যাচাই সহজ হয়।';

CREATE OR REPLACE FUNCTION content.normalize_account_mobile() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, database AS $$
BEGIN NEW.mobile := database.normalize_mobile(NEW.mobile); RETURN NEW; END $$;
COMMENT ON FUNCTION content.normalize_account_mobile() IS 'প্রকাশ্য bKash/Nagad ও যোগাযোগ নম্বরের আকার ঠিক রাখে।';

-- ── ২. নিবন্ধনের নিয়ম ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registration.guard_registration() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'বাদ দেওয়া নিবন্ধনের অবস্থা আর বদলানো যাবে না।';
  END IF;
  IF OLD.status = 'approved' AND NEW.status = 'approved'
     AND (NEW.spouse_count IS DISTINCT FROM OLD.spouse_count OR NEW.children_count IS DISTINCT FROM OLD.children_count) THEN
    RAISE EXCEPTION 'অনুমোদিত টিকিটের সদস্যসংখ্যা সরাসরি বদলানো যাবে না।';
  END IF;
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
     AND NEW.status IN ('approved', 'pending') THEN
    NEW.status := 'cancelled';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION registration.guard_registration() IS 'বাদ দেওয়া নিবন্ধন বদলানো বা অনুমোদিত টিকিটের সদস্যসংখ্যা নীরবে বদলানো আটকায়।';

-- ── ৩. টিকিটের নিয়ম (অনুমোদন ছাড়া QR চালু নয়) ────────────────────
CREATE OR REPLACE FUNCTION gate.guard_ticket() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, registration AS $$
BEGIN
  IF NEW.status = 'active' AND NOT EXISTS (
    SELECT 1 FROM registration.registrations r
    WHERE r.id = NEW.registration_id AND r.status = 'approved' AND r.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'অনুমোদিত নিবন্ধন ছাড়া QR টিকিট চালু করা যাবে না।';
  END IF;
  IF NEW.status = 'revoked' AND NEW.revoked_at IS NULL THEN NEW.revoked_at := now(); END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION gate.guard_ticket() IS 'টিকিট কেবল অনুমোদিত নিবন্ধনের জন্য চালু হতে পারে; বাতিলের সময় সময়-ছাপ বসায়।';

-- ── ৪. পেমেন্ট → নিবন্ধন → টিকিট (মূল প্রতিক্রিয়া) ────────────────
CREATE OR REPLACE FUNCTION gate.on_payment_verified() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, registration, payment, gate AS $$
DECLARE who text;
BEGIN
  UPDATE registration.registrations
     SET status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
   WHERE id = NEW.registration_id AND status <> 'approved' AND archived_at IS NULL;

  INSERT INTO gate.tickets(registration_id, qr_secret, status, issued_by)
  VALUES (NEW.registration_id, database.random_token(), 'active', auth.uid())
  ON CONFLICT (registration_id) DO UPDATE
     SET qr_secret = excluded.qr_secret, status = 'active', issued_by = excluded.issued_by,
         issued_at = now(), revoked_at = NULL;

  who := coalesce((SELECT display_name FROM admin.admins WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin.audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'payment.verified', NEW.registration_id,
          jsonb_build_object('amount', NEW.submitted_amount, 'provider', NEW.provider, 'ticketIssued', true));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION gate.on_payment_verified() IS 'পেমেন্ট verified হলে নিবন্ধন অনুমোদন করে, নতুন QR টিকিট দেয় এবং অডিট লেখে — এক ধাপেই।';

CREATE OR REPLACE FUNCTION gate.on_payment_rejected() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, registration, ops AS $$
DECLARE who text;
BEGIN
  UPDATE registration.registrations SET status = 'rejected', updated_at = now()
   WHERE id = NEW.registration_id AND archived_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM gate.checkins c WHERE c.registration_id = NEW.registration_id);

  UPDATE gate.tickets SET status = 'revoked', revoked_at = now()
   WHERE registration_id = NEW.registration_id AND status = 'active';

  who := coalesce((SELECT display_name FROM admin.admins WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin.audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'payment.rejected', NEW.registration_id,
          jsonb_build_object('reason', NEW.rejection_reason, 'ticketRevoked', true));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION gate.on_payment_rejected() IS 'পেমেন্ট প্রত্যাখ্যাত হলে টিকিট বাতিল করে; চেক-ইন হয়ে গেলে নিবন্ধন আর বদলায় না।';

CREATE OR REPLACE FUNCTION gate.on_payment_refunded() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, registration, ops AS $$
DECLARE who text;
BEGIN
  UPDATE registration.registrations SET status = 'refunded', refunded_at = coalesce(refunded_at, now()), updated_at = now()
   WHERE id = NEW.registration_id AND archived_at IS NULL;

  UPDATE gate.tickets SET status = 'revoked', revoked_at = now()
   WHERE registration_id = NEW.registration_id AND status = 'active';

  who := coalesce((SELECT display_name FROM admin.admins WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin.audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'payment.refunded', NEW.registration_id,
          jsonb_build_object('refundAmount', NEW.submitted_amount, 'ticketRevoked', true));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION gate.on_payment_refunded() IS 'টাকা ফেরত দেওয়া হলে নিবন্ধন "refunded" করে ও টিকিট বাতিল করে।';

-- ── ৫. রিফান্ড লেখার নিয়ম ────────────────────────────────────────
CREATE OR REPLACE FUNCTION payment.on_refund_inserted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, payment, people, ops AS $$
DECLARE paid numeric; total numeric; who text;
BEGIN
  SELECT submitted_amount INTO paid FROM payment.payments WHERE id = NEW.payment_id;
  IF paid IS NULL THEN RAISE EXCEPTION 'পেমেন্ট পাওয়া যায়নি।'; END IF;
  SELECT coalesce(sum(amount), 0) INTO total FROM payment.refunds WHERE payment_id = NEW.payment_id;
  IF total > paid THEN RAISE EXCEPTION 'রিফান্ডের মোট টাকা (%) জমা দেওয়া টাকার (%) চেয়ে বেশি হতে পারে না।', total, paid; END IF;

  UPDATE payment.payments SET status = 'refunded', updated_at = now()
   WHERE id = NEW.payment_id AND status <> 'refunded';

  who := coalesce((SELECT display_name FROM admin.admins WHERE user_id = auth.uid()), 'system');
  INSERT INTO admin.audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, auth.uid(), who, 'refund.created', NEW.registration_id,
          jsonb_build_object('amount', NEW.amount, 'method', NEW.method, 'reason', NEW.reason_bn));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION payment.on_refund_inserted() IS 'রিফান্ড যোগ হলে হিসাব মিলিয়ে পেমেন্টকে refunded করে — তারপরেই টিকিট বাতিলের ধাপ চলে।';

-- ── ৬. চেক-ইনের নিয়ম ও অডিট ─────────────────────────────────────
CREATE OR REPLACE FUNCTION gate.guard_checkin() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, registration, payment, gate AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM registration.registrations r
    JOIN payment.payments p ON p.registration_id = r.id
    JOIN gate.tickets t ON t.registration_id = r.id
    WHERE r.id = NEW.registration_id AND r.status = 'approved' AND r.archived_at IS NULL
      AND p.status = 'verified' AND t.status = 'active'
  ) THEN
    RAISE EXCEPTION 'টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION gate.guard_checkin() IS 'অনুমোদিত + যাচাইকৃত + চালু টিকিট ছাড়া দরজা খোলে না (তিন স্তরের শর্ত)।';

CREATE OR REPLACE FUNCTION gate.audit_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, gate, people AS $$
DECLARE who text;
BEGIN
  SELECT display_name INTO who FROM admin.admins WHERE user_id = NEW.operator_id;
  INSERT INTO admin.audit_logs(event_id, actor_id, actor_name, action, record_id, metadata)
  VALUES (NEW.event_id, NEW.operator_id, coalesce(who, 'staff'), 'ticket.checkin', NEW.registration_id,
          jsonb_build_object('deviceId', NEW.device_id, 'people', NEW.group_size));
  RETURN NULL;
END $$;
COMMENT ON FUNCTION gate.audit_checkin() IS 'প্রতিটি সফল চেক-ইন অডিট-লগে লিখে রাখে (কোন ডিভাইস, কতজন)।';

-- ── ৭. অ্যাডমিন টেবিলের নিয়ম ─────────────────────────────────────
CREATE OR REPLACE FUNCTION admin.fill_admin_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, admin AS $$
BEGIN
  IF NEW.email = '' THEN
    SELECT coalesce(u.email, '') INTO NEW.email FROM auth.users u WHERE u.id = NEW.user_id;
  END IF;
  IF NEW.display_name = '' THEN NEW.display_name := coalesce(nullif(split_part(NEW.email, '@', 1), ''), 'স্টাফ'); END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION admin.fill_admin_fields() IS 'admin.admins-এ নতুন সারি যোগ হলে auth.users থেকে ইমেইল ও নাম স্বয়ংক্রিয়ভাবে বসায়।';

-- ═══════════════ ট্রিগার বসানো ═══════════════
-- ১. হালনাগাদের সময়-ছাপ
CREATE TRIGGER trg_touch_events         BEFORE UPDATE ON event.events            FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_fees           BEFORE UPDATE ON event.fees        FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_contacts       BEFORE UPDATE ON event.contacts    FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_sections       BEFORE UPDATE ON content.sections       FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_schedule       BEFORE UPDATE ON content.schedule       FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_accounts       BEFORE UPDATE ON payment.accounts FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_participants   BEFORE UPDATE ON registration.participants    FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_registrations  BEFORE UPDATE ON registration.registrations   FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_access         BEFORE UPDATE ON registration.links FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_profiles       BEFORE UPDATE ON admin.admins        FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_payments       BEFORE UPDATE ON payment.payments         FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_devices        BEFORE UPDATE ON admin.devices      FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();
CREATE TRIGGER trg_touch_settings       BEFORE UPDATE ON database.settings      FOR EACH ROW EXECUTE FUNCTION database.set_updated_at();

-- ২. মোবাইল নম্বর পরিষ্কার
CREATE TRIGGER trg_norm_participant     BEFORE INSERT OR UPDATE ON registration.participants FOR EACH ROW EXECUTE FUNCTION registration.normalize_participant();
CREATE TRIGGER trg_norm_payment         BEFORE INSERT OR UPDATE ON payment.payments      FOR EACH ROW EXECUTE FUNCTION payment.normalize_payment();
CREATE TRIGGER trg_norm_account_mobile  BEFORE INSERT OR UPDATE ON payment.accounts FOR EACH ROW EXECUTE FUNCTION content.normalize_account_mobile();
CREATE TRIGGER trg_norm_contact_mobile  BEFORE INSERT OR UPDATE ON event.contacts FOR EACH ROW EXECUTE FUNCTION content.normalize_account_mobile();

-- ৩. নিয়ম-শৃঙ্খলা
CREATE TRIGGER trg_guard_registration   BEFORE UPDATE ON registration.registrations FOR EACH ROW EXECUTE FUNCTION registration.guard_registration();
CREATE TRIGGER trg_guard_ticket         BEFORE INSERT OR UPDATE ON gate.tickets FOR EACH ROW EXECUTE FUNCTION gate.guard_ticket();
CREATE TRIGGER trg_guard_checkin        BEFORE INSERT ON gate.checkins        FOR EACH ROW EXECUTE FUNCTION gate.guard_checkin();

-- ৪. মূল প্রতিক্রিয়া-শৃঙ্খল
CREATE TRIGGER trg_payment_verified     AFTER UPDATE OF status ON payment.payments FOR EACH ROW
  WHEN (NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified') EXECUTE FUNCTION gate.on_payment_verified();
CREATE TRIGGER trg_payment_rejected     AFTER UPDATE OF status ON payment.payments FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected') EXECUTE FUNCTION gate.on_payment_rejected();
CREATE TRIGGER trg_payment_refunded     AFTER UPDATE OF status ON payment.payments FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded') EXECUTE FUNCTION gate.on_payment_refunded();
CREATE TRIGGER trg_refund_inserted      AFTER INSERT ON payment.refunds FOR EACH ROW EXECUTE FUNCTION payment.on_refund_inserted();
CREATE TRIGGER trg_checkin_audit        AFTER INSERT ON gate.checkins FOR EACH ROW EXECUTE FUNCTION gate.audit_checkin();
CREATE TRIGGER trg_admin_fill           BEFORE INSERT OR UPDATE ON admin.admins FOR EACH ROW EXECUTE FUNCTION admin.fill_admin_fields();

COMMIT;
