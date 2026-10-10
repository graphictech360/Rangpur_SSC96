import { z } from "zod";
export const mobilePattern = /^(?:\+?880|0)1[3-9]\d{8}$/;
export const normalizeMobile = (value) =>
  String(value || "")
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .replace(/[\s()-]/g, "")
    .replace(/^\+?880/, "0");
export const cleanText = (value) => String(value ?? "").trim();
const mobile = z
  .string()
  .transform(normalizeMobile)
  .refine((x) => /^01[3-9]\d{8}$/.test(x), "সঠিক বাংলাদেশি মোবাইল নম্বর দিন।");
const text = (max = 200) => z.string().trim().min(1, "এই তথ্যটি দিন।").max(max);
export const participantSchema = z.object({
  // নাম ও মোবাইল কখনোই ফাঁকা চলবে না (এগুলো সুরক্ষিত ঘর);
  // বাকিগুলো অ্যাডমিন লুকিয়ে দিলে ফাঁকা এলেও নিবন্ধন আটকাবে না।
  name: text(120),
  school: z.string().trim().max(200).default(""),
  sscRoll: z.string().trim().max(30).default(""),
  sscRegistration: z.string().trim().max(40).default(""),
  mobile,
  location: z.string().trim().max(200).default(""),
  tshirt: z.enum(["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
  // ছবির ঠিকানা: অনলাইনে Supabase Storage-এর ছোট লিংক, ডেমো/অফলাইনে data URI
  photoUrl: z
    .string()
    .trim()
    .max(1_400_000)
    .refine(
      (v) =>
        v === "" ||
        (/^https:\/\//.test(v) && v.length <= 400) ||
        /^data:image\/(jpeg|jpg|png|webp);base64,/.test(v),
      "ছবির লিংক সঠিক নয়।",
    )
    .default(""),
});
export const registrationSchema = z.object({
  participant: participantSchema,
  spouse: z.coerce.number().int().min(0).max(1),
  children: z.coerce.number().int().min(0).max(20),
  // ফর্ম থেকে সরানো হয়েছে; পুরোনো ক্লায়েন্ট পাঠালেও চলবে (না দিলে ফাঁকা থাকে)
  food: z
    .enum(["সাধারণ", "নিরামিষ", "বিশেষ অনুরোধ", ""])
    .optional()
    .default(""),
  notes: z.string().trim().max(600).default(""),
  // ফর্মে অ্যাডমিন যে ঘরগুলো যোগ করেছেন, সেগুলোর উত্তর
  answers: z.record(z.string().max(40), z.string().max(2000)).optional().default({}),
  payment: z.object({
    provider: z.enum(["bkash", "nagad"]),
    accountId: z.string().uuid(),
    senderMobile: mobile,
    transactionId: z
      .string()
      .trim()
      .min(5, "সঠিক ট্রানজেকশন আইডি দিন।")
      .max(64)
      .regex(
        /^[a-zA-Z0-9-]+$/,
        "ট্রানজেকশন আইডিতে শুধু ইংরেজি অক্ষর, সংখ্যা ও হাইফেন দিন।",
      ),
    amount: z.coerce.number().positive(),
  }),
  consent: z.literal(true, { error: "শর্তে সম্মতি দিন।" }),
});
export const eventSchema = z.object({
  name: text(160),
  tagline: text(200),
  dateLabel: text(80),
  isDummyDate: z.boolean(),
  venue: text(140),
  city: text(100),
  venueEnglish: text(200),
  registrationOpen: z.boolean(),
  // R21: ভেন্যুর লাইভ লোকেশন ম্যাপ — অ্যাডমিন প্যানেল থেকে বদলানো যায়
  mapQuery: z.string().trim().max(200).default(""),
  mapLink: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//i.test(v), {
      message: "ম্যাপ লিংক https:// দিয়ে শুরু হতে হবে।",
    })
    .default(""),
  mapVisible: z.coerce.boolean().default(true),
});
/** নিবন্ধন ফর্মের ঘর — অ্যাডমিন প্যানেল থেকে যোগ/বদল করা যায় */
export const formFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(
      /^[a-z][a-z0-9_]{2,29}$/,
      "কী-তে ছোট ইংরেজি অক্ষর, সংখ্যা ও আন্ডারস্কোর দিন (যেমন: blood_group)।",
    ),
  label: text(120),
  kind: z.enum([
    "text",
    "textarea",
    "select",
    "number",
    "tel",
    "date",
    "checkbox",
    // মূল ঘরের নিজস্ব ধরন
    "photo",
    "tshirt",
    "family",
  ]),
  options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  placeholder: z.string().trim().max(200).default(""),
  help: z.string().trim().max(300).default(""),
  maxLength: z.coerce.number().int().min(1).max(2000).default(200),
  required: z.coerce.boolean().default(false),
  visible: z.coerce.boolean().default(true),
  order: z.coerce.number().int().min(0).max(999).default(50),
  // ফর্মের কোন ধাপে ঘরটি থাকবে (১ = পরিচয়, ২ = পরিবার)
  step: z.coerce.number().int().min(1).max(2).default(1),
  // মূল ঘর (নাম, মোবাইল, ছবি, টি-শার্ট…) — মুছে ফেলা যায় না, শুধু এডিট/লুকানো
  isBase: z.coerce.boolean().optional(),
  isLocked: z.coerce.boolean().optional(),
});

