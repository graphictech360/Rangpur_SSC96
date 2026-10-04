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
  AppError,
  registrationSchema,
  participantSchema,
  eventSchema,
  sectionSchema,
  scheduleSchema,
  accountSchema,
  feesSchema,
} from "./domain.mjs";
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
            mediaSrc: ["'self'", "blob:"],
            frameAncestors: null,
            upgradeInsecureRequests: [],
          },
        }
      : false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  }),
);
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
    if (req.get("origin") !== expected)
      return res.status(403).json({ error: "এই উৎস থেকে অনুরোধ অনুমোদিত নয়।" });
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
    const input = registrationSchema.parse(req.body);
    const data =
      mode === "demo"
        ? await demo.register(input)
        : await rpc("submit_registration", { p_data: input });
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
      else throw new AppError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।", 401);
    } else {
      const { data, error } = await makeClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session)
        throw new AppError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।", 401);
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
    res.cookie("r96_session", packSession(user), cookieOptions(req));
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
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
    let identity =
      mode === "supabase" ? await rpc("staff_identity", {}, user) : user;
    res.json({
      id: identity.id,
      name: identity.name,
      email: user.email,
      role: identity.role,
    });
  }),
);
app.get(
  "/api/admin",
  wrap(async (req, res) => {
    const user = await auth(req, res, true);
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
  if (action === "section.save") return sectionSchema.parse(data);
  if (action === "schedule.save") return scheduleSchema.parse(data);
  if (action === "account.save") return accountSchema.parse(data);
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
    const user = await auth(req, res, true);
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
