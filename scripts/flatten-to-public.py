#!/usr/bin/env python3
"""ধাপ ২: সেকশন-স্কিমাগুলো তুলে দিয়ে সব টেবিল/ভিউ public-এ আনা।

- 10–20 নম্বর ফাইল থেকে CREATE SCHEMA / REVOKE / COMMENT ON SCHEMA সরানো
- প্রতিটি ফাংশনের search_path → pg_catalog, public
- database_health ভিউ → public-এর টেবিল + সেকশন-প্রিফিক্স
- 23_harden.sql → public-এর টেবিলে RLS ও অনুমতি বন্ধ
- 00_reset.sql → পুরোনো সব টেবিল/ভিউ/স্কিমা মুছে ফেলা
- 22_seed.sql → guide_tables-এর table_name নতুন নামে, section বর্ণনা হালনাগাদ
- 20_guide.sql → guide_relations/live_counts public-এর জন্য
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUPABASE = ROOT / "supabase"

SECTIONS = ["database", "event", "content", "user", "payment", "admin", "gate", "report", "guide", "registration"]

NEW_TABLES = [
    "participants", "registrations", "user_links",
    "payments", "payment_accounts", "refunds",
    "admin_users", "admin_login_events", "admin_password_resets", "admin_email_outbox",
    "admin_devices", "admin_audit_logs",
    "gate_tickets", "gate_checkins",
    "content_sections", "content_schedule", "content_form_fields",
    "content_nav_items", "content_form_texts",
    "event_events", "event_fees", "event_contacts",
    "report_summary", "report_school_wise", "report_daily", "report_attendance",
    "report_refunds", "report_tshirt_sizes", "report_food_preferences", "report_collectors",
    "guide_tables", "guide_flows", "guide_overview", "guide_relations", "guide_schemas", "guide_functions",
    "database_schemas", "database_settings", "database_migrations", "database_health",
]

NEW_VIEWS = ["report_summary", "report_school_wise", "report_daily", "report_attendance", "report_refunds",
             "report_tshirt_sizes", "report_food_preferences", "report_collectors",
             "guide_overview", "guide_relations", "guide_schemas", "guide_functions", "database_health"]

SECTION_OF = """CASE
    WHEN c.relname IN ('participants', 'registrations', 'user_links') THEN 'user'
    WHEN c.relname IN ('payments', 'payment_accounts', 'refunds')     THEN 'payment'
    WHEN c.relname LIKE 'admin\\_%'    THEN 'admin'
    WHEN c.relname LIKE 'gate\\_%'     THEN 'gate'
    WHEN c.relname LIKE 'content\\_%'  THEN 'content'
    WHEN c.relname LIKE 'event\\_%'    THEN 'event'
    WHEN c.relname LIKE 'report\\_%'   THEN 'report'
    WHEN c.relname LIKE 'guide\\_%'    THEN 'guide'
    WHEN c.relname LIKE 'database\\_%' THEN 'database'
    ELSE 'public' END AS section"""

HEALTH_VIEW = f"""-- ── ৪. স্বাস্থ্য-ভিউ: টেবিল, সেকশন, আকার, RLS, ইনডেক্স, ট্রিগার ──
CREATE OR REPLACE VIEW database_health AS
SELECT
  n.nspname                                   AS schema_name,
  {SECTION_OF},
  c.relname                                   AS table_name,
  GREATEST(c.reltuples, 0)::bigint            AS approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
  c.relrowsecurity                            AS rls_on,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policies,
  (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid)                                       AS indexes,
  (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal)               AS triggers
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN ({", ".join("'" + t + "'" for t in NEW_TABLES)})
ORDER BY section, c.relname;
COMMENT ON VIEW database_health IS 'প্রতিটি টেবিলের সেকশন, সারি-সংখ্যা, আকার, RLS, ইনডেক্স ও ট্রিগারের এক নজরের ছবি। Supabase SQL Editor-এ: select * from database_health;';
"""

HARDEN = f"""-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ১৩ | নিরাপত্তা: public-এর সব টেবিলে RLS চালু ও বাইরের অনুমতি প্রত্যাহার
-- কেন দরকার: টেবিলগুলো এখন public-এ (Table Editor-এ সহজে দেখার জন্য),
-- কিন্তু Data API-তে কেউ কোনো সারি পড়তে/লিখতে পারবে না —
-- শুধু অনুমোদিত RPC দরজাগুলোই তথ্য দেয়।
-- ব্যাখ্যা: policy নেই = "সব বন্ধ"।
-- ⚠️ public-এর ফাংশন (RPC) স্পর্শ করা হয় না — anon কেবল অনুমোদিতগুলোই ডাকতে পারে।
-- এই ফাইল বারবার চালানো নিরাপদ।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  names text[] := ARRAY[{", ".join("'" + t + "'" for t in NEW_TABLES)}];
  t record;
  n_tables integer := 0;
  n_views integer := 0;
