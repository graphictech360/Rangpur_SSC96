/**
 * টিম ও অনুমতি (R17) — শুধু মেইন অ্যাডমিন দেখেন।
 *  • সহ-অ্যাডমিন (সীমিত এক্সেস) বা গেট স্টাফ যোগ করা
 *  • প্রতিটি সহ-অ্যাডমিনের জন্য ট্যাব-ধরে অনুমতি বাছাই
 *  • অ্যাকাউন্ট সাময়িক বন্ধ (নিষ্ক্রিয়) বা পুরোপুরি বাদ দেওয়া
 *  • পাসওয়ার্ড বদলে দেওয়া (সম্পাদনার সময় নতুনটি লিখলেই হয়)
 */
import { useState, type FormEvent } from "react";
import {
  Crown,
  Loader2,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import type { Staff, TeamMember } from "../types";
import type { SaveMutation } from "./Editors";

/** অনুমতির কী → প্যানেলের ট্যাবের বাংলা নাম (server/domain.mjs-এর PERMISSION_KEYS-এর সঙ্গে মিল) */
export const PERMISSION_LABELS: [string, string][] = [
  ["overview", "এক নজরে"],
  ["reports", "রিপোর্ট ও হিসাব"],
  ["participants", "বন্ধু ও নিবন্ধন"],
  ["payments", "পেমেন্ট যাচাই"],
  ["event", "অনুষ্ঠান ও ফি"],
  ["content", "পেজের লেখা ও ছবি"],
  ["schedule", "সময়সূচি"],
  ["accounts", "পেমেন্ট নম্বর"],
  ["form", "নিবন্ধন ফর্ম"],
  ["header", "হেডার ও মেনু"],
  ["devices", "স্টাফ ডিভাইস"],
  ["expenses", "খরচের খাতা"],
  ["donations", "বন্ধুদের ঐচ্ছিক অনুদান"],
];

interface TeamForm {
  id: string;
  name: string;
  email: string;
  role: "moderator" | "scanner";
  password: string;
  permissions: string[];
  active: boolean;
}
const emptyForm: TeamForm = {
  id: "",
  name: "",
  email: "",
  role: "moderator",
  password: "",
  permissions: ["overview"],
  active: true,
};

export default function TeamManager({
  team,
  staff,
  onSave,
  onDelete,
}: {
  team: TeamMember[];
  staff: Staff;
  onSave: SaveMutation;
  onDelete: (action: string, id: string, title: string) => void;
}) {
  const [form, setForm] = useState<TeamForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      await onSave("team.save", {
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password || undefined,
        permissions: form.role === "moderator" ? form.permissions : [],
        active: form.active,
      });
      setForm(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (perm: string) =>
    setForm((p) =>
      p
        ? {
            ...p,
            permissions: p.permissions.includes(perm)
              ? p.permissions.filter((x) => x !== perm)
              : [...p.permissions, perm],
          }
        : p,
    );
  return (
    <div className="team-manager">
      {/* ── মেইন অ্যাডমিন (বদলানো যায় না) ── */}
      <section className="admin-panel-card team-main-card">
        <h3>
          <Crown size={18} /> মেইন অ্যাডমিন
        </h3>
        <div className="team-row main">
          <span className="team-avatar">{staff.name.charAt(0)}</span>
          <div>
            <b>{staff.name}</b>
            <small>{staff.email} · সব এক্সেস · একমাত্র অথরিটি</small>
          </div>
          <span className="team-badge admin">মেইন অ্যাডমিন</span>
        </div>
        <p>
          একমাত্র মেইন অ্যাডমিনই সহ-অ্যাডমিন যোগ/বাদ দিতে ও তাদের এক্সেস ঠিক
          করে দিতে পারেন।
        </p>
      </section>

      {/* ── টিমের তালিকা ── */}
      <section className="admin-panel-card">
        <div className="panel-card-heading">
          <h3>
            <UserCog size={18} /> সহ-অ্যাডমিন ও স্টাফ ({team.length ? team.length : 0})
          </h3>
          <button
            className="button button-primary"
            onClick={() => {
              setError("");
              setForm({ ...emptyForm });
            }}
          >
            <Plus size={16} /> নতুন সদস্য
          </button>
        </div>
        {team.length === 0 && !form && (
          <p className="expense-empty">
            এখনো কোনো সহ-অ্যাডমিন বা স্টাফ যোগ করা হয়নি।
          </p>
        )}
        <ul className="team-list">
          {team.map((m) => (
            <li key={m.id} className={m.active ? "" : "inactive"}>
              <span className="team-avatar">{m.name.charAt(0)}</span>
              <div className="team-info">
                <b>
                  {m.name}
                  {!m.active && <em className="team-off">· বন্ধ আছে</em>}
                </b>
                <small>{m.email}</small>
                <small className="team-perms">
                  {m.role === "scanner"
                    ? "শুধু গেট চেক-ইন"
                    : m.permissions.length
                      ? "এক্সেস: " +
                        PERMISSION_LABELS.filter(([k]) =>
                          m.permissions.includes(k),
                        )
                          .map(([, label]) => label)
                          .join(", ")
                      : "কোনো এক্সেস দেওয়া হয়নি"}
                </small>
              </div>
              <span
                className={`team-badge ${m.role === "scanner" ? "scanner" : "moderator"}`}
              >
                {m.role === "scanner" ? "গেট স্টাফ" : "সহ-অ্যাডমিন"}
              </span>
              <span className="row-actions">
                <button
                  className="icon-button"
                  aria-label="সদস্য সম্পাদনা"
                  onClick={() => {
                    setError("");
                    setForm({
                      id: m.id,
                      name: m.name,
                      email: m.email,
                      role: m.role,
                      password: "",
                      permissions: m.permissions || [],
                      active: m.active,
                    });
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label="সদস্য বাদ দিন"
                  onClick={() => onDelete("team.delete", m.id, m.name)}
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </li>
          ))}
        </ul>

        {/* ── যোগ/সম্পাদনার ফর্ম ── */}
        {form && (
          <form className="team-form" onSubmit={submit}>
            <h4>{form.id ? "সদস্য সম্পাদনা" : "নতুন সদস্য যোগ"}</h4>
            <div className="finance-entry-row">
              <label className="grow">
                <span>নাম</span>
                <input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => p && { ...p, name: e.target.value })
                  }
                />
              </label>
              <label className="grow">
                <span>ইমেইল (লগইনের জন্য)</span>
                <input
                  type="email"
                  required
                  maxLength={200}
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => p && { ...p, email: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="finance-entry-row">
              <label>
                <span>ভূমিকা</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm(
                      (p) =>
                        p && {
                          ...p,
                          role: e.target.value as "moderator" | "scanner",
                        },
                    )
                  }
                >
                  <option value="moderator">সহ-অ্যাডমিন (সীমিত এক্সেস)</option>
                  <option value="scanner">গেট স্টাফ (শুধু চেক-ইন)</option>
                </select>
              </label>
              <label className="grow">
                <span>
                  পাসওয়ার্ড{" "}
                  {form.id ? "(বদলাতে চাইলে নতুনটি লিখুন)" : "(অন্তত ৮ অক্ষর)"}
                </span>
                <input
                  type="text"
                  minLength={form.id ? 0 : 8}
                  maxLength={200}
                  required={!form.id}
                  placeholder={form.id ? "খালি রাখলে আগেরটিই থাকবে" : ""}
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => p && { ...p, password: e.target.value })
                  }
                />
              </label>
              <label className="consent team-active">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((p) => p && { ...p, active: e.target.checked })
                  }
                />
                <span>অ্যাকাউন্ট চালু</span>
              </label>
            </div>
            {form.role === "moderator" && (
              <fieldset className="perm-grid">
                <legend>
                  <ShieldCheck size={15} /> কোন কোন জায়গার এক্সেস পাবে?
                </legend>
                {PERMISSION_LABELS.map(([key, label]) => (
                  <label
                    key={key}
                    className={`perm-chip ${form.permissions.includes(key) ? "on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(key)}
                      onChange={() => toggle(key)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="finance-entry-row">
              <button className="button button-primary" disabled={busy}>
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Save size={16} />
                )}
                {form.id ? "সদস্য আপডেট" : "সদস্য যোগ করুন"}
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setForm(null)}
              >
                <X size={16} /> বাতিল
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
