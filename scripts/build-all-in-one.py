"""০৪_SETUP_ALL_IN_ONE.sql নতুন করে বানানো — সব ফাইল একসাথে (এক পেস্টে বসানোর জন্য)।"""

from pathlib import Path

root = Path("/home/user/rangpur-ssc96/supabase")
order = [
    ("00_reset.sql", "ধাপ ০ | পুরোনো সব গঠন মুছে ফেলা (auth অ্যাকাউন্ট অটুট)"),
    ("10_database.sql", "ধাপ ১ | database — স্কিমা-তালিকা, সেটিংস, স্বাস্থ্য"),
    ("11_event.sql", "ধাপ ২ | event — অনুষ্ঠান, ফি, যোগাযোগ"),
    ("12_content.sql", "ধাপ ৩ | content — পেজের সেকশন ও সময়সূচি"),
    ("13_user.sql", "ধাপ ৪ | user — অংশগ্রহণকারী, নিবন্ধন, গোপন লিংক"),
    ("14_payment.sql", "ধাপ ৫ | payment — Send Money নম্বর, পেমেন্ট, রিফান্ড"),
    ("15_admin.sql", "ধাপ ৬ | admin — অ্যাডমিন, লগইন, রিসেট, ডিভাইস, অডিট"),
    ("16_gate.sql", "ধাপ ৭ | gate — QR টিকিট ও চেক-ইন"),
    ("17_report.sql", "ধাপ ৮ | report — হিসাবের ভিউ"),
    ("18_functions.sql", "ধাপ ৯ | হিসাব-ইঞ্জিন ও টুলবক্স"),
    ("19_rules.sql", "ধাপ ১০ | নিয়ম ও স্বয়ংক্রিয় প্রতিক্রিয়া"),
    ("20_guide.sql", "ধাপ ১১ | guide — গঠন-বর্ণনা"),
    ("21_api.sql", "ধাপ ১২ | public RPC দরজাগুলো"),
    ("22_seed.sql", "ধাপ ১৩ | শুরুর ডেটা, টেবিল-বর্ণনা ও কার্য-প্রবাহ"),
    ("23_harden.sql", "ধাপ ১৪ | নিরাপত্তা: RLS ও অনুমতি বন্ধ"),
    ("24_photos.sql", "ধাপ ১৫ | ছবি: Storage bucket, photo_url কলাম ও ছবিসহ RPC"),
]

header = """-- ═══════════════════════════════════════════════════════════════════
-- Rangpur SSC 96 Festival — সম্পূর্ণ সেটআপ (এক ফাইলে সব ধাপ)
-- ব্যবহার: Supabase Dashboard → SQL Editor → New query → পুরো ফাইল পেস্ট → Run
--
-- নতুন গঠন — ৯টি সেকশন-স্কিমা, প্রতিটির নিজের আলাদা টেবিল:
--   user        → participants · registrations · links
--   admin       → admins · login_events · password_resets · email_outbox · devices · audit_logs
--   event       → events · fees · contacts
--   content     → sections · schedule
--   payment     → accounts · payments · refunds
--   gate        → tickets · checkins
--   report      → হিসাবের ৮টি ভিউ
--   guide       → tables · flows (গঠন-বর্ণনা)
--   database    → schemas · settings · migrations · health
--
-- ⚠️ Table Editor-এ টেবিল দেখতে উপরের schema dropdown থেকে সেকশনের নাম বাছুন।
--    এক টেবিলে ক্লিক করলেই শুধু সেই টেবিলের ডেটা দেখাবে।
-- ⚠️ এই স্কিমাগুলো Data API-তে exposed করবেন না — সব কাজ RPC দিয়েই হয়।
-- ⚠️ admin.admins-এ ভূমিকা বসাতে শেষে 03_staff_setup.sql আলাদা করে চালান।
-- ═══════════════════════════════════════════════════════════════════
"""

parts = [header]
for name, label in order:
    text = (root / name).read_text().strip()
    parts.append(
        "\n\n-- ═══════════════════════════════════════════════════════════════════\n"
        f"-- {label}  ({name})\n"
        "-- ═══════════════════════════════════════════════════════════════════\n" + text
    )

out = Path("/home/user/rangpur-ssc96/supabase/04_SETUP_ALL_IN_ONE.sql")
out.write_text("\n".join(parts) + "\n")
print("✅ 04_SETUP_ALL_IN_ONE.sql নতুন করে বানানো হলো:", len(out.read_text().splitlines()), "লাইন")
