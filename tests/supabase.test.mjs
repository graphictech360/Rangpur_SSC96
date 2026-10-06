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
    photoUrl:
      "https://example.supabase.co/storage/v1/object/public/photos/participants/test/x.jpg",
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
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    -- Supabase Storage-এর অনুকরণ (ছবির bucket/অনুমতি পরীক্ষার জন্য)
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    create function storage.foldername(name text) returns text[] language sql stable as $$ select string_to_array(name,'/') $$;
    create function storage.extension(name text) returns text language sql stable as $$ select split_part(name,'.',2) $$;`,
  );
  // নতুন গঠন: সব টেবিল public-এ, ধাপে ধাপে ফাইলগুলো (00_reset বাদ — PGlite খালি অবস্থায় শুরু হয়)
  const steps = [
    "10_database.sql", "11_event.sql", "12_content.sql", "13_user.sql",
    "14_payment.sql", "15_admin.sql", "16_gate.sql", "17_report.sql",
    "18_functions.sql", "19_rules.sql", "20_guide.sql", "21_api.sql", "22_seed.sql", "23_harden.sql",
    "24_photos.sql",
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
    "insert into admin_users(user_id,role,display_name) values($1,$2,$3),($4,$5,$6)",
    [admin, "admin", "Test Admin", scanner, "scanner", "Test Scanner"],
  );
  site = await as("anon", null, () => rpc("public_site"));
});
after(async () => {
  await db?.close();
});
test("গঠন: সব ২৪টি টেবিল public-এ, সবগুলোতে RLS; সিডে নমুনা মানুষ/পেমেন্ট নেই", async () => {
  assert.equal(
    (
      await query(
        `select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname = 'public' and c.relrowsecurity
                    and c.relkind='r' and c.relname in (
                      'participants','registrations','user_links','payments','payment_accounts','refunds',
                      'admin_users','admin_login_events','admin_password_resets','admin_email_outbox',
                      'admin_devices','admin_audit_logs','gate_tickets','gate_checkins',
                      'content_sections','content_schedule','event_events','event_fees','event_contacts',
                      'guide_tables','guide_flows','database_schemas','database_settings','database_migrations')`,
      )
    )[0].n,
    24,
  );
  assert.equal(
    (
      await query(
        `select count(*)::int n from information_schema.tables where table_type='BASE TABLE'
           and table_schema = 'public' and table_name in (
             'participants','registrations','user_links','payments','payment_accounts','refunds',
             'admin_users','admin_login_events','admin_password_resets','admin_email_outbox',
             'admin_devices','admin_audit_logs','gate_tickets','gate_checkins',
             'content_sections','content_schedule','event_events','event_fees','event_contacts',
             'guide_tables','guide_flows','database_schemas','database_settings','database_migrations')`,
      )
    )[0].n,
    24,
  );
  assert.equal(site.schedule.length, 14);
  assert.ok(
    site.sections.some((x) => x.key === "registration"),
    "পাবলিক সাইটে নিবন্ধন সেকশন আছে (section_key = registration)",
  );
  assert.equal(site.accounts.length, 8);
  assert.equal(site.fees.friend, 1499);
  assert.equal(
    (await query("select count(*)::int n from public.participants"))[0].n,
    0,
  );
  await assert.rejects(
    as("anon", null, () => query("select * from public.payments")),
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
    (await query("select count(*)::int n from public.participants"))[0].n,
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
    (await query("select count(*)::int n from gate_tickets"))[0].n,
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
    (await query("select count(*)::int n from gate_checkins"))[0].n,
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
    (await query("select count(*)::int n from admin_audit_logs"))[0].n > 5,
  );
});

test("ফর্মের সব ঘর (মূল ঘরসহ) এডিট, লুকানো ও টেনে সাজানো যায় — উত্তর custom_answers-এ জমা হয়", async () => {
  const seeded = (await as("anon", null, () => rpc("public_site"))).formFields;
  // মূল ঘরগুলো এখন ফর্ম-কনফিগেরই অংশ (নয়টি) — সিড থেকে আসে
  assert.equal(seeded.filter((f) => f.isBase).length, 9);
  assert.ok(seeded.some((f) => f.key === "tshirt" && f.isBase));

  // ১) অ্যাডমিন দুটি ঘর যোগ করেন — একটি বাধ্যতামূলক বাছাই, একটি ঐচ্ছিক লেখা
  const blood = "dddddddd-dddd-4ddd-addd-dddddddddddd";
  const jersey = "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee";
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formField.save",
      {
        id: blood,
        key: "blood_group",
        label: "রক্তের গ্রুপ",
        kind: "select",
        options: ["A+", "B+", "O+"],
        placeholder: "",
        help: "",
        maxLength: 10,
        required: true,
        visible: true,
        step: 2,
        order: 100,
      },
    ]),
  );
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formField.save",
      {
        id: jersey,
        key: "jersey_name",
        label: "জার্সিতে নাম",
        kind: "text",
        options: [],
        placeholder: "",
        help: "",
        maxLength: 12,
        required: false,
        visible: true,
        step: 2,
        order: 110,
      },
    ]),
  );
  const publicFields = (await as("anon", null, () => rpc("public_site")))
    .formFields;
  assert.equal(publicFields.length, 11); // ৯টি মূল ঘর + ২টি নতুন
  assert.equal(publicFields.at(-2).key, "blood_group");
  assert.equal(publicFields.at(-1).label, "জার্সিতে নাম");

  // ২) মূল ঘরের লেবেল বদলানো যায়, কিন্তু কী/ধরন বদলায় না
  const tshirt = seeded.find((f) => f.key === "tshirt");
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formField.save",
      {
        id: tshirt.id,
        key: "hacked_key",
        label: "জার্সির মাপ",
        kind: "select",
        order: tshirt.order,
        required: true,
        visible: true,
        step: 2,
      },
    ]),
  );
  const afterLabel = (await as("anon", null, () => rpc("public_site")))
    .formFields.find((f) => f.key === "tshirt");
  assert.equal(afterLabel.label, "জার্সির মাপ"); // লেবেল বদলেছে
  assert.equal(afterLabel.kind, "tshirt"); // ধরন আগের মতোই
  assert.equal(afterLabel.isBase, true);

  // ৩) টি-শার্টের ঘর লুকিয়ে দেওয়া যায় (কিছু আয়োজনে টি-শার্ট লাগে না)
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formField.save",
      { id: tshirt.id, label: "জার্সির মাপ", visible: false, order: tshirt.order },
    ]),
  );
  assert.equal(
    (await as("anon", null, () => rpc("public_site"))).formFields.some(
      (f) => f.key === "tshirt",
    ),
    false,
  );

  // ৪) নামের মতো সুরক্ষিত ঘর লুকানো বা মোছার চেষ্টা ব্যর্থ হয়
  const nameField = seeded.find((f) => f.key === "name");
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formField.save",
      { id: nameField.id, label: "নাম", visible: false, order: nameField.order },
    ]),
  );
  const nameAfter = (await as("anon", null, () => rpc("public_site")))
    .formFields.find((f) => f.key === "name");
  assert.equal(nameAfter.visible, true);
  const blockedDelete = await as("authenticated", admin, () =>
    rpc("admin_mutate", ["formField.delete", { id: nameField.id }]),
  ).then(() => null, (e) => e);
  assert.match(String(blockedDelete?.message || blockedDelete), /মূল ঘর/);

  // ৫) টেনে সাজানো: reorder এক কলেই সব ঘরের ক্রম বদলায়
  const order = (await as("anon", null, () => rpc("public_site"))).formFields;
  const reversed = order
    .slice()
    .reverse()
    .map((f, i) => ({ id: f.id, order: (i + 1) * 10 }));
  await as("authenticated", admin, () =>
    rpc("admin_mutate", ["formField.reorder", { items: reversed }]),
  );
  const reordered = (await as("anon", null, () => rpc("public_site")))
    .formFields;
  assert.equal(reordered.at(-1).key, order.at(0).key);

  // ৬) সাধারণ নিবন্ধনে বাধ্যতামূলক ঘর ফাঁকা থাকলে জমা হয় না
  const baseInput = {
    participant: {
      name: "ফর্ম ঘর পরীক্ষা",
      school: "কারমাইকেল কলেজ",
      sscRoll: "96777",
      sscRegistration: "",
      mobile: "01719000111",
      location: "রংপুর",
      tshirt: "L",
      photoUrl: "https://example.supabase.co/storage/v1/object/public/photos/x.jpg",
    },
    spouse: 0,
    children: 0,
    answers: {},
    payment: {
      provider: "nagad",
      accountId: site.accounts.find((a) => a.provider === "nagad").id,
      senderMobile: "01719000111",
      transactionId: "FORMFIELD01",
      amount: 1600,
    },
    consent: true,
  };
  const missing = await as("anon", null, () =>
    rpc("submit_registration", [baseInput]),
  ).then(() => null, (e) => e);
  assert.match(String(missing?.message || missing), /রক্তের গ্রুপ/);

  // ৭) উত্তর দিলে জমা হয় এবং উত্তর ফেরত আসে
  const created = await as("anon", null, () =>
    rpc("submit_registration", [
      {
        ...baseInput,
        answers: { blood_group: "B+", jersey_name: "রফিক" },
      },
    ]),
  );
  assert.equal(created.registration.answers.blood_group, "B+");
  assert.equal(created.registration.answers.jersey_name, "রফিক");

  // ৮) লুকানো ঘর আর ফর্মে আসে না; উত্তর আগের রেকর্ডে থেকে যায়
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formField.save",
      {
        id: jersey,
        key: "jersey_name",
        label: "জার্সিতে নাম",
        kind: "text",
        options: [],
        placeholder: "",
        help: "",
        maxLength: 12,
        required: false,
        visible: false,
        order: 110,
      },
    ]),
  );
  const afterHide = (await as("anon", null, () => rpc("public_site")))
    .formFields;
  assert.equal(afterHide.some((f) => f.key === "jersey_name"), false);
  const stillThere = await as("anon", null, () =>
    rpc("ticket_status", [created.trackingKey]),
  );
  assert.equal(stillThere.answers.jersey_name, "রফিক");

  // ৯) রিপোর্টে দেখা যায় কে কী উত্তর দিয়েছে
  const stats = (await as("authenticated", admin, () => rpc("admin_overview")))
    .stats;
  const bloodStat = (stats.formFields || []).find(
    (f) => f.key === "blood_group",
  );
  assert.equal(bloodStat.answered, 1);
  assert.deepEqual(bloodStat.top[0], { value: "B+", count: 1 });

  // ১০) ঘর মুছে ফেললে ফর্ম থেকে চলে যায়
  await as("authenticated", admin, () =>
    rpc("admin_mutate", ["formField.delete", { id: blood }]),
  );
  assert.equal(
    (await as("anon", null, () => rpc("public_site"))).formFields.some(
      (f) => f.key === "blood_group",
    ),
    false,
  );
});

test("ফর্মের লেখা ও হেডারের মেনু অ্যাডমিন প্যানেল থেকে বদলানো যায়", async () => {
  // ১) কার্ডের লেখা বদল
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "formText.save",
      { key: "card.title", value: "তোমার আসনটি তৈরি!" },
    ]),
  );
  const site1 = await as("anon", null, () => rpc("public_site"));
  assert.equal(site1.formTexts["card.title"], "তোমার আসনটি তৈরি!");

  // ২) মেনুর লিংক: নতুন যোগ, লুকানো, ক্রম বদল, মোছা
  const linkId = "11111111-2222-4333-8444-555555555555";
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "navItem.save",
      {
        id: linkId,
        kind: "link",
        label: "ফেসবুক গ্রুপ",
        target: "https://facebook.com/groups/ssc96",
        order: 900,
        visible: true,
      },
    ]),
  );
  const nav1 = (await as("anon", null, () => rpc("public_site"))).nav;
  assert.equal(nav1.at(-1).label, "ফেসবুক গ্রুপ");
  assert.equal(nav1.at(-1).kind, "link");

  const ticket = nav1.find((n) => n.kind === "ticket");
  assert.ok(ticket, "“আমার টিকিট” বোতামটি মেনুতে আছে");
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "navItem.reorder",
      { items: [{ id: ticket.id, order: 5 }] },
    ]),
  );
  const nav2 = (await as("anon", null, () => rpc("public_site"))).nav;
  assert.equal(nav2[0].kind, "ticket");

  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "navItem.save",
      { id: linkId, kind: "link", label: "ফেসবুক গ্রুপ", target: "", order: 900, visible: false },
    ]),
  );
  const nav3 = (await as("anon", null, () => rpc("public_site"))).nav;
  assert.equal(nav3.some((n) => n.label === "ফেসবুক গ্রুপ"), false);

  await as("authenticated", admin, () =>
    rpc("admin_mutate", ["navItem.delete", { id: linkId }]),
  );
  const admin1 = await as("authenticated", admin, () => rpc("admin_overview"));
  assert.equal(admin1.nav.some((n) => n.label === "ফেসবুক গ্রুপ"), false);
  assert.equal(admin1.formTexts["card.title"], "তোমার আসনটি তৈরি!");

  // ৩) লোগোর লিংক বদলানো যায় (হেডারের লোগো)
  const branding = admin1.sections.find((x) => x.key === "branding");
  await as("authenticated", admin, () =>
    rpc("admin_mutate", [
      "section.save",
      {
        id: branding.id,
        key: "branding",
        title: "RANGPUR SSC 96",
        subtitle: "বন্ধুত্বের উৎসব",
        imageUrl: "https://example.supabase.co/storage/v1/object/public/photos/branding/x.jpg",
        order: 10,
        visible: true,
      },
    ]),
  );
  const branding2 = (await as("anon", null, () => rpc("public_site"))).sections.find(
    (x) => x.key === "branding",
  );
  assert.match(branding2.imageUrl, /branding\/x\.jpg/);
});
