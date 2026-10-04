#!/usr/bin/env node
/**
 * Supabase প্রকল্পে পুরো সেটআপ এক কমান্ডে:
 *   ১) supabase/01_schema.sql  — ১৪টি টেবিল, RLS, RPC
 *   ২) supabase/02_seed.sql    — ইভেন্ট, ১৩ কনটেন্ট, ১৪ সময়সূচি, ৮ পেমেন্ট নম্বর
 *   ৩) (ঐচ্ছিক) staff.yml-এর ইমেইল দিয়ে অ্যাকাউন্ট তৈরি + ভূমিকা বসানো
 *   ৪) যাচাই: টেবিল/RLS/RPC গণনা, anon-এর অনুমতি, staff ভূমিকা
 *
 * ব্যবহার:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/supabase-apply.mjs --ref <project-ref>
 *   ... --admin you@example.com --staff a@x.com --staff b@x.com
 *   ... --verify-only        (শুধু যাচাই)
 *
 * দরকার: scoped Personal Access Token, scope = database:read + database:write (+ auth:read/write,
 * অ্যাকাউন্ট তৈরি করতে হলে)। কোনো service_role/secret key লাগে না।
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.supabase.com/v1";
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const list = (name) => {
  const out = [];
  args.forEach((a, i) => {
    if (a === "--" + name && args[i + 1]) out.push(args[i + 1]);
  });
  return out;
};
const ref = flag("ref", process.env.SUPABASE_PROJECT_REF || "");
const token = process.env.SUPABASE_ACCESS_TOKEN || "";
const adminEmail = flag("admin", "");
const staffEmails = list("staff");
const verifyOnly = args.includes("--verify-only");
const root = path.resolve(import.meta.dirname, "..");

function die(message) {
  console.error("✖ " + message);
  process.exit(1);
}

// URL থেকে project ref বের করার সুবিধা: --ref https://xxxx.supabase.co দিলেও চলবে
const projectRef =
  ref.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || ref.trim();
if (!token) {
  die(
    "SUPABASE_ACCESS_TOKEN পাওয়া যায়নি।\n" +
      "  Supabase → Account → Access Tokens → নতুন scoped token\n" +
      "  scope: database:read, database:write (+ ঐচ্ছিক auth:read)\n" +
      "  তারপর: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/supabase-apply.mjs --ref <ref> --admin you@example.com",
  );
}
if (!projectRef)
  die("project ref প্রয়োজন: --ref mbuzwqsrnmergrtetwqq (অথবা পুরো URL)।");

async function api(pathname, { method = "POST", body } = {}) {
  const response = await fetch(API + pathname, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw Object.assign(
      new Error(`${response.status} ${detail.slice(0, 400)}`),
      {
        status: response.status,
      },
    );
  }
  return data;
}

const sql = (query, { readOnly = false } = {}) =>
  api(`/projects/${projectRef}/database/query${readOnly ? "/read-only" : ""}`, {
    body: { query },
  });

async function runFile(file, label) {
  const text = await readFile(path.join(root, "supabase", file), "utf8");
  process.stdout.write(`→ ${label} (${file}) … `);
  await sql(text);
  console.log("সম্পন্ন");
}

async function verify() {
  const rows = async (query) => {
    const data = await sql(query, { readOnly: true });
    return Array.isArray(data) ? data : (data?.result ?? []);
  };
  const [tables] = await rows(
    `select json_build_object(
       'schemas', (select count(*) from pg_namespace where nspname in
         ('database','admin','event','content','registration','payment','gate','report','guide')),
       'tables', (select count(*) from information_schema.tables where table_type='BASE TABLE'
         and table_schema in ('database','admin','event','content','registration','payment','gate','guide')),
       'with_rls', (select count(*) from pg_tables
         where schemaname in ('database','admin','event','content','registration','payment','gate','guide') and rowsecurity),
       'report_views', (select count(*) from information_schema.views where table_schema='report'),
       'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                     where p.prosecdef and (n.nspname='database' or (n.nspname='public' and p.proname in (
                       'public_site','submit_registration','ticket_status','staff_identity','admin_overview',
                       'admin_mutate','register_device','device_state','check_in','guide_overview',
                       'log_login','request_password_reset')))),
       'content', (select count(*) from content.sections),
       'schedule', (select count(*) from content.schedule),
       'accounts', (select count(*) from payment.accounts),
       'contacts', (select count(*) from event.contacts),
       'admins', (select count(*) from admin.admins),
       'flow_rows', (select count(*) from guide.flows),
       'table_rows', (select count(*) from guide.tables),
       'table_comments', (select count(*) from pg_description d join pg_class c on c.oid=d.objoid
                          join pg_namespace n on n.oid=c.relnamespace
                          where n.nspname in ('database','admin','event','content','registration','payment','gate','guide') and d.objsubid=0),
       'column_comments', (select count(*) from pg_description d join pg_class c on c.oid=d.objoid
                           join pg_namespace n on n.oid=c.relnamespace
                           where n.nspname in ('database','admin','event','content','registration','payment','gate','guide') and d.objsubid>0),
       'indexes', (select count(*) from pg_indexes
                   where schemaname in ('database','admin','event','content','registration','payment','gate','guide')),
       'triggers', (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
                    join pg_namespace n on n.oid=c.relnamespace
                    where not t.tgisinternal and n.nspname in ('database','admin','event','content','registration','payment','gate')),
       'exposed', (select count(*) from pg_namespace where nspname in
         ('database','admin','event','content','registration','payment','gate','report','guide')
         and nspname in (select unnest(string_to_array(current_setting('pgrst.db_schemas', true), ','))))
     ) as report`,
  );
  return tables.report ?? tables;
}

/**
 * ইতিমধ্যে তৈরি Auth অ্যাকাউন্ট খুঁজে বের করে তার RLS ভূমিকা বসায়।
 * পাসওয়ার্ড কখনো পড়া/লেখা হয় না — অ্যাকাউন্ট মালিক নিজে Dashboard-এ বানান।
 */
