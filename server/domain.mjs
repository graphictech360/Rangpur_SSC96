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
  name: text(120),
  school: text(200),
  sscRoll: text(30),
  sscRegistration: z.string().trim().max(40).default(""),
  mobile,
  location: text(200),
  tshirt: z.enum(["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
});
export const registrationSchema = z.object({
  participant: participantSchema,
  spouse: z.coerce.number().int().min(0).max(1),
  children: z.coerce.number().int().min(0).max(20),
  food: z.enum(["সাধারণ", "নিরামিষ", "বিশেষ অনুরোধ"]),
  notes: z.string().trim().max(600).default(""),
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
