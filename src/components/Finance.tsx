/**
 * খরচের খাতা (R17) — শুধু অ্যাডমিন প্যানেলের ভেতরে, সাধারণ ব্যবহারকারী দেখেন না।
 *  • অনুমোদিত নিবন্ধনের মোট আয় — বন্ধু / জীবনসঙ্গী / শিশু ভাগে
 *  • বন্ধুদের ঐচ্ছিক অনুদান — আলাদা বাক্সে, মোট অঙ্কসহ
 *  • খরচ লেখার সহজ ফর্ম — কে লিখলেন ও কোন তারিখে, সব আপনা-আপনি থাকে
 *  • মোট তহবিল − মোট খরচ = ব্যালেন্স (প্লাসে সবুজ, মাইনাসে লাল)
 */
import { useMemo, useState, type FormEvent } from "react";
import {
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Save,
  Scale,
  Trash2,
  Users,
  Wallet,
  HandCoins,
  Download,
  X,
} from "lucide-react";
import type { AdminData, Expense, Donation, Staff } from "../types";
import { bn, money, triggerBlobDownload } from "../lib";
import type { SaveMutation } from "./Editors";

const today = () => new Date().toISOString().slice(0, 10);
/** ২০২৬-০১-৩১ ধাঁচে বাংলা তারিখ */
const bnDate = (iso: string) => bn(iso.split("-").reverse().join("-"));

