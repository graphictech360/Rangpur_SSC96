import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarDays,
  FileText,
  Settings2,
  Smartphone,
  ScanLine,
  ArrowUpRight,
  LogOut,
  RefreshCw,
  Download,
  Plus,
  Search,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  Copy,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Ticket,
  Menu,
  BarChart3,
  ListChecks,
  GripVertical,
  ArrowUp,
  ArrowDown,
  EyeOff,
  PanelTop,
  Upload,
  Image as ImageIcon,
  Link2,
  Type,
  Unlock,
  Lock,
} from "lucide-react";
import type {
  AdminData,
  FormField,
  Registration,
  Site,
  Staff,
} from "../types";
import {
  api,
  mutate,
  bn,
  money,
  timeLabel,
  dateTime,
  downloadCsv,
  ticketLink,
  copyText,
  post,
  shrinkLogo,
} from "../lib";
import { Avatar, Dialog, Spinner, StatusBadge, useToast } from "./UI";
import {
  EntityEditor,
  EventSettings,
  participantEditor,
  type EditorState,
} from "./Editors";
import RegistrationForm from "./RegistrationForm";
import Reports from "./Reports";
const FIELD_KIND_BN: Record<string, string> = {
  text: "এক লাইনের লেখা",
  textarea: "বড় লেখা",
  select: "তালিকা থেকে বাছাই",
  number: "সংখ্যা",
  tel: "মোবাইল নম্বর",
  date: "তারিখ",
  checkbox: "হ্যাঁ/না",
};

// নিবন্ধন কার্ডের যে লেখাগুলো অ্যাডমিন নিজে বদলাতে পারেন
const FORM_TEXT_KEYS: { key: string; label: string; hint: string }[] = [
  { key: "card.eyebrow", label: "কার্ডের উপরের ছোট লেখা", hint: "YOUR SEAT IS WAITING" },
  { key: "card.title", label: "কার্ডের শিরোনাম", hint: "বন্ধু, নামটা লিখে ফেলো!" },
  { key: "step1.title", label: "১ম ধাপের শিরোনাম", hint: "০১ / তোমার পরিচয়" },
  { key: "step2.title", label: "২য় ধাপের শিরোনাম", hint: "০২ / কারা আসছো একসাথে?" },
  { key: "step3.title", label: "৩য় ধাপের শিরোনাম", hint: "০৩ / পেমেন্টের তথ্য" },
  { key: "step1.label", label: "১ম ধাপের ছোট নাম", hint: "পরিচয়" },
  { key: "step2.label", label: "২য় ধাপের ছোট নাম", hint: "পরিবার" },
  { key: "step3.label", label: "৩য় ধাপের ছোট নাম", hint: "পেমেন্ট" },
  { key: "payment.sender_mobile", label: "প্রেরকের নম্বর ঘরের নাম", hint: "যে নম্বর থেকে টাকা পাঠিয়েছ" },
  { key: "payment.sender_mobile_hint", label: "প্রেরকের নম্বর ঘরের ছায়া-লেখা", hint: "যে নম্বর থেকে পাঠিয়েছ" },
  { key: "payment.transaction_id", label: "ট্রানজেকশন আইডি ঘরের নাম", hint: "ট্রানজেকশন আইডি" },
  { key: "fee.label", label: "ফি-র লেবেল", hint: "মোট নিবন্ধন ফি" },
  { key: "family.spouse", label: "জীবনসঙ্গী লেবেল", hint: "জীবনসঙ্গী আসবেন?" },
  { key: "family.children", label: "শিশু লেবেল", hint: "কতজন ছোট্ট অতিথি?" },
  { key: "family.total", label: "পরিবারের মোট লেবেল", hint: "মোট পরিবারের সদস্য" },
  { key: "privacy.note", label: "গোপনীয়তার লেখা", hint: "তথ্য শুধু আয়োজন…" },
  { key: "consent.text", label: "সম্মতির লেখা", hint: "প্রদত্ত তথ্য সঠিক…" },
];