// হেডারের মেনুর একটি আইটেম — অ্যাডমিন নিজে যোগ/বদল/লুকাতে পারেন
export const navItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["section", "ticket", "link"]),
  label: text(60),
  target: z.string().trim().max(400).default(""),
  order: z.coerce.number().int().min(0).max(999).default(50),
  visible: z.coerce.boolean().default(true),
});
/** R20: আগের সফল আয়োজনের অ্যালবাম — ছবি (আপলোড/লিংক) ও ভিডিও লিংক */
export const albumMediaSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["image", "video"]),
  url: z
    .string()
    .min(5)
    .max(2_600_000) // ডেমো/প্রিভিউতে ছবি data-URI হিসেবেই থাকে
    .refine(
      (x) =>
        x.startsWith("/assets/") ||
        /^https:\/\//.test(x) ||
        x.startsWith("data:image/"),
      "ছবি/ভিডিওর জন্য HTTPS লিংক বা আপলোড করা ছবি দিন।",
    ),
});
export const albumSchema = z.object({
  id: z.string().uuid().optional(),
  title: text(160), // লোকেশন/আয়োজনের নাম
  dateLabel: z.string().trim().max(80).default(""),
  media: z.array(albumMediaSchema).max(40).default([]),
  active: z.boolean().default(true),
  order: z.coerce.number().int().min(0).max(999),
});
export const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_-]+$/),
  title: text(250),
  subtitle: z.string().trim().max(250).default(""),
  body: z.string().trim().max(3000).default(""),
  imageUrl: z
    .string()
    .max(1000)
    .refine(
      (x) => !x || x.startsWith("/assets/") || /^https:\/\//.test(x),
      "ছবির জন্য /assets/ অথবা HTTPS লিংক দিন।",
    )
    .default(""),
  visible: z.boolean(),
  order: z.coerce.number().int().min(0).max(999),
});
export const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: text(220),
  note: z.string().trim().max(500).default(""),
  period: z.enum(["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা"]),
  visible: z.boolean(),
  order: z.coerce.number().int().min(0).max(999),
});
export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.enum(["bkash", "nagad"]),
  name: text(100),
  mobile: z
    .string()
    .transform(normalizeMobile)
    .refine((x) => /^01[3-9]\d{8}$/.test(x)),
  active: z.boolean(),
  order: z.coerce.number().int().min(0).max(999),
});
export const feesSchema = z.object({
  friend: z.coerce.number().int().min(1).max(100000),
  spouse: z.coerce.number().int().min(0).max(100000),
  child: z.coerce.number().int().min(0).max(100000),
});
// ── টিম ও অনুমতি (R17): মেইন অ্যাডমিন সহ-অ্যাডমিন যোগ/বাদ ও এক্সেস ঠিক করেন ──
// প্রতিটি অনুমতির কী = অ্যাডমিন প্যানেলের একটি ট্যাব
export const PERMISSION_KEYS = [
  "overview",
  "reports",
  "participants",
  "payments",
  "event",
  "content",
  "schedule",
  "accounts",
  "form",
  "header",
  "devices",
  "expenses",
  "donations",
];
// কোন অ্যাকশন করতে কোন অনুমতি লাগে (মেইন অ্যাডমিনের সব অনুমতি আছে)
export const ACTION_PERMISSIONS = {
  "event.save": ["event"],
  "fees.save": ["event"],
  "section.save": ["content"],
  "album.save": ["content"],
  "album.delete": ["content"],
  "section.delete": ["content"],
  "schedule.save": ["schedule"],
  "schedule.delete": ["schedule"],
  "account.save": ["accounts"],
  "account.delete": ["accounts"],
  "formField.save": ["form"],
  "formField.delete": ["form"],
  "formField.move": ["form"],
  "formField.reorder": ["form"],
  "formText.save": ["form"],
  "navItem.save": ["header"],
  "navItem.delete": ["header"],
  "navItem.reorder": ["header"],
  "participant.save": ["participants", "payments"],
  "payment.save": ["payments"],
  "registration.approve": ["payments"],
  "registration.reject": ["payments"],
  "registration.remove": ["participants", "payments"],
  "registration.reissue": ["participants", "payments"],
  "device.update": ["devices"],
  "expense.save": ["expenses"],
  "expense.delete": ["expenses"],
  "donation.save": ["donations"],
  "donation.delete": ["donations"],
  // টিম বদলাতে পারেন কেবল মেইন অ্যাডমিন — কোনো অনুমতি দিয়েও এটি খোলা যায় না
  "team.save": null,
  "team.delete": null,
};
/** ব্যবহারকারীর এই কাজের অনুমতি আছে কি? admin=সব; moderator=তালিকা অনুযায়ী */
export function canDo(user, action) {
  if (user?.role === "admin") return true;
  if (user?.role !== "moderator") return false;
  const needed = ACTION_PERMISSIONS[action];
  if (needed === null) return false; // শুধু মেইন অ্যাডমিন
  if (!needed) return false;
  const held = Array.isArray(user.permissions) ? user.permissions : [];
  return needed.some((p) => held.includes(p));
}
const dateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ দিন (YYYY-MM-DD)।");
const amountNumber = z.coerce
  .number()
  .min(1, "টাকার পরিমাণ শূন্যের বেশি দিন।")
  .max(10000000, "টাকার পরিমাণ খুব বড়।");
