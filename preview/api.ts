/**
 * ব্রাউজার ডেমো API: আসল সার্ভারের `/api/*` রুটগুলো একই ডেমো স্টোর লজিক দিয়ে চালায়।
 * সার্ভার ছাড়াই পুরো অ্যাপ (ফর্ম → pending → admin অনুমোদন → QR → চেক-ইন) কাজ করে।
 */
import { z } from "zod";
import { demo, initDemo } from "../server/demo-store.mjs";
import {
  AppError,
  registrationSchema,
  participantSchema,
  eventSchema,
  sectionSchema,
  scheduleSchema,
  accountSchema,
  feesSchema,
} from "../server/domain.mjs";
import { clearPreviewData } from "./shims/fs-promises";
import { randomBytes } from "./shims/crypto";

const SESSION_KEY = "r96-demo:session";
const DEVICE_KEY = "r96-demo:device";

function read(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* মেমোরি মোড */
  }
}

export const DEMO_ACCOUNTS = {
  admin: { email: "admin@ssc96.demo", password: "Festival96!" },
  staff: { email: "staff@ssc96.demo", password: "Checkin96!" },
};

const users = {
  "admin@ssc96.demo": {
    id: "demo-admin",
    name: "ডেমো আয়োজক",
    role: "admin",
  },
  "staff@ssc96.demo": {
    id: "demo-staff",
    name: "ডেমো গেট স্টাফ",
    role: "scanner",
  },
} as const;

/**
 * প্রতিটি অনুরোধের আগে ডেমো স্টোর আবার পড়ি: একাধিক ট্যাব/পেজ খোলা থাকলে
 * (যেমন অংশগ্রহণকারীর ট্যাব + অ্যাডমিনের ট্যাব) দুই দিকেই নতুন তথ্য দেখা যায়।
 */

function currentUser() {
  const email = read(SESSION_KEY);
  if (!email) return null;
  const user = users[email as keyof typeof users];
  return user ? { ...user, email } : null;
}

function requireUser() {
  const user = currentUser();
  if (!user) throw new AppError("আয়োজক/স্টাফ হিসেবে লগইন করুন।", 401);
  return user;
}

const idSchema = z.string().uuid();
/** সার্ভারের validateMutation()-এর হুবহু প্রতিরূপ। */
function validateMutation(action: string, data: unknown) {
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

type Result = { status: number; data: unknown };

async function route(
  path: string,
  method: string,
  body: Record<string, unknown>,
): Promise<Result> {
  await initDemo();
  if (path === "/site") return { status: 200, data: await demo.site() };

  if (path === "/registrations" && method === "POST")
    return {
      status: 201,
      data: await demo.register(registrationSchema.parse(body)),
    };

  if (path === "/ticket" && method === "POST") {
    const key = z
      .string()
      .regex(/^[a-f0-9]{64}$/, "টিকিটের লিংক সঠিক নয়।")
      .parse(body.trackingKey);
    return { status: 200, data: await demo.lookup(key) };
  }

  if (path === "/login" && method === "POST") {
    const { email, password } = z
      .object({ email: z.string().max(200), password: z.string().max(200) })
      .parse(body);
    const expected = Object.entries(DEMO_ACCOUNTS).find(
      ([, account]) => account.email === email && account.password === password,
    );
    if (!expected) throw new AppError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।", 401);
    write(SESSION_KEY, email);
    const user = currentUser()!;
    return {
      status: 200,
      data: { id: user.id, name: user.name, email, role: user.role },
    };
  }

  if (path === "/logout" && method === "POST") {
    write(SESSION_KEY, "");
    return { status: 200, data: { ok: true } };
  }

  if (path === "/me") {
    const user = currentUser();
    return {
      status: 200,
      data: user
        ? { id: user.id, name: user.name, email: user.email, role: user.role }
        : null,
    };
  }

  if (path === "/admin")
    return { status: 200, data: await demo.overview(requireUser()) };

  if (path === "/admin/mutate" && method === "POST") {
    const user = requireUser();
    const action = z.string().max(60).parse(body.action);
    const payload = validateMutation(action, body.payload);
    return { status: 200, data: await demo.mutate(user, action, payload) };
  }

  if (path === "/staff/device" && method === "GET")
    return {
      status: 200,
      data: await demo.deviceState(requireUser(), read(DEVICE_KEY)),
    };

  if (path === "/staff/device" && method === "POST") {
    const user = requireUser();
    const label = z.string().trim().min(2).max(100).parse(body.label);
    const token = read(DEVICE_KEY) || randomBytes(32).toString("hex");
    write(DEVICE_KEY, token);
    return {
      status: 200,
      data: await demo.registerDevice(user, label, token),
    };
  }

  if (path === "/checkin" && method === "POST") {
    const user = requireUser();
    const input = z.string().trim().min(5).max(300).parse(body.input);
    return {
      status: 200,
      data: await demo.checkin(user, input, read(DEVICE_KEY)),
    };
  }

  throw new AppError("API পাওয়া যায়নি।", 404);
}

/** সব `/api/*` অনুরোধ ব্রাউজারের ভেতরেই উত্তর দেয়; কোনো নেটওয়ার্ক লাগে না। */
export function installDemoApi() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(raw, location.href);
    if (!url.pathname.startsWith("/api/")) return original(input, init);
    const method = (init?.method || "GET").toUpperCase();
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body)) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
    try {
      const result = await route(url.pathname.slice(4), method, body);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const status =
        error instanceof AppError
          ? error.status
          : typeof (error as { status?: number }).status === "number"
            ? (error as { status: number }).status
            : 400;
      const message =
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "তথ্য সঠিক নয়।")
          : (error as Error).message || "অনুরোধ সম্পন্ন হয়নি।";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
  };
}

export function resetPreview() {
  clearPreviewData();
  location.hash = "";
  location.reload();
}

/** প্রিভিউ ব্যানার: ডেমো রিসেট ও ডেমো লগইনের সহজ বাটন। */
export function mountPreviewBadge() {
  const bar = document.createElement("div");
  bar.setAttribute("data-preview-badge", "true");
  bar.innerHTML = `
    <div style="position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:8px;
      background:rgba(20,32,24,.92);color:#f6f1e4;font:500 12px/1.4 'Noto Sans Bengali',system-ui,sans-serif;
      padding:8px 10px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.28);backdrop-filter:blur(6px)">
      <span style="opacity:.85">ব্রাউজার ডেমো প্রিভিউ · সার্ভার ছাড়াই চলে</span>
      <button type="button" data-preview-reset style="border:1px solid rgba(246,241,228,.35);background:transparent;color:#f6f1e4;
        font:600 12px 'Noto Sans Bengali',system-ui,sans-serif;padding:4px 10px;border-radius:999px;cursor:pointer">ডেমো রিসেট</button>
    </div>`;
  document.body.appendChild(bar);
  bar
    .querySelector("[data-preview-reset]")
    ?.addEventListener("click", () => resetPreview());
}
