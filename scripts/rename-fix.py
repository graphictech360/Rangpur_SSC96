"""22_seed.sql-এ বাকি থাকা registration → user ঠিক করা (JSON মান, কার্য-প্রবাহের সারণি ইত্যাদি)।"""

from pathlib import Path
import re

p = Path("/home/user/rangpur-ssc96/supabase/22_seed.sql")
s = p.read_text()

n1 = s.count('"schema_name": "registration"')
s = s.replace('"schema_name": "registration"', '"schema_name": "user"')

n2 = len(re.findall(r'"table": "registration\.', s))
s = s.replace('"table": "registration.', '"table": "user.')

s = s.replace("registration স্কিমা:", "user স্কিমা:")
s = s.replace("'13_registration'", "'13_user'")
s = s.replace("'বন্ধু ও নিবন্ধন সেকশন'", "'ব্যবহারকারী (বন্ধু) ও নিবন্ধন সেকশন'")

p.write_text(s)
print("JSON schema_name বদল:", n1, "| effects-এর table:", n2)

# বাকি যা আছে দেখা
left = [
    (i, line)
    for i, line in enumerate(s.splitlines(), 1)
    if re.search(r"\bregistration\b", line)
    and not re.search(r"registration(s|_json|_id|_open|_created|\.approve|\.reject|\.remove|\.reissue|\.restore)", line)
]
print("বাকি লেখা:", [x[0] for x in left][:10])