export default function ExpenseSheet({
  data,
  staff,
  onSave,
  onDelete,
}: {
  data: AdminData;
  staff: Staff;
  onSave: SaveMutation;
  onDelete: (action: string, id: string, title: string) => void;
}) {
  const expenses = data.expenses || [];
  const donations = data.donations || [];
  const fin = data.finance;
  // খরচ লেখা: "expenses" অনুমতি · অনুদান লেখা: আলাদা "donations" অনুমতি
  const canExpense =
    staff.role === "admin" || (staff.permissions || []).includes("expenses");
  const canDonate =
    staff.role === "admin" || (staff.permissions || []).includes("donations");

  const donationTotal = donations.reduce((a, d) => a + d.amount, 0);
  const expenseTotal = expenses.reduce((a, x) => a + x.amount, 0);
  const regIncome = fin?.registrationTotal || 0;
  const fund = regIncome + donationTotal;
  const balance = fund - expenseTotal;

  return (
    <div className="finance-sheet">
      {/* ── সারাংশ: তহবিল, খরচ, ব্যালেন্স ── */}
      <div className="finance-cards">
        <article className="finance-card">
          <span className="finance-icon fund">
            <PiggyBank size={20} />
          </span>
          <div>
            <small>মোট তহবিল</small>
            <b>৳ {money(fund)}</b>
            <span>
              নিবন্ধন ৳ {money(regIncome)} + অনুদান ৳ {money(donationTotal)}
            </span>
          </div>
        </article>
        <article className="finance-card">
          <span className="finance-icon spent">
            <ReceiptText size={20} />
          </span>
          <div>
            <small>মোট খরচ</small>
            <b>৳ {money(expenseTotal)}</b>
            <span>{bn(expenses.length)}টি খরচের এন্ট্রি</span>
          </div>
        </article>
        <article
          className={`finance-card balance ${balance < 0 ? "negative" : "positive"}`}
        >
          <span className="finance-icon scale">
            <Scale size={20} />
          </span>
          <div>
            <small>ব্যালেন্স (জমা − খরচ)</small>
            <b>
              {balance < 0 ? "−" : "+"} ৳ {money(Math.abs(balance))}
            </b>
            <span>
              {balance < 0
                ? "খরচ তহবিল ছাড়িয়ে গেছে — সতর্ক হোন"
                : "তহবিলে এখনো টাকা আছে"}
            </span>
          </div>
        </article>
      </div>

      <div className="finance-grid">
        {/* ── অনুমোদিত নিবন্ধন থেকে আয় ── */}
        <section className="admin-panel-card finance-income">
          <h3>
            <Users size={18} /> অনুমোদিত নিবন্ধন থেকে আয়
          </h3>
          <p>
            প্রতিটি নিবন্ধন অনুমোদনের সময়কার ফি ধরে হিসাব — পরে ফি বদলালেও
            পুরোনো হিসাব ঠিক থাকে।
          </p>
          {fin ? (
            <table className="finance-table">
              <tbody>
                <tr>
                  <td>বন্ধুদের জমাকৃত ফি</td>
                  <td>{bn(fin.friendCount)} জন</td>
                  <td className="amount">৳ {money(fin.friendTotal)}</td>
                </tr>
                <tr>
                  <td>জীবনসঙ্গীদের ফি</td>
                  <td>{bn(fin.spouseCount)} জন</td>
                  <td className="amount">৳ {money(fin.spouseTotal)}</td>
                </tr>
                <tr>
                  <td>শিশুদের ফি</td>
                  <td>{bn(fin.childCount)} জন</td>
                  <td className="amount">৳ {money(fin.childTotal)}</td>
                </tr>
                <tr className="total-row">
                  <td>মোট নিবন্ধন-আয়</td>
                  <td>
                    {bn(fin.friendCount + fin.spouseCount + fin.childCount)} জন
                  </td>
                  <td className="amount">৳ {money(fin.registrationTotal)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="form-error">আয়ের হিসাব পড়া যায়নি।</p>
          )}
        </section>

        {/* ── বন্ধুদের ঐচ্ছিক অনুদান ── */}
        <DonationBox
          donations={donations}
          total={donationTotal}
          canEdit={canDonate}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>

      {/* ── খরচ লেখা ও তালিকা ── */}
      <ExpenseEntry
        expenses={expenses}
        total={expenseTotal}
        canEdit={canExpense}
        onSave={onSave}
        onDelete={onDelete}
        csv={() => downloadCsv(expenses, donations, fin?.registrationTotal || 0)}
        pdf={() => downloadPdf(data)}
      />
    </div>
  );
}

/** ঐচ্ছিক অনুদানের বাক্স: মোট অঙ্ক + সহজ ফর্ম + তালিকা */
function DonationBox({
  donations,
  total,
  canEdit,
  onSave,
  onDelete,
}: {
  donations: Donation[];
  total: number;
  /** "donations" অনুমতি: কেবল অনুমতিধারী/মেইন অ্যাডমিন লিখতে-বদলাতে পারেন */
  canEdit: boolean;
  onSave: SaveMutation;
  onDelete: (action: string, id: string, title: string) => void;
}) {
  const empty = { id: "", date: today(), donor: "", amount: "", note: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave("donation.save", {
        ...(form.id ? { id: form.id } : {}),
        date: form.date,
        donor: form.donor,
        amount: Number(form.amount),
        note: form.note,
      });
      setForm(empty);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-panel-card donation-box">
      <h3>
        <HandCoins size={18} /> বন্ধুদের ঐচ্ছিক অনুদান
      </h3>
      <div className="donation-figure">
        <small>মোট অনুদান</small>
        <b>৳ {money(total)}</b>
      </div>
      {!canEdit && (
        <p className="readonly-note">
          তুমি অনুদানের তালিকা দেখতে পারো — যোগ/বদল করতে পারেন কেবল মেইন
          অ্যাডমিন বা “বন্ধুদের ঐচ্ছিক অনুদান” অনুমতিধারী।
        </p>
      )}
      {canEdit && (
      <form className="finance-entry-form" onSubmit={submit}>
        <div className="finance-entry-row">
          <label>
            <span>তারিখ</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </label>
          <label className="grow">
            <span>বন্ধুর নাম</span>
            <input
              required
              maxLength={120}
              placeholder="যিনি অনুদান দিলেন"
              value={form.donor}
              onChange={(e) => setForm((p) => ({ ...p, donor: e.target.value }))}
            />
          </label>
          <label>
            <span>টাকা (৳)</span>
            <input
              type="number"
              min={1}
              max={10000000}
              required
              placeholder="০"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, amount: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="finance-entry-row">
          <label className="grow">
            <span>নোট (ঐচ্ছিক)</span>
            <input
              maxLength={400}
              placeholder="যেমন: পিঠা উৎসবের জন্য"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </label>
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : form.id ? (
              <Save size={16} />
            ) : (
              <Plus size={16} />
            )}
            {form.id ? "আপডেট" : "অনুদান যোগ"}
          </button>
          {form.id && (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setForm(empty)}
            >
              <X size={16} /> বাতিল
            </button>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
      )}
      {donations.length > 0 && (
        <ul className="donation-list">
          {donations.map((d) => (
            <li key={d.id}>
              <div>
                <b>{d.donor}</b>
                <small>
                  {bnDate(d.date)} · লিখেছেন {d.enteredBy}
                  {d.note ? ` · ${d.note}` : ""}
                </small>
              </div>
              <span className="amount">৳ {money(d.amount)}</span>
              {canEdit && (
                <span className="row-actions">
                  <button
                    className="icon-button"
                    aria-label="অনুদান সম্পাদনা"
                    onClick={() =>
                      setForm({
                        id: d.id,
                        date: d.date,
                        donor: d.donor,
                        amount: String(d.amount),
                        note: d.note,
                      })
                    }
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label="অনুদান মুছুন"
                    onClick={() => onDelete("donation.delete", d.id, d.donor)}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** খরচ লেখার ফর্ম + পুরো তালিকা (কে, কবে, কত) */
function ExpenseEntry({
  expenses,
  total,
  canEdit,
  onSave,
  onDelete,
  csv,
  pdf,
}: {
  expenses: Expense[];
  total: number;
  /** "expenses" অনুমতি না থাকলে খরচের তালিকা শুধু পড়া যায় */
  canEdit: boolean;
  onSave: SaveMutation;
  onDelete: (action: string, id: string, title: string) => void;
  csv: () => void;
  pdf: () => void;
}) {
  const empty = { id: "", date: today(), title: "", amount: "", note: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      expenses.filter((x) =>
        `${x.title} ${x.note} ${x.enteredBy}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [expenses, search],
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave("expense.save", {
        ...(form.id ? { id: form.id } : {}),
        date: form.date,
        title: form.title,
        amount: Number(form.amount),
        note: form.note,
      });
      setForm(empty);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-panel-card expense-box">
      <h3>
        <Wallet size={18} /> খরচের খাতা
      </h3>
      <p>
        খরচ লিখলেই তালিকায় উঠে যাবে — কে লিখলেন ও কখন, তা আপনা-আপনি জমা থাকে।
      </p>
      {!canEdit && (
        <p className="readonly-note">
          তুমি খরচের তালিকা দেখতে পারো — লিখতে/বদলাতে লাগবে “খরচের খাতা”
          অনুমতি।
        </p>
      )}
      {canEdit && (
      <form className="finance-entry-form" onSubmit={submit}>
        <div className="finance-entry-row">
          <label>
            <span>তারিখ</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </label>
          <label className="grow">
            <span>খরচের বিবরণ</span>
            <input
              required
              maxLength={200}
              placeholder="যেমন: ডেকোরেশন, সাউন্ড সিস্টেম…"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </label>
          <label>
            <span>টাকা (৳)</span>
            <input
              type="number"
              min={1}
              max={10000000}
              required
              placeholder="০"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, amount: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="finance-entry-row">
          <label className="grow">
            <span>নোট (ঐচ্ছিক)</span>
            <input
              maxLength={400}
              placeholder="রসিদ নম্বর, দোকানের নাম ইত্যাদি"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </label>
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : form.id ? (
              <Save size={16} />
            ) : (
              <Plus size={16} />
            )}
            {form.id ? "খরচ আপডেট" : "খরচ যোগ করুন"}
          </button>
          {form.id && (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setForm(empty)}
            >
              <X size={16} /> বাতিল
            </button>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
      )}

      <div className="expense-toolbar">
        <input
          placeholder="খরচ খুঁজুন…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="button button-ghost" onClick={csv}>
          <Download size={16} /> CSV ডাউনলোড
        </button>
        <button type="button" className="button button-ghost" onClick={pdf}>
          <Download size={16} /> PDF ডাউনলোড
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="expense-empty">
          {expenses.length === 0
            ? "এখনো কোনো খরচ লেখা হয়নি।"
            : "খোঁজার সঙ্গে মেলা কোনো খরচ নেই।"}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="finance-table expense-table">
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>বিবরণ</th>
                <th>লিখেছেন</th>
                <th className="amount">টাকা</th>
                <th aria-label="কাজ"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{bnDate(x.date)}</td>
                  <td>
                    <b>{x.title}</b>
                    {x.note && <small className="expense-note">{x.note}</small>}
                  </td>
                  <td className="nowrap">{x.enteredBy}</td>
                  <td className="amount">৳ {money(x.amount)}</td>
                  <td className="nowrap">
                    {canEdit && (
                      <span className="row-actions">
                        <button
                          className="icon-button"
                          aria-label="খরচ সম্পাদনা"
                          onClick={() =>
                            setForm({
                              id: x.id,
                              date: x.date,
                              title: x.title,
                              amount: String(x.amount),
                              note: x.note,
                            })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label="খরচ মুছুন"
                          onClick={() => onDelete("expense.delete", x.id, x.title)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}>মোট খরচ</td>
                <td className="amount">৳ {money(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** এক্সেলে খোলার মতো CSV — খরচ, অনুদান ও সারাংশ একসঙ্গে */
function downloadCsv(
  expenses: Expense[],
  donations: Donation[],
  regIncome: number,
) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["ধরন", "তারিখ", "বিবরণ", "টাকা", "লিখেছেন", "নোট"].map(esc).join(","),
    ...expenses.map((x) =>
      ["খরচ", x.date, x.title, x.amount, x.enteredBy, x.note].map(esc).join(","),
    ),
    ...donations.map((d) =>
      ["অনুদান", d.date, d.donor, d.amount, d.enteredBy, d.note]
        .map(esc)
        .join(","),
    ),
    "",
    ["নিবন্ধন-আয়", "", "", regIncome, "", ""].map(esc).join(","),
    [
      "মোট অনুদান",
      "",
      "",
      donations.reduce((a, d) => a + d.amount, 0),
      "",
      "",
    ]
      .map(esc)
      .join(","),
    ["মোট খরচ", "", "", expenses.reduce((a, x) => a + x.amount, 0), "", ""]
      .map(esc)
      .join(","),
  ];
  // \uFEFF (BOM) থাকলে এক্সেলে বাংলা ঠিকঠাক দেখায়
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerBlobDownload(blob, `kharcher-khata-${today()}.csv`);
}

/**
 * R19: খরচের খাতা PDF — ব্যাংক স্টেটমেন্টের মতো।
 * জমা (নিবন্ধন-আয় + অনুদান) ও খরচ এক খতিয়ানে, চলতি ব্যালেন্সসহ;
 * প্রতি পাতায় সেই পাতার সারাংশ, শেষ পাতায় খাতওয়ারি গ্র্যান্ড টোটাল।
 */
async function downloadPdf(data: AdminData) {
  const fin = data.finance;
  const expenses = data.expenses || [];
  const donations = data.donations || [];
  type Entry = {
    date: string;
    desc: string;
    by: string;
    credit: number;
    debit: number;
  };
  const opening: Entry[] = [
    {
      date: "",
      desc: `নিবন্ধন-আয় — বন্ধুদের ফি (${bn(fin?.friendCount || 0)} জন)`,
      by: "স্বয়ংক্রিয়",
      credit: fin?.friendTotal || 0,
      debit: 0,
    },
    {
      date: "",
      desc: `নিবন্ধন-আয় — জীবনসঙ্গীদের ফি (${bn(fin?.spouseCount || 0)} জন)`,
      by: "স্বয়ংক্রিয়",
      credit: fin?.spouseTotal || 0,
      debit: 0,
    },
    {
      date: "",
      desc: `নিবন্ধন-আয় — শিশুদের ফি (${bn(fin?.childCount || 0)} জন)`,
      by: "স্বয়ংক্রিয়",
      credit: fin?.childTotal || 0,
      debit: 0,
    },
  ];
  const moves: Entry[] = [
    ...donations.map((d) => ({
      date: d.date,
      desc: `অনুদান — ${d.donor}${d.note ? ` (${d.note})` : ""}`,
      by: d.enteredBy,
      credit: d.amount,
      debit: 0,
    })),
    ...expenses.map((x) => ({
      date: x.date,
      desc: `খরচ — ${x.title}${x.note ? ` (${x.note})` : ""}`,
      by: x.enteredBy,
      credit: 0,
      debit: x.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const entries = [...opening, ...moves];
  let run = 0;
  const rows = entries.map((e) => {
    run += e.credit - e.debit;
    return [
      e.date ? bnDate(e.date) : "—",
      e.desc,
      e.by,
      e.credit ? `৳ ${money(e.credit)}` : "",
      e.debit ? `৳ ${money(e.debit)}` : "",
      `৳ ${money(run)}`,
    ];
  });
  const donationTotal = donations.reduce((a, d) => a + d.amount, 0);
  const expenseTotal = expenses.reduce((a, x) => a + x.amount, 0);
  const regIncome = fin?.registrationTotal || 0;
  const fund = regIncome + donationTotal;
  const balance = fund - expenseTotal;
  const { exportTablePdf } = await import("../pdf");
  await exportTablePdf({
    filename: `kharcher-khata-${today()}.pdf`,
    reportTitle: "খরচের খাতা",
    event: data.event,
    columns: [
      { label: "তারিখ", width: 13 },
      { label: "বিবরণ", width: 36 },
      { label: "লিখেছেন", width: 15 },
      { label: "জমা (৳)", width: 12, align: "right" },
      { label: "খরচ (৳)", width: 12, align: "right" },
      { label: "ব্যালেন্স (৳)", width: 13, align: "right" },
    ],
    rows,
    pageSummary: (start, end) => {
      const slice = entries.slice(start, end);
      const inSum = slice.reduce((a, e) => a + e.credit, 0);
      const outSum = slice.reduce((a, e) => a + e.debit, 0);
      return [
        { label: "এই পাতার জমা", value: `৳ ${money(inSum)}`, tone: "good" },
        { label: "এই পাতার খরচ", value: `৳ ${money(outSum)}`, tone: "bad" },
      ];
    },
    grandSummary: {
      title: "গ্র্যান্ড টোটাল — পুরো খাতার হিসাব",
      items: [
        {
          label: `বন্ধুদের ফি (${bn(fin?.friendCount || 0)} জন)`,
          value: `৳ ${money(fin?.friendTotal || 0)}`,
        },
        {
          label: `জীবনসঙ্গীদের ফি (${bn(fin?.spouseCount || 0)} জন)`,
          value: `৳ ${money(fin?.spouseTotal || 0)}`,
        },
        {
          label: `শিশুদের ফি (${bn(fin?.childCount || 0)} জন)`,
          value: `৳ ${money(fin?.childTotal || 0)}`,
        },
        { label: "মোট নিবন্ধন-আয়", value: `৳ ${money(regIncome)}` },
        {
          label: `বন্ধুদের ঐচ্ছিক অনুদান (${bn(donations.length)}টি)`,
          value: `৳ ${money(donationTotal)}`,
        },
        {
          label: "মোট তহবিল (জমা)",
          value: `৳ ${money(fund)}`,
          strong: true,
          tone: "good",
        },
        {
          label: `মোট খরচ (${bn(expenses.length)}টি এন্ট্রি)`,
          value: `৳ ${money(expenseTotal)}`,
          strong: true,
          tone: "bad",
        },
        {
          label: balance < 0 ? "ব্যালেন্স — লস (ঘাটতি)" : "ব্যালেন্স (উদ্বৃত্ত)",
          value: `${balance < 0 ? "− " : "+ "}৳ ${money(Math.abs(balance))}`,
          strong: true,
          tone: balance < 0 ? "bad" : "good",
        },
        {
          label: "অবস্থা",
          value:
            balance < 0
              ? `তহবিলের চেয়ে খরচ ৳ ${money(Math.abs(balance))} বেশি — লস চলছে`
              : `তহবিলে এখনো ৳ ${money(balance)} আছে`,
          tone: balance < 0 ? "bad" : "good",
        },
      ],
    },
  });
}