BEGIN
  -- ১) প্রতিটি টেবিলে RLS চালু
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY (names) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    n_tables := n_tables + 1;
  END LOOP;
  RAISE NOTICE 'RLS চালু হলো %টি টেবিলে', n_tables;

  -- ২) টেবিলে বাইরের সব অনুমতি প্রত্যাহার
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY (names) LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t.relname);
  END LOOP;

  -- ৩) রিপোর্ট/বর্ণনার ভিউগুলোও পড়া বন্ধ (প্যানেল RPC দিয়েই দেখে)
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname = ANY (names) LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t.relname);
    n_views := n_views + 1;
  END LOOP;
  RAISE NOTICE 'ভিউ বন্ধ হলো %টিতে', n_views;

  -- ৪) সিকোয়েন্স (থাকলে)
  FOR t IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', t.sequence_name);
  END LOOP;
END $$;

-- ৫) ভবিষ্যতে তৈরি হবে এমন টেবিল/সিকোয়েন্সেও যেন অনুমতি চলে না যায়
--    (ALTER DEFAULT PRIVILEGES শুধু বর্তমান রোলের তৈরি জিনিসে খাটে, তাই তথ্য-সুরক্ষার মূল ভরসা RLS)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

COMMIT;
"""


def reset_sql() -> str:
    base = [t for t in NEW_TABLES if t not in NEW_VIEWS]
    drops = "\n".join(f'DROP VIEW IF EXISTS public.{"\"user\"" if v == "user" else v} CASCADE;' for v in ["user"] + NEW_VIEWS)
    tables = "\n".join(f"DROP TABLE IF EXISTS public.{t} CASCADE;" for t in base)
    olds = "\n".join(f"DROP SCHEMA IF EXISTS {s if s != 'user' else chr(34) + 'user' + chr(34)} CASCADE;" for s in SECTIONS)
    funcs = "\n".join(
        f"DROP FUNCTION IF EXISTS {sig};"
        for sig in [
            "public.public_site()", "public.submit_registration(jsonb)", "public.ticket_status(text)",
            "public.staff_identity()", "public.admin_overview()", "public.admin_mutate(text, jsonb)",
            "public.register_device(text, text)", "public.device_state(text)", "public.check_in(text, text)",
            "public.guide_overview()", "public.log_login(text, boolean, text)",
            "public.request_password_reset(text)", "public.complete_password_reset(text, text)",
        ]
    )
    return f"""-- ═══════════════════════════════════════════════════════════════════
-- ধাপ ০ | পুরোনো সব গঠন মুছে ফেলা (শুধু নতুন সেটআপের ঠিক আগে একবার)
-- নতুন গঠন: সব টেবিল ও ভিউ একটিমাত্র স্কিমায় → public
--   নামের শুরুতে সেকশন বোঝা যায়: admin_* admin সেকশন, payment_* পেমেন্ট,
--   user-এর তথ্য: participants · registrations · user_links, ইত্যাদি।
-- ⚠️ অ্যাডমিন অ্যাকাউন্ট (auth.users) মুছে যায় না — শুধু তাঁর ভূমিকা
--    নতুন admin_users টেবিলে আবার বসাতে হবে।
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- ১) পুরোনো সেকশন-স্কিমাগুলো (এখন ব্যবহার হয় না)
{olds}

