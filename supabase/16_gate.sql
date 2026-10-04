-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৭ | schema: gate  —  গেট সেকশন
-- দরজার সবকিছু: QR টিকিট ও চেক-ইন। টিকিট অনুমোদনের পর তৈরি হয়,
-- চেক-ইন এক নিবন্ধনে একবারই।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. QR টিকিট ───────────────────────────────────────────────────
CREATE TABLE gate_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL UNIQUE REFERENCES registrations ON DELETE CASCADE,
  qr_secret       text NOT NULL CHECK (qr_secret ~ '^[a-f0-9]{64}$'),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_by       uuid REFERENCES auth.users ON DELETE SET NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz
);
COMMENT ON TABLE gate_tickets IS 'QR টিকিট টেবিল — পেমেন্ট যাচাইয়ের পর স্বয়ংক্রিয়ভাবে তৈরি, রিফান্ড/প্রত্যাখ্যানে বাতিল।';
COMMENT ON COLUMN gate_tickets.qr_secret IS 'QR-এ থাকা এলোমেলো ৬৪ অক্ষরের কোড; QR-এ ব্যক্তিগত তথ্য নেই।';
COMMENT ON COLUMN gate_tickets.status IS 'active = চালু · revoked = বাতিল (রিফান্ড/প্রত্যাখ্যান/বাদ দেওয়া)।';
CREATE INDEX tickets_status ON gate_tickets(status) WHERE status = 'active';

-- ── ২. দরজার চেক-ইন ───────────────────────────────────────────────
CREATE TABLE gate_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES event_events,
  registration_id uuid NOT NULL UNIQUE,
  FOREIGN KEY (registration_id, event_id) REFERENCES registrations(id, event_id),
  device_id       uuid NOT NULL,
  FOREIGN KEY (device_id, event_id) REFERENCES admin_devices(id, event_id),
  operator_id     uuid NOT NULL REFERENCES auth.users,
  group_size      integer NOT NULL CHECK (group_size BETWEEN 1 AND 22),
  checked_in_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE gate_checkins IS 'দরজার চেক-ইন টেবিল — কতজন ঢুকল, কোন ফোনে, কে চালাল। এক নিবন্ধনে একবারই (UNIQUE)।';
COMMENT ON COLUMN gate_checkins.group_size IS 'যিনি এসেছেন + সঙ্গী + শিশু — একসাথে কতজন ঢুকল।';
CREATE INDEX checkins_event_time ON gate_checkins(event_id, checked_in_at DESC);

COMMIT;
