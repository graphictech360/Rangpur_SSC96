import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { initialState, hash, token } from "./seed.mjs";
import { computeStats } from "./stats.mjs";
import {
  AppError,
  canDo,
  computeTotal,
  normalizeMobile,
  safeRegistration,
} from "./domain.mjs";
const dataDir = path.resolve(process.env.DEMO_DATA_DIR || "data");
const file = path.join(dataDir, "demo-store.json");
let state,
  queue = Promise.resolve();
export async function initDemo() {
  await mkdir(dataDir, { recursive: true });
  try {
    state = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    state = initialState();
    await persist();
  }
}
async function persist() {
  await writeFile(file + ".tmp", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  await rename(file + ".tmp", file);
}
function transact(fn) {
  const next = queue.then(async () => {
    const backup = structuredClone(state);
    try {
      const result = await fn();
      await persist();
      return result;
    } catch (e) {
      state = backup;
      throw e;
    }
  });
  queue = next.catch(() => {});
  return next;
}
function audit(user, action, recordId, meta = {}) {
  state.audit.unshift({
    id: randomUUID(),
    user: user?.name || "public",
    action,
    recordId,
    meta,
    createdAt: new Date().toISOString(),
  });
}
function requireAdmin(user) {
  if (user?.role !== "admin")
    throw new AppError("অ্যাডমিন অনুমতি প্রয়োজন।", 403);
}
// প্যানেলে ঢুকতে পারেন: মেইন অ্যাডমিন ও সহ-অ্যাডমিন (moderator)
function requirePanel(user) {
  if (!["admin", "moderator"].includes(user?.role))
    throw new AppError("অ্যাডমিন অনুমতি প্রয়োজন।", 403);
}
function requireStaff(user) {
  if (!["admin", "moderator", "scanner"].includes(user?.role))
    throw new AppError("স্টাফ লগইন প্রয়োজন।", 403);
}
// সহ-অ্যাডমিনের নির্দিষ্ট অনুমতি আছে কি?
const hasPerm = (user, perm) =>
  user?.role === "admin" ||
  (user?.role === "moderator" &&
    (user.permissions || []).includes(perm));
function findReg(id) {
  const r = state.registrations.find((x) => x.id === id);
  if (!r) throw new AppError("নিবন্ধন পাওয়া যায়নি।", 404);
  return r;
}
export const demo = {
  site: async () => ({
    mode: "demo",
    event: { ...state.event, photoRequired: true },
    fees: state.fees,
    sections: state.sections
      .filter((x) => x.visible)
      .sort((a, b) => a.order - b.order),
    schedule: state.schedule
      .filter((x) => x.visible)
      .sort((a, b) => a.order - b.order),
    accounts: state.accounts
      .filter((x) => x.active)
      .sort((a, b) => a.order - b.order),
    formFields: (state.formFields || [])
      .filter((x) => x.visible !== false)
      .sort((a, b) => a.order - b.order),
    nav: (state.navItems || [])
      .filter((x) => x.visible !== false)
      .sort((a, b) => a.order - b.order),
    formTexts: state.formTexts || {},
    albums: (state.albums || [])
      .filter((x) => x.active && (x.media || []).length)
      .sort((a, b) => a.order - b.order),
    demoTicketKey: state.demoTicketKey,
  }),
  register: async (data) =>
    transact(() => {
      if (!state.event.registrationOpen)
        throw new AppError("নিবন্ধন আপাতত বন্ধ আছে।");
      if (
        state.registrations.some(
          (r) =>
            !r.archivedAt &&
            normalizeMobile(r.participant.mobile) === data.participant.mobile,
        )
      )
        throw new AppError(
          "এই মোবাইল নম্বরে ইতিমধ্যে নিবন্ধন আছে। সংরক্ষিত টিকিটের লিংক ব্যবহার করুন।",
          409,
        );
      if (
        state.registrations.some(
          (r) =>
            r.payment.provider === data.payment.provider &&
            r.payment.transactionId.toUpperCase() ===
              data.payment.transactionId.toUpperCase(),
        )
      )
        throw new AppError("এই ট্রানজেকশন আইডি আগে জমা হয়েছে।", 409);
      const account = state.accounts.find(
        (a) =>
          a.id === data.payment.accountId &&
          a.provider === data.payment.provider &&
          a.active,
      );
      if (!account)
        throw new AppError("পেমেন্ট গ্রহণকারীর সঠিক নম্বর বেছে নিন।");
      const total = computeTotal(state.fees, data.spouse, data.children);
      if (data.payment.amount !== total)
        throw new AppError(
          "ফি পরিবর্তিত হয়েছে। পেজ রিফ্রেশ করে সঠিক পরিমাণ যাচাই করুন।",
          409,
        );
      if (!String(data.participant.photoUrl || "").trim())
        throw new AppError("নিজের একটি ছবি আপলোড করুন — ছবি ছাড়া টিকিট তৈরি হবে না।", 400);
      const trackingKey = token();
      const r = {
        id: randomUUID(),
        ticketNumber: `R96-${String(state.nextSerial++).padStart(5, "0")}`,
        participant: data.participant, // ছবি (photoUrl) এর ভিতরেই থাকে
        spouse: data.spouse,
        children: data.children,
        food: data.food || "",
        notes: data.notes,
        answers: data.answers || {},
        feeSnapshot: { ...state.fees },
        total,
        status: "pending",
        payment: {
          ...data.payment,
          id: randomUUID(),
          collectorName: account.name,
          collectorMobile: account.mobile,
          status: "pending",
          reviewedAt: null,
          reason: "",
        },
        trackingHash: hash(trackingKey),
        qrSecret: null,
        createdAt: new Date().toISOString(),
        approvedAt: null,
        checkedInAt: null,
        archivedAt: null,
        source: "demo",
      };
      state.registrations.push(r);
      audit(null, "registration.created", r.id);
      return { registration: safeRegistration(r), trackingKey };
    }),
  lookup: async (key) => {
    if (!/^[a-f0-9]{64}$/.test(key))
      throw new AppError("সঠিক টিকিটের গোপন লিংক বা রিকভারি কোড দিন।", 404);
    const keyHash = hash(key);
    const r = state.registrations.find((x) => x.trackingHash === keyHash);
    if (!r || r.archivedAt)
      throw new AppError("নিবন্ধন পাওয়া যায়নি বা বাতিল হয়েছে।", 404);
    return safeRegistration(r, { ticket: true });
  },
  // ডেমো লগইন: মেইন অ্যাডমিনের যোগ করা টিম-সদস্য (সহ-অ্যাডমিন/স্টাফ) মেলানো
  teamLogin: async (email, password) => {
    const m = (state.team || []).find(
      (x) =>
        x.active &&
        x.email === String(email).trim().toLowerCase() &&
        x.password === password,
    );
    if (!m) return null;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      permissions: m.permissions || [],
    };
  },
  // সেশনের টিম-সদস্য এখনো সক্রিয় কি না + হালনাগাদ অনুমতি
  teamIdentity: async (id) => {
    const m = (state.team || []).find((x) => x.id === id);
    if (!m || !m.active) return null;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      permissions: m.permissions || [],
    };
  },
  overview: async (user) => {
    requirePanel(user);
    const registrations = state.registrations.map((r) => safeRegistration(r));
    // সহ-অ্যাডমিন: যে বিভাগের অনুমতি নেই সেই বিভাগের ডেটা পাঠানো হয় না
    const canRegs =
      user.role === "admin" ||
      ["overview", "reports", "participants", "payments"].some((p) =>
        hasPerm(user, p),
      );
    // খরচের খাতা দেখা: "expenses" বা "donations" — যেকোনো একটি থাকলেই
    const canMoney = hasPerm(user, "expenses") || hasPerm(user, "donations");
    return {
      me: {
        id: user.id,
        name: user.name,
        role: user.role,
        permissions: user.role === "admin" ? null : user.permissions || [],
      },
      team:
        user.role === "admin"
          ? (state.team || []).map(({ password, ...safe }) => safe)
          : [],
      expenses: canMoney
        ? (state.expenses || [])
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
        : [],
      donations: canMoney
        ? (state.donations || [])
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
        : [],
      // খরচের খাতার আয়-সারাংশ: অনুমোদিত নিবন্ধন থেকে বন্ধু/সঙ্গী/শিশু ভাগে
      // (প্রতিটি নিবন্ধনের নিজের ফি-snapshot ধরে — পরে ফি বদলালেও হিসাব ঠিক থাকে)
      finance: canMoney
        ? (() => {
            const approvedRegs = state.registrations.filter(
              (r) => r.status === "approved" && !r.archivedAt,
            );
            const sum = (fn) => approvedRegs.reduce((a, r) => a + fn(r), 0);
            return {
              friendCount: approvedRegs.length,
              friendTotal: sum((r) => r.feeSnapshot.friend),
              spouseCount: sum((r) => r.spouse),
              spouseTotal: sum((r) => r.spouse * r.feeSnapshot.spouse),
              childCount: sum((r) => r.children),
              childTotal: sum((r) => r.children * r.feeSnapshot.child),
              registrationTotal: sum((r) => r.total),
            };
          })()
        : null,
      event: state.event,
      fees: state.fees,
      sections: state.sections,
      albums: (state.albums || []).sort((a, b) => a.order - b.order),
      schedule: state.schedule,
      accounts: state.accounts,
      formFields: state.formFields || [],
      nav: state.navItems || [],
      formTexts: state.formTexts || {},
      formFieldStats: (state.formFields || [])
        .filter((f) => f.visible !== false)
        .sort((a, b) => a.order - b.order)
        .map((f) => {
          const values = registrations
            .filter((r) => r.archivedAt === null)
            .map((r) => (r.answers || {})[f.key])
            .filter((v) => v !== undefined && v !== "");
          const counts = {};
          for (const v of values) counts[v] = (counts[v] || 0) + 1;
          return {
            key: f.key,
            label: f.label,
            kind: f.kind,
            order: f.order,
            answered: values.length,
            top: Object.entries(counts)
              .map(([value, count]) => ({ value, count }))
              .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
              .slice(0, 8),
          };
        }),
      registrations: canRegs ? registrations : [],
      devices: hasPerm(user, "devices")
        ? state.devices.map(({ tokenHash, ...d }) => d)
        : [],
      audit: user.role === "admin" ? state.audit.slice(0, 100) : [],
      // রিপোর্ট ট্যাবের সব হিসাব (Supabase-এর admin_overview()->stats-এর সমান গঠন)
      stats: computeStats(
        registrations.map((r) => ({
          ...r,
          groupSize: 1 + r.spouse + r.children,
        })),
        state.registrations.filter((r) => r.archivedAt).length,
        state.formFields || [],
      ),
    };
  },
  mutate: async (user, action, payload) =>
    transact(() => {
      requirePanel(user);
      // সহ-অ্যাডমিন: অনুমতির তালিকার বাইরের কাজ আটকে যায়
      if (!canDo(user, action))
        throw new AppError("এই কাজের অনুমতি তোমার অ্যাকাউন্টে নেই।", 403);
      let result = { ok: true };
      if (action === "expense.save") {
        // খরচের খাতা: কে লিখলেন (enteredBy) সার্ভার নিজে বসায় — বদলানো যায় না
        if (!Array.isArray(state.expenses)) state.expenses = [];
        const existing = state.expenses.find((x) => x.id === payload.id);
        if (existing) {
          Object.assign(existing, {
            date: payload.date,
            title: payload.title,
            amount: payload.amount,
            note: payload.note || "",
          });
          result = existing;
        } else {
          const obj = {
            ...payload,
            id: payload.id || randomUUID(),
            note: payload.note || "",
            enteredBy: user.name,
            createdAt: new Date().toISOString(),
          };
          state.expenses.push(obj);
          result = obj;
        }
      } else if (action === "expense.delete") {
        state.expenses = (state.expenses || []).filter(
          (x) => x.id !== payload.id,
        );
      } else if (action === "donation.save") {
        if (!Array.isArray(state.donations)) state.donations = [];
        const existing = state.donations.find((x) => x.id === payload.id);
        if (existing) {
          Object.assign(existing, {
            date: payload.date,
            donor: payload.donor,
            amount: payload.amount,
            note: payload.note || "",
          });
          result = existing;
        } else {
          const obj = {
            ...payload,
            id: payload.id || randomUUID(),
            note: payload.note || "",
            enteredBy: user.name,
            createdAt: new Date().toISOString(),
          };
          state.donations.push(obj);
          result = obj;
        }
      } else if (action === "donation.delete") {
        state.donations = (state.donations || []).filter(
          (x) => x.id !== payload.id,
        );
      } else if (action === "team.save") {
        // শুধু মেইন অ্যাডমিন (canDo-তে আগেই আটকায়, তবু দ্বিগুণ পাহারা)
        requireAdmin(user);
        if (!Array.isArray(state.team)) state.team = [];
        if (
          state.team.some(
            (x) => x.email === payload.email && x.id !== payload.id,
          )
        )
          throw new AppError("এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।", 409);
        const existing = state.team.find((x) => x.id === payload.id);
        if (existing) {
          Object.assign(existing, {
            name: payload.name,
            email: payload.email,
            role: payload.role,
            permissions: payload.permissions || [],
            active: payload.active !== false,
          });
          if (payload.password) existing.password = payload.password;
          const { password, ...safe } = existing;
          result = safe;
        } else {
          if (!payload.password)
            throw new AppError("নতুন অ্যাকাউন্টের জন্য পাসওয়ার্ড দিন।", 400);
          const obj = {
            id: payload.id || randomUUID(),
            name: payload.name,
            email: payload.email,
            role: payload.role,
            password: payload.password,
            permissions: payload.permissions || [],
            active: payload.active !== false,
            createdBy: user.name,
            createdAt: new Date().toISOString(),
          };
          state.team.push(obj);
          const { password, ...safe } = obj;
          result = safe;
        }
      } else if (action === "team.delete") {
        requireAdmin(user);
        state.team = (state.team || []).filter((x) => x.id !== payload.id);
      } else if (action === "event.save") state.event = { ...state.event, ...payload };
      else if (action === "fees.save") state.fees = { ...payload };
      else if (action === "formField.save") {
        if (!Array.isArray(state.formFields)) state.formFields = [];
        const existing = state.formFields.find((x) => x.id === payload.id);
        if (existing?.isBase) {
          // মূল ঘর: লেবেল/সাহায্য/ধাপ/ক্রম বদলানো যায়; কী/ধরন কখনো নয়
          Object.assign(existing, {
            label: payload.label ?? existing.label,
            placeholder:
              payload.placeholder === undefined
                ? existing.placeholder
                : payload.placeholder,
            help: payload.help === undefined ? existing.help : payload.help,
            step: payload.step ?? existing.step ?? 1,
            order: payload.order ?? existing.order,
            required: existing.isLocked
              ? existing.required
              : (payload.required ?? existing.required),
            visible: existing.isLocked
              ? existing.visible
              : (payload.visible ?? existing.visible),
          });
          result = existing;
        } else {
          if (
            state.formFields.some(
              (x) => x.key === payload.key && x.id !== payload.id,
            )
          )
            throw new AppError("এই কী (key) দিয়ে আরেকটি ঘর আছে।");
          const obj = { ...payload, id: payload.id || randomUUID() };
          const i = state.formFields.findIndex((x) => x.id === obj.id);
          if (i >= 0) state.formFields[i] = { ...state.formFields[i], ...obj };
          else state.formFields.push(obj);
          result = obj;
        }
      } else if (action === "formField.delete") {
        const f = (state.formFields || []).find((x) => x.id === payload.id);
        if (f?.isBase)
          throw new AppError(
            "ফর্মের মূল ঘর মুছে ফেলা যায় না — চাইলে “লুকাও” দিয়ে ফর্ম থেকে সরান।",
          );
        state.formFields = (state.formFields || []).filter(
          (x) => x.id !== payload.id,
        );
      } else if (action === "formField.move") {
        const f = (state.formFields || []).find((x) => x.id === payload.id);
        if (f) f.order = payload.order;
      } else if (action === "formField.reorder") {
        // ড্র্যাগ করে সাজানোর পর এক কলেই সব ঘরের ক্রম
        for (const item of payload.items || []) {
          const f = (state.formFields || []).find((x) => x.id === item.id);
          if (f) f.order = item.order;
        }
      } else if (action === "navItem.save") {
        if (!Array.isArray(state.navItems)) state.navItems = [];
        const obj = { ...payload, id: payload.id || randomUUID() };
        const i = state.navItems.findIndex((x) => x.id === obj.id);
        if (i >= 0) state.navItems[i] = { ...state.navItems[i], ...obj };
        else state.navItems.push(obj);
        result = obj;
      } else if (action === "navItem.delete") {
        state.navItems = (state.navItems || []).filter(
          (x) => x.id !== payload.id,
        );
      } else if (action === "navItem.reorder") {
        for (const item of payload.items || []) {
          const n = (state.navItems || []).find((x) => x.id === item.id);
          if (n) n.order = item.order;
        }
      } else if (action === "formText.save") {
        state.formTexts = {
          ...(state.formTexts || {}),
          [payload.key]: payload.value ?? "",
        };
      } else if (action === "album.save") {
        // আগের আয়োজনের অ্যালবাম: নাম, তারিখ, ছবি/ভিডিওর তালিকা
        if (!Array.isArray(state.albums)) state.albums = [];
        const obj = {
          ...payload,
          id: payload.id || randomUUID(),
          media: (payload.media || []).map((m) => ({
            ...m,
            id: m.id || randomUUID(),
          })),
        };
        const i = state.albums.findIndex((x) => x.id === obj.id);
        if (i >= 0) state.albums[i] = obj;
        else state.albums.push(obj);
        result = obj;
      } else if (action === "album.delete") {
        state.albums = (state.albums || []).filter((x) => x.id !== payload.id);
      } else if (
        ["section.save", "schedule.save", "account.save"].includes(action)
      ) {
        const key = {
          "section.save": "sections",
          "schedule.save": "schedule",
          "account.save": "accounts",
        }[action];
        if (
          key === "sections" &&
          state.sections.some(
            (x) => x.key === payload.key && x.id !== payload.id,
          )
        )
          throw new AppError("এই সেকশন কী ইতিমধ্যে আছে।");
        const obj = { ...payload, id: payload.id || randomUUID() };
        const i = state[key].findIndex((x) => x.id === obj.id);
        if (i >= 0) state[key][i] = obj;
        else state[key].push(obj);
        result = obj;
      } else if (
        ["section.delete", "schedule.delete", "account.delete"].includes(action)
      ) {
        const key = {
          "section.delete": "sections",
          "schedule.delete": "schedule",
          "account.delete": "accounts",
        }[action];
        if (key === "accounts") {
          const a = state.accounts.find((x) => x.id === payload.id);
          if (a) a.active = false;
        } else state[key] = state[key].filter((x) => x.id !== payload.id);
      } else if (action === "registration.approve") {
        const r = findReg(payload.id);
        if (r.archivedAt)
          throw new AppError("বাদ দেওয়া নিবন্ধন অনুমোদন করা যাবে না।");
        if (payload.verified !== true)
          throw new AppError("নিজের লেনদেনের রেকর্ড মিলিয়ে নিশ্চিত করুন।");
        if (r.status === "approved") return { ok: true };
        if (r.payment.amount !== r.total)
          throw new AppError(
            "জমা দেওয়া টাকার পরিমাণ নির্ধারিত ফি-র সঙ্গে মিলছে না।",
          );
        r.status = "approved";
        r.approvedAt = new Date().toISOString();
        r.qrSecret = token();
        r.payment.status = "verified";
        r.payment.reviewedAt = r.approvedAt;
        r.payment.reason = "";
      } else if (action === "registration.reject") {
        const r = findReg(payload.id);
        if (r.checkedInAt)
          throw new AppError("চেক-ইন হওয়া টিকিট প্রত্যাখ্যান করা যাবে না।");
        if (!payload.reason?.trim())
          throw new AppError("প্রত্যাখ্যানের কারণ লিখুন।");
        r.status = "rejected";
        r.qrSecret = null;
        r.payment.status = "rejected";
        r.payment.reason = payload.reason.trim();
        r.payment.reviewedAt = new Date().toISOString();
      } else if (action === "participant.save") {
        const r = findReg(payload.id);
        if (
          state.registrations.some(
            (x) =>
              x.id !== r.id &&
              !x.archivedAt &&
              x.participant.mobile === payload.participant.mobile,
          )
        )
          throw new AppError("এই মোবাইলে অন্য নিবন্ধন আছে।");
        if (
          r.status === "approved" &&
          (r.spouse !== payload.spouse || r.children !== payload.children)
        )
          throw new AppError(
            "অনুমোদিত টিকিটের সদস্যসংখ্যা সরাসরি বদলানো যাবে না।",
          );
        r.participant = payload.participant;
        r.food = payload.food || "";
        r.notes = payload.notes || "";
        if (payload.answers) r.answers = payload.answers;
        r.spouse = payload.spouse;
        r.children = payload.children;
        r.total = computeTotal(r.feeSnapshot, r.spouse, r.children);
      } else if (action === "payment.save") {
        const r = findReg(payload.id);
        if (r.status === "approved" || r.checkedInAt || r.archivedAt)
          throw new AppError(
            "অনুমোদিত বা বাতিল পেমেন্ট সরাসরি বদলানো যাবে না।",
          );
        const account = state.accounts.find(
          (a) =>
            a.id === payload.accountId &&
            a.provider === payload.provider &&
            a.active,
        );
        if (!account) throw new AppError("সঠিক পেমেন্ট গ্রহণকারী বেছে নিন।");
        if (
          state.registrations.some(
            (x) =>
              x.id !== r.id &&
              x.payment.provider === payload.provider &&
              x.payment.transactionId.toUpperCase() ===
                payload.transactionId.toUpperCase(),
          )
        )
          throw new AppError("এই ট্রানজেকশন আইডি আগে ব্যবহৃত হয়েছে।");
        const { id, ...payment } = payload;
        r.payment = {
          ...r.payment,
          ...payment,
          collectorName: account.name,
          collectorMobile: account.mobile,
          status: "pending",
          reviewedAt: null,
          reason: "",
        };
        r.status = "pending";
      } else if (action === "registration.reissue") {
        const r = findReg(payload.id);
        if (r.archivedAt)
          throw new AppError("বাতিল নিবন্ধনের লিংক তৈরি করা যাবে না।");
        const trackingKey = token();
        r.trackingHash = hash(trackingKey);
        result = { trackingKey };
      } else if (action === "registration.remove") {
        const r = findReg(payload.id);
        r.archivedAt = new Date().toISOString();
        r.status = "cancelled";
        r.qrSecret = null;
      } else if (action === "device.update") {
        const d = state.devices.find((x) => x.id === payload.id);
        if (!d) throw new AppError("ডিভাইস পাওয়া যায়নি।");
        d.status = payload.status;
        d.approvedBy = user.name;
        d.updatedAt = new Date().toISOString();
      } else throw new AppError("অজানা পরিবর্তন।");
      audit(user, action, payload.id || state.event.id);
      return result;
    }),
  registerDevice: async (user, label, deviceToken) =>
    transact(() => {
      requireStaff(user);
      const tokenHash = hash(deviceToken);
      let device = state.devices.find(
        (d) => d.userId === user.id && d.tokenHash === tokenHash,
      );
      if (!device) {
        device = {
          id: randomUUID(),
          userId: user.id,
          staffName: user.name,
          label,
          tokenHash,
          status: user.role === "admin" ? "approved" : "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          approvedBy: user.role === "admin" ? user.name : null,
        };
        state.devices.push(device);
        audit(user, "device.register", device.id);
      }
      const { tokenHash: _, ...safe } = device;
      return safe;
    }),
  deviceState: async (user, deviceToken) => {
    requireStaff(user);
    const d = state.devices.find(
      (x) => x.userId === user.id && x.tokenHash === hash(deviceToken || ""),
    );
    if (!d) return null;
    const { tokenHash, ...safe } = d;
    return safe;
  },
  checkin: async (user, input, deviceToken) =>
    transact(() => {
      requireStaff(user);
      const device = state.devices.find(
        (x) =>
          x.userId === user.id &&
          x.tokenHash === hash(deviceToken || "") &&
          x.status === "approved",
      );
      if (!device)
        throw new AppError(
          "এই ব্রাউজার/ডিভাইসটি চেক-ইনের জন্য অনুমোদিত নয়।",
          403,
        );
      let r;
      if (/^R96:\w[\w-]+:[a-f0-9]{64}$/.test(input)) {
        const [, id, secret] = input.split(":");
        r = state.registrations.find((x) => x.id === id);
        if (
          !r?.qrSecret ||
          !timingSafeEqual(Buffer.from(secret), Buffer.from(r.qrSecret))
        )
          throw new AppError("QR টিকিটটি সঠিক নয়।", 404);
      } else if (/^R96-\d{5,}$/.test(input.toUpperCase()))
        r = state.registrations.find(
          (x) => x.ticketNumber === input.toUpperCase(),
        );
      else throw new AppError("এই উৎসবের সঠিক QR বা টিকিট নম্বর দিন।");
      if (
        !r ||
        r.archivedAt ||
        r.status !== "approved" ||
        r.payment.status !== "verified"
      )
        throw new AppError("টিকিট অনুমোদিত নয় বা বাতিল হয়েছে।", 403);
      const alreadyCheckedIn = Boolean(r.checkedInAt);
      if (!alreadyCheckedIn) {
        r.checkedInAt = new Date().toISOString();
        audit(user, "ticket.checkin", r.id, { deviceId: device.id });
      }
      return {
        alreadyCheckedIn,
        ticketNumber: r.ticketNumber,
        name: r.participant.name,
        school: r.participant.school,
        photoUrl: r.participant.photoUrl || "",
        people: 1 + r.spouse + r.children,
        spouse: r.spouse,
        children: r.children,
        checkedInAt: r.checkedInAt,
      };
    }),
  /* ── R26: পুশ নোটিফিকেশন ও বেল-আইকনের আনরিড হিসাব ────────────── */
  pushSubscribe: async (user, sub, label = "") =>
    transact(() => {
      requirePanel(user);
      if (!Array.isArray(state.pushSubs)) state.pushSubs = [];
      const entry = {
        userId: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        label: String(label || "").slice(0, 120),
        createdAt: new Date().toISOString(),
      };
      const i = state.pushSubs.findIndex((x) => x.endpoint === sub.endpoint);
      if (i >= 0) state.pushSubs[i] = entry;
      else state.pushSubs.push(entry);
      return { ok: true };
    }),
  pushUnsubscribe: async (user, endpoint) =>
    transact(() => {
      requirePanel(user);
      state.pushSubs = (state.pushSubs || []).filter(
        (x) => !(x.endpoint === endpoint && x.userId === user.id),
      );
      return { ok: true };
    }),
  // শুধু সার্ভার নিজে ডাকে (নতুন নিবন্ধনের পরে) — কোনো API রুট থেকে নয়
  pushTargets: async () =>
    (state.pushSubs || []).map((x) => ({
      endpoint: x.endpoint,
      p256dh: x.p256dh,
      auth: x.auth,
    })),
  pushPrune: async (endpoints) =>
    transact(() => {
      const dead = new Set(endpoints || []);
      state.pushSubs = (state.pushSubs || []).filter(
        (x) => !dead.has(x.endpoint),
      );
      return { ok: true };
    }),
  notifState: async (user) => {
    requirePanel(user);
    const seenAt = state.notifSeen?.[user.id] || "1970-01-01T00:00:00.000Z";
    return {
      seenAt,
      unread: state.registrations.filter(
        (r) => !r.archivedAt && r.createdAt > seenAt,
      ).length,
    };
  },
  notifMarkSeen: async (user) =>
    transact(() => {
      requirePanel(user);
      if (!state.notifSeen) state.notifSeen = {};
      state.notifSeen[user.id] = new Date().toISOString();
      return { seenAt: state.notifSeen[user.id], unread: 0 };
    }),
};
