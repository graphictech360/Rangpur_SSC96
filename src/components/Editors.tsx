import { useState, type FormEvent } from "react";
import { Save, Loader2, AlertTriangle } from "lucide-react";
import type {
  AdminData,
  FestivalEvent,
  Fees,
  PaymentAccount,
  Registration,
} from "../types";
import { money } from "../lib";
export type EditorKind =
  "section" | "schedule" | "account" | "participant" | "payment";
export interface EditorState {
  kind: EditorKind;
  data: Record<string, any>;
  title: string;
}
export type SaveMutation = (action: string, payload: unknown) => Promise<any>;
function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}
export function EntityEditor({
  editor,
  accounts,
  onSave,
  onClose,
}: {
  editor: EditorState;
  accounts: PaymentAccount[];
  onSave: SaveMutation;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({ ...editor.data }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (key: string, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));
  const field = (
    key: string,
    label: string,
    type = "text",
    required = true,
    disabled = false,
  ) => (
    <TextField
      key={key}
      label={label}
      value={form[key]}
      type={type}
      onChange={(v) => set(key, v)}
      required={required}
      disabled={disabled}
    />
  );
  const check = (key: string, label: string) => (
    <label className="consent editor-check">
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) => set(key, e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
  const area = (key: string, label: string) => (
    <label className="field">
      {label}
      <textarea
        rows={key === "body" ? 4 : key === "imageUrl" ? 3 : 2}
        value={form[key] || ""}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let payload = { ...form };
      if (["section", "schedule", "account"].includes(editor.kind))
        payload.order = Number(form.order);
      if (editor.kind === "participant") {
        payload = {
          id: form.id,
          participant: {
            name: form.name,
            school: form.school,
            sscRoll: form.sscRoll,
            sscRegistration: form.sscRegistration || "",
            mobile: form.mobile,
            location: form.location,
            tshirt: form.tshirt,
          },
          spouse: Number(form.spouse),
          children: Number(form.children),
          food: form.food,
          notes: form.notes || "",
        };
      }
      if (editor.kind === "payment")
        payload = {
          id: form.id,
          provider: form.provider,
          accountId: form.accountId,
          senderMobile: form.senderMobile,
          transactionId: form.transactionId,
          amount: Number(form.amount),
        };
      await onSave(`${editor.kind}.save`, payload);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="entity-editor" onSubmit={submit}>
      {editor.kind === "section" && (
        <>
          {field("key", "সেকশন কী (ইংরেজি, যেমন memories)")}
          {field("title", "শিরোনাম")}
          {field("subtitle", "ছোট শিরোনাম", "text", false)}
          {area("body", "বিস্তারিত লেখা")}
          {area(
            "imageUrl",
            "ছবির লিংক — একাধিক ছবি দিলে ব্যানারে নিজে থেকেই বদলাবে (প্রতি লাইনে একটি)",
          )}
          {field("order", "সাজানোর ক্রম", "number")}
          {check("visible", "মূল পেজে দেখাবে")}
        </>
      )}
      {editor.kind === "schedule" && (
        <>
          <div className="field-grid">
            {field("time", "সময়", "time")}
            <label className="field">
              পর্ব
              <select
                value={form.period}
                onChange={(e) => set("period", e.target.value)}
              >
                {["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {field("title", "আয়োজনের নাম")}
          {area("note", "বিশেষ নোট")}
          {field("order", "সাজানোর ক্রম", "number")}
          {check("visible", "সময়সূচিতে দেখাবে")}
        </>
      )}
      {editor.kind === "account" && (
        <>
          <label className="field">
            পেমেন্ট পদ্ধতি
            <select
              value={form.provider}
              onChange={(e) => set("provider", e.target.value)}
            >
              <option value="bkash">বিকাশ</option>
              <option value="nagad">নগদ</option>
            </select>
          </label>
          {field("name", "গ্রহণকারীর নাম")}
          {field("mobile", "ব্যক্তিগত মোবাইল নম্বর", "tel")}
          {field("order", "সাজানোর ক্রম", "number")}
          {check("active", "Send Money নম্বরটি সক্রিয়")}
        </>
      )}
      {editor.kind === "participant" && (
        <>
          <div className="field-grid">
            {field("name", "নাম")}
            {field("mobile", "মোবাইল", "tel")}
          </div>
          {field("school", "স্কুলের নাম")}
          <div className="field-grid">
            {field("sscRoll", "এসএসসি রোল")}
            {field("sscRegistration", "এসএসসি রেজিস্ট্রেশন", "text", false)}
          </div>
          {field("location", "বর্তমান অবস্থান")}
          <div className="field-grid">
            <label className="field">
              টি-শার্ট
              <select
                value={form.tshirt}
                onChange={(e) => set("tshirt", e.target.value)}
              >
                {["XS", "S", "M", "L", "XL", "XXL", "3XL"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              খাবারের পছন্দ
              <select
                value={form.food}
                onChange={(e) => set("food", e.target.value)}
              >
                {["সাধারণ", "নিরামিষ", "বিশেষ অনুরোধ"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {field(
              "spouse",
              "জীবনসঙ্গীর সংখ্যা (০/১)",
              "number",
              true,
              form.locked,
            )}
            {field(
              "children",
              "শিশুর সংখ্যা (০–২০)",
              "number",
              true,
              form.locked,
            )}
          </div>
          {form.locked && (
            <p className="small-note">
              অনুমোদিত টিকিটের সদস্যসংখ্যা ও ফি সুরক্ষিত রাখা হয়েছে।
            </p>
          )}
          {area("notes", "বিশেষ অনুরোধ")}
        </>
      )}
      {editor.kind === "payment" && (
        <>
          <div className="notice notice-warning">
            <AlertTriangle size={17} />
            নিজের লেনদেনের রেকর্ড মিলিয়ে সংশোধন করুন। সেভ করলে আবার যাচাইয়ের
            অপেক্ষায় থাকবে।
          </div>
          <label className="field">
            পেমেন্ট পদ্ধতি
            <select
              value={form.provider}
              onChange={(e) => {
                const provider = e.target.value;
                setForm((p) => ({
                  ...p,
                  provider,
                  accountId:
                    accounts.find((a) => a.active && a.provider === provider)
                      ?.id || "",
                }));
              }}
            >
              <option value="bkash">বিকাশ</option>
              <option value="nagad">নগদ</option>
            </select>
          </label>
          <label className="field">
            গ্রহণকারীর নম্বর
            <select
              value={form.accountId}
              onChange={(e) => set("accountId", e.target.value)}
            >
              {accounts
                .filter((a) => a.active && a.provider === form.provider)
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name} · {a.mobile}
                  </option>
                ))}
            </select>
          </label>
          {field("senderMobile", "প্রেরকের নম্বর", "tel")}
          {field("transactionId", "ট্রানজেকশন আইডি")}
          {field("amount", "দাবিকৃত জমার পরিমাণ", "number")}
          <p className="small-note">
            নির্ধারিত ফি: ৳ {money(form.expectedTotal)}। কম বা বেশি হলে অনুমোদন
            হবে না।
          </p>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onClose}
        >
          বাতিল
        </button>
        <button className="button button-primary" disabled={busy}>
          {busy ? <Loader2 size={17} className="spin" /> : <Save size={17} />}
          পরিবর্তন সেভ করো
        </button>
      </div>
    </form>
  );
}
export function EventSettings({
  data,
  onSave,
}: {
  data: AdminData;
  onSave: SaveMutation;
}) {
  const [event, setEvent] = useState<FestivalEvent>({ ...data.event }),
    [fees, setFees] = useState<Fees>({ ...data.fees });
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const set = (key: keyof FestivalEvent, value: string | boolean) =>
    setEvent((p) => ({ ...p, [key]: value }));
  const save = async (e: FormEvent, kind: string) => {
    e.preventDefault();
    setBusy(kind);
    setError("");
    try {
      await onSave(
        kind === "event" ? "event.save" : "fees.save",
        kind === "event" ? event : fees,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="admin-settings-grid">
      <form className="admin-panel-card" onSubmit={(e) => save(e, "event")}>
        <h3>অনুষ্ঠানের তথ্য</h3>
        <p>সেভ করলে মূল পেজের তথ্য আপডেট হবে।</p>
        {(
          [
            "name",
            "tagline",
            "dateLabel",
            "venue",
            "city",
            "venueEnglish",
          ] as const
        ).map((key) => (
          <TextField
            key={key}
            label={
              {
                name: "অনুষ্ঠানের নাম",
                tagline: "ট্যাগলাইন",
                dateLabel: "তারিখের লেখা",
                venue: "ভেন্যু (বাংলা)",
                city: "শহর (বাংলা)",
                venueEnglish: "লোকেশনের ইংরেজি নাম",
              }[key]
            }
            value={event[key]}
            onChange={(value) => set(key, value)}
          />
        ))}
        <label className="consent">
          <input
            type="checkbox"
            checked={event.isDummyDate}
            onChange={(e) => set("isDummyDate", e.target.checked)}
          />
          <span>তারিখটি এখনো প্রস্তাবিত/ডেমো</span>
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={event.registrationOpen}
            onChange={(e) => set("registrationOpen", e.target.checked)}
          />
          <span>নিবন্ধন চালু থাকবে</span>
        </label>
        <button className="button button-primary" disabled={!!busy}>
          {busy === "event" ? (
            <Loader2 size={17} className="spin" />
          ) : (
            <Save size={17} />
          )}
          অনুষ্ঠানের তথ্য সেভ
        </button>
      </form>
      <form
        className="admin-panel-card fee-settings"
        onSubmit={(e) => save(e, "fees")}
      >
        <h3>নিবন্ধন ফি</h3>
        <p>
          নতুন নিবন্ধনে এই ফি প্রযোজ্য হবে। পুরোনো নিবন্ধনের ফি-র snapshot
          বদলাবে না।
        </p>
        {(["friend", "spouse", "child"] as const).map((key) => (
          <TextField
            key={key}
            label={
              {
                friend: "বন্ধু (৳)",
                spouse: "জীবনসঙ্গী (৳)",
                child: "প্রতি শিশু (৳)",
              }[key]
            }
            type="number"
            value={fees[key]}
            onChange={(value) =>
              setFees((p) => ({ ...p, [key]: Number(value) }))
            }
          />
        ))}
        <button className="button button-primary" disabled={!!busy}>
          <Save size={17} />
          ফি সেভ করো
        </button>
        <div className="notice notice-info">
          <span>
            বিকাশ ও নগদ ব্যক্তিগত নম্বরের পেমেন্ট ম্যানুয়ালি যাচাই করতে হবে।
            অ্যাপ স্বয়ংক্রিয়ভাবে টাকা গ্রহণ বা নিশ্চিত করে না।
          </span>
        </div>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
export const participantEditor = (r: Registration): EditorState => ({
  kind: "participant",
  title: "বন্ধুর তথ্য সংশোধন",
  data: {
    id: r.id,
    ...r.participant,
    food: r.food,
    notes: r.notes,
    spouse: r.spouse,
    children: r.children,
    locked: r.status === "approved",
  },
});
