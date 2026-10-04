import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let db, site, pending, device;
const admin = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  scanner = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const deviceToken = randomBytes(32).toString("hex");
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const rpc = async (name, args = []) => {
  const parameters = args.map((_, i) => `$${i + 1}`).join(",");
  return (
    await query(`select public.${name}(${parameters}) as result`, args)
  )[0].result;
};
async function as(role, uid, fn) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid || "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}
const input = (overrides = {}) => ({
  participant: {
    name: "পরীক্ষার বন্ধু",
    school: "রংপুর জিলা স্কুল",
    sscRoll: "96123",
    sscRegistration: "960123",
    mobile: "01790000001",
    location: "ঢাকা",
    tshirt: "L",
  },
  spouse: 1,
  children: 2,
  food: "সাধারণ",
  notes: "",
  payment: {
    provider: "bkash",
    accountId: site.accounts.find((a) => a.provider === "bkash").id,
    senderMobile: "01790000001",
    transactionId: "TEST-ABC96",
    amount: 2399,
  },
  consent: true,
  ...overrides,
});
before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  // নতুন গঠন: ৯টি সেকশন-স্কিমা, ধাপে ধাপে ফাইলগুলো (00_reset বাদ — PGlite খালি অবস্থায় শুরু হয়)
  const steps = [
    "10_database.sql", "11_event.sql", "12_content.sql", "13_registration.sql",
    "14_payment.sql", "15_admin.sql", "16_gate.sql", "17_report.sql",
    "18_functions.sql", "19_rules.sql", "20_guide.sql", "21_api.sql", "22_seed.sql", "23_harden.sql",
  ];
  for (const file of steps) {
    await db.exec(readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8"));
  }
  await query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    admin,
    "admin@example.test",
    scanner,
    "staff@example.test",
  ]);
  await query(
    "insert into admin.admins(user_id,role,display_name) values($1,$2,$3),($4,$5,$6)",
    [admin, "admin", "Test Admin", scanner, "scanner", "Test Scanner"],
  );
  site = await as("anon", null, () => rpc("public_site"));
});
after(async () => {
  await db?.close();
});
test("schema: ৯ সেকশন-স্কিমা, ২৪টি আলাদা টেবিল, সবগুলোতে RLS; সিডে নমুনা মানুষ/পেমেন্ট নেই", async () => {
  assert.equal(
    (
      await query(
        `select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname in ('database','admin','event','content','registration','payment','gate','guide')
                    and c.relkind='r' and c.relrowsecurity`,
      )
    )[0].n,
    24,
  );
  assert.equal(
    (
      await query(
        `select count(*)::int n from information_schema.tables where table_type='BASE TABLE'
           and table_schema in ('database','admin','event','content','registration','payment','gate','guide')`,
      )
    )[0].n,
    24,
  );
  assert.equal(site.schedule.length, 14);
  assert.equal(site.accounts.length, 8);
  assert.equal(site.fees.friend, 1499);
  assert.equal(
    (await query("select count(*)::int n from registration.participants"))[0].n,
    0,
  );
  await assert.rejects(
    as("anon", null, () => query("select * from payment.payments")),
    /permission denied/,
  );
});
test("server-side total rejects fee tampering and rolls back the whole registration", async () => {
  const data = input();
  data.payment.amount = 1;
  await assert.rejects(
    as("anon", null, () => rpc("submit_registration", [data])),
    /টাকার পরিমাণ/,
  );
  assert.equal(
    (await query("select count(*)::int n from registration.participants"))[0].n,
    0,
  );
});
test("anonymous registration always starts pending; no QR before approval", async () => {
  pending = await as("anon", null, () =>
    rpc("submit_registration", [
      input({ status: "approved", approvedAt: "2026-01-01" }),
    ]),
  );
  assert.equal(pending.registration.status, "pending");
  assert.equal(pending.registration.total, 2399);
  assert.equal(pending.registration.qrPayload, null);
  assert.match(pending.trackingKey, /^[a-f0-9]{64}$/);
  assert.equal(
    (await query("select count(*)::int n from gate.tickets"))[0].n,
    0,
  );
});
test("duplicate transaction IDs (case insensitive) and phone numbers are rejected", async () => {
  const data = input();
  data.participant.mobile = "01790000002";
  data.payment.transactionId = "test-abc96";
  await assert.rejects(
    as("anon", null, () => rpc("submit_registration", [data])),
    /আগে ব্যবহৃত/,
  );
  const another = input();
  another.payment.transactionId = "ANOTHER-TRX";
  await assert.rejects(
    as("anon", null, () => rpc("submit_registration", [another])),
    /ইতিমধ্যে নিবন্ধন/,
  );
});
test("participants cannot approve/check in; scanner role cannot use admin RPCs", async () => {
  await assert.rejects(
    as("anon", null, () =>
      rpc("admin_mutate", [
        "registration.approve",
        { id: pending.registration.id, verified: true },
      ]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    as("anon", null, () => rpc("check_in", ["R96-00001", deviceToken])),
    /permission denied/,
  );
  await assert.rejects(
    as("authenticated", scanner, () =>
      rpc("admin_mutate", [
        "registration.approve",
        { id: pending.registration.id, verified: true },
      ]),
    ),
    /অ্যাডমিন/,
  );
});
test("admin approval requires explicit manual verification and then issues a QR", async () => {
  await assert.rejects(
    as("authenticated", admin, () =>
      rpc("admin_mutate", [
        "registration.approve",
        { id: pending.registration.id, verified: false },
      ]),
    ),
    /নিশ্চিত করুন/,
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "registration.approve",
      { id: pending.registration.id, verified: true },
    ]),
  );
  const ticket = await as("anon", null, () =>
    rpc("ticket_status", [pending.trackingKey]),
  );
  assert.equal(ticket.status, "approved");
  assert.equal(ticket.payment.status, "verified");
  assert.match(ticket.qrPayload, /^R96:[a-f0-9-]{36}:[a-f0-9]{64}$/);
  pending.registration = ticket;
  await assert.rejects(
    as("anon", null, () =>
      rpc("ticket_status", [randomBytes(32).toString("hex")]),
    ),
    /পাওয়া যায়নি/,
  );
});
test("logged-in but unapproved staff browser cannot check in", async () => {
  device = await as("authenticated", scanner, () =>
    rpc("register_device", ["Gate phone 1", deviceToken]),
  );
  assert.equal(device.status, "pending");
  await assert.rejects(
    as("authenticated", scanner, () =>
      rpc("check_in", [pending.registration.qrPayload, deviceToken]),
    ),
    /অনুমোদিত নয়/,
  );
});
test("approved device can check in once; duplicate scan is not a second entry", async () => {
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "device.update",
      { id: device.id, status: "approved" },
    ]),
  );
  const first = await as("authenticated", scanner, () =>
    rpc("check_in", [pending.registration.qrPayload, deviceToken]),
  );
  assert.equal(first.alreadyCheckedIn, false);
  assert.equal(first.people, 4);
  const second = await as("authenticated", scanner, () =>
    rpc("check_in", [pending.registration.qrPayload, deviceToken]),
  );
  assert.equal(second.alreadyCheckedIn, true);
  assert.equal(
    (await query("select count(*)::int n from gate.checkins"))[0].n,
    1,
  );
});
test("forged QR and revoked devices are rejected", async () => {
  const fake = `R96:${pending.registration.id}:${randomBytes(32).toString("hex")}`;
  await assert.rejects(
    as("authenticated", scanner, () => rpc("check_in", [fake, deviceToken])),
    /QR টিকিট সঠিক নয়/,
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "device.update",
      { id: device.id, status: "revoked" },
    ]),
  );
  await assert.rejects(
    as("authenticated", scanner, () =>
      rpc("check_in", [pending.registration.qrPayload, deviceToken]),
    ),
    /অনুমোদিত নয়/,
  );
});
test("existing fee snapshots remain unchanged when rates change; content/schedule/accounts are editable", async () => {
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "fees.save",
      { friend: 1600, spouse: 600, child: 250 },
    ]),
  );
  assert.equal(
    (await as("anon", null, () => rpc("ticket_status", [pending.trackingKey])))
      .total,
    2399,
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "event.save",
      { ...site.event, name: "Edited Festival" },
    ]),
  );
  const id = "cccccccc-cccc-4ccc-accc-cccccccccccc";
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "schedule.save",
      {
        id,
        time: "18:30",
        period: "সন্ধ্যা",
        title: "Test addition",
        note: "",
        order: 15,
        visible: true,
      },
    ]),
  );
  assert.equal(
    (await as("anon", null, () => rpc("public_site"))).schedule.length,
    15,
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", ["schedule.delete", { id }]),
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", ["account.delete", { id: site.accounts[0].id }]),
  );
  assert.equal(
    (await as("anon", null, () => rpc("public_site"))).accounts.length,
    7,
  );
  await db.exec(
    readFileSync(new URL("../supabase/22_seed.sql", import.meta.url), "utf8"),
  );
  const again = await as("anon", null, () => rpc("public_site"));
  assert.equal(again.event.name, "Edited Festival");
  assert.equal(again.schedule.length, 14);
  assert.equal(again.fees.friend, 1600);
  assert.equal(again.accounts.length, 7);
});
test("receipt recovery reissue invalidates old link, and removal revokes receipt/check-in", async () => {
  const oldQr = pending.registration.qrPayload;
  const result = await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "registration.reissue",
      { id: pending.registration.id },
    ]),
  );
  await assert.rejects(
    as("anon", null, () => rpc("ticket_status", [pending.trackingKey])),
    /পাওয়া যায়নি/,
  );
  assert.equal(
    (await as("anon", null, () => rpc("ticket_status", [result.trackingKey])))
      .qrPayload,
    oldQr,
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "registration.remove",
      { id: pending.registration.id },
    ]),
  );
  await assert.rejects(
    as("anon", null, () => rpc("ticket_status", [result.trackingKey])),
    /পাওয়া যায়নি/,
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "device.update",
      { id: device.id, status: "approved" },
    ]),
  );
  await assert.rejects(
    as("authenticated", scanner, () => rpc("check_in", [oldQr, deviceToken])),
    /বাতিল/,
  );
  assert.ok(
    (await query("select count(*)::int n from admin.audit_logs"))[0].n > 5,
  );
});
