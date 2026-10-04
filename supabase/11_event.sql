-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ২ | schema: event  —  অনুষ্ঠানের মূল সত্তা
-- একটাই অনুষ্ঠান, তার ফি এবং প্রকাশ্য যোগাযোগ নম্বর।
-- এই স্কিমার উপরেই বাকি সব স্কিমা নির্ভর করে (registration → payment → gate)।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS event;
REVOKE ALL ON SCHEMA event FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA event REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON SCHEMA event IS 'অনুষ্ঠানের মূল তথ্য: event, ফি-র হার ও প্রকাশ্য যোগাযোগ নম্বর।';

-- ── ১. অনুষ্ঠান ───────────────────────────────────────────────────
CREATE TABLE event.events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  name                text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  tagline             text NOT NULL CHECK (length(tagline) BETWEEN 1 AND 200),
  date_label          text NOT NULL CHECK (length(date_label) BETWEEN 1 AND 60),
  is_dummy_date       boolean NOT NULL DEFAULT true,
  venue               text NOT NULL CHECK (length(venue) BETWEEN 1 AND 160),
  city                text NOT NULL CHECK (length(city) BETWEEN 1 AND 80),
  venue_english       text NOT NULL CHECK (length(venue_english) BETWEEN 1 AND 160),
  registration_open   boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE event.events IS 'অনুষ্ঠানের নাম, তারিখ, ভেন্যু ও নিবন্ধন চালু/বন্ধ — পুরো অ্যাপের কেন্দ্র।';
COMMENT ON COLUMN event.events.slug IS 'স্থির পরিচয় (rangpur-ssc96) — সব RPC এই slug ধরে অনুষ্ঠান খুঁজে পায়।';
COMMENT ON COLUMN event.events.is_dummy_date IS 'true = তারিখ এখন নমুনা; আসল তারিখ ঠিক হলে অ্যাডমিন প্যানেল থেকে বদলাবেন।';
COMMENT ON COLUMN event.events.registration_open IS 'false করলে নতুন নিবন্ধন বন্ধ, পুরোনো টিকিট অটুট থাকে।';

-- ── ২. ফি-র হার ───────────────────────────────────────────────────
CREATE TABLE event.fees (
  event_id  uuid NOT NULL REFERENCES event.events ON DELETE CASCADE,
  kind      text NOT NULL CHECK (kind IN ('friend', 'spouse', 'child')),
  amount    numeric(10,0) NOT NULL CHECK (amount BETWEEN 0 AND 100000),
  currency  text NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, kind),
  CHECK (kind <> 'friend' OR amount > 0)
);
COMMENT ON TABLE event.fees IS 'বন্ধু, জীবনসঙ্গী ও প্রতি শিশুর পৃথক ফি (বন্ধু ১৪৯৯ · সঙ্গী ৫০০ · শিশু ২০০)।';
COMMENT ON COLUMN event.fees.amount IS 'ফি বদলালেও পুরোনো নিবন্ধনে তখনকার ফি snapshot হিসেবে থেকে যায়।';

-- ── ৩. প্রকাশ্য যোগাযোগ নম্বর (হেল্পলাইন / আয়োজক) ────────────────
CREATE TABLE event.contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event.events ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(label) BETWEEN 2 AND 80),
  mobile      text NOT NULL CHECK (mobile ~ '^(01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})$'),
  note_bn     text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_active   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE event.contacts IS 'পাবলিক পেজে দেখানো যোগাযোগ নম্বর — আয়োজক/হেল্পলাইন।';
COMMENT ON COLUMN event.contacts.mobile IS 'একাদশ ডিজিটের বাংলাদেশি নম্বর (01XXXXXXXXX)।';

CREATE INDEX event_contacts_event ON event.contacts(event_id, sort_order) WHERE is_active;

COMMIT;
