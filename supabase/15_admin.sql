-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৬ | schema: admin  —  অ্যাডমিন সেকশন
-- একটি মূল **admin table** (কে অ্যাডমিন, কে গেট স্টাফ), তার সাথে
-- লগইন-হিসাব, পাসওয়ার্ড রিসেট, ইমেইল-আউটবক্স, অনুমোদিত ফোন ও অডিট-লগ।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS admin;
REVOKE ALL ON SCHEMA admin FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON SCHEMA admin IS 'অ্যাডমিন সেকশন: অ্যাডমিনের তালিকা, লগইন-হিসাব, পাসওয়ার্ড রিসেট, অনুমোদিত ফোন ও অডিট-লগ।';

-- ── ১. অ্যাডমিন টেবিল (একটাই মূল টেবিল — কে কী) ───────────────────
CREATE TABLE admin.admins (
  user_id       uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email         text NOT NULL DEFAULT '' CHECK (length(email) <= 200),
  display_name  text NOT NULL DEFAULT '' CHECK (length(display_name) <= 120),
  role          text NOT NULL DEFAULT 'scanner' CHECK (role IN ('admin', 'scanner')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  login_count   integer NOT NULL DEFAULT 0 CHECK (login_count >= 0),
  failed_logins integer NOT NULL DEFAULT 0 CHECK (failed_logins >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin.admins IS 'অ্যাডমিনের মূল টেবিল — কে অ্যাডমিন, কে গেট স্টাফ, সক্রিয় কি না, কতবার লগইন করেছে। এখানে সারি না থাকলে কেউ প্যানেলে ঢুকতে পারে না।';
COMMENT ON COLUMN admin.admins.role IS 'admin = পুরো প্যানেল ও সব কাজ · scanner = শুধু গেট চেক-ইন।';
COMMENT ON COLUMN admin.admins.is_active IS 'false করলে অ্যাকাউন্ট থাকলেও প্যানেল/চেক-ইন বন্ধ — বাতিলের সবচেয়ে সহজ পথ।';
COMMENT ON COLUMN admin.admins.email IS 'auth.users থেকে স্বয়ংক্রিয়ভাবে বসে (ট্রিগার); দরকারে হাতে লেখাও যায়।';
CREATE UNIQUE INDEX admins_only_one_active_admin ON admin.admins((true)) WHERE role = 'admin' AND is_active;
CREATE INDEX admins_active ON admin.admins(role, is_active);

-- ── ২. লগইন-ইভেন্ট (সফল ও ব্যর্থ) ─────────────────────────────────
CREATE TABLE admin.login_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL CHECK (length(email) BETWEEN 5 AND 200),
  user_id    uuid REFERENCES admin.admins(user_id) ON DELETE SET NULL,
  succeeded  boolean NOT NULL,
  note_bn    text NOT NULL DEFAULT '' CHECK (length(note_bn) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin.login_events IS 'প্রতিটি অ্যাডমিন/স্টাফ লগইনের হিসাব — সফল ও ব্যর্থ দুটোই, সাথে বাংলা টীকা।';
COMMENT ON COLUMN admin.login_events.succeeded IS 'false = ভুল পাসওয়ার্ড বা অননুমোদিত চেষ্টা — নিরাপত্তার খোঁজে কাজে লাগে।';
CREATE INDEX login_events_time ON admin.login_events(created_at DESC);

-- ── ৩. পাসওয়ার্ড ভুলে যাওয়ার অনুরোধ ─────────────────────────────
CREATE TABLE admin.password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL CHECK (length(email) BETWEEN 5 AND 200),
  user_id      uuid REFERENCES admin.admins(user_id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'email_sent', 'completed', 'unknown_email', 'rate_limited')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  note_bn      text NOT NULL DEFAULT '' CHECK (length(note_bn) <= 300)
);
COMMENT ON TABLE admin.password_resets IS '"পাসওয়ার্ড ভুলে গেছি" চাপলে কী হলো — ইমেইল পাঠানো হলো কি না, কখন সম্পন্ন হলো।';
COMMENT ON COLUMN admin.password_resets.status IS 'requested → email_sent → completed; unknown_email = এই ইমেইলে অ্যাকাউন্ট নেই (বাইরে একই বার্তা দেখানো হয়)।';
CREATE INDEX password_resets_time ON admin.password_resets(requested_at DESC);

-- ── ৪. ইমেইল-আউটবক্স ─────────────────────────────────────────────
CREATE TABLE admin.email_outbox (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('password_reset', 'welcome', 'ticket', 'reminder', 'other')),
  to_email   text NOT NULL CHECK (length(to_email) BETWEEN 5 AND 200),
  subject_bn text NOT NULL CHECK (length(subject_bn) BETWEEN 3 AND 200),
  provider   text NOT NULL DEFAULT 'supabase_auth',
  status     text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  note_bn    text NOT NULL DEFAULT '' CHECK (length(note_bn) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin.email_outbox IS 'কোন ইমেইল কখন কাকে পাঠানো হলো (পাসওয়ার্ড রিসেট এখন Supabase Auth পাঠায়)।';
CREATE INDEX email_outbox_time ON admin.email_outbox(created_at DESC);

-- ── ৫. অনুমোদিত ফোন/ব্রাউজার ─────────────────────────────────────
CREATE TABLE admin.devices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event.events,
  user_id     uuid NOT NULL REFERENCES admin.admins(user_id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(label) BETWEEN 2 AND 100),
  token_hash  text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  approved_by uuid REFERENCES admin.admins(user_id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, token_hash),
  UNIQUE (id, event_id)
);
COMMENT ON TABLE admin.devices IS 'স্টাফ ডিভাইস ট্যাবের টেবিল — গেটে কোন ফোন/ব্রাউজার অনুমোদিত, কে অনুমোদন দিল।';
COMMENT ON COLUMN admin.devices.token_hash IS 'ব্রাউজারে থাকা গোপন টোকেনের hash; ফোন হারালে অ্যাডমিন বাতিল করতে পারেন।';
CREATE INDEX devices_event ON admin.devices(event_id, status);

-- ── ৬. অডিট-লগ ───────────────────────────────────────────────────
CREATE TABLE admin.audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES event.events,
  actor_id   uuid REFERENCES auth.users ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT 'public' CHECK (length(actor_name) BETWEEN 1 AND 120),
  action     text NOT NULL CHECK (length(action) BETWEEN 3 AND 80),
  record_id  uuid,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin.audit_logs IS 'কে কী করল তার অডিট-লগ — নিবন্ধন, অনুমোদন, রিফান্ড, রিফান্ড-বাতিল, চেক-ইন সব কাজ এখানে লেখা হয়।';
COMMENT ON COLUMN admin.audit_logs.metadata IS 'বাড়তি তথ্য (যেমন আগের পেমেন্ট, রিফান্ডের কারণ) jsonb আকারে।';
CREATE INDEX audit_event_time ON admin.audit_logs(event_id, created_at DESC);

COMMIT;
