-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৩ | schema: content  —  পেজের লেখা, সময়সূচি ও টাকার নম্বর
-- অ্যাডমিন প্যানেল থেকে যা যা বদলানো যায়, সব এখানে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS content;
REVOKE ALL ON SCHEMA content FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA content REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON SCHEMA content IS 'ওয়েবসাইটের সব লেখা-ছবি, সময়সূচি এবং bKash/Nagad নম্বর — অ্যাডমিন এখান থেকেই সম্পাদনা করেন।';

-- ── ১. পেজের সেকশন (hero, story, registration...) ─────────────────
CREATE TABLE content.sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event.events ON DELETE CASCADE,
  section_key text NOT NULL CHECK (section_key ~ '^[a-z0-9_-]{1,60}$'),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 250),
  subtitle    text NOT NULL DEFAULT '' CHECK (length(subtitle) <= 300),
  body        text NOT NULL DEFAULT '' CHECK (length(body) <= 3000),
  image_url   text NOT NULL DEFAULT '' CHECK (image_url = '' OR image_url LIKE '/assets/%' OR image_url LIKE 'https://%'),
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, section_key)
);
COMMENT ON TABLE content.sections IS 'পাবলিক পেজের প্রতিটি সেকশনের শিরোনাম, লেখা ও ছবি (১৩টি সেকশন)।';
COMMENT ON COLUMN content.sections.image_url IS 'একাধিক ছবি দিতে এক লাইনে একটি পাথ লিখুন — কলাজ/ব্যানারে ঘুরে ঘুরে দেখাবে।';
COMMENT ON COLUMN content.sections.is_visible IS 'false করলে সেকশনটি সাইটে দেখাবে না, মুছবে না।';

-- ── ২. সময়সূচি ───────────────────────────────────────────────────
CREATE TABLE content.schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event.events ON DELETE CASCADE,
  start_time  time NOT NULL,
  period      text NOT NULL CHECK (period IN ('সকাল', 'দুপুর', 'বিকেল', 'সন্ধ্যা')),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 220),
  note        text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  sort_order  integer NOT NULL CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE content.schedule IS 'সেদিনের সময়সূচি — সকাল ৯টা থেকে সন্ধ্যা ৬টা পর্যন্ত ১৪টি ধাপ।';
COMMENT ON COLUMN content.schedule.period IS 'দিনের ভাগ: সকাল / দুপুর / বিকেল / সন্ধ্যা।';

CREATE INDEX schedule_event_order ON content.schedule(event_id, sort_order);

COMMIT;