const tabs = [
  ["overview", "এক নজরে", LayoutDashboard],
  ["reports", "রিপোর্ট ও হিসাব", BarChart3],
  ["participants", "বন্ধু ও নিবন্ধন", Users],
  ["payments", "পেমেন্ট যাচাই", CreditCard],
  ["event", "অনুষ্ঠান ও ফি", Settings2],
  ["content", "পেজের লেখা ও ছবি", FileText],
  ["schedule", "সময়সূচি", CalendarDays],
  ["accounts", "পেমেন্ট নম্বর", CreditCard],
  ["form", "নিবন্ধন ফর্ম", ListChecks],
  ["header", "হেডার ও মেনু", PanelTop],
  ["devices", "স্টাফ ডিভাইস", Smartphone],
] as const;
export default function Admin({
  site,
  staff,
  navigate,
  onLogout,
  onSiteChange,
  onTicket,
}: {
  site: Site;
  staff: Staff;
  navigate: (path: string) => void;
  onLogout: () => void;
  onSiteChange: () => void;
  onTicket: (key?: string) => void;
}) {
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sidebar, setSidebar] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null),
    [inspectedId, setInspectedId] = useState<string | null>(null),
    [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{
      action: string;
      id: string;
      title: string;
      body: string;
    } | null>(null),
    [actionBusy, setActionBusy] = useState(false),
    [reissued, setReissued] = useState(""),
    [testingMail, setTestingMail] = useState(false),
    [notify, setNotify] = useState<{
      configured: boolean;
      provider: string;
      to: string;
      quickLogin: boolean;
    } | null>(null);
  const toast = useToast();
  const load = async () => {
    try {
      setData(await api<AdminData>("/admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    api<{ configured: boolean; provider: string; to: string; quickLogin: boolean }>(
      "/notify-status",
    )
      .then(setNotify)
      .catch(() => setNotify(null));
  }, []);
  // টেনে সাজানো: ধরলাম → টানলাম → ছাড়লাম
  const [dragId, setDragId] = useState<string>("");
  const [overId, setOverId] = useState<string>("");
  const [textDraft, setTextDraft] = useState<Record<string, string>>({});
  const [logoBusy, setLogoBusy] = useState(false);
  const [navDraft, setNavDraft] = useState<{ kind: string; label: string; target: string }>({
    kind: "section",
    label: "",
    target: "",
  });
  // একটি ঘরকে target-এর জায়গায় নামানো: বাকি সবাই নিজের ক্রম ধরে সরে যায়
  const dropField = async (targetId: string) => {
    const list = (data?.formFields || []).slice().sort((a, b) => a.order - b.order);
    const from = list.findIndex((f) => f.id === dragId);
    const to = list.findIndex((f) => f.id === targetId);
    setDragId("");
    setOverId("");
    if (from < 0 || to < 0 || from === to) return;
    const moved = list.splice(from, 1)[0];
    list.splice(to, 0, moved);
    const items = list.map((f, i) => ({ id: f.id, order: (i + 1) * 10 }));
    try {
      await mutate("formField.reorder", { items });
      await load();
      onSiteChange();
      toast("ঘরের জায়গা বদলানো হলো।");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  // মেনুর দুই লিংকের ক্রম বদল
  const swapNav = async (a: { id: string; order: number }, b: { id: string; order: number }) => {
    try {
      await mutate("navItem.reorder", {
        items: [
          { id: a.id, order: b.order },
          { id: b.id, order: a.order },
        ],
      });
      await load();
      onSiteChange();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const dropNav = async (targetId: string) => {
    const list = (data?.nav || []).slice().sort((a, b) => a.order - b.order);
    const from = list.findIndex((n) => n.id === dragId);
    const to = list.findIndex((n) => n.id === targetId);
    setDragId("");
    setOverId("");
    if (from < 0 || to < 0 || from === to) return;
    const moved = list.splice(from, 1)[0];
    list.splice(to, 0, moved);
    const items = list.map((n, i) => ({ id: n.id, order: (i + 1) * 10 }));
    try {
      await mutate("navItem.reorder", { items });
      await load();
      onSiteChange();
      toast("মেনুর ক্রম বদলানো হলো।");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  // লোগো বদল: ব্রাউজারেই ছোট করা হয়, তারপর Storage-এ ওঠে ও সেকশনে সেভ হয়
  const pickLogo = async (file?: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const photo = await shrinkLogo(file);
      const out = await post<{ url: string }>("/admin/logo", { photo });
      await load();
      onSiteChange();
      toast("নতুন লোগো সেভ হয়েছে।");
      return out;
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLogoBusy(false);
    }
  };
  const brandingSection = (data?.sections || []).find((x) => x.key === "branding");
  // দুই ঘরের ক্রম বদল (উপর/নিচ) — একটি save কলে দুটোই
  const moveField = async (field: FormField, targetOrder: number) => {
    try {
      await mutate("formField.move", {
        id: field.id,
        order: Math.max(0, targetOrder),
      });
      await load();
      toast("ক্রম বদলানো হলো।");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const save = async (action: string, payload: unknown) => {
    const result = await mutate<any>(action, payload);
    await load();
    onSiteChange();
    toast("পরিবর্তন সেভ হয়েছে।");
    return result;
  };
  const act = async (action: string, payload: unknown) => {
    setActionBusy(true);
    try {
      return await save(action, payload);
    } catch (e) {
      toast((e as Error).message, true);
      throw e;
    } finally {
      setActionBusy(false);
    }
  };
  const requestRemove = (
    action: string,
    id: string,
    title: string,
    body: string,
  ) => setConfirm({ action, id, title, body });
  const confirmAction = async () => {
    if (!confirm) return;
    try {
      const result = await act(confirm.action, { id: confirm.id });
      if (confirm.action === "registration.reissue")
        setReissued(result.trackingKey);
      setConfirm(null);
      setInspectedId(null);
    } catch {
      /* Error is already shown. */
    }
  };
  const changeTab = (value: string) => {
    setTab(value);
    setSidebar(false);
    setSearch("");
    setFilter(value === "payments" ? "pending" : "all");
  };
  const copy = async (value: string) => {
    try {
      await copyText(value);
      toast("কপি হয়েছে।");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  if (staff.role !== "admin")
    return (
      <div className="access-denied">
        <ShieldCheck size={40} />
        <h1>অ্যাডমিন অনুমতি নেই</h1>
        <p>তোমার অ্যাকাউন্টটি গেট স্টাফের জন্য।</p>
        <button
          className="button button-primary"
          onClick={() => navigate("/check-in")}
        >
          গেট চেক-ইন খুলুন
        </button>
      </div>
    );
  const active = data?.registrations.filter((r) => !r.archivedAt) || [],
    pending = active.filter((r) => r.status === "pending"),
    approved = active.filter((r) => r.status === "approved");
  const checked = approved.filter((r) => r.checkedInAt),
    income = approved.reduce((a, r) => a + r.total, 0);
  const filtered = (data?.registrations || []).filter((r) => {
    const statusOk =
      filter === "removed"
        ? !!r.archivedAt
        : !r.archivedAt &&
          (filter === "all" ||
            (filter === "checkedin" ? !!r.checkedInAt : r.status === filter));
    const text = [
      r.participant.name,
      r.participant.school,
      r.participant.mobile,
      r.ticketNumber,
      r.payment.transactionId,
    ]
      .join(" ")
      .toLowerCase();
    return statusOk && text.includes(search.toLowerCase());
  });
  const inspected = data?.registrations.find((r) => r.id === inspectedId);
  const currentSite: Site = data
    ? {
        ...site,
        event: data.event,
        fees: data.fees,
        accounts: data.accounts.filter((a) => a.active),
        schedule: data.schedule,
        sections: data.sections,
      }
    : site;
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${sidebar ? "admin-sidebar-open" : ""}`}>
        <a
          className="admin-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <img src="/assets/ssc96-logo.webp" alt="SSC 96" />
          <div>
            RANGPUR <b>SSC 96</b>
            <small>আয়োজক প্যানেল</small>
          </div>
        </a>
        <span className="sidebar-label">FESTIVAL MANAGEMENT</span>
        <nav aria-label="অ্যাডমিন বিভাগ">
          {tabs.map(([key, label, Icon]) => (
            <button
              className={tab === key ? "active" : ""}
              key={key}
              onClick={() => changeTab(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === "payments" && pending.length > 0 && (
                <b className="sidebar-count">{bn(pending.length)}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => navigate("/check-in")}>
            <ScanLine size={18} />
            গেট চেক-ইন
            <ArrowUpRight size={16} />
          </button>
          <button onClick={() => navigate("/")}>
            <ArrowUpRight size={18} />
            উৎসবের পেজ দেখুন
          </button>
          <div className="sidebar-user">
            <span>{staff.name.charAt(0)}</span>
            <div>
              <b>{staff.name}</b>
              <small>Administrator</small>
            </div>
            <button aria-label="লগআউট" onClick={onLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-backdrop"
          aria-label="মেনু বন্ধ করুন"
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <button
              className="icon-button admin-mobile-menu"
              aria-label="অ্যাডমিন মেনু"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={22} />
            </button>
            <span>
              রংপুর এসএসসি ’৯৬ <ChevronRight size={14} />
              <b>{tabs.find((t) => t[0] === tab)?.[1]}</b>
            </span>
          </div>
          <div>
            <span
              className={`connection-status ${site.mode === "demo" ? "connection-demo" : ""}`}
            >
              <i />
              {site.mode === "demo" ? "ডেমো ডেটা" : "Supabase সংযুক্ত"}
            </span>
            <button
              type="button"
              className={`connection-status notify-status ${notify?.configured ? "notify-on" : "notify-off"}`}
              disabled={testingMail}
              title={
                notify?.configured
                  ? `নতুন নিবন্ধনের খবর ইমেইলে যাচ্ছে: ${notify.to} — চেপে একটি পরীক্ষা মেইল পাঠান`
                  : "ইমেইল খবর এখনো চালু করা হয়নি (docs/NOTIFICATION.bn.md দেখুন)"
              }
              onClick={async () => {
                setTestingMail(true);
                try {
                  const r = await api<{ to: string }>("/notify-test", { method: "POST" });
                  toast(`পরীক্ষা মেইল পাঠানো হলো → ${r.to}`);
                } catch (e) {
                  toast((e as Error).message, true);
                } finally {
                  setTestingMail(false);
                }
              }}
            >
              <i />
              {testingMail
                ? "মেইল যাচ্ছে…"
                : notify?.configured
                  ? "নতুন নিবন্ধনে ইমেইল"
                  : "ইমেইল খবর বন্ধ"}
            </button>
            <button
              className="icon-button"
              aria-label="ডেটা রিফ্রেশ"
              onClick={load}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-page-heading">
            <div>
              <span className="admin-overline">RANGPUR SSC 96 FESTIVAL</span>
              <h1>
                {tab === "overview"
                  ? "সব আয়োজন, এক নজরে।"
                  : tab === "reports"
                    ? "রিপোর্ট ও হিসাব"
                    : tabs.find((t) => t[0] === tab)?.[1]}
              </h1>
              <p>
                {tab === "overview"
                  ? "বন্ধুরা আসছে। প্রস্তুতি কতদূর, দেখে নিই।"
                  : "প্রয়োজনমতো তথ্য পরিবর্তন, যোগ বা বাদ দিন।"}
              </p>
            </div>
            {["overview", "participants", "payments"].includes(tab) && (
              <button
                className="button button-primary"
                onClick={() => setAdding(true)}
              >
                <Plus size={17} />
                বন্ধু যোগ করুন
              </button>
            )}
          </div>
          {site.mode === "demo" && (
            <div className="notice notice-warning admin-demo-notice">
              <AlertTriangle size={17} />
              <span>
                এখানের নিবন্ধন ও যাচাই কাল্পনিক ডেমো (টেবিল তৈরি আছে, তবে এটি
                ব্রাউজারের নমুনা ডেটা)। বাস্তব অংশগ্রহণকারীর তথ্য দেবেন না।
              </span>
            </div>
          )}
          {loading ? (
            <Spinner label="আয়োজনের তথ্য আসছে…" />
          ) : error ? (
            <div className="notice notice-danger">
              {error}
              <button className="text-button" onClick={load}>
                আবার চেষ্টা করুন
              </button>
            </div>
          ) : (
            data && (
              <>
                {tab === "reports" && (
                  <Reports
                    stats={data.stats}
                    registrations={data.registrations}
                  />
                )}
                {tab === "overview" && (
                  <>
                    <div className="admin-stats">
                      <Stat
                        label="মোট নিবন্ধন"
                        value={bn(active.length)}
                        detail={`পরিবারসহ ${bn(active.reduce((a, r) => a + 1 + r.spouse + r.children, 0))} জন`}
                        icon={<Users />}
                        color="green"
                      />
                      <Stat
                        label="যাচাইয়ের অপেক্ষায়"
                        value={bn(pending.length)}
                        detail="পেমেন্ট মিলিয়ে অনুমোদন দিন"
                        icon={<CreditCard />}
                        color="yellow"
                      />
                      <Stat
                        label="যাচাইকৃত ফি"
                        value={`৳ ${money(income)}`}
                        detail={`${bn(approved.length)}টি অনুমোদিত নিবন্ধন`}
                        icon={<ShieldCheck />}
                        color="peach"
                      />
                      <Stat
                        label="গেটে চেক-ইন"
                        value={bn(checked.length)}
                        detail={`${bn(checked.reduce((a, r) => a + 1 + r.spouse + r.children, 0))} জন প্রবেশ করেছেন`}
                        icon={<ScanLine />}
                        color="blue"
                      />
                    </div>
                    <div className="admin-overview-grid">
                      <section className="admin-panel-card pending-overview">
                        <div className="panel-card-heading">
                          <h3>পেমেন্ট যাচাই বাকি</h3>
                          <button
                            className="text-button"
                            onClick={() => changeTab("payments")}
                          >
                            সব দেখুন
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                        {pending.length === 0 ? (
                          <div className="empty-state">
                            <Check size={26} />
                            <p>সব পেমেন্ট দেখা হয়েছে!</p>
                          </div>
                        ) : (
                          pending.slice(0, 5).map((r) => (
                            <button
                              className="overview-participant"
                              key={r.id}
                              onClick={() => setInspectedId(r.id)}
                            >
                              <Avatar
                                name={r.participant.name}
                                photo={r.participant.photoUrl}
                              />
                              <div>
                                <b>{r.participant.name}</b>
                                <small>{r.participant.school}</small>
                              </div>
                              <strong>৳ {money(r.total)}</strong>
                              <ChevronRight size={16} />
                            </button>
                          ))
                        )}
                      </section>
                      <section className="admin-panel-card organizer-notes">
                        <span className="eyebrow">
                          <ShieldCheck size={15} />
                          একটু মনে রাখি
                        </span>
                        <h3>
                          অনুমোদনের আগে
                          <br />
                          লেনদেন মিলিয়ে নিন।
                        </h3>
                        <p>
                          ট্রানজেকশন আইডি, প্রেরকের নম্বর, গ্রহণকারীর নম্বর ও
                          টাকার পরিমাণ নিজের অ্যাকাউন্টের রেকর্ডের সঙ্গে যাচাই
                          করুন।
                        </p>
                        <button
                          className="button button-dark"
                          onClick={() => navigate("/check-in")}
                        >
                          <ScanLine size={17} />
                          চেক-ইন প্যানেল
                        </button>
                      </section>
                    </div>
                    <section className="admin-panel-card audit-card">
                      <h3>সাম্প্রতিক পরিবর্তন</h3>
                      {data.audit.length === 0 ? (
                        <p className="muted">এখনো কোনো পরিবর্তন হয়নি।</p>
                      ) : (
                        data.audit.slice(0, 8).map((a) => (
                          <div key={a.id}>
                            <span>
                              <Check size={14} />
                            </span>
                            <p>
                              <b>{a.action}</b>
                              <small>{a.user}</small>
                            </p>
                            <time>{dateTime(a.createdAt)}</time>
                          </div>
                        ))
                      )}
                    </section>
                  </>
                )}
                {["participants", "payments"].includes(tab) && (
                  <section className="admin-panel-card participant-panel">
                    <div className="table-toolbar">
                      <div className="admin-search">
                        <Search size={17} />
                        <input
                          aria-label="নিবন্ধন খুঁজুন"
                          placeholder="নাম, স্কুল, মোবাইল বা ট্রানজেকশন…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="নিবন্ধনের স্ট্যাটাস বাছাই"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">সব নিবন্ধন</option>
                        <option value="pending">যাচাইয়ের অপেক্ষায়</option>
                        <option value="approved">অনুমোদিত</option>
                        <option value="checkedin">চেক-ইন সম্পন্ন</option>
                        <option value="rejected">প্রত্যাখ্যাত</option>
                        <option value="removed">বাদ দেওয়া নিবন্ধন</option>
                      </select>
                      <button
                        className="button button-outline"
                        onClick={() => downloadCsv(filtered)}
                      >
                        <Download size={15} />
                        CSV
                      </button>
                    </div>
                    <div className="table-scroll">
                      <table className="participants-table">
                        <thead>
                          <tr>
                            <th>বন্ধু / নিবন্ধন</th>
                            <th>পরিবার</th>
                            <th>পেমেন্ট</th>
                            <th>স্ট্যাটাস</th>
                            <th>ব্যবস্থাপনা</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <div className="table-person">
                                  <Avatar
                                    name={r.participant.name}
                                    photo={r.participant.photoUrl}
                                  />
                                  <div>
                                    <b>{r.participant.name}</b>
                                    <small>
                                      {r.ticketNumber} · {r.participant.mobile}
                                    </small>
                                    <span>{r.participant.school}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <b>{bn(1 + r.spouse + r.children)} জন</b>
                                <small>
                                  সঙ্গী {bn(r.spouse)} · শিশু {bn(r.children)}
                                </small>
                              </td>
                              <td>
                                <b>৳ {money(r.total)}</b>
                                <small className="transaction-cell">
                                  {r.payment.provider === "bkash"
                                    ? "bKash"
                                    : "Nagad"}{" "}
                                  · {r.payment.transactionId}
                                </small>
                              </td>
                              <td>
                                <StatusBadge
                                  status={r.status}
                                  checkedIn={!!r.checkedInAt && !r.archivedAt}
                                />
                              </td>
                              <td>
                                <div className="table-actions">
                                  <button
                                    className="icon-button"
                                    title="বিস্তারিত ও পেমেন্ট যাচাই"
                                    aria-label={`${r.participant.name} বিস্তারিত`}
                                    onClick={() => setInspectedId(r.id)}
                                  >
                                    <Eye size={17} />
                                  </button>
                                  {!r.archivedAt && (
                                    <>
                                      <button
                                        className="icon-button"
                                        title="তথ্য সংশোধন"
                                        aria-label={`${r.participant.name} সংশোধন`}
                                        onClick={() =>
                                          setEditor(participantEditor(r))
                                        }
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        className="icon-button danger-button"
                                        title="অংশগ্রহণকারী বাদ দিন"
                                        aria-label={`${r.participant.name} বাদ দিন`}
                                        onClick={() =>
                                          requestRemove(
                                            "registration.remove",
                                            r.id,
                                            "এই বন্ধুর নিবন্ধন বাদ দেবেন?",
                                            "টিকিট বাতিল হবে এবং আর চেক-ইন করা যাবে না। পেমেন্ট ও পরিবর্তনের রেকর্ড সংরক্ষিত থাকবে; এটি টাকা ফেরত দেওয়ার প্রক্রিয়া নয়।",
                                          )
                                        }
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filtered.length === 0 && (
                        <div className="empty-state">
                          <Search size={28} />
                          <p>এই তালিকায় কোনো নিবন্ধন নেই।</p>
                        </div>
                      )}
                    </div>
                    <div className="table-footer">
                      {bn(filtered.length)}টি নিবন্ধন দেখানো হচ্ছে{" "}
                      <span>
                        ব্যক্তিগত তথ্য শুধু অনুমোদিত অ্যাডমিনদের জন্য।
                      </span>
                    </div>
                  </section>
                )}
                {tab === "event" && (
                  <EventSettings
                    key={data.event.id}
                    data={data}
                    onSave={save}
                  />
                )}
                {tab === "content" && (
                  <>
                    <div className="admin-section-toolbar">
                      <p>
                        প্রতিটি সেকশনের লেখা, ছবি, দৃশ্যমানতা ও ক্রম আলাদা করে
                        নিয়ন্ত্রণ করুন।
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() =>
                          setEditor({
                            kind: "section",
                            title: "নতুন সেকশন",
                            data: {
                              key: "",
                              title: "",
                              subtitle: "",
                              body: "",
                              imageUrl: "",
                              visible: true,
                              order: data.sections.length,
                            },
                          })
                        }
                      >
                        <Plus size={17} />
                        সেকশন যোগ করুন
                      </button>
                    </div>
                    <div className="content-editor-grid">
                      {data.sections
                        .sort((a, b) => a.order - b.order)
                        .map((s) => (
                          <article
                            className="admin-panel-card content-editor-card"
                            key={s.id}
                          >
                            <div className="content-card-label">
                              <span>{s.key.toUpperCase()}</span>
                              <b
                                className={
                                  s.visible ? "visible-badge" : "hidden-badge"
                                }
                              >
                                {s.visible ? "দৃশ্যমান" : "লুকানো"}
                              </b>
                            </div>
                            <h3>{s.title}</h3>
                            <p>{s.body}</p>
                            {s.imageUrl && (
                              <span className="image-path">
                                <FileText size={13} />
                                {s.imageUrl}
                              </span>
                            )}
                            <div className="content-card-actions">
                              <button
                                className="button button-outline"
                                onClick={() =>
                                  setEditor({
                                    kind: "section",
                                    title: "সেকশন সংশোধন",
                                    data: s,
                                  })
                                }
                              >
                                <Pencil size={15} />
                                সম্পাদনা
                              </button>
                              <button
                                className="icon-button danger-button"
                                aria-label={`${s.key} সেকশন বাদ দিন`}
                                onClick={() =>
                                  requestRemove(
                                    "section.delete",
                                    s.id,
                                    "সেকশনটি বাদ দেবেন?",
                                    "এই সেকশনটি মূল পেজ থেকে সরিয়ে দেওয়া হবে। চাইলে পরে একই কী দিয়ে আবার যোগ করতে পারবেন।",
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                  </>
                )}
                {tab === "schedule" && (
                  <>
                    <div className="admin-section-toolbar">
                      <p>সময় ও আয়োজনের বাস্তব তথ্য পরে এখানে পরিবর্তন করুন।</p>
                      <button
                        className="button button-primary"
                        onClick={() =>
                          setEditor({
                            kind: "schedule",
                            title: "আয়োজন যোগ করুন",
                            data: {
                              time: "09:00",
                              period: "সকাল",
                              title: "",
                              note: "",
                              visible: true,
                              order: data.schedule.length,
                            },
                          })
                        }
                      >
                        <Plus size={17} />
                        আয়োজন যোগ করুন
                      </button>
                    </div>
                    <div className="admin-panel-card admin-schedule-list">
                      {data.schedule
                        .sort((a, b) => a.order - b.order)
                        .map((s) => (
                          <div key={s.id}>
                            <span className="admin-schedule-time">
                              {timeLabel(s.time)}
                              <small>{s.period}</small>
                            </span>
                            <p>
                              <b>{s.title}</b>
                              <small>
                                {s.note ||
                                  (s.visible
                                    ? "মূল পেজে দৃশ্যমান"
                                    : "মূল পেজে লুকানো")}
                              </small>
                            </p>
                            <button
                              className="icon-button"
                              aria-label={`${s.title} সংশোধন`}
                              onClick={() =>
                                setEditor({
                                  kind: "schedule",
                                  title: "সময়সূচি সংশোধন",
                                  data: s,
                                })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button danger-button"
                              aria-label={`${s.title} বাদ দিন`}
                              onClick={() =>
                                requestRemove(
                                  "schedule.delete",
                                  s.id,
                                  "এই আয়োজন বাদ দেবেন?",
                                  "এই আয়োজনটি সময়সূচি থেকে সরিয়ে দেওয়া হবে।",
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </>
                )}
                {tab === "accounts" && (
                  <>
                    <div className="admin-section-toolbar">
                      <p>
                        শুধু ব্যক্তিগত Send Money নম্বর। এটি কোনো পেমেন্ট গেটওয়ে
                        নয়।
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() =>
                          setEditor({
                            kind: "account",
                            title: "পেমেন্ট নম্বর যোগ করুন",
                            data: {
                              provider: "bkash",
                              name: "",
                              mobile: "",
                              active: true,
                              order: data.accounts.length,
                            },
                          })
                        }
                      >
                        <Plus size={17} />
                        নম্বর যোগ করুন
                      </button>
                    </div>
                    <div className="account-editor-grid">
                      {data.accounts
                        .sort((a, b) => a.order - b.order)
                        .map((a) => (
                          <article
                            className={`admin-panel-card account-editor-card ${a.provider}`}
                            key={a.id}
                          >
                            <div>
                              <span className="account-provider">
                                {a.provider === "bkash" ? "◈ bKash" : "◉ Nagad"}
                              </span>
                              <span
                                className={
                                  a.active ? "visible-badge" : "hidden-badge"
                                }
                              >
                                {a.active ? "সক্রিয়" : "বন্ধ"}
                              </span>
                            </div>
                            <h3>{a.name}</h3>
                            <strong>{a.mobile}</strong>
                            <p>ব্যক্তিগত নম্বর · Send Money</p>
                            <div className="content-card-actions">
                              <button
                                className="button button-outline"
                                onClick={() =>
                                  setEditor({
                                    kind: "account",
                                    title: "পেমেন্ট নম্বর সংশোধন",
                                    data: a,
                                  })
                                }
                              >
                                <Pencil size={15} />
                                সম্পাদনা
                              </button>
                              <button
                                className="icon-button danger-button"
                                aria-label={`${a.name} ${a.provider} নম্বর বন্ধ করুন`}
                                onClick={() =>
                                  requestRemove(
                                    "account.delete",
                                    a.id,
                                    "নম্বরটি নিষ্ক্রিয় করবেন?",
                                    "নতুন নিবন্ধনে নম্বরটি আর দেখাবে না। পুরোনো পেমেন্টের রেকর্ড অপরিবর্তিত থাকবে।",
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                  </>
                )}
                {tab === "form" && (
                  <>
                    <div className="admin-section-toolbar">
                      <p>
                        ফর্মের <b>প্রতিটি ঘর</b> এখানে — মূল ঘরগুলোও (ছবি, নাম,
                        স্কুল, মোবাইল, টি-শার্টের সাইজ) লেবেল বদলানো যায়, ধাপ
                        বদলানো যায়, দরকার না হলে <b>লুকিয়ে</b> দেওয়া যায়।
                        কার্ড টেনে (drag) ঘরের জায়গাও বদলাতে পারো।
                      </p>
                      <button
                        className="button button-primary"
                        onClick={() =>
                          setEditor({
                            kind: "formField",
                            title: "নতুন ঘর যোগ করুন",
                            data: {
                              key: "",
                              label: "",
                              kind: "text",
                              options: [],
                              placeholder: "",
                              help: "",
                              maxLength: 200,
                              required: false,
                              visible: true,
                              step: 2,
                              order: ((data.formFields || []).length + 1) * 10,
                            },
                          })
                        }
                      >
                        <Plus size={17} />
                        নতুন ঘর যোগ করুন
                      </button>
                    </div>
                    {[1, 2].map((stepNo) => {
                      const all = (data.formFields || [])
                        .slice()
                        .sort((a, b) => a.order - b.order);
                      const inStep = all.filter((f) => (f.step ?? 1) === stepNo);
                      if (!inStep.length) return null;
                      return (
                        <section className="form-step-group" key={stepNo}>
                          <h3 className="form-step-group-title">
                            {stepNo === 1
                              ? "ধাপ ১ — পরিচয় (স্ক্রল করে দেখা যায়)"
                              : "ধাপ ২ — কারা আসছো একসাথে"}
                          </h3>
                          <div className="form-field-list">
                      {inStep.map((f) => (
                          <article
                            className={`admin-panel-card form-field-card${
                              f.visible === false ? " field-hidden" : ""
                            }${f.isBase ? " field-base" : ""}${
                              dragId === f.id ? " dragging" : ""
                            }${overId === f.id && dragId !== f.id ? " drag-over" : ""}`}
                            key={f.id}
                            draggable
                            onDragStart={() => setDragId(f.id)}
                            onDragEnd={() => {
                              setDragId("");
                              setOverId("");
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (overId !== f.id) setOverId(f.id);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              dropField(f.id);
                            }}
                          >
                            <div className="form-field-head">
                              <span className="drag-handle" title="টেনে জায়গা বদলাও">
                                <GripVertical size={16} />
                              </span>
                              <div>
                                <h3>
                                  {f.label || f.key}{" "}
                                  {f.required && <em className="req-mark">*</em>}
                                </h3>
                                <p>
                                  ধরন: {FIELD_KIND_BN[f.kind] || f.kind} · কী:{" "}
                                  <code>{f.key}</code>
                                  {f.kind === "select" && f.options?.length
                                    ? ` · বিকল্প: ${f.options.join(", ")}`
                                    : ""}
                                </p>
                              </div>
                              <div className="field-badges">
                                <span className="step-badge">
                                  ধাপ {f.step === 2 ? "২" : "১"}
                                </span>
                                {f.isBase && (
                                  <span className="base-badge" title="ফর্মের মূল ঘর">
                                    মূল ঘর
                                  </span>
                                )}
                                {f.isLocked && (
                                  <span className="lock-badge">
                                    <Lock size={12} /> সুরক্ষিত
                                  </span>
                                )}
                                {f.visible === false && (
                                  <span className="hidden-badge">
                                    <EyeOff size={13} /> লুকানো
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="content-card-actions">
                              <button
                                className="icon-button"
                                aria-label={`${f.label} উপরে নাও`}
                                disabled={inStep[0]?.id === f.id}
                                onClick={() =>
                                  moveField(
                                    f,
                                    (inStep[inStep.indexOf(f) - 1]?.order ?? f.order) - 1,
                                  )
                                }
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`${f.label} নিচে নাও`}
                                disabled={inStep.at(-1)?.id === f.id}
                                onClick={() =>
                                  moveField(
                                    f,
                                    (inStep[inStep.indexOf(f) + 1]?.order ?? f.order) + 1,
                                  )
                                }
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                className="button button-outline"
                                onClick={() =>
                                  setEditor({
                                    kind: "formField",
                                    title: f.isBase
                                      ? "মূল ঘর সংশোধন করুন"
                                      : "ঘর সংশোধন করুন",
                                    data: {
                                      ...f,
                                      optionsText: (f.options || []).join(", "),
                                    },
                                  })
                                }
                              >
                                <Pencil size={15} />
                                সম্পাদনা
                              </button>
                              {!f.isLocked && (
                                <button
                                  className="button button-outline"
                                  onClick={() =>
                                    act("formField.save", {
                                      ...f,
                                      optionsText: undefined,
                                      visible: f.visible === false,
                                    }).then(load)
                                  }
                                >
                                  {f.visible === false ? (
                                    <>
                                      <Eye size={15} /> আবার দেখাও
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff size={15} /> লুকাও
                                    </>
                                  )}
                                </button>
                              )}
                              {f.isLocked ? (
                                <span className="field-note">
                                  <Unlock size={13} /> নাম ও মোবাইল ফর্মে
                                  থাকতেই হবে
                                </span>
                              ) : (
                                !f.isBase && (
                                  <button
                                    className="icon-button danger-button"
                                    aria-label={`${f.label} মুছে ফেলুন`}
                                    onClick={() =>
                                      requestRemove(
                                        "formField.delete",
                                        f.id,
                                        `“${f.label}” ঘরটি মুছে ফেলবেন?`,
                                        "ফর্ম থেকে চলে যাবে। আগে যারা উত্তর দিয়েছেন, তাঁদের তথ্য রেকর্ডে থাকবে।",
                                      )
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )
                              )}
                            </div>
                          </article>
                        ))}
                          </div>
                        </section>
                      );
                    })}

                    <section className="admin-panel-card form-texts-card">
                      <h3>
                        <Type size={16} /> ফর্মের লেখা (যা খালি রাখলে আগের লেখাই
                        থাকবে)
                      </h3>
                      <p className="admin-note">
                        নিবন্ধন কার্ডের শিরোনাম, ধাপের নাম, ফি-লেবেল, সম্মতির
                        বাক্য — সব এখান থেকে বদলানো যায়।
                      </p>
                      <div className="form-texts-grid">
                        {FORM_TEXT_KEYS.map((t) => (
                          <label className="field" key={t.key}>
                            {t.label}
                            <input
                              value={
                                textDraft[t.key] ??
                                data.formTexts?.[t.key] ??
                                ""
                              }
                              placeholder={t.hint}
                              onChange={(e) =>
                                setTextDraft((d) => ({
                                  ...d,
                                  [t.key]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="button button-outline"
                              disabled={
                                textDraft[t.key] === undefined ||
                                textDraft[t.key] === (data.formTexts?.[t.key] ?? "")
                              }
                              onClick={() =>
                                act("formText.save", {
                                  key: t.key,
                                  value: textDraft[t.key] ?? "",
                                }).then(() => setTextDraft((d) => {
                                  const next = { ...d };
                                  delete next[t.key];
                                  return next;
                                }))
                              }
                            >
                              <Check size={15} /> সেভ
                            </button>
                          </label>
                        ))}
                      </div>
                    </section>

                    {(data.formFieldStats || []).length > 0 && (
                      <section className="admin-panel-card form-field-stats">
                        <h3>কে কী উত্তর দিয়েছে</h3>
                        <div className="stat-grid">
                          {(data.formFieldStats || []).map((f) => (
                            <div key={f.key}>
                              <span>{f.label}</span>
                              <strong>
                                {f.answered} জন উত্তর দিয়েছে
                              </strong>
                              {(f.top || []).length > 0 && (
                                <ul>
                                  {f.top.map((t) => (
                                    <li key={t.value}>
                                      {t.value} — {t.count} জন
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {tab === "header" && (
                  <>
                    <div className="admin-section-toolbar">
                      <p>
                        উপরের হেডার বারের সব কিছু এখানে — <b>লোগো</b>, নাম,
                        ছোট লেখা আর <b>মেনুর প্রতিটি লিংক</b>। টেনে (drag)
                        মেনুর ক্রম বদলাও, দরকার নেই এমন লিংক লুকাও বা মুছে
                        ফেলো।
                      </p>
                    </div>

                    <section className="admin-panel-card header-brand-card">
                      <h3>
                        <ImageIcon size={16} /> লোগো ও নাম
                      </h3>
                      <div className="logo-row">
                        <span className="logo-preview">
                          <img
                            src={brandingSection?.imageUrl || "/assets/ssc96-logo.webp"}
                            alt="এখনকার লোগো"
                          />
                        </span>
                        <div className="logo-actions">
                          <label className="button button-outline">
                            {logoBusy ? (
                              <Loader2 size={15} className="spin" />
                            ) : (
                              <Upload size={15} />
                            )}
                            {logoBusy ? "আপলোড হচ্ছে…" : "নতুন লোগো আপলোড করুন"}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={logoBusy}
                              onChange={(e) => pickLogo(e.target.files?.[0])}
                            />
                          </label>
                          <p className="admin-note">
                            লোগো নিজে থেকেই ছোট হয়ে সেভ হয় — পেজ দ্রুত খোলে।
                            চাইলে নিচের ঘরে সরাসরি ছবির লিংকও বসাতে পারো।
                          </p>
                        </div>
                      </div>
                      <div className="field-grid">
                        <label className="field">
                          হেডারের নাম (বড় লেখা)
                          <input
                            value={brandingSection?.title ?? ""}
                            onChange={(e) =>
                              save("section.save", {
                                ...brandingSection,
                                key: "branding",
                                title: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          হেডারের ছোট লেখা
                          <input
                            value={brandingSection?.subtitle ?? ""}
                            onChange={(e) =>
                              save("section.save", {
                                ...brandingSection,
                                key: "branding",
                                subtitle: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field field-full">
                          লোগোর লিংক (অথবা উপরের বোতামে ছবি দিন)
                          <input
                            value={brandingSection?.imageUrl ?? ""}
                            placeholder="/assets/ssc96-logo.webp"
                            onChange={(e) =>
                              save("section.save", {
                                ...brandingSection,
                                key: "branding",
                                imageUrl: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <p className="admin-note">
                        লেখা বদলালেই সেভ হয় — উপরে হেডারে সাথে সাথে দেখা যাবে।
                        হেডারের নাম ও লোগো টিকিটেও দেখা যায়।
                      </p>
                    </section>

                    <section className="admin-panel-card">
                      <div className="header-nav-head">
                        <h3>
                          <Link2 size={16} /> মেনুর লিংক
                        </h3>
                        <div className="nav-add-row">
                          <select
                            value={navDraft.kind}
                            onChange={(e) =>
                              setNavDraft((d) => ({ ...d, kind: e.target.value }))
                            }
                          >
                            <option value="section">পেজের অংশে যাবে</option>
                            <option value="ticket">আমার টিকিট (বোতাম)</option>
                            <option value="link">বাইরের লিংক</option>
                          </select>
                          <input
                            placeholder="নাম (বাংলা)"
                            value={navDraft.label}
                            onChange={(e) =>
                              setNavDraft((d) => ({ ...d, label: e.target.value }))
                            }
                          />
                          {navDraft.kind !== "ticket" && (
                            <input
                              placeholder={
                                navDraft.kind === "section"
                                  ? "সেকশনের কী (registration, memories…)"
                                  : "https://…"
                              }
                              value={navDraft.target}
                              onChange={(e) =>
                                setNavDraft((d) => ({ ...d, target: e.target.value }))
                              }
                            />
                          )}
                          <button
                            className="button button-primary"
                            disabled={!navDraft.label.trim()}
                            onClick={() =>
                              act("navItem.save", {
                                kind: navDraft.kind,
                                label: navDraft.label.trim(),
                                target:
                                  navDraft.kind === "ticket"
                                    ? ""
                                    : navDraft.target.trim(),
                                order: ((data.nav || []).length + 1) * 10,
                                visible: true,
                              }).then(() =>
                                setNavDraft({ kind: "section", label: "", target: "" }),
                              )
                            }
                          >
                            <Plus size={16} /> যোগ করুন
                          </button>
                        </div>
                      </div>
                      <div className="nav-item-list">
                        {(data.nav || [])
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((n, i, arr) => (
                            <div
                              className={`nav-item-row${
                                n.visible === false ? " nav-item-hidden" : ""
                              }${dragId === n.id ? " dragging" : ""}${
                                overId === n.id && dragId !== n.id ? " drag-over" : ""
                              }`}
                              key={n.id}
                              draggable
                              onDragStart={() => setDragId(n.id)}
                              onDragEnd={() => {
                                setDragId("");
                                setOverId("");
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (overId !== n.id) setOverId(n.id);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                dropNav(n.id);
                              }}
                            >
                              <span className="drag-handle">
                                <GripVertical size={16} />
                              </span>
                              <b>{n.label}</b>
                              <span className="nav-kind">
                                {n.kind === "ticket"
                                  ? "টিকিট বোতাম"
                                  : n.kind === "link"
                                    ? n.target
                                    : `#${n.target}`}
                              </span>
                              <div className="nav-item-actions">
                                <button
                                  className="icon-button"
                                  aria-label="উপরে নাও"
                                  disabled={i === 0}
                                  onClick={() => swapNav(n, arr[i - 1])}
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="নিচে নাও"
                                  disabled={i === arr.length - 1}
                                  onClick={() => swapNav(n, arr[i + 1])}
                                >
                                  <ArrowDown size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="নাম বদলাও"
                                  onClick={() =>
                                    setEditor({
                                      kind: "navItem",
                                      title: "মেনুর লিংক সংশোধন",
                                      data: { ...n },
                                    })
                                  }
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={n.visible === false ? "দেখাও" : "লুকাও"}
                                  onClick={() =>
                                    act("navItem.save", {
                                      ...n,
                                      visible: n.visible === false,
                                    })
                                  }
                                >
                                  {n.visible === false ? (
                                    <Eye size={15} />
                                  ) : (
                                    <EyeOff size={15} />
                                  )}
                                </button>
                                <button
                                  className="icon-button danger-button"
                                  aria-label="মুছে ফেলুন"
                                  onClick={() =>
                                    requestRemove(
                                      "navItem.delete",
                                      n.id,
                                      `“${n.label}” লিংকটি মুছে ফেলবেন?`,
                                      "হেডার থেকে চলে যাবে। পরে আবার যোগ করতে পারবেন।",
                                    )
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="admin-note">
                        টিপস: “আমার টিকিট” লিংকটি <b>nav-cta</b> স্টাইলে বোতাম
                        হয়ে ডান দিকে থাকে। লুকিয়ে দিলে বোতামটিও লুকিয়ে যায়।
                      </p>
                    </section>
                  </>
                )}
                {tab === "devices" && (
                  <>
                    <div className="notice notice-info">
                      <ShieldCheck size={19} />
                      <p>
                        স্টাফ আগে নিজের অ্যাকাউন্টে লগইন করে ডিভাইস অনুমোদনের
                        অনুরোধ করবেন। এখানে অনুমোদন/বাতিল করুন। এটি
                        ব্রাউজার-সেশনের অনুমতি, ফোনের IMEI বা হার্ডওয়্যার-লক নয়।
                        স্টাফ অ্যাকাউন্ট তৈরির নির্দেশনা Supabase setup ফাইলে
                        আছে।
                      </p>
                    </div>
                    <div className="admin-panel-card device-list">
                      {data.devices.length === 0 ? (
                        <div className="empty-state">
                          <Smartphone size={32} />
                          <h3>এখনো কোনো ডিভাইস নেই</h3>
                          <p>
                            চেক-ইন প্যানেল থেকে এই ব্রাউজার বা অন্য স্টাফ ফোনের
                            অনুমোদন চাইতে পারবেন।
                          </p>
                          <button
                            className="button button-primary"
                            onClick={() => navigate("/check-in")}
                          >
                            <ScanLine size={17} />
                            চেক-ইন খুলুন
                          </button>
                        </div>
                      ) : (
                        data.devices.map((d) => (
                          <div className="device-row" key={d.id}>
                            <span className="device-row-icon">
                              <Smartphone size={24} />
                            </span>
                            <div>
                              <b>{d.label}</b>
                              <small>
                                {d.staffName} · {dateTime(d.createdAt)}
                              </small>
                            </div>
                            <span
                              className={`device-status device-${d.status}`}
                            >
                              {d.status === "approved"
                                ? "অনুমোদিত"
                                : d.status === "pending"
                                  ? "অপেক্ষায়"
                                  : "বাতিল"}
                            </span>
                            {d.status !== "approved" ? (
                              <button
                                className="button button-primary"
                                disabled={actionBusy}
                                onClick={() =>
                                  act("device.update", {
                                    id: d.id,
                                    status: "approved",
                                  }).catch(() => {})
                                }
                              >
                                <Check size={15} />
                                অনুমোদন
                              </button>
                            ) : (
                              <button
                                className="button button-outline"
                                disabled={actionBusy}
                                onClick={() =>
                                  act("device.update", {
                                    id: d.id,
                                    status: "revoked",
                                  }).catch(() => {})
                                }
                              >
                                <X size={15} />
                                বাতিল
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )
          )}
        </main>
      </div>
      {editor && data && (
        <Dialog title={editor.title} onClose={() => setEditor(null)}>
          <EntityEditor
            editor={editor}
            accounts={data.accounts}
            onSave={save}
            onClose={() => setEditor(null)}
          />
        </Dialog>
      )}
      {adding && (
        <Dialog title="নতুন বন্ধুর নিবন্ধন" onClose={() => setAdding(false)}>
          <RegistrationForm
            site={currentSite}
            onTicket={(key) => {
              setAdding(false);
              onTicket(key);
            }}
            onRegistered={load}
          />
        </Dialog>
      )}
      {inspected && (
        <Dialog
          title={`নিবন্ধন · ${inspected.ticketNumber}`}
          onClose={() => setInspectedId(null)}
          wide
        >
          <RegistrationDetail
            registration={inspected}
            fields={data?.formFields || []}
            busy={actionBusy}
            onAction={act}
            onEdit={() => {
              setEditor(participantEditor(inspected));
              setInspectedId(null);
            }}
            onEditPayment={() => {
              setEditor({
                kind: "payment",
                title: "পেমেন্ট তথ্য সংশোধন",
                data: {
                  ...inspected.payment,
                  id: inspected.id,
                  expectedTotal: inspected.total,
                },
              });
              setInspectedId(null);
            }}
            onReissue={() =>
              requestRemove(
                "registration.reissue",
                inspected.id,
                "টিকিটের নতুন গোপন লিংক তৈরি করবেন?",
                "আগের স্ট্যাটাস/টিকিটের লিংকটি অকার্যকর হবে। নতুন লিংক কপি করে পরিচয় যাচাইয়ের পর বন্ধুকে দিন। টিকিটের QR অপরিবর্তিত থাকবে।",
              )
            }
          />
        </Dialog>
      )}
      {confirm && (
        <Dialog title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="confirm-description">{confirm.body}</p>
          <div className="editor-actions">
            <button
              className="button button-outline"
              onClick={() => setConfirm(null)}
            >
              না, ফিরে যাই
            </button>
            <button
              className="button button-dark"
              disabled={actionBusy}
              onClick={confirmAction}
            >
              {actionBusy ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              হ্যাঁ, নিশ্চিত
            </button>
          </div>
        </Dialog>
      )}
      {reissued && (
        <Dialog
          title="নতুন গোপন লিংক তৈরি হয়েছে"
          onClose={() => setReissued("")}
        >
          <p>
            এই লিংকটি ব্যক্তিগতভাবে বন্ধুকে দিন। পরিচয় নিশ্চিত না হয়ে কাউকে
            দেবেন না।
          </p>
          <div className="reissued-link">{ticketLink(reissued)}</div>
          <button
            className="button button-primary full-width"
            onClick={() => copy(ticketLink(reissued))}
          >
            <Copy size={17} />
            নতুন লিংক কপি করুন
          </button>
        </Dialog>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <article className={`admin-stat stat-${color}`}>
      <div>
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function RegistrationDetail({
  registration: r,
  fields,
  busy,
  onAction,
  onEdit,
  onEditPayment,
  onReissue,
}: {
  registration: Registration;
  fields: FormField[];
  busy: boolean;
  onAction: (action: string, payload: unknown) => Promise<any>;
  onEdit: () => void;
  onEditPayment: () => void;
  onReissue: () => void;
}) {
  const [verified, setVerified] = useState(false),
    [reason, setReason] = useState(""),
    [rejecting, setRejecting] = useState(false);
  return (
    <div className="registration-detail">
      <div className="detail-profile">
        <Avatar
          name={r.participant.name}
          photo={r.participant.photoUrl}
          className="large"
        />
        <div>
          <h3>{r.participant.name}</h3>
          <p>{r.participant.school}</p>
          <StatusBadge
            status={r.status}
            checkedIn={!!r.checkedInAt && !r.archivedAt}
          />
        </div>
        {!r.archivedAt && (
          <button className="button button-outline" onClick={onEdit}>
            <Pencil size={15} />
            সম্পাদনা
          </button>
        )}
      </div>
      <div className="detail-data-grid">
        {[
          ["মোবাইল", r.participant.mobile],
          ["বর্তমান অবস্থান", r.participant.location],
          ["এসএসসি রোল", r.participant.sscRoll],
          ["এসএসসি রেজিস্ট্রেশন", r.participant.sscRegistration || "—"],
          ["মোট সদস্য", `${bn(1 + r.spouse + r.children)} জন`],
          ["পরিবার", `সঙ্গী ${bn(r.spouse)} · শিশু ${bn(r.children)}`],
          ["টি-শার্ট", r.participant.tshirt],
          ...(r.food ? [["খাবার", r.food]] : []),
          ...Object.entries(r.answers || {})
            .filter(([, v]) => String(v || "").trim() !== "")
            .map(([k, v]) => [
              fields.find((f) => f.key === k)?.label || k,
              String(v),
            ]),
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </div>
        ))}
      </div>
      {r.notes && <p className="detail-notes">বিশেষ অনুরোধ: {r.notes}</p>}
      <section className="detail-payment">
        <div className="panel-card-heading">
          <h3>
            <CreditCard size={18} />
            পেমেন্ট যাচাই
          </h3>
          {!r.archivedAt && r.status !== "approved" && (
            <button className="text-button" onClick={onEditPayment}>
              <Pencil size={14} />
              সংশোধন
            </button>
          )}
        </div>
        <div className="detail-data-grid">
          {[
            [
              "পদ্ধতি",
              r.payment.provider === "bkash"
                ? "বিকাশ · Send Money"
                : "নগদ · Send Money",
            ],
            ["ট্রানজেকশন আইডি", r.payment.transactionId],
            ["প্রেরকের নম্বর", r.payment.senderMobile],
            [
              "গ্রহণকারী",
              `${r.payment.collectorName} · ${r.payment.collectorMobile}`,
            ],
            ["দাবিকৃত জমা", `৳ ${money(r.payment.amount)}`],
            ["নির্ধারিত ফি", `৳ ${money(r.total)}`],
          ].map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <b>{value}</b>
            </div>
          ))}
        </div>
        <p className="detail-fee-breakdown">
          বন্ধু ৳ {money(r.feeSnapshot.friend)} + সঙ্গী {bn(r.spouse)} × ৳{" "}
          {money(r.feeSnapshot.spouse)} + শিশু {bn(r.children)} × ৳{" "}
          {money(r.feeSnapshot.child)}
        </p>
        {r.payment.reason && (
          <p className="form-error">কারণ: {r.payment.reason}</p>
        )}
        {!r.archivedAt && r.status !== "approved" && (
          <>
            <label className="consent verification-consent">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              <span>
                নিজের বিকাশ/নগদের লেনদেনের রেকর্ডে ট্রানজেকশন আইডি, নম্বর ও
                টাকার পরিমাণ মিলিয়ে পেয়েছি।
              </span>
            </label>
            <button
              className="button button-primary full-width"
              disabled={!verified || busy}
              onClick={() =>
                onAction("registration.approve", {
                  id: r.id,
                  verified: true,
                }).catch(() => {})
              }
            >
              {busy ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <ShieldCheck size={18} />
              )}
              পেমেন্ট অনুমোদন ও QR তৈরি
            </button>
          </>
        )}
        {!r.archivedAt && !r.checkedInAt && (
          <>
            <button
              className="text-button reject-toggle"
              onClick={() => setRejecting(!rejecting)}
            >
              <X size={15} />
              পেমেন্ট প্রত্যাখ্যান করুন
            </button>
            {rejecting && (
              <div className="reject-form">
                <label className="field">
                  প্রত্যাখ্যানের কারণ
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="বন্ধু এই কারণটি নিজের স্ট্যাটাস পেজে দেখতে পারবেন।"
                  />
                </label>
                <button
                  className="button button-outline danger-button"
                  disabled={reason.trim().length < 3 || busy}
                  onClick={() =>
                    onAction("registration.reject", { id: r.id, reason })
                      .then(() => setRejecting(false))
                      .catch(() => {})
                  }
                >
                  প্রত্যাখ্যান নিশ্চিত করুন
                </button>
              </div>
            )}
          </>
        )}
        {r.status === "approved" && (
          <div className="notice notice-success">
            <ShieldCheck size={19} />
            পেমেন্ট যাচাইকৃত। বন্ধুর সংরক্ষিত লিংকে QR টিকিট প্রস্তুত।
          </div>
        )}
      </section>
      {!r.archivedAt && (
        <div className="detail-reissue">
          <p>
            বন্ধু টিকিটের গোপন লিংক হারিয়ে ফেললে পরিচয় যাচাই করে নতুন লিংক দিন।
          </p>
          <button className="button button-outline" onClick={onReissue}>
            <Ticket size={16} />
            লিংক পুনরায় তৈরি
          </button>
        </div>
      )}
      <p className="small-note">
        নিবন্ধন জমা: {dateTime(r.createdAt)}
        {r.checkedInAt && ` · চেক-ইন: ${dateTime(r.checkedInAt)}`}
      </p>
    </div>
  );
}
