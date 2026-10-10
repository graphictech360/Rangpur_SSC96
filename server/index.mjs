import "dotenv/config";
import express from "express";
import { createServer as createHttpServer } from "node:http";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
// Node 20-এ global WebSocket নেই; Supabase realtime ক্লায়েন্ট তৈরি হতে এটি লাগে
import WebSocketImpl from "ws";
import { z } from "zod";
import { demo, initDemo } from "./demo-store.mjs";
import {
  pushConfig,
  pushInternalKey,
  sendPushToAll,
} from "./push.mjs";
import {
  notifyConfig,
  notifyNewRegistration,
  quickLoginUrl,
  registrationEmail,
  sendMail,
  verifyQuickLoginToken,
} from "./notify.mjs";
import {
  AppError,
  registrationSchema,
  participantSchema,
  eventSchema,
  sectionSchema,
  albumSchema,
  canDo,
  scheduleSchema,
  accountSchema,
  formFieldSchema,
  navItemSchema,
  feesSchema,
  expenseSchema,
  donationSchema,
  teamMemberSchema,
} from "./domain.mjs";
import {
  record as recordSecurity,
  eventsSnapshot,
  loginLockRemaining,
  lockMessageBn,
  noteLoginFailure,
  noteLoginSuccess,
  botGuard,
  cleanText,
} from "./security.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const mode = process.env.DATA_MODE || "demo";
const production = process.env.NODE_ENV === "production";
if (!["demo", "supabase"].includes(mode))
  throw Error("DATA_MODE must be demo or supabase");
if (
  production &&
  mode === "demo" &&
  process.env.ALLOW_DEMO_PRODUCTION !== "true"
)
  throw Error(
    "Production requires DATA_MODE=supabase. Demo is not a real registration service.",
  );
if (
  production &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
)
  throw Error("Set SESSION_SECRET to at least 32 random characters.");
if (
  production &&
  (!process.env.APP_ORIGIN || process.env.COOKIE_SECURE !== "true")
)
  throw Error("Production requires APP_ORIGIN and COOKIE_SECURE=true (HTTPS).");
let publicClient;
const supabaseUrl =
  process.env.SUPABASE_URL || "https://mbuzwqsrnmergrtetwqq.supabase.co";
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
if (mode === "supabase") {
  if (!supabaseKey)
    throw Error(
      "Add SUPABASE_PUBLISHABLE_KEY in .env after running the migrations.",
    );
  if (supabaseKey.startsWith("sb_secret_"))
    throw Error("Do not use a Supabase secret/service-role key.");
  try {
    if (
      JSON.parse(Buffer.from(supabaseKey.split(".")[1] || "", "base64url"))
        .role === "service_role"
    )
      throw Error("SERVICE_ROLE_FORBIDDEN");
  } catch (e) {
    if (e.message === "SERVICE_ROLE_FORBIDDEN")
      throw Error("Do not use a service-role key.");
  }
  publicClient = makeClient();
} else await initDemo();
function makeClient(jwt) {
  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: { transport: WebSocketImpl },
      global: {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        fetch: (url, options) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
      },
    },
  );
}
async function rpc(name, args = {}, user) {
  const { data, error } = await makeClient(user?.accessToken).rpc(name, args);
  if (error)
    throw new AppError(
      error.message,
      error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400,
    );
  return data;
}
// ── ছবি: যাচাই + Supabase Storage-এ তোলা (Vercel-এ ফাইল রাখা যায় না, তাই Storage) ──
const PHOTO_MAX_BYTES = 1_200_000; // ~১.২ MB (ব্রাউজারে ছোট করা হয়, তারপরও যাচাই)
const PHOTO_TYPES = {
  jpeg: { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  jpg: { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  webp: { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
};

function decodePhoto(dataUrl) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || "").trim(),
  );
  if (!match) throw new AppError("ছবির ধরন সঠিক নয় — JPG, PNG বা WebP দিন।", 400);
  const type = PHOTO_TYPES[match[1]];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new AppError("ছবিটি খালি। আবার চেষ্টা করুন।", 400);
  if (buffer.length > PHOTO_MAX_BYTES)
    throw new AppError("ছবিটি খুব বড় (১.২ MB-এর কম দিন)।", 400);
  if (!type.magic.every((b, i) => buffer[i] === b))
    throw new AppError("ফাইলটি আসল ছবি মনে হচ্ছে না।", 400);
  return { buffer, ...type };
}

const PHOTO_PREFIX = `${supabaseUrl}/storage/v1/object/public/photos/`;
const isOurPhoto = (url) =>
  typeof url === "string" && (url.startsWith(PHOTO_PREFIX) || url.startsWith("data:image/"));

