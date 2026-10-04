-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৩ | schema: content  —  পেজের লেখা, সময়সূচি ও টাকার নম্বর
-- অ্যাডমিন প্যানেল থেকে যা যা বদলানো যায়, সব এখানে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;


-- ── ১. পেজের সেকশন (hero, story, "user"...) ─────────────────
CREATE TABLE content_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
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
COMMENT ON TABLE content_sections IS 'পাবলিক পেজের প্রতিটি সেকশনের শিরোনাম, লেখা ও ছবি (১৩টি সেকশন)।';
COMMENT ON COLUMN content_sections.image_url IS 'একাধিক ছবি দিতে এক লাইনে একটি পাথ লিখুন — কলাজ/ব্যানারে ঘুরে ঘুরে দেখাবে।';
COMMENT ON COLUMN content_sections.is_visible IS 'false করলে সেকশনটি সাইটে দেখাবে না, মুছবে না।';

-- ── ২. সময়সূচি ───────────────────────────────────────────────────
CREATE TABLE content_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  start_time  time NOT NULL,
  period      text NOT NULL CHECK (period IN ('সকাল', 'দুপুর', 'বিকেল', 'সন্ধ্যা')),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 220),
  note        text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  sort_order  integer NOT NULL CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE content_schedule IS 'সেদিনের সময়সূচি — সকাল ৯টা থেকে সন্ধ্যা ৬টা পর্যন্ত ১৪টি ধাপ।';
COMMENT ON COLUMN content_schedule.period IS 'দিনের ভাগ: সকাল / দুপুর / বিকেল / সন্ধ্যা।';

CREATE INDEX schedule_event_order ON content_schedule(event_id, sort_order);

-- ── ৩. নিবন্ধন ফর্মের ঘর (অ্যাডমিন নিজে যোগ/বদল/মুছতে পারেন) ──────
-- এখানে যত ঘর থাকবে, পাবলিক নিবন্ধন ফর্মে ঠিক তত ঘরই দেখাবে।
CREATE TABLE content_form_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  field_key   text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]{2,30}$'),
  label_bn    text NOT NULL CHECK (length(label_bn) BETWEEN 2 AND 120),
  kind        text NOT NULL CHECK (kind IN ('text', 'textarea', 'select', 'number', 'tel', 'date', 'checkbox',
                                            'photo', 'tshirt', 'family')),
  options     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  placeholder text NOT NULL DEFAULT '' CHECK (length(placeholder) <= 200),
  help_bn     text NOT NULL DEFAULT '' CHECK (length(help_bn) <= 300),
  max_length  integer NOT NULL DEFAULT 200 CHECK (max_length BETWEEN 1 AND 2000),
  is_required boolean NOT NULL DEFAULT false,
  is_visible  boolean NOT NULL DEFAULT true,
  is_base     boolean NOT NULL DEFAULT false,
  is_locked   boolean NOT NULL DEFAULT false,
  step        smallint NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 2),
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, field_key)
);
COMMENT ON TABLE content_form_fields IS 'নিবন্ধন ফর্মের অতিরিক্ত ঘর — অ্যাডমিন প্যানেল থেকে যোগ, বদল, ক্রম বদল, লুকানো ও মুছে ফেলা যায়।';
COMMENT ON COLUMN content_form_fields.kind IS 'ঘরের ধরন: text (এক লাইন), textarea (বড় লেখা), select (তালিকা থেকে বাছাই), number, tel (মোবাইল), date (তারিখ), checkbox (হ্যাঁ/না)।';
COMMENT ON COLUMN content_form_fields.options IS 'select ঘরের বিকল্পগুলো — ["সাধারণ", "নিরামিষ"] আকারে।';
COMMENT ON COLUMN content_form_fields.is_visible IS 'false করলে ঘরটি ফর্মে দেখাবে না, মুছবে না (উত্তরগুলো আগের মতোই থাকে)।';
COMMENT ON COLUMN content_form_fields.is_required IS 'true হলে উত্তর না দিয়ে কেউ জমা দিতে পারবে না।';
COMMENT ON COLUMN content_form_fields.is_base IS 'true = ফর্মের মূল ঘর (নাম, মোবাইল, ছবি, টি-শার্ট…) — এগুলোও লেবেল/ক্রম বদলানো ও লুকানো যায়।';
COMMENT ON COLUMN content_form_fields.is_locked IS 'true = নাম ও মোবাইলের মতো অপরিহার্য ঘর — লুকানো বা মুছে ফেলা যায় না।';
COMMENT ON COLUMN content_form_fields.step IS 'ফর্মের কোন ধাপে ঘরটি দেখাবে (১ = পরিচয়, ২ = পরিবার)।';

CREATE INDEX form_fields_event_order ON content_form_fields(event_id, sort_order);

-- ── ৪. হেডার/মেনুর আইটেম (অ্যাডমিন নিজে বদলাতে পারেন) ──────────────
CREATE TABLE content_nav_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('section', 'ticket', 'link')),
  label_bn    text NOT NULL CHECK (length(label_bn) BETWEEN 1 AND 60),
  target      text NOT NULL DEFAULT '' CHECK (length(target) <= 400),
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE content_nav_items IS 'হেডারের মেনুর প্রতিটি লিংক/বোতাম — অ্যাডমিন প্যানেল থেকে যোগ, নাম বদল, ক্রম বদল, লুকানো ও মুছে ফেলা যায়।';
COMMENT ON COLUMN content_nav_items.kind IS 'section = পেজের কোন অংশে স্ক্রল করবে (target = সেকশনের কী), ticket = “আমার টিকিট” খুলবে, link = বাইরের লিংক।';
COMMENT ON COLUMN content_nav_items.target IS 'section ধরনের জন্য সেকশনের কী (যেমন registration), link ধরনের জন্য পুরো ঠিকানা (https://…)।';

CREATE INDEX nav_items_event_order ON content_nav_items(event_id, sort_order);

-- ── ৫. ফর্মের লেখা (শিরোনাম, ধাপের নাম, বার্তা — সব বদলানো যায়) ──
CREATE TABLE content_form_texts (
  event_id    uuid NOT NULL REFERENCES event_events ON DELETE CASCADE,
  text_key    text NOT NULL CHECK (text_key ~ '^[a-z][a-z0-9_.]{2,40}$'),
  value_bn    text NOT NULL DEFAULT '' CHECK (length(value_bn) <= 400),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, text_key)
);
COMMENT ON TABLE content_form_texts IS 'নিবন্ধন কার্ডের সব লেখা — “YOUR SEAT IS WAITING”, ধাপের নাম, ফি-লেবেল, সম্মতির বাক্য। খালি রাখলে আগের লেখাই থাকে।';


COMMIT;