-- ২) public-এর টেবিল ও ভিউ
{tables}

{drops}

-- ৩) পুরোনো অনুমোদিত দরজাগুলো (RPC)
{funcs}

-- ৪) অভ্যন্তরীণ ফাংশনগুলো (যেকোনো signature-তেই থাকলে মুছে ফেলা)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (ARRAY[
         'key_hash','random_token','normalize_mobile','set_updated_at','event_id','require_role',
         'log_action','device_json','registration_json','stats','live_counts',
         'normalize_participant','normalize_payment','normalize_account_mobile','guard_registration',
         'guard_ticket','on_payment_verified','on_payment_rejected','on_payment_refunded',
         'on_refund_inserted','guard_checkin','audit_checkin','fill_admin_fields'])
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
    RAISE NOTICE 'মুছে ফেলা হলো: %', r.sig;
  END LOOP;
END $$;

COMMIT;
"""


def move_seed() -> None:
    path = SUPABASE / "22_seed.sql"
    s = path.read_text()

    mapping = {
        ("database", "schemas"): "database_schemas",
        ("database", "settings"): "database_settings",
        ("database", "migrations"): "database_migrations",
        ("admin", "admins"): "admin_users",
        ("admin", "login_events"): "admin_login_events",
        ("admin", "password_resets"): "admin_password_resets",
        ("admin", "email_outbox"): "admin_email_outbox",
        ("admin", "devices"): "admin_devices",
        ("admin", "audit_logs"): "admin_audit_logs",
        ("event", "events"): "event_events",
        ("event", "fees"): "event_fees",
        ("event", "contacts"): "event_contacts",
        ("content", "sections"): "content_sections",
        ("content", "schedule"): "content_schedule",
        ("user", "participants"): "participants",
        ("user", "registrations"): "registrations",
        ("user", "links"): "user_links",
        ("payment", "accounts"): "payment_accounts",
        ("payment", "payments"): "payments",
        ("payment", "refunds"): "refunds",
        ("gate", "tickets"): "gate_tickets",
        ("gate", "checkins"): "gate_checkins",
        ("guide", "tables"): "guide_tables",
        ("guide", "flows"): "guide_flows",
    }

    def repl(m):
        sec, rest = m.group(1), m.group(2)
        new = mapping.get((sec, rest))
        return f'"schema_name": "{sec}",\n  "table_name": "{new}"' if new else m.group(0)

    s = re.sub(r'"schema_name": "([a-z]+)",\s*\n\s*"table_name": "([a-z_]+)"', repl, s)

    # database_schemas-এর বর্ণনা: এখন স্কিমা নয়, নামের শুরুতে সেকশন
    s = s.replace("-- ── ১. কোন স্কিমা কী কাজে ─────────────────────────────────────────",
                  "-- ── ১. কোন সেকশন (নামের শুরু) কী কাজে ───────────────────────────")
    s = s.replace("INSERT INTO database_schemas(name, section_bn, purpose_bn, sort_order) VALUES",
                  "-- প্রতিটি সারি = Table Editor-এ নামের শুরুর অংশ (prefix)\nINSERT INTO database_schemas(name, section_bn, purpose_bn, sort_order) VALUES")
    s = s.replace("'ডেটাবেস-স্তরের হিসাব: স্কিমা-তালিকা, সেটিংস, মাইগ্রেশন ও স্বাস্থ্য-ভিউ।'",
                  "'database_* — ডেটাবেস-স্তরের হিসাব: সেকশন-তালিকা, সেটিংস, মাইগ্রেশন ও স্বাস্থ্য-ভিউ।'")
    s = s.replace("'অ্যাডমিন টেবিল, লগইন-হিসাব, পাসওয়ার্ড রিসেট, ইমেইল-আউটবক্স, অনুমোদিত ফোন ও অডিট-লগ।'",
                  "'admin_* — অ্যাডমিন টেবিল, লগইন-হিসাব, পাসওয়ার্ড রিসেট, ইমেইল-আউটবক্স, অনুমোদিত ফোন ও অডিট-লগ।'")
    s = s.replace("'অনুষ্ঠানের পরিচয়, ফি-র হার ও প্রকাশ্য যোগাযোগ নম্বর।'",
                  "'event_* — অনুষ্ঠানের পরিচয়, ফি-র হার ও প্রকাশ্য যোগাযোগ নম্বর।'")
    s = s.replace("'ওয়েবসাইটের ১৩টি সেকশন ও ১৪ ধাপের সময়সূচি।'",
                  "'content_* — ওয়েবসাইটের ১৩টি সেকশন ও ১৪ ধাপের সময়সূচি।'")
    s = s.replace("'অংশগ্রহণকারী, নিবন্ধন ও গোপন টিকিট-লিংক।'",
                  "'participants · registrations · user_links — অংশগ্রহণকারী, নিবন্ধন ও গোপন টিকিট-লিংক (আপনার \"user\" সেকশন)।'")
    s = s.replace("'Send Money নম্বর, প্রতি নিবন্ধনের পেমেন্ট রেকর্ড ও রিফান্ড।'",
                  "'payments · payment_accounts · refunds — Send Money নম্বর, প্রতি নিবন্ধনের পেমেন্ট রেকর্ড ও রিফান্ড।'")
    s = s.replace("'QR টিকিট ও দরজার চেক-ইন।'", "'gate_* — QR টিকিট ও দরজার চেক-ইন।'")
    s = s.replace("'হিসাবের ভিউ: মোট, স্কুলভিত্তিক, দিনভিত্তিক, উপস্থিতি, রিফান্ড ও সাইজ/খাবার।'",
                  "'report_* — হিসাবের ভিউ: মোট, স্কুলভিত্তিক, দিনভিত্তিক, উপস্থিতি, রিফান্ড ও সাইজ/খাবার।'")
    s = s.replace("'কোন টেবিল কী কাজে, কার সাথে সম্পর্ক, কোন কাজে কী ঘটে।'",
                  "'guide_* — কোন টেবিল কী কাজে, কার সাথে সম্পর্ক, কোন কাজে কী ঘটে।'")
    s = s.replace("-- ২৪টি টেবিলের পরিচয় (ব্যাখ্যা)", "-- ২৪+ টেবিলের পরিচয় (ব্যাখ্যা)")
    s = s.replace("'২৫টি টেবিলের", "'৩৫+ টেবিলের")
    path.write_text(s)
    print("✏️ 22_seed.sql হালনাগাদ")


def fix_guide() -> None:
    path = SUPABASE / "20_guide.sql"
    s = path.read_text()

    # সম্পর্ক-ভিউ: এখন সব সম্পর্ক public-এর ভেতরে
    s = s.replace("""  AND ns.nspname IN ('database', 'event', 'content', 'user', 'payment', 'admin', 'gate', 'report', 'guide')""",
                  """  AND ns.nspname = 'public' AND ns2.nspname = 'public'""")

    # সারি-গণনা: guide_tables-এর table_name-ই আসল নাম
    s = s.replace("""  FOR t IN SELECT schema_name, table_name FROM guide_tables LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', t.schema_name, t.table_name) INTO n;
    out := out || jsonb_build_object(t.schema_name || '.' || t.table_name, n);""",
                  """  FOR t IN SELECT table_name FROM guide_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.table_name) INTO n;
    out := out || jsonb_build_object(t.table_name, n);""")

    # guide_overview: সারি-সংখ্যা এখন শুধু টেবিল-নাম দিয়ে
    s = s.replace("""'keyColumns', t.key_columns, 'rows', coalesce((guide.live_counts() ->> (t.schema_name || '.' || t.table_name))::bigint, 0),""",
                  """'keyColumns', t.key_columns, 'rows', coalesce((guide.live_counts() ->> t.table_name)::bigint, 0),""")
    path.write_text(s)
    print("✏️ 20_guide.sql হালনাগাদ")


def main() -> None:
    # ১) সেকশন-স্কিমার ঘোষণা সরানো (10–20 নম্বর ফাইল)
    for name in ["10_database.sql", "11_event.sql", "12_content.sql", "13_user.sql", "14_payment.sql",
                 "15_admin.sql", "16_gate.sql", "17_report.sql", "20_guide.sql"]:
        path = SUPABASE / name
        s = path.read_text()
        out = []
        for line in s.splitlines(keepends=True):
            stripped = line.strip()
            if re.match(r"CREATE SCHEMA IF NOT EXISTS (\"?)(database|event|content|user|payment|admin|gate|report|guide)\1;", stripped):
                continue
            if re.match(r"(REVOKE ALL ON SCHEMA|ALTER DEFAULT PRIVILEGES IN SCHEMA|COMMENT ON SCHEMA) ", stripped):
                continue
            if re.match(r"REVOKE ALL ON ALL (TABLES|FUNCTIONS) IN SCHEMA (report|guide)", stripped):
                continue
            out.append(line)
        path.write_text("".join(out))

    # ২) search_path পরিষ্কার
    for path in SUPABASE.glob("*.sql"):
        if "SETUP" in path.name:
            continue
        s = path.read_text()
        s = re.sub(r"SET search_path = pg_catalog, public(?:, (?:\"[a-z_]+\"|[a-z_]+))*",
                   "SET search_path = pg_catalog, public", s)
        path.write_text(s)

    # ৩) 10_database.sql-এর স্বাস্থ্য-ভিউ নতুন করে
    path = SUPABASE / "10_database.sql"
    s = path.read_text()
    start = s.index("-- ── ৪. স্বাস্থ্য-ভিউ")
    end = s.index("COMMIT;", start)
    s = s[:start] + HEALTH_VIEW + "\n" + s[end:]
    s = s.replace("-- ধাপ ১ | schema: database  —  \"ডেটাবেস সেকশন\"",
                  "-- ধাপ ১ | database_* — \"ডেটাবেস সেকশন\" (সব টেবিল public-এ)")
    s = s.replace("COMMENT ON TABLE database_schemas IS 'প্রতিটি স্কিমার উদ্দেশ্য — কোন স্কিমা জীবনের কোন সেকশনের তথ্য রাখে।';",
                  "COMMENT ON TABLE database_schemas IS 'প্রতিটি সেকশনের উদ্দেশ্য — Table Editor-এ নামের শুরুর অংশ (prefix) অনুযায়ী।';")
    s = s.replace("COMMENT ON COLUMN database_schemas.name IS 'স্কিমার নাম (database, admin, event, content, \"user\", payment, gate, report, guide)।';",
                  "COMMENT ON COLUMN database_schemas.name IS 'সেকশনের নাম-প্রিফিক্স (database, admin, event, content, user, payment, gate, report, guide)।';")
    path.write_text(s)

    # ৪) 23_harden.sql নতুন করে
    (SUPABASE / "23_harden.sql").write_text(HARDEN)
    print("✏️ 23_harden.sql নতুন করে লেখা")

    # ৫) 00_reset.sql নতুন করে
    (SUPABASE / "00_reset.sql").write_text(reset_sql())
    print("✏️ 00_reset.sql নতুন করে লেখা")

    move_seed()
    fix_guide()
    print("\n✅ ধাপ ২ সম্পন্ন")


if __name__ == "__main__":
    main()
