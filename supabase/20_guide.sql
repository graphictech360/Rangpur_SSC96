-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ৯ | schema: guide  —  মানুষের পড়ার জন্য গঠন-বর্ণনা
-- এখানে ডেটা নয়, ব্যাখ্যা থাকে: কোন টেবিল কী কাজে, কার সাথে কার
-- সম্পর্ক, আর কোনো কাজ করলে কী ঘটে (action → reaction)।
-- guide_relations ও guide_functions পুরোটাই স্বয়ংক্রিয় — ডেটাবেস
-- বদলালে এগুলোও নিজে থেকে ঠিক হয়ে যায়।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

SET search_path = public, pg_catalog;


-- ── ১. প্রতিটি টেবিলের পরিচয় ও উদ্দেশ্য ──────────────────────────
CREATE TABLE IF NOT EXISTS guide_tables (
  schema_name  text NOT NULL,
  table_name   text NOT NULL,
  purpose_bn   text NOT NULL CHECK (length(purpose_bn) BETWEEN 5 AND 300),
  written_by   text NOT NULL CHECK (length(written_by) BETWEEN 2 AND 120),
  key_columns  text NOT NULL CHECK (length(key_columns) BETWEEN 2 AND 200),
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (schema_name, table_name)
);
COMMENT ON TABLE guide_tables IS '২৫টি টেবিলের এক-লাইনের বাংলা পরিচয়: কী কাজে, কে লেখে, মূল কলাম কোনগুলো।';
COMMENT ON COLUMN guide_tables.written_by IS 'এই টেবিলে কে লিখতে পারে — যেমন "অংশগ্রহণকারীর ফর্ম (RPC)" বা "অ্যাডমিন প্যানেল"।';
COMMENT ON COLUMN guide_tables.key_columns IS 'এই টেবিলের সবচেয়ে জরুরি কলামগুলো।';

-- ── ২. কোনো কাজ করলে কী ঘটে (action → reaction) ───────────────────
CREATE TABLE IF NOT EXISTS guide_flows (
  id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{3,40}$'),
  title_bn   text NOT NULL CHECK (length(title_bn) BETWEEN 3 AND 120),
  actor_bn   text NOT NULL CHECK (length(actor_bn) BETWEEN 3 AND 80),
  trigger_bn text NOT NULL CHECK (length(trigger_bn) BETWEEN 3 AND 200),
  steps      jsonb NOT NULL DEFAULT '[]'::jsonb,
  effects    jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE guide_flows IS 'প্রতিটি কাজের ধাপে ধাপে ফলাফল — লগইন, পাসওয়ার্ড রিসেট, পেমেন্ট, রিফান্ড, চেক-ইন সহ ১৫টি প্রবাহ।';
COMMENT ON COLUMN guide_flows.steps IS 'যে ধাপগুলো একের পর এক ঘটে (বাংলা লেখার তালিকা)।';
COMMENT ON COLUMN guide_flows.effects IS 'কোন টেবিলে কী লেখা/বদল হয় — {"schema.table", "কী হয়"} আকারে।';

-- ── ৩. টেবিল-থেকে-টেবিল সম্পর্ক (স্বয়ংক্রিয়, foreign key থেকে) ────
CREATE VIEW guide_relations AS
SELECT
  ns.nspname  AS child_schema,
  cl.relname  AS child_table,
  a.attname   AS child_column,
  ns2.nspname AS parent_schema,
  cl2.relname AS parent_table,
  a2.attname  AS parent_column,
  CASE con.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'r' THEN 'RESTRICT'
       WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END AS on_delete,
  con.conname AS constraint_name
FROM pg_constraint con
JOIN pg_class cl  ON cl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cl.relnamespace
JOIN pg_class cl2 ON cl2.oid = con.confrelid
JOIN pg_namespace ns2 ON ns2.oid = cl2.relnamespace
JOIN unnest(con.conkey)  WITH ORDINALITY AS k(attnum, ord) ON true
JOIN unnest(con.confkey) WITH ORDINALITY AS f(attnum, ord) ON f.ord = k.ord
JOIN pg_attribute a  ON a.attrelid = cl.oid  AND a.attnum = k.attnum
JOIN pg_attribute a2 ON a2.attrelid = cl2.oid AND a2.attnum = f.attnum
WHERE con.contype = 'f'
  AND ns.nspname = 'public' AND ns2.nspname = 'public'
ORDER BY 1, 2, 3;
COMMENT ON VIEW guide_relations IS 'প্রতিটি foreign key সম্পর্ক — কোন টেবিলের কোন কলাম কার সাথে জোড়া, মুছলে কী হয়। স্বয়ংক্রিয়ভাবে তৈরি।';

-- ── ৪. কোন ফাংশন কে ডাকতে পারে (স্বয়ংক্রিয়) ─────────────────────
CREATE VIEW guide_functions AS
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  obj_description(p.oid, 'pg_proc') AS purpose_bn,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS public_can_call,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS staff_can_call
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY n.nspname, p.proname;
COMMENT ON VIEW guide_functions IS 'সব ফাংশনের তালিকা — কে ডাকতে পারে (সাধারণ ব্যবহারকারী/স্টাফ) ও কী কাজে।';

-- ── ৫. প্রতিটি টেবিলে এখন কত সারি (সঠিক গণনা) ────────────────────
CREATE OR REPLACE FUNCTION public.live_counts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE t record; out jsonb := '{}'::jsonb; n bigint;
BEGIN
  FOR t IN SELECT table_name FROM guide_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.table_name) INTO n;
    out := out || jsonb_build_object(t.table_name, n);
  END LOOP;
  RETURN out;
