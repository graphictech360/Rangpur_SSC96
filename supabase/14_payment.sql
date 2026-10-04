-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৫ | schema: payment  —  টাকার সব হিসাব
-- কে কত টাকা Send Money করল, কোন নম্বরে, অনুমোদন পেল কি না,
-- আর কেউ রিফান্ড চাইলে কী হলো — সব এখানে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

CREATE SCHEMA IF NOT EXISTS payment;
REVOKE ALL ON SCHEMA payment FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA payment REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON SCHEMA payment IS 'প্রতি নিবন্ধনের পেমেন্ট রেকর্ড ও রিফান্ড — প্রতিটি টাকা ঠিক কার সাথে জুড়ে আছে তা এখানে লেখা।';

-- ── ০. Send Money নম্বর (bKash/Nagad) ─────────────────────────────
CREATE TABLE payment.accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES event.events ON DELETE CASCADE,
  provider       text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
  collector_name text NOT NULL CHECK (length(collector_name) BETWEEN 1 AND 100),
  mobile         text NOT NULL CHECK (mobile ~ '^(01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})$'),
  sort_order     integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  is_active      boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, event_id)
);
COMMENT ON TABLE payment.accounts IS 'প্রকাশ্য ব্যক্তিগত Send Money নম্বর (Tomal · Mahatab · Shohag · Arif — bKash ও Nagad)।';
COMMENT ON COLUMN payment.accounts.is_active IS 'নিষ্ক্রিয় করলে নতুন নিবন্ধনে দেখাবে না, পুরোনো রেকর্ড অটুট থাকবে।';

-- ── ১. পেমেন্ট (প্রতি নিবন্ধনে একটি) ──────────────────────────────
CREATE TABLE payment.payments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  uuid NOT NULL REFERENCES event.events,
  registration_id           uuid NOT NULL UNIQUE,
  FOREIGN KEY (registration_id, event_id) REFERENCES registration.registrations(id, event_id),
  account_id                uuid NOT NULL,
  FOREIGN KEY (account_id, event_id) REFERENCES payment.accounts(id, event_id),
  provider                  text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
  collector_name_snapshot   text NOT NULL,
  collector_mobile_snapshot text NOT NULL CHECK (collector_mobile_snapshot ~ '^(01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})$'),
  sender_mobile             text NOT NULL CHECK (sender_mobile ~ '^01[3-9][0-9]{8}$'),
  transaction_id            text NOT NULL CHECK (transaction_id ~ '^[A-Za-z0-9-]{5,64}$'),
  normalized_transaction_id text GENERATED ALWAYS AS (upper(transaction_id)) STORED,
  submitted_amount          numeric(10,0) NOT NULL CHECK (submitted_amount > 0),
  status                    text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'refunded')),
  reviewed_by               uuid REFERENCES auth.users ON DELETE SET NULL,
  reviewed_at               timestamptz,
  rejection_reason          text NOT NULL DEFAULT '' CHECK (length(rejection_reason) <= 500),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider, normalized_transaction_id)
);
COMMENT ON TABLE payment.payments IS 'প্রতি নিবন্ধনের নিজস্ব Send Money রেকর্ড — প্রেরকের নম্বর, TrxID ও টাকার পরিমাণ।';
COMMENT ON COLUMN payment.payments.collector_name_snapshot IS 'কোন নম্বরে টাকা গেল তার তখনকার নাম — পরে নম্বর বদলালেও রেকর্ড ঠিক থাকে।';
COMMENT ON COLUMN payment.payments.normalized_transaction_id IS 'বড় হাতের অক্ষরে স্বয়ংক্রিয় রূপ — একই TrxID দুইবার জমা দেওয়া যায় না।';
COMMENT ON COLUMN payment.payments.status IS 'pending=যাচাই বাকি · verified=অনুমোদিত · rejected=প্রত্যাখ্যান · refunded=টাকা ফেরত দেওয়া হয়েছে।';
CREATE INDEX accounts_event_order ON payment.accounts(event_id, sort_order) WHERE is_active;
CREATE INDEX payments_status ON payment.payments(event_id, status, created_at DESC);
CREATE INDEX payments_collector ON payment.payments(account_id, status);

-- ── ২. রিফান্ড (এক পেমেন্টে একাধিক আংশিক রিফান্ড হতে পারে) ─────────
CREATE TABLE payment.refunds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES event.events,
  payment_id    uuid NOT NULL REFERENCES payment.payments ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES registration.registrations ON DELETE CASCADE,
  amount        numeric(10,0) NOT NULL CHECK (amount > 0),
  reason_bn     text NOT NULL CHECK (length(reason_bn) BETWEEN 3 AND 500),
  method        text NOT NULL DEFAULT 'bkash' CHECK (method IN ('bkash', 'nagad', 'cash', 'other')),
  reference     text NOT NULL DEFAULT '' CHECK (length(reference) <= 80),
  marked_by     uuid REFERENCES auth.users ON DELETE SET NULL,
  refunded_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE payment.refunds IS 'টাকা ফেরত দেওয়ার রেকর্ড — কত টাকা, কেন, কোন মাধ্যমে, কে অনুমোদন করল।';
COMMENT ON COLUMN payment.refunds.amount IS 'আংশিক রিফান্ডও সম্ভব; মোট রিফান্ড পেমেন্টের টাকার বেশি হতে পারে না (ট্রিগারে আটকানো)।';
COMMENT ON COLUMN payment.refunds.reference IS 'রিফান্ডের TrxID বা সাক্ষীর নোট (ঐচ্ছিক)।';
CREATE INDEX refunds_time ON payment.refunds(event_id, refunded_at DESC);

COMMIT;
