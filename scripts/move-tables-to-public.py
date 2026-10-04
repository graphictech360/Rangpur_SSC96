#!/usr/bin/env python3
"""সব টেবিল/ভিউ সেকশন-স্কিমা থেকে public-এ আনা — নামের শুরুতে সেকশন-প্রিফিক্স।

ফাংশন/ট্রিগার আগের স্কিমাতেই থাকে (Table Editor-এ দেখা যায় না),
তাই Table Editor খুললেই public-এ সব টেবিল একসাথে দেখা যায়।
"""
import re
from pathlib import Path

SUPABASE = Path(__file__).resolve().parent.parent / "supabase"

# ⚠️ ক্রম গুরুত্বপূর্ণ: লম্বা নাম আগে (refunds → refund এর আগে)
RENAMES = [
    ('"user".registrations', "registrations"),
    ('"user".participants', "participants"),
    ('"user".links', "user_links"),
    ("user.registrations", "registrations"),
    ("user.participants", "participants"),
    ("user.links", "user_links"),
    ("payment.payments", "payments"),
    ("payment.accounts", "payment_accounts"),
    ("payment.refunds", "refunds"),
    ("admin.admins", "admin_users"),
    ("admin.login_events", "admin_login_events"),
    ("admin.password_resets", "admin_password_resets"),
    ("admin.email_outbox", "admin_email_outbox"),
    ("admin.devices", "admin_devices"),
    ("admin.audit_logs", "admin_audit_logs"),
    ("gate.tickets", "gate_tickets"),
    ("gate.checkins", "gate_checkins"),
    ("content.sections", "content_sections"),
    ("content.schedule", "content_schedule"),
    ("event.events", "event_events"),
    ("event.fees", "event_fees"),
    ("event.contacts", "event_contacts"),
    ("report.summary", "report_summary"),
    ("report.school_wise", "report_school_wise"),
    ("report.daily", "report_daily"),
    ("report.attendance", "report_attendance"),
    ("report.refunds", "report_refunds"),
    ("report.tshirt_sizes", "report_tshirt_sizes"),
    ("report.food_preferences", "report_food_preferences"),
    ("report.collectors", "report_collectors"),
    ("guide.tables", "guide_tables"),
    ("guide.flows", "guide_flows"),
    ("guide.overview", "guide_overview"),
    ("guide.relations", "guide_relations"),
    ("guide.schemas", "guide_schemas"),
    ("guide.functions", "guide_functions"),
    ("database.schemas", "database_schemas"),
    ("database.settings", "database_settings"),
    ("database.migrations", "database_migrations"),
    ("database.health", "database_health"),
]

FILES = [
    "03_staff_setup.sql",
    "10_database.sql", "11_event.sql", "12_content.sql", "13_user.sql",
    "14_payment.sql", "15_admin.sql", "16_gate.sql", "17_report.sql",
    "18_functions.sql", "19_rules.sql", "20_guide.sql", "21_api.sql",
    "22_seed.sql", "23_harden.sql", "24_photos.sql",
]


def add_public_to_search_path(text: str) -> str:
    """প্রতিটি ফাংশনের search_path-এ public যোগ করা (টেবিল এখন public-এ)।"""
    out = []
    for line in text.splitlines(keepends=True):
        if "SET search_path = pg_catalog" in line and "public" not in line:
            line = re.sub(r"SET search_path = pg_catalog(?:,)?",
                          "SET search_path = pg_catalog, public", line, count=1)
        out.append(line)
    return "".join(out)


def main():
    total = 0
    for name in FILES:
        path = SUPABASE / name
        if not path.exists():
            print("⚠️ নেই:", name)
            continue
        text = path.read_text()
        before = text
        n = 0
        for old, new in RENAMES:
            if old in text:
                n += text.count(old)
                text = text.replace(old, new)
        text = add_public_to_search_path(text)
        if text != before:
            path.write_text(text)
            print(f"✏️ {name}: {n}টি রেফারেন্স")
            total += n
    print(f"\nমোট {total}টি রেফারেন্স বদলানো হলো।")


if __name__ == "__main__":
    main()