async function uploadPhoto(dataUrl, folder = "participants") {
  const { buffer, mime, ext } = decodePhoto(dataUrl);
  if (mode === "demo") {
    // ডেমোতে কিছুই বাইরে পাঠানো হয় না — ছবিটাই ডেটা হিসেবে থাকে (অফলাইনেও চলে)
    return { url: dataUrl, demo: true };
  }
  const day = new Date().toISOString().slice(0, 10);
  const path = `${folder}/${day}/${randomUUID()}.${ext}`;
  const answer = await fetch(`${supabaseUrl}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": mime,
      "x-upsert": "false",
      "cache-control": "max-age=31536000",
    },
    body: buffer,
    signal: AbortSignal.timeout(25000),
  });
  if (!answer.ok)
    throw new AppError(
      "ছবি আপলোড করা যায়নি। internet ঠিক আছে কি না দেখে আবার চেষ্টা করুন।",
      502,
    );
  return { url: `${PHOTO_PREFIX}${path}`, path };
}

const app = express();
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "https:", "data:", "blob:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            mediaSrc: ["'self'", "https:", "blob:"],
            // R21/R22: গুগল ম্যাপ + ইউটিউব (স্মৃতি-ভিডিও) iframe অনুমোদিত
            frameSrc: [
              "'self'",
              "https://www.google.com",
              "https://maps.google.com",
              "https://www.youtube-nocookie.com",
            ],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    // কেউ যেন সাইটটিকে নিজের পেজের ভেতরে (iframe) ঢুকিয়ে প্রতারণা করতে না পারে
    frameguard: { action: "sameorigin" },
    // (Permissions-Policy হেডারটি নিচে আলাদা করে বসানো — এই helmet সংস্করণে
    //  সেই অপশনটি নেই, তাই নিজের মিডলওয়্যার দিয়ে দেওয়া হচ্ছে)
    // যেকোনো প্রেরককে শুধু ডোমেইনটুকু জানানো হয়, পুরো ঠিকানা নয়
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // HTTPS বাধ্যতামূলক (শুধু আসল সাইটে; লোকাল ডেমোতে নয়)
    hsts: production
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);
// ক্যামেরা দরকার কেবল গেট-স্ক্যানারে (QR পড়তে); বাকি সব সেন্সর বন্ধ
app.use((_, res, next) => {
  res.set(
    "Permissions-Policy",
    // ক্যামেরা: QR স্ক্যানার · লোকেশন: ভেন্যুর রুট-ম্যাপ (R22) — দুটোই শুধু নিজের পেজে
    'camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), serial=()',
  );
  next();
});
app.use(compression());
app.use(express.json({ limit: "64kb" }));
app.use(
  cookieParser(process.env.SESSION_SECRET || randomBytes(32).toString("hex")),
);
app.use("/api", (_, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 150,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "অনেকবার অনুরোধ এসেছে। এক মিনিট পরে আবার চেষ্টা করুন।" },
  }),
);
app.use("/api", (req, res, next) => {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.get("origin")
  ) {
    const expected =
      process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
    if (req.get("origin") !== expected) {
      recordSecurity("blockedOrigin", `${req.method} ${req.originalUrl}`, req);
      return res.status(403).json({ error: "এই উৎস থেকে অনুরোধ অনুমোদিত নয়।" });
    }
  }
  next();
});
// ⚠️ সেশন রাখা হয় কুকিতেই (সই করা JSON) — Vercel-এর একাধিক ইনস্ট্যান্সেও কাজ করে।
// মেমোরিতে রাখলে এক অনুরোধ এক ইনস্ট্যান্সে, আরেক অনুরোধ আরেকটায় গিয়ে লগইন হারিয়ে যেত।
const SESSION_HOURS = 8;
const packSession = (user) =>
  JSON.stringify({ ...user, absoluteExpiry: Date.now() + SESSION_HOURS * 3600000 });
const cookieOptions = (req) => {
  const preview = String(req.get("host")).endsWith(".e2b.app");
  return {
    httpOnly: true,
    signed: true,
    secure: process.env.COOKIE_SECURE === "true" || req.secure || preview,
    sameSite: preview ? "none" : "strict",
    partitioned: preview,
    path: "/",
    maxAge: 8 * 3600000,
  };
};
// রিডাইরেক্টের জন্য সাইটের ঠিকানা (লোকাল, প্রিভিউ ও লাইভ — সবখানেই কাজ করে)
const siteUrlForRedirect = (req) => {
  const fixed = (process.env.APP_ORIGIN || process.env.SITE_URL || "").trim();
  if (fixed) return fixed.replace(/\/$/, "");
  const proto = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
  return `${proto}://${req.get("host")}`;
};
async function auth(req, res, required = false) {
  const raw = req.signedCookies.r96_session;
  let s = null;
  try {
    s = raw ? JSON.parse(raw) : null;
  } catch {
    s = null;
  }
  if (!s || !s.absoluteExpiry || s.absoluteExpiry < Date.now()) {
    if (required) throw new AppError("আয়োজক/স্টাফ হিসেবে লগইন করুন।", 401);
    return null;
  }
  // অ্যাক্সেস-টোকেনের মেয়াদ শেষের পথে — নতুন করে নিয়ে কুকি হালনাগাদ
  if (mode === "supabase" && res && s.tokenExpiry && s.tokenExpiry < Date.now() + 90000) {
    const { data, error } = await makeClient().auth.refreshSession({
      refresh_token: s.refreshToken,
    });
    if (error || !data.session) {
      res.clearCookie("r96_session", cookieOptions(req));
      throw new AppError("সেশন শেষ হয়েছে। আবার লগইন করুন।", 401);
    }
    s.accessToken = data.session.access_token;
    s.refreshToken = data.session.refresh_token;
    s.tokenExpiry = data.session.expires_at * 1000;
    res.cookie("r96_session", packSession(s), cookieOptions(req));
  }
  return s;
}
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
const publicLimit = rateLimit({
  windowMs: 600000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "অনেকবার জমা দেওয়া হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।" },
});
const loginLimit = rateLimit({
  windowMs: 600000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "অনেকবার লগইনের চেষ্টা হয়েছে। ১০ মিনিট পরে চেষ্টা করুন।" },
});
// ── ছবি আপলোড: ব্রাউজার ছোট করে পাঠায়, সার্ভার যাচাই করে Supabase Storage-এ রাখে ──
app.post(
  "/api/photo",
  express.json({ limit: "3mb" }),
  publicLimit,
  wrap(async (req, res) => {
    const { photo } = z
      .object({ photo: z.string().min(64).max(2_600_000) })
      .parse(req.body);
    res.json(await uploadPhoto(photo));
  }),
);
// ── হেডারের লোগো বদল: শুধু অ্যাডমিন, এক চাপে আপলোড + সেভ ──
app.post(
  "/api/admin/logo",
  express.json({ limit: "3mb" }),
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    const { photo } = z
      .object({ photo: z.string().min(64).max(2_600_000) })
      .parse(req.body);
    const uploaded = await uploadPhoto(photo, "branding");
    // বিদ্যমান branding সেকশনের নাম/ছোট লেখা রেখে শুধু লোগো বদলানো হয়
    const site = mode === "demo" ? await demo.site() : await rpc("public_site");
    const current = (site.sections || []).find((x) => x.key === "branding") || {};
    const payload = {
      id: current.id,
      key: "branding",
      title: current.title || "RANGPUR SSC 96",
      subtitle: current.subtitle || "",
      body: current.body || "",
      imageUrl: uploaded.url,
      order: current.order ?? 10,
      visible: true,
    };
    const result =
      mode === "demo"
        ? await demo.mutate(user, "section.save", payload)
        : await rpc("admin_mutate", { p_action: "section.save", p_payload: payload }, user);
    res.json({ ...uploaded, section: result });
  }),
);
// ── আগের আয়োজনের অ্যালবামের ছবি আপলোড (content-অনুমতি লাগে) ──
app.post(
  "/api/admin/memory-photo",
  express.json({ limit: "3mb" }),
  wrap(async (req, res) => {
    const user = await freshDemoUser(await auth(req, res, true));
    if (!canDo(user, "album.save"))
      throw new AppError("এই কাজের অনুমতি তোমার অ্যাকাউন্টে নেই।", 403);
    const { photo } = z
      .object({ photo: z.string().min(64).max(2_600_000) })
      .parse(req.body);
    res.json(await uploadPhoto(photo, "memories"));
  }),
);
// ── নিরাপত্তার হিসাব (শুধু অ্যাডমিন দেখতে পান) ──
app.get(
  "/api/admin/security",
  wrap(async (req, res) => {
    await auth(req, res, true);
    res.json(eventsSnapshot());
  }),
);
app.get(
  "/api/site",
  wrap(async (_, res) => {
    const data = mode === "demo" ? await demo.site() : await rpc("public_site");
    res.json({ ...data, mode });
  }),
);
app.post(
  "/api/registrations",
  publicLimit,
  wrap(async (req, res) => {
    // রোবট ঠেকানো: লুকানো ফাঁদ-ঘর বা অস্বাভাবিক দ্রুত জমা → চুপচাপ আটকানো
    const botReason = botGuard(req.body);
    if (botReason) {
      recordSecurity("blockedBot", botReason.slice(0, 60), req);
      throw new AppError(botReason, 400);
    }
    const input = registrationSchema.parse(req.body);
    // লেখা পরিষ্কার: HTML ট্যাগ ও নিয়ন্ত্রণ-অক্ষর বাদ
    input.participant.name = cleanText(input.participant.name, 120);
    input.participant.school = cleanText(input.participant.school, 200);
    input.participant.location = cleanText(input.participant.location, 200);
    input.participant.sscRoll = cleanText(input.participant.sscRoll, 30);
    input.participant.sscRegistration = cleanText(input.participant.sscRegistration, 40);
    if (input.notes) input.notes = cleanText(input.notes, 600);
    // অ্যাডমিন কোন ঘর বাধ্যতামূলক রেখেছেন / লুকিয়ে দিয়েছেন — সেটিই নিয়ম
    {
      const cfg =
        mode === "demo" ? await demo.site() : await rpc("public_site");
      const values = {
        name: input.participant.name,
        school: input.participant.school,
        ssc_roll: input.participant.sscRoll,
        ssc_registration: input.participant.sscRegistration,
        mobile: input.participant.mobile,
        location: input.participant.location,
        photo: input.participant.photoUrl,
        tshirt: input.participant.tshirt,
        family: "1",
      };
      for (const f of cfg.formFields || []) {
        if (!f.required || f.visible === false) continue;
        const value = f.isBase
          ? values[f.key]
          : input.answers?.[f.key];
        if (!String(value ?? "").trim())
          throw new AppError(`ঘরটি পূরণ করুন: ${f.label}`, 400);
      }
    }
    // ছবিটি সত্যিই আমাদের Storage থেকে এসেছে কি না (নকল লিংক ঠেকাতে)
    if (input.participant.photoUrl && !isOurPhoto(input.participant.photoUrl))
      throw new AppError("ছবির লিংক সঠিক নয়। আবার আপলোড করুন।", 400);
    if (mode !== "demo" && input.participant.photoUrl && input.participant.photoUrl.startsWith("data:"))
      throw new AppError("অনলাইন মোডে ছবি আপলোড করে নিন।", 400);
    const data =
      mode === "demo"
        ? await demo.register(input)
        : await rpc("submit_registration", { p_data: input });
    // নিবন্ধন জমা হয়ে গেছে — এখন আয়োজকের ইমেইলে খবর। মেইল ব্যর্থ হলেও
    // নিবন্ধন আগেই সফল, তাই এখানে কিছুই থামানো হয় না (সর্বোচ্চ ৮ সেকেন্ড)।
    try {
      // মেইলে অতিরিক্ত ঘরগুলোর বাংলা নাম দেখানোর জন্য ঘরের তালিকা জুড়ে দিই
      let fields = [];
      try {
        const site =
          mode === "demo" ? await demo.site() : await rpc("public_site");
        fields = site?.formFields || [];
      } catch {
        fields = [];
      }
      const sent = await notifyNewRegistration({
        registration: { ...data?.registration, fields },
        registrationId: data?.registration?.id,
      });
      if (sent?.ok) console.log("[notify] নিবন্ধনের খবর পাঠানো হলো:", sent.subject);
    } catch (e) {
      console.error("[notify] খবর পাঠাতে সমস্যা:", e?.message || e);
    }
    // R26: অ্যাডমিন/মডারেটরের ব্রাউজার ও মোবাইলে পুশ নোটিফিকেশন।
    // পুশ ব্যর্থ হলেও নিবন্ধন আগেই সফল — কিছু থামানো হয় না।
    try {
      const targets =
        mode === "demo"
          ? await demo.pushTargets()
          : await rpc("push_targets", { p_key: pushInternalKey() });
      if (Array.isArray(targets) && targets.length) {
        const reg = data?.registration;
        const people =
          1 + (Number(reg?.spouse) || 0) + (Number(reg?.children) || 0);
        const { sent: ok, dead } = await sendPushToAll(targets, {
          title: "🎟️ নতুন নিবন্ধন",
          body: `${reg?.participant?.name || "নতুন বন্ধু"} — ${reg?.ticketNumber || ""} · মোট ${people} জন`,
          url: "/admin",
          tag: `reg-${reg?.id || Date.now()}`,
        });
        if (ok) console.log(`[push] ${ok}টি ডিভাইসে নোটিফিকেশন গেল`);
        if (dead.length)
          mode === "demo"
            ? await demo.pushPrune(dead)
            : await rpc("push_prune", { p_key: pushInternalKey(), p_endpoints: dead });
      }
    } catch (e) {
      console.error("[push] পুশ পাঠাতে সমস্যা:", e?.message || e);
    }
    res.status(201).json(data);
  }),
);
app.post(
  "/api/ticket",
  wrap(async (req, res) => {
    const key = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(req.body.trackingKey);
    res.json(
      mode === "demo"
        ? await demo.lookup(key)
        : await rpc("ticket_status", { p_tracking_key: key }),
    );
  }),
);
app.post(
  "/api/login",
  loginLimit,
  wrap(async (req, res) => {
    const { email, password } = z
      .object({
        email: z.email().max(200),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);
    const lockedFor = loginLockRemaining(req, email);
    if (lockedFor > 0) throw new AppError(lockMessageBn(lockedFor), 429);
    let user;
    if (mode === "demo") {
      if (email === "admin@ssc96.demo" && password === "Festival96!")
        user = { id: "demo-admin", name: "ডেমো আয়োজক", email, role: "admin" };
      else if (email === "staff@ssc96.demo" && password === "Checkin96!")
        user = {
          id: "demo-staff",
          name: "ডেমো গেট স্টাফ",
          email,
          role: "scanner",
        };
      else {
        // মেইন অ্যাডমিনের যোগ করা টিম-সদস্য (সহ-অ্যাডমিন/স্টাফ) — ডেমো স্টোরে থাকে
        const member = await demo.teamLogin(email, password);
        if (member) user = { ...member, teamMember: true };
        else {
          recordSecurity("loginFailure", `ডেমো লগইন: ${email}`, req);
          const state = noteLoginFailure(req, email);
          throw new AppError(
            state.locked
              ? lockMessageBn(5 * 60 * 1000)
              : `ইমেইল বা পাসওয়ার্ড সঠিক নয়। অবশিষ্ট চেষ্টা: ${state.left}টি।`,
            state.locked ? 429 : 401,
          );
        }
      }
    } else {
      const { data, error } = await makeClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) {
        recordSecurity("loginFailure", `লগইন: ${email}`, req);
        const state = noteLoginFailure(req, email);
        throw new AppError(
          state.locked
            ? lockMessageBn(5 * 60 * 1000)
            : "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
          state.locked ? 429 : 401,
        );
      }
      user = {
        id: data.user.id,
        email,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        tokenExpiry: data.session.expires_at * 1000,
      };
      const identity = await rpc("staff_identity", {}, user);
      user = { ...user, ...identity };
    }
    noteLoginSuccess(req, email);
    res.cookie("r96_session", packSession(user), cookieOptions(req));
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || null,
    });
  }),
);
// ── মেইলের বোতাম: এক ক্লিকে প্যানেল ─────────────────────────────
// লিংকে ৬০ মিনিটের সই-করা টোকেন থাকে; সার্ভার নিজেই লগইন করে কুকি বসায়।
app.get(
  "/api/quick-login",
  wrap(async (req, res) => {
    const back = `${siteUrlForRedirect(req)}/admin`;
    let data = null;
    try {
      data = verifyQuickLoginToken(req.query.t);
    } catch {
      data = null;
    }
    if (!data) {
      return res.redirect(302, `${back}?login=expired`);
    }
    const cfg = notifyConfig();
    const email = (process.env.QUICK_LOGIN_EMAIL || "").trim().toLowerCase();
    const password = (process.env.QUICK_LOGIN_PASSWORD || "").trim();
    const demoMode = mode === "demo";
    const demoEmail = "admin@ssc96.demo";
    const demoPass = "Festival96!";
    const wanted = demoMode ? demoEmail : email;
    if (!wanted || data.e !== wanted.toLowerCase() || (!demoMode && !password)) {
      // এক-ক্লিক চালু করা নেই — লগইন পেজে পাঠিয়ে দিই (ইমেইল আগেই বসানো)
      return res.redirect(
        302,
        `${back}?login=1&email=${encodeURIComponent(data.e)}`,
      );
    }
    let user;
    if (demoMode) {
      user = { id: "demo-admin", name: "ডেমো আয়োজক", email: demoEmail, role: "admin" };
    } else {
      const { data: auth, error } = await makeClient().auth.signInWithPassword({
        email: wanted,
        password,
      });
      if (error || !auth.session) {
        console.error("[quick-login] লগইন হলো না:", error?.message);
        return res.redirect(302, `${back}?login=failed`);
      }
      user = {
        id: auth.user.id,
        email: wanted,
        accessToken: auth.session.access_token,
        refreshToken: auth.session.refresh_token,
        tokenExpiry: auth.session.expires_at * 1000,
      };
      try {
        const identity = await rpc("staff_identity", {}, user);
        user = { ...user, ...identity };
      } catch (e) {
        console.error("[quick-login] ভূমিকা পড়া যায়নি:", e?.message || e);
      }
    }
    noteLoginSuccess(req, email);
    res.cookie("r96_session", packSession(user), cookieOptions(req));
    try {
      // লগইনের হিসাব রেখে দিই (প্যানেলের লগে দেখা যাবে)
      await rpc("log_login", {
        p_email: wanted,
        p_ok: true,
        p_note: "ইমেইল লিংক থেকে এক ক্লিকে",
      });
    } catch (e) {
      console.error("[quick-login] লগ রাখা যায়নি:", e?.message || e);
    }
    return res.redirect(302, `${back}?welcome=1`);
  }),
);