END $$;
COMMENT ON FUNCTION live_counts() IS 'প্রতিটি টেবিলে এই মুহূর্তে কতটি সারি আছে — অ্যাডমিন প্যানেলের গঠন-পর্দায় দেখানো হয়।';

-- ── ৬. স্কিমা-তালিকা (হালনাগাদ টেবিল-সংখ্যাসহ) ────────────────────
CREATE OR REPLACE VIEW guide_schemas AS
SELECT s.name, s.section_bn, s.purpose_bn, s.sort_order,
       (SELECT count(*) FROM guide_tables t WHERE t.schema_name = s.name) AS table_count,
       (SELECT coalesce(sum(h.approx_rows), 0) FROM database_health h WHERE h.schema_name = s.name) AS approx_rows
FROM database_schemas s
ORDER BY s.sort_order, s.name;
COMMENT ON VIEW guide_schemas IS 'প্রতিটি স্কিমার উদ্দেশ্য ও কতটি টেবিল আছে — এক নজরে।';

-- ── ৭. সবকিছু একসাথে: অ্যাডমিন প্যানেলের "ডেটাবেস গঠন" পর্দা ──────
DROP VIEW IF EXISTS guide_overview CASCADE;  -- কলামের গঠন বদলালে ভিউ নতুন করে বানাতে হয়
CREATE VIEW guide_overview AS
SELECT jsonb_build_object(
  'generatedAt', now(),
  'counts', jsonb_build_object(
    'schemas', (SELECT count(*) FROM database_schemas),
    'tables', (SELECT count(*) FROM guide_tables),
    'relations', (SELECT count(*) FROM guide_relations),
    'flows', (SELECT count(*) FROM guide_flows),
    'functions', (SELECT count(*) FROM guide_functions WHERE schema_name = 'public'),
    'indexes', (SELECT count(*) FROM database_health),
    'triggers', (SELECT coalesce(sum(triggers), 0) FROM database_health)),
  'schemas', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'name', name, 'section', section_bn, 'purpose', purpose_bn, 'tables', table_count) ORDER BY sort_order, name)
    FROM guide_schemas), '[]'::jsonb),
  'tables', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'schema', t.schema_name, 'table', t.table_name, 'purpose', t.purpose_bn, 'writtenBy', t.written_by,
      'keyColumns', t.key_columns, 'rows', coalesce((live_counts() ->> t.table_name)::bigint, 0),
      'indexes', coalesce((SELECT h.indexes FROM database_health h WHERE h.schema_name = t.schema_name AND h.table_name = t.table_name), 0),
      'triggers', coalesce((SELECT h.triggers FROM database_health h WHERE h.schema_name = t.schema_name AND h.table_name = t.table_name), 0),
      'rls', coalesce((SELECT h.rls_on FROM database_health h WHERE h.schema_name = t.schema_name AND h.table_name = t.table_name), false))
      ORDER BY t.schema_name, t.table_name) FROM guide_tables t), '[]'::jsonb),
  'relations', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM guide_relations r), '[]'::jsonb),
  'flows', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'title', title_bn, 'actor', actor_bn, 'trigger', trigger_bn, 'steps', steps, 'effects', effects)
      ORDER BY sort_order) FROM guide_flows), '[]'::jsonb),
  'functions', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'schema', schema_name, 'name', function_name, 'args', arguments, 'purpose', purpose_bn,
      'publicCanCall', public_can_call, 'staffCanCall', staff_can_call) ORDER BY schema_name, function_name)
    FROM guide_functions), '[]'::jsonb),
  'health', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.schema_name, h.table_name) FROM database_health h), '[]'::jsonb)
 ) AS data;
COMMENT ON VIEW guide_overview IS 'অ্যাডমিন প্যানেলের "ডেটাবেস গঠন" ট্যাবের পুরো তথ্য এক jsonb-তে।';


COMMIT;