async function findUser(email) {
  const safe = email.replace(/'/g, "''");
  const rows = await sql(
    `select id, email from auth.users where lower(email)=lower('${safe}') limit 1`,
    { readOnly: true },
  );
  return Array.isArray(rows) ? rows[0] : undefined;
}

async function setRole(id, role, displayName, email) {
  await sql(
    `insert into admin.admins(user_id,role,display_name,is_active)
     values ('${id}','${role}','${displayName.replace(/'/g, "''")}',true)
     on conflict(user_id) do update set role=excluded.role, display_name=excluded.display_name, is_active=true;`,
  );
  return email;
}

console.log(`প্রকল্প: ${projectRef}`);
console.log(verifyOnly ? "ধরন: শুধু যাচাই" : "ধরন: সম্পূর্ণ সেটআপ");
if (!verifyOnly) {
  const steps = [
    ["10_database.sql", "database সেকশন: স্কিমা-তালিকা, সেটিংস, স্বাস্থ্য"],
    ["11_event.sql", "event সেকশন: অনুষ্ঠান, ফি, যোগাযোগ নম্বর"],
    ["12_content.sql", "content সেকশন: সেকশন ও সময়সূচি"],
    [
      "13_registration.sql",
      "registration সেকশন: অংশগ্রহণকারী, নিবন্ধন, গোপন লিংক",
    ],
    ["14_payment.sql", "payment সেকশন: Send Money নম্বর, পেমেন্ট, রিফান্ড"],
    ["15_admin.sql", "admin সেকশন: অ্যাডমিন টেবিল, লগইন, রিসেট, ডিভাইস, অডিট"],
    ["16_gate.sql", "gate সেকশন: QR টিকিট ও চেক-ইন"],
    ["17_report.sql", "report সেকশন: হিসাবের ভিউ"],
    ["18_functions.sql", "database টুলবক্স ও হিসাব-ইঞ্জিন"],
    ["19_rules.sql", "নিয়ম ও প্রতিক্রিয়া (ট্রিগার)"],
    ["20_guide.sql", "guide সেকশন: গঠন-বর্ণনা"],
    ["21_api.sql", "public RPC দরজাগুলো"],
    ["22_seed.sql", "শুরুর ডেটা, টেবিল-বর্ণনা ও ১৬টি কার্য-প্রবাহ"],
    ["23_harden.sql", "নিরাপত্তা: সব টেবিলে RLS চালু, বাইরের অনুমতি বন্ধ"],
  ];
  for (const [file, label] of steps) await runFile(file, label);
}

const missing = [];
const ready = [];
if (!verifyOnly) {
  for (const email of [adminEmail, ...staffEmails].filter(Boolean)) {
    const user = await findUser(email);
    if (!user) {
      missing.push(email);
      continue;
    }
    const role = email === adminEmail ? "admin" : "scanner";
    const name = role === "admin" ? "প্রধান আয়োজক" : "গেট স্টাফ";
    await setRole(user.id, role, name, email);
    ready.push({ email, role });
    console.log(
      `→ ${role === "admin" ? "অ্যাডমিন" : "স্টাফ"} ভূমিকা বসানো হলো: ${email}`,
    );
  }
}
if (missing.length) {
  console.log(
    "\n⚠️  এই ইমেইলগুলো এখনো Supabase Authentication-এ নেই (পাসওয়ার্ড আপনিই ঠিক করবেন):",
  );
  for (const email of missing) console.log("   • " + email);
  console.log(
    "Supabase Dashboard → Authentication → Users → Add user → email+password দিয়ে অ্যাকাউন্ট বানান,",
  );
  console.log(
    "তারপর আবার চালান:  npm run supabase -- --ref " +
      projectRef +
      " --admin <ইমেইল> …",
  );
}
if (ready.length) {
  const list = await sql(
    `select u.email, s.role, s.display_name, s.is_active
       from admin.admins a left join auth.users u on u.id = a.user_id
      order by a.role, a.email`,
    { readOnly: true },
  );
  console.log("\nবর্তমান স্টাফ তালিকা:");
  for (const row of Array.isArray(list) ? list : [])
    console.log(
      `   ${row.role === "admin" ? "🛡️" : "🎟️"} ${row.email} — ${row.display_name}${row.is_active ? "" : " (নিষ্ক্রিয়)"}`,
    );
}

const report = await verify();
console.log("\n=== যাচাই ===");
console.log(
  `সেকশন-স্কিমা: ${report.schemas} | টেবিল: ${report.tables} (RLS চালু: ${report.with_rls}) | রিপোর্ট ভিউ: ${report.report_views}`,
);
console.log(`SECURITY DEFINER ফাংশন: ${report.functions}`);
console.log(
  `গোছানো অবস্থা → টেবিল-বর্ণনা ${report.table_comments}, কলাম-বর্ণনা ${report.column_comments}, ইনডেক্স ${report.indexes}, ট্রিগার ${report.triggers}, গাইড টেবিল ${report.table_rows}, কার্য-প্রবাহ ${report.flow_rows}`,
);
console.log(
  `সিড ডেটা → সেকশন ${report.content}, সময়সূচি ${report.schedule}, Send Money নম্বর ${report.accounts}, যোগাযোগ ${report.contacts}, অ্যাডমিন ${report.admins}`,
);
if (Number(report.exposed) > 0)
  console.log(
    "⚠️  সতর্কতা: কোনো সেকশন-স্কিমা Data API-তে exposed — Settings → API → Exposed schemas থেকে সরান।",
  );
else
  console.log(
    "সেকশন-স্কিমাগুলো Data API-তে exposed নয় ✅ (Settings → API-তেও মিলিয়ে নিন)",
  );

// অ্যানন অনুমতি যাচাই: পাবলিক RPC চলে, সরাসরি টেবিল পড়া যায় না
const anonChecks = await sql(
  `select json_build_object(
     'public_rpc', (select has_function_privilege('anon','public.public_site()','execute')),
     'submit_rpc', (select has_function_privilege('anon','public.submit_registration(jsonb)','execute')),
     'ticket_rpc', (select has_function_privilege('anon','public.ticket_status(text)','execute')),
     'admin_rpc', (select has_function_privilege('anon','public.admin_mutate(text,jsonb)','execute')),
     'checkin_rpc', (select has_function_privilege('anon','public.check_in(text,text)','execute')),
     'direct_select', (select has_table_privilege('anon','registration.participants','select'))
   ) as checks`,
  { readOnly: true },
);
const checks = anonChecks[0]?.checks ?? {};
console.log(
  `anon → public_site: ${checks.public_rpc ? "অনুমোদিত ✅" : "না ✖"} | সরাসরি participants পড়া: ${
    checks.direct_select ? "সম্ভব ✖" : "নিষিদ্ধ ✅"
  } | registration জমা: ${checks.submit_rpc ? "অনুমোদিত ✅" : "না ✖"}`,
);

console.log(
  "\nসব ধাপ শেষ। এখন অ্যাপে DATA_MODE=supabase + publishable key বসিয়ে ডিপ্লয় করুন।",
);
