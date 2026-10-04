// Optional maintainer helper: regenerates INITIAL SQL content from server/seed.mjs.
// Does not connect to Supabase or modify any database.
import {
  seedEvent,
  seedSections,
  seedSchedule,
  collectors,
} from "../server/seed.mjs";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const uuid = (s) => {
  const h = createHash("sha256")
    .update("rangpur-ssc96:" + s)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
const sections = seedSections.map((s) => ({
  id: uuid("section-" + s.key),
  section_key: s.key,
  title: s.title,
  subtitle: s.subtitle,
  body: s.body,
  image_url: s.imageUrl,
  sort_order: s.order,
  is_visible: s.visible,
}));
const schedule = seedSchedule.map((s) => ({
  id: uuid("schedule-" + s.order),
  start_time: s.time,
  period: s.period,
  title: s.title,
  note: s.note,
  sort_order: s.order,
  is_visible: true,
}));
const accounts = ["bkash", "nagad"].flatMap((provider) =>
  collectors.map(([name, mobile], i) => ({
    id: uuid("account-" + provider + "-" + name),
    provider,
    collector_name: name,
    mobile,
    sort_order: i,
    is_active: true,
  })),
);
let sql = `-- Rangpur_SSC96 | Initial event content ONLY. No sample people/payments.\n-- Safe to rerun: existing admin-edited rows are not overwritten.\nBEGIN;\nINSERT INTO ssc96.events(id,slug,name,tagline,date_label,is_dummy_date,venue,city,venue_english,registration_open) VALUES(${quote(uuid("event"))},'rangpur-ssc96',${quote(seedEvent.name)},${quote(seedEvent.tagline)},${quote(seedEvent.dateLabel)},true,${quote(seedEvent.venue)},${quote(seedEvent.city)},${quote(seedEvent.venueEnglish)},true) ON CONFLICT(slug) DO NOTHING;\n`;
for (const [k, v] of Object.entries({ friend: 1499, spouse: 500, child: 200 }))
  sql += `INSERT INTO ssc96.event_fees(event_id,kind,amount) SELECT id,${quote(k)},${v} FROM ssc96.events WHERE slug='rangpur-ssc96' ON CONFLICT(event_id,kind) DO NOTHING;\n`;
function block(table, rows, fields, conflict = "id") {
  const columns = Object.keys(fields);
  return `\nINSERT INTO ssc96.${table}(event_id,${columns.join(",")})\nSELECT e.id,${columns.map((k) => "x." + k).join(",")}\nFROM ssc96.events e CROSS JOIN jsonb_to_recordset($seed$${JSON.stringify(rows, null, 2)}$seed$::jsonb) AS x(${columns.map((k) => k + " " + fields[k]).join(",")})\nWHERE e.slug='rangpur-ssc96' ON CONFLICT(${conflict}) DO NOTHING;\n`;
}
sql += block(
  "content_sections",
  sections,
  {
    id: "uuid",
    section_key: "text",
    title: "text",
    subtitle: "text",
    body: "text",
    image_url: "text",
    sort_order: "integer",
    is_visible: "boolean",
  },
  "event_id,section_key",
);
sql += block("event_schedule", schedule, {
  id: "uuid",
  start_time: "time",
  period: "text",
  title: "text",
  note: "text",
  sort_order: "integer",
  is_visible: "boolean",
});
sql += block("payment_accounts", accounts, {
  id: "uuid",
  provider: "text",
  collector_name: "text",
  mobile: "text",
  sort_order: "integer",
  is_active: "boolean",
});
sql += "COMMIT;\n";
writeFileSync(new URL("../supabase/02_seed.sql", import.meta.url), sql);
console.log(
  `SQL ready: ${sections.length} content rows, ${schedule.length} schedule rows, ${accounts.length} collection accounts.`,
);
