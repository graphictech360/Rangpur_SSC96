-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৪ | schema: user  —  অংশগ্রহণকারী, নিবন্ধন ও অ্যাকাউন্ট
-- কে নিবন্ধন করল, কতজন আসছে, গোপন টিকিট-লিংক, কে লগইন করল,
-- পাসওয়ার্ড ভুলে গেলে কী হলো, কোন ইমেইল পাঠানো হলো।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. অংশগ্রহণকারী (যিনি ফর্ম পূরণ করেন) ─────────────────────────
CREATE TABLE participants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES event_events,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  school_name      text NOT NULL CHECK (length(school_name) BETWEEN 1 AND 200),
  ssc_batch        integer NOT NULL DEFAULT 1996 CHECK (ssc_batch = 1996),
  ssc_roll         text NOT NULL CHECK (length(ssc_roll) BETWEEN 1 AND 30),
  ssc_registration text NOT NULL DEFAULT '' CHECK (length(ssc_registration) <= 40),
  mobile           text NOT NULL CHECK (mobile ~ '^01[3-9][0-9]{8}$'),
  current_location text NOT NULL CHECK (length(current_location) BETWEEN 1 AND 200),
  tshirt_size      text NOT NULL CHECK (tshirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  archived_at      timestamptz,
  UNIQUE (id, event_id)
);
COMMENT ON TABLE participants IS 'যিনি নিবন্ধন ফর্ম পূরণ করেন — নাম, স্কুল, SSC রোল, মোবাইল, এলাকা ও টি-শার্ট সাইজ।';
COMMENT ON COLUMN participants.mobile IS 'বাংলা বা ইংরেজি অঙ্কে লেখা হলেও ট্রিগারে ০১XXXXXXXXX আকারে সংরক্ষিত হয়।';
COMMENT ON COLUMN participants.archived_at IS 'মুছে ফেলা নয় — আর্কাইভ। অ্যাডমিন "বাদ দিন" চাপলে এই সময় বসে।';
CREATE UNIQUE INDEX participants_active_mobile ON participants(event_id, mobile) WHERE archived_at IS NULL;
CREATE INDEX participants_school ON participants(event_id, school_name);

-- ── ২. নিবন্ধন (পরিবারের সংখ্যা, ফি, অবস্থা) ──────────────────────
CREATE TABLE registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES event_events,
  participant_id  uuid NOT NULL UNIQUE,
  FOREIGN KEY (participant_id, event_id) REFERENCES participants(id, event_id),
  ticket_serial   bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  ticket_number   text GENERATED ALWAYS AS ('R96-' || lpad(ticket_serial::text, greatest(5, length(ticket_serial::text)), '0')) STORED UNIQUE,
  spouse_count    smallint NOT NULL DEFAULT 0 CHECK (spouse_count BETWEEN 0 AND 1),
  children_count  smallint NOT NULL DEFAULT 0 CHECK (children_count BETWEEN 0 AND 20),
  -- খাবার ও বিশেষ অনুরোধ আর বাধ্যতামূলক নয় (ফর্ম থেকে সরানো হয়েছে);
  -- চাইলে অ্যাডমিন প্যানেল থেকে আবার ঘর যোগ করা যায় — তখনই এগুলো ভরে।
  food_preference text CHECK (food_preference IN ('সাধারণ', 'নিরামিষ', 'বিশেষ অনুরোধ')),
  notes           text NOT NULL DEFAULT '' CHECK (length(notes) <= 600),
  custom_answers  jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(custom_answers) = 'object'),
  fee_friend      numeric(10,0) NOT NULL CHECK (fee_friend > 0),
  fee_spouse      numeric(10,0) NOT NULL CHECK (fee_spouse >= 0),
  fee_child       numeric(10,0) NOT NULL CHECK (fee_child >= 0),
  total_fee       numeric(10,0) GENERATED ALWAYS AS (fee_friend + spouse_count * fee_spouse + children_count * fee_child) STORED,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  refunded_at     timestamptz,
  archived_at     timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, event_id)
);
COMMENT ON TABLE registrations IS 'এক অংশগ্রহণকারীর এক নিবন্ধন — কতজন আসছে, মোট ফি ও অনুমোদনের অবস্থা (pending → approved → check-in)।';
COMMENT ON COLUMN registrations.custom_answers IS 'ফর্মের অতিরিক্ত ঘরগুলোর উত্তর — {"blood_group":"B+", "jersey_name":"রফিক"} আকারে।';
COMMENT ON COLUMN registrations.ticket_number IS 'স্বয়ংক্রিয় টিকিট নম্বর (R96-00001) — কাগজের টিকিটেও ছাপা হয়।';
COMMENT ON COLUMN registrations.total_fee IS 'স্বয়ংক্রিয় যোগফল = বন্ধু + (সঙ্গী × ৫০০) + (শিশু × ২০০)।';
COMMENT ON COLUMN registrations.status IS 'pending=যাচাই বাকি · approved=টিকিট চালু · rejected=প্রত্যাখ্যান · refunded=টাকা ফেরত · cancelled=বাদ দেওয়া।';
CREATE INDEX registrations_event_status ON registrations(event_id, status, created_at DESC);
CREATE INDEX registrations_pending ON registrations(event_id, created_at) WHERE status = 'pending';

-- ── ৩. গোপন টিকিট-লিংক (ট্র্যাকিং কী-এর hash) ─────────────────────
CREATE TABLE user_links (
  registration_id   uuid PRIMARY KEY REFERENCES registrations ON DELETE CASCADE,
  tracking_key_hash text NOT NULL UNIQUE CHECK (tracking_key_hash ~ '^[a-f0-9]{64}$'),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE user_links IS 'গোপন status/receipt লিংকের SHA-256 hash — ফোন নম্বর দিয়ে কেউ অন্যের টিকিট খুঁজতে পারে না।';
COMMENT ON COLUMN user_links.tracking_key_hash IS 'আসল কী কেবল নিবন্ধনের সময় একবারই দেখা যায়; ডেটাবেসে শুধু hash থাকে।';

COMMIT;