app.post(
  "/api/password-reset",
  loginLimit,
  wrap(async (req, res) => {
    const { email } = z.object({ email: z.email().max(200) }).parse(req.body);
    const site = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
    let note = "";
    if (mode === "demo") {
      note = "ডেমো মোডে ইমেইল পাঠানো হয় না।";
    } else {
      // ১) আমাদের ডেটাবেসে হিসাব রাখা (কে কখন চাইল)
      try {
        await rpc("request_password_reset", { p_email: email });
      } catch {
        /* হিসাব না লিখলেও রিসেট আটকাবে না */
      }
      // ২) আসল ইমেইল পাঠানোর অনুরোধ Supabase Auth-কে
      const answer = await fetch(
        `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(`${site}/admin/reset`)}`,
        {
          method: "POST",
          headers: { apikey: supabaseKey, "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      if (answer.status === 429)
        note =
          "এই মুহূর্তে ইমেইল-সীমা (ঘণ্টায় ২টি) শেষ। একটু পরে আবার চেষ্টা করুন বা Supabase Dashboard → Authentication → Users থেকে সরাসরি পাসওয়ার্ড বদলে নিন।";
      else if (!answer.ok)
        note =
          "ইমেইল সেবায় সমস্যা হয়েছে। চাইলে Supabase Dashboard → Authentication → Users থেকে সরাসরি পাসওয়ার্ড বদলানো যায়।";
    }
    // ইমেইল আছে কি নেই — বাইরে সবসময় একই উত্তর (তথ্য ফাঁস নয়)
    res.json({
      ok: true,
      message: "আপনার ইমেইলে থাকলে রিসেট-লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।",
      note,
    });
  }),
);
app.post(
  "/api/password-update",
  loginLimit,
  wrap(async (req, res) => {
    const { token, password } = z
      .object({ token: z.string().min(20).max(4000), password: z.string().min(6).max(200) })
      .parse(req.body);
    const answer = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const body = await answer.json().catch(() => ({}));
    if (!answer.ok)
      throw new AppError(
        "রিসেট-লিংকের সময় শেষ হয়ে গেছে বা সেটি সঠিক নয়। আবার নতুন লিংক চেয়ে নিন।",
        400,
      );
    // হিসাব সম্পন্ন করা (কে নতুন পাসওয়ার্ড বসাল)
    try {
      await rpc("complete_password_reset", { p_email: body?.email || "" });
    } catch {
      /* হিসাব না লিখলেও সমস্যা নেই */
    }
    res.json({ ok: true });
  }),
);
app.post(
  "/api/logout",
  wrap(async (req, res) => {
    res.clearCookie("r96_session", cookieOptions(req));
    res.json({ ok: true });
  }),
);
app.get(
  "/api/me",
  wrap(async (req, res) => {
    const user = await auth(req, res);
    if (!user) return res.json(null);
    let identity;
    if (mode === "supabase") identity = await rpc("staff_identity", {}, user);
    else if (user.teamMember) {
      // ডেমো টিম-সদস্য: অনুমতি মাঝপথে বদলালে বা অ্যাকাউন্ট বন্ধ হলে এখানেই ধরা পড়ে
      identity = await demo.teamIdentity(user.id);
      if (!identity) {
        res.clearCookie("r96_session", cookieOptions(req));
        return res.json(null);
      }
    } else identity = user;
    res.json({
      id: identity.id,
      name: identity.name,
      email: user.email,
      role: identity.role,
      permissions: identity.permissions || null,
    });
  }),
);
// প্যানেলের হেডারে দেখানোর জন্য: মেইল-খবর চালু কি না
app.get(
  "/api/notify-status",
  wrap(async (req, res) => {
    await auth(req, res, true);
    const cfg = notifyConfig();
    res.json({
      configured: cfg.configured,
      provider: cfg.provider,
      to: cfg.to,
      quickLogin: cfg.quickLogin,
    });
  }),
);
// ── প্যানেল থেকে “পরীক্ষা মেইল” — সত্যিই পাঠিয়ে ফল জানায় ─────────
/* ── R26: পুশ নোটিফিকেশন ও বেল-আইকন ─────────────────────────────── */
app.get(
  "/api/push/config",
  wrap(async (req, res) => {
    await auth(req, res, true);
    res.json(pushConfig());
  }),
);
const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(20).max(300),
    auth: z.string().min(10).max(100),
  }),
  label: z.string().max(120).optional().default(""),
});
app.post(
  "/api/push/subscribe",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    const sub = subscriptionSchema.parse(req.body);
    res.json(
      mode === "demo"
        ? await demo.pushSubscribe(user, sub, sub.label)
        : await rpc(
            "push_subscribe",
            {
              p_endpoint: sub.endpoint,
              p_p256dh: sub.keys.p256dh,
              p_auth: sub.keys.auth,
              p_label: sub.label,
            },
            user,
          ),
    );
  }),
);
app.post(
  "/api/push/unsubscribe",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    const endpoint = z.string().url().max(1000).parse(req.body.endpoint);
    res.json(
      mode === "demo"
        ? await demo.pushUnsubscribe(user, endpoint)
        : await rpc("push_unsubscribe", { p_endpoint: endpoint }, user),
    );
  }),
);
app.get(
  "/api/notifications",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    res.json(
      mode === "demo"
        ? await demo.notifState(user)
        : await rpc("notif_state", {}, user),
    );
  }),
);
app.post(
  "/api/notifications/seen",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    res.json(
      mode === "demo"
        ? await demo.notifMarkSeen(user)
        : await rpc("notif_mark_seen", {}, user),
    );
  }),
);
app.post(
  "/api/notify-test",
  loginLimit,
  wrap(async (req, res) => {
    await auth(req, res, true);
    const cfg = notifyConfig();
    if (!cfg.configured)
      throw new AppError(
        "ইমেইল এখনো চালু করা হয়নি। Vercel-এ RESEND_API_KEY বসান (docs/NOTIFICATION.bn.md)।",
        400,
      );
    const mail = registrationEmail({
      registration: {
        total: 2199,
        spouse: 1,
        children: 1,
        food: "সাধারণ",
        ticketNumber: "R96-TEST",
        participant: {
          name: "পরীক্ষামূলক বন্ধু",
          school: "রংপুর জিলা স্কুল",
          sscRoll: "96001",
          mobile: "01700000000",
          location: "রংপুর",
          tshirt: "L",
        },
        payment: {
          provider: "bkash",
          senderMobile: "01700000000",
          transactionId: "TEST-TRX-96",
          amount: 2199,
          collectorName: "Tomal",
          collectorMobile: "+8801773539721",
        },
      },
      registrationId: "notify-test",
    });
    const result = await sendMail(mail);
    if (!result.ok)
      throw new AppError(
        `পরীক্ষা মেইল পাঠানো যায়নি (${result.provider || "কোনো মাধ্যম নেই"}${
          result.status ? " · HTTP " + result.status : ""
        })। ${String(result.detail || result.reason || "").slice(0, 200)}`,
        502,
      );
    res.json({ ...result, to: mail.to, subject: mail.subject });
  }),
);
// ডেমো টিম-সদস্যের অনুমতি প্রতিবার স্টোর থেকে টাটকা পড়া হয় —
// মেইন অ্যাডমিন অনুমতি বদলালে/অ্যাকাউন্ট বন্ধ করলে সঙ্গে সঙ্গে কার্যকর
async function freshDemoUser(user) {
  if (mode !== "demo" || !user?.teamMember) return user;
  const identity = await demo.teamIdentity(user.id);
  if (!identity) throw new AppError("অ্যাকাউন্টটি আর সক্রিয় নেই। আবার লগইন করুন।", 401);
  return { ...user, ...identity };
}
app.get(
  "/api/admin",
  wrap(async (req, res) => {
    const user = await freshDemoUser(await auth(req, res, true));
    res.json(
      mode === "demo"
        ? await demo.overview(user)
        : await rpc("admin_overview", {}, user),
    );
  }),
);
const idSchema = z.string().uuid();
function validateMutation(action, data) {
  if (action === "event.save") return eventSchema.parse(data);
  if (action === "fees.save") return feesSchema.parse(data);
  // R17: খরচের খাতা, ঐচ্ছিক অনুদান ও টিম-ব্যবস্থাপনা
  if (action === "expense.save") return expenseSchema.parse(data);
  if (action === "donation.save") return donationSchema.parse(data);
  if (action === "team.save") return teamMemberSchema.parse(data);
  if (["expense.delete", "donation.delete", "team.delete"].includes(action))
    return z.object({ id: idSchema }).parse(data);
  if (action === "section.save") return sectionSchema.parse(data);
  if (action === "album.save") return albumSchema.parse(data);
  if (action === "album.delete") return z.object({ id: idSchema }).parse(data);
  if (action === "schedule.save") return scheduleSchema.parse(data);
  if (action === "account.save") return accountSchema.parse(data);
  if (action === "formField.save") return formFieldSchema.parse(data);
  if (action === "formField.delete") return z.object({ id: idSchema }).parse(data);
  if (action === "navItem.save") return navItemSchema.parse(data);
  if (action === "navItem.delete") return z.object({ id: idSchema }).parse(data);
  if (action === "formText.save")
    return z
      .object({
        key: z.string().trim().regex(/^[a-z][a-z0-9_.]{2,40}$/),
        value: z.string().trim().max(400).default(""),
      })
      .parse(data);
  if (action === "formField.reorder" || action === "navItem.reorder")
    return z
      .object({
        items: z
          .array(
            z.object({
              id: idSchema,
              order: z.coerce.number().int().min(0).max(999),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(data);
  if (action === "formField.move")
    return z
      .object({ id: idSchema, order: z.coerce.number().int().min(0).max(999) })
      .parse(data);
  if (action === "participant.save")
    return z
      .object({
        id: idSchema,
        participant: participantSchema,
        food: z.enum(["সাধারণ", "নিরামিষ", "বিশেষ অনুরোধ"]),
        notes: z.string().max(600).default(""),
        spouse: z.coerce.number().int().min(0).max(1),
        children: z.coerce.number().int().min(0).max(20),
      })
      .parse(data);
  if (action === "payment.save")
    return z
      .object({ id: idSchema, ...registrationSchema.shape.payment.shape })
      .parse(data);
  if (action === "registration.approve")
    return z.object({ id: idSchema, verified: z.literal(true) }).parse(data);
  if (action === "registration.reject")
    return z
      .object({ id: idSchema, reason: z.string().trim().min(3).max(500) })
      .parse(data);
  if (action === "device.update")
    return z
      .object({ id: idSchema, status: z.enum(["approved", "revoked"]) })
      .parse(data);
  if (
    [
      "section.delete",
      "schedule.delete",
      "account.delete",
      "registration.remove",
      "registration.reissue",
    ].includes(action)
  )
    return z.object({ id: idSchema }).parse(data);
  throw new AppError("অজানা অ্যাডমিন অ্যাকশন।");
}
app.post(
  "/api/admin/mutate",
  wrap(async (req, res) => {
    const user = await freshDemoUser(await auth(req, res, true));
    const action = z.string().max(60).parse(req.body.action);
    const payload = validateMutation(action, req.body.payload);
    res.json(
      mode === "demo"
        ? await demo.mutate(user, action, payload)
        : await rpc(
            "admin_mutate",
            { p_action: action, p_payload: payload },
            user,
          ),
    );
  }),
);
app.get(
  "/api/staff/device",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    const deviceToken = req.signedCookies.r96_device || "";
    res.json(
      mode === "demo"
        ? await demo.deviceState(user, deviceToken)
        : await rpc("device_state", { p_token: deviceToken }, user),
    );
  }),
);
app.post(
  "/api/staff/device",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    const label = z.string().trim().min(2).max(100).parse(req.body.label);
    const deviceToken =
      req.signedCookies.r96_device || randomBytes(32).toString("hex");
    const device =
      mode === "demo"
        ? await demo.registerDevice(user, label, deviceToken)
        : await rpc(
            "register_device",
            { p_label: label, p_token: deviceToken },
            user,
          );
    res.cookie("r96_device", deviceToken, {
      ...cookieOptions(req),
      maxAge: 30 * 86400000,
    });
    res.json(device);
  }),
);
app.post(
  "/api/checkin",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
    const input = z.string().trim().min(5).max(300).parse(req.body.input);
    const deviceToken = req.signedCookies.r96_device || "";
    res.json(
      mode === "demo"
        ? await demo.checkin(user, input, deviceToken)
        : await rpc(
            "check_in",
            { p_input: input, p_device_token: deviceToken },
            user,
          ),
    );
  }),
);
app.use("/api", (_, res) =>
  res.status(404).json({ error: "API পাওয়া যায়নি।" }),
);
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: err.issues[0]?.message || "তথ্য যাচাই করুন।" });
  if (err instanceof AppError)
    return res.status(err.status).json({ error: err.message });
  console.error("Request failed:", err.message);
  res
    .status(500)
    .json({ error: "সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।" });
});
app.use(
  "/assets",
  express.static(path.join(root, "public/assets"), { maxAge: 86400000 }),
);
app.get("/manifest.webmanifest", (_, res) =>
  res.sendFile(path.join(root, "public/manifest.webmanifest")),
);
app.get("/sw.js", (_, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(root, "public/sw.js"));
});
// Vercel-এ ফ্রন্টএন্ড স্ট্যাটিক হিসেবে যায় (build/), তাই ফাংশনটি শুধু /api চালায়
const onVercel = Boolean(process.env.VERCEL);
const httpServer = createHttpServer(app);
if (onVercel) {
  // কিছুই করতে হবে না — স্ট্যাটিক ফাইল ও SPA রুট Vercel নিজেই সামলায়
} else if (production) {
  app.use(express.static(path.join(root, "build")));
  app.get("/{*path}", (_, res) =>
    res.sendFile(path.join(root, "build/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: { server: httpServer },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
if (!onVercel) {
  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, "0.0.0.0", () =>
    console.log(
      `Rangpur SSC 96 Festival → http://0.0.0.0:${port} | data: ${mode}${mode === "demo" ? " (synthetic demo only)" : ""}`,
    ),
  );
}

// Vercel serverless: এই Express অ্যাপটিই হ্যান্ডলার (api/index.mjs দেখুন)
export default app;
