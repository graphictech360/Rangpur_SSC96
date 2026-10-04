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
} from "lucide-react";
import type { AdminData, Registration, Site, Staff } from "../types";
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
} from "../lib";
import { Dialog, Spinner, StatusBadge, useToast } from "./UI";
import {
  EntityEditor,
  EventSettings,
  participantEditor,
  type EditorState,
} from "./Editors";
import RegistrationForm from "./RegistrationForm";
import Reports from "./Reports";
const tabs = [
  ["overview", "এক নজরে", LayoutDashboard],
  ["reports", "রিপোর্ট ও হিসাব", BarChart3],
  ["participants", "বন্ধু ও নিবন্ধন", Users],
  ["payments", "পেমেন্ট যাচাই", CreditCard],
  ["event", "অনুষ্ঠান ও ফি", Settings2],
  ["content", "পেজের লেখা ও ছবি", FileText],
  ["schedule", "সময়সূচি", CalendarDays],
  ["accounts", "পেমেন্ট নম্বর", CreditCard],
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
    [reissued, setReissued] = useState("");
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
  }, []);
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
                              <span className="participant-avatar">
                                {r.participant.name.charAt(0)}
                              </span>
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
                                  <span className="participant-avatar">
                                    {r.participant.name.charAt(0)}
                                  </span>
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
  busy,
  onAction,
  onEdit,
  onEditPayment,
  onReissue,
}: {
  registration: Registration;
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
        <span className="participant-avatar large">
          {r.participant.name.charAt(0)}
        </span>
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
          ["খাবার", r.food],
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