// খরচের খাতার এক লাইন — কে লিখেছে (enteredBy) সার্ভার নিজেই বসায়
export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  date: dateText,
  title: text(200),
  amount: amountNumber,
  note: z.string().trim().max(400).default(""),
});
// বন্ধুদের ঐচ্ছিক অনুদানের এক লাইন
export const donationSchema = z.object({
  id: z.string().uuid().optional(),
  date: dateText,
  donor: text(120),
  amount: amountNumber,
  note: z.string().trim().max(400).default(""),
});
// সহ-অ্যাডমিন/গেট স্টাফ অ্যাকাউন্ট (মেইন অ্যাডমিন তৈরি/সম্পাদনা করেন)
export const teamMemberSchema = z.object({
  id: z.string().uuid().optional(),
  name: text(120),
  email: z.email().max(200).transform((x) => x.trim().toLowerCase()),
  role: z.enum(["moderator", "scanner"]),
  // নতুন অ্যাকাউন্টে পাসওয়ার্ড লাগবে; সম্পাদনায় খালি রাখলে আগেরটিই থাকে
  password: z.string().min(8, "পাসওয়ার্ড অন্তত ৮ অক্ষরের দিন।").max(200).optional().or(z.literal("")),
  permissions: z
    .array(z.enum(PERMISSION_KEYS))
    .max(PERMISSION_KEYS.length)
    .default([]),
  active: z.boolean().default(true),
});
export function safeRegistration(r, { ticket = false } = {}) {
  const { trackingHash, qrSecret, ...publicData } = r;
  return {
    ...publicData,
    qrPayload:
      ticket && r.status === "approved" && !r.archivedAt && qrSecret
        ? `R96:${r.id}:${qrSecret}`
        : null,
  };
}
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function computeTotal(fees, spouse, children) {
  return fees.friend + fees.spouse * spouse + fees.child * children;
}
