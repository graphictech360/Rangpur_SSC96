import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Globe2,
  MapPin,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { api, bn } from "../lib";

/* R46: ভিজিটর অ্যানালিটিক্স — রিয়েলটাইম, কিন্তু পেজ কখনো নিজে রিলোড হয় না।
   প্রতি ১০ সেকেন্ডে শুধু ডেটা চুপচাপ আপডেট হয়; কাজের মাঝে কোনো বাধা পড়ে না।
   R50: দেশ/শহরের তালিকা ক্লিকে এক্সপ্যান্ড হয়; দৈনিক চার্টের রেঞ্জ বাছাই করা যায়। */
interface Analytics {
  online: number;
  today: number;
  uniqueToday: number;
  lastHour: number;
  total: number;
  range?: { from: string; to: string; visits: number };
  hourly: { h: string; count: number }[];
  daily: { d: string; count: number }[];
  regDaily: { d: string; count: number; approved?: number; rejected?: number }[];
  byCountry: { k: string; count: number }[];
  byCity: { k: string; count: number }[];
  recent: { at: string; country: string; region: string; city: string; path: string }[];
}
// দেশের কোড → বাংলা নাম (ব্রাউজারের নিজস্ব তালিকা থেকে), সাথে পতাকা
const countryName = (code: string) => {
  if (!code || code === "??") return "অজানা";
  try {
    return (
      new Intl.DisplayNames(["bn"], { type: "region" }).of(code) || code
    );
  } catch {
    return code;
  }
};
const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
    : "🌐";
const timeBn = (iso: string) =>
  new Date(iso).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
const dayBn = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
  });
// ঢাকার আজকের তারিখ (YYYY-MM-DD) ও N দিন পেছনের তারিখ
const dhakaToday = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Dhaka" });
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Dhaka",
  });

// R50: দৈনিক চার্টের রেঞ্জ-প্রিসেট — ৭/১৪ দিন, ১/৩/৬ মাস ও কাস্টম
const RANGE_PRESETS: { key: string; label: string; days: number }[] = [
  { key: "7d", label: "৭ দিন", days: 7 },
  { key: "14d", label: "১৪ দিন", days: 14 },
  { key: "1m", label: "১ মাস", days: 30 },
  { key: "3m", label: "৩ মাস", days: 91 },
  { key: "6m", label: "৬ মাস", days: 183 },
];

function BarChart({
  items,
  color,
  emptyText,
}: {
  items: { label: string; count: number }[];
  color: string;
  emptyText: string;
}) {
  const max = Math.max(1, ...items.map((x) => x.count));
  const hasData = items.some((x) => x.count > 0);
  const dense = items.length > 40; // বড় রেঞ্জে বারের উপরের সংখ্যা লুকানো থাকে
  if (!hasData) return <p className="ana-empty">{emptyText}</p>;
  return (
    <div
      className={`ana-bars${dense ? " ana-bars-dense" : ""}`}
      role="img"
      aria-label="বার চার্ট"
    >
      {items.map((x, i) => (
        <div className="ana-bar-col" key={i} title={`${x.label} — ${bn(x.count)}`}>
          {!dense && (
            <span className="ana-bar-count">{x.count > 0 ? bn(x.count) : ""}</span>
          )}
          <span
            className="ana-bar"
            style={{
              height: `${Math.max(x.count > 0 ? 8 : 2, Math.round((x.count / max) * 100))}%`,
              background: color,
            }}
          />
          <small>{x.label}</small>
        </div>
      ))}
    </div>
  );
}

/* R52: ২-রঙা বার — প্রতিদিনের অনুমোদিত (সবুজ) ও প্রত্যাখ্যাত (লাল) নিবন্ধন পাশাপাশি */
function DualBarChart({
  items,
  emptyText,
}: {
  items: { label: string; day: string; total: number; a: number; b: number }[];
  emptyText: string;
}) {
  const max = Math.max(1, ...items.flatMap((x) => [x.a, x.b]));
  const hasData = items.some((x) => x.total > 0 || x.a > 0 || x.b > 0);
  if (!hasData) return <p className="ana-empty">{emptyText}</p>;
  return (
    <>
      <div className="ana-legend" aria-hidden>
        <span>
          <i style={{ background: "#2f7a52" }} /> অনুমোদিত
        </span>
        <span>
          <i style={{ background: "#d44317" }} /> প্রত্যাখ্যাত
        </span>
      </div>
      <div className="ana-bars" role="img" aria-label="অনুমোদিত বনাম প্রত্যাখ্যাত নিবন্ধনের বার চার্ট">
        {items.map((x, i) => (
          <div
            className="ana-bar-col"
            key={i}
            title={`${x.day} — মোট ${bn(x.total)} · অনুমোদিত ${bn(x.a)} · প্রত্যাখ্যাত ${bn(x.b)}`}
          >
            <span className="ana-bar-count">{x.total > 0 ? bn(x.total) : ""}</span>
            <span className="ana-bar-duo">
              <span
                className="ana-bar"
                style={{
                  height: `${Math.max(x.a > 0 ? 8 : 2, Math.round((x.a / max) * 100))}%`,
                  background: "#2f7a52",
                }}
              />
              <span
                className="ana-bar"
                style={{
                  height: `${Math.max(x.b > 0 ? 8 : 2, Math.round((x.b / max) * 100))}%`,
                  background: "#d44317",
                }}
              />
            </span>
            <small>{x.label}</small>
          </div>
        ))}
      </div>
      <p className="ana-note">
        বারের উপরের সংখ্যা = সেদিনের মোট নিবন্ধন (যাচাইয়ের অপেক্ষায় থাকাগুলোসহ); সবুজ
        বার অনুমোদিত, লাল বার প্রত্যাখ্যাত।
      </p>
    </>
  );
}

/* R50: র‍্যাঙ্ক-তালিকা — প্রথম কয়েকটি দেখায়; নিচের ডাউন-অ্যারোতে ক্লিক করলে বাকিগুলো খোলে।
   শুধু যেসব দেশ/জেলা থেকে সত্যিই ভিজিট হয়েছে সেগুলোই আসে — নাম নিজে নিজেই যুক্ত হয়। */
const COLLAPSED_ROWS = 6;
function RankList({
  items,
  icon,
  nameOf,
}: {
  items: { k: string; count: number }[];
  icon?: (k: string) => string;
  nameOf: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...items.map((x) => x.count));
  if (!items.length) return <p className="ana-empty">এখনো কোনো তথ্য জমা হয়নি।</p>;
  const shown = open ? items : items.slice(0, COLLAPSED_ROWS);
  const hidden = items.length - COLLAPSED_ROWS;
  return (
    <>
      <ul className="ana-rank">
        {shown.map((x) => (
          <li key={x.k}>
            <span className="ana-rank-name">
              {icon ? <i>{icon(x.k)}</i> : null}
              {nameOf(x.k)}
            </span>
            <span className="ana-rank-track">
              <span style={{ width: `${Math.round((x.count / max) * 100)}%` }} />
            </span>
            <b>{bn(x.count)}</b>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className="ana-expand"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? (
            <>
              <ChevronUp size={15} /> কম দেখান
            </>
          ) : (
            <>
              <ChevronDown size={15} /> আরও {bn(hidden)}টি দেখুন
            </>
          )}
        </button>
      )}
    </>
  );
}

export default function AnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // R50: দৈনিক চার্টের রেঞ্জ — প্রিসেট বা কাস্টম তারিখ
  const [preset, setPreset] = useState("14d");
  const [customFrom, setCustomFrom] = useState(daysAgo(13));
  const [customTo, setCustomTo] = useState(dhakaToday());
  const rangeRef = useRef({ from: "", to: "" });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentRange = () => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    const p = RANGE_PRESETS.find((x) => x.key === preset) || RANGE_PRESETS[1];
    return { from: daysAgo(p.days - 1), to: dhakaToday() };
  };
  const load = async (range?: { from: string; to: string }) => {
    const r = range || rangeRef.current;
    try {
      const q =
        r.from && r.to
          ? `?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`
          : "";
      const d = await api<Analytics>(`/admin/analytics${q}`);
      setData(d);
      setUpdatedAt(new Date());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    rangeRef.current = currentRange();
    load();
    // প্রতি ১০ সেকেন্ডে শুধু সংখ্যাগুলো বদলায় — পেজ রিলোড হয় না
    timer.current = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // রেঞ্জ বদলালে সাথে সাথে নতুন ডেটা (পেজ রিলোড ছাড়া)
  const applyRange = (nextPreset: string, from?: string, to?: string) => {
    setPreset(nextPreset);
    const r =
      nextPreset === "custom"
        ? { from: from || customFrom, to: to || customTo }
        : (() => {
            const p = RANGE_PRESETS.find((x) => x.key === nextPreset)!;
            return { from: daysAgo(p.days - 1), to: dhakaToday() };
          })();
    rangeRef.current = r;
    load(r);
  };
  if (!data && !error) return <p className="ana-empty">পরিসংখ্যান আসছে…</p>;
  if (error && !data)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  const d = data!;
  const stats = [
    { icon: <Activity size={19} />, label: "এখন অনলাইনে (শেষ ৫ মিনিটে সক্রিয়)", value: d.online, live: true },
    { icon: <Users size={19} />, label: "আজকের ভিজিট", value: d.today },
    { icon: <UserCheck size={19} />, label: "আজকের ইউনিক ভিজিটর", value: d.uniqueToday },
    { icon: <TrendingUp size={19} />, label: "শেষ ১ ঘণ্টায়", value: d.lastHour },
    { icon: <Globe2 size={19} />, label: "মোট ভিজিট (শুরু থেকে সব দিন)", value: d.total },
  ];
  const dailyItems = d.daily.map((x, i) => {
    const step = Math.max(1, Math.ceil(d.daily.length / 7));
    return {
      label: i % step === (d.daily.length - 1) % step ? dayBn(x.d) : "",
      count: x.count,
    };
  });
  return (
    <div className="analytics-panel">
      <div className="ana-live-bar">
        <span className="ana-live-dot" aria-hidden />
        লাইভ — প্রতি ১০ সেকেন্ডে সংখ্যাগুলো নিজে নিজে আপডেট হয়, পেজ রিলোড হয় না।
        {updatedAt && (
          <small>
            <RefreshCw size={12} /> সর্বশেষ:{" "}
            {updatedAt.toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </small>
        )}
      </div>
      <div className="ana-stat-grid">
        {stats.map((s) => (
          <article className={`admin-panel-card ana-stat${s.live ? " ana-stat-live" : ""}`} key={s.label}>
            <span className="ana-stat-icon">{s.icon}</span>
            <b>{bn(s.value)}</b>
            <small>{s.label}</small>
          </article>
        ))}
      </div>
      <div className="ana-grid-2">
        <article className="admin-panel-card">
          <h3 className="ana-card-title">গত ২৪ ঘণ্টার ভিজিট (ঘণ্টা ধরে)</h3>
          <BarChart
            items={d.hourly.map((x, i) => ({
              label: i % 4 === 0 ? x.h : "",
              count: x.count,
            }))}
            color="#2f7a52"
            emptyText="গত ২৪ ঘণ্টায় কোনো ভিজিট রেকর্ড হয়নি।"
          />
        </article>
        <article className="admin-panel-card">
          <h3 className="ana-card-title">
            <CalendarRange size={16} /> দিন ধরে ভিজিট
            {d.range && (
              <span className="ana-range-sum">
                এই রেঞ্জে {bn(d.range.visits)} ভিজিট
              </span>
            )}
          </h3>
          {/* R50: রেঞ্জ বাছাই — ৭/১৪ দিন, ১/৩/৬ মাস বা নিজের পছন্দের তারিখ */}
          <div className="ana-range-row" role="group" aria-label="সময়ের রেঞ্জ">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`ana-range-chip${preset === p.key ? " on" : ""}`}
                onClick={() => applyRange(p.key)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`ana-range-chip${preset === "custom" ? " on" : ""}`}
              onClick={() => applyRange("custom")}
            >
              কাস্টম
            </button>
          </div>
          {preset === "custom" && (
            <div className="ana-custom-row">
              <label>
                থেকে
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    if (e.target.value) applyRange("custom", e.target.value, customTo);
                  }}
                />
              </label>
              <label>
                পর্যন্ত
                <input
                  type="date"
                  value={customTo}
                  max={dhakaToday()}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    if (e.target.value) applyRange("custom", customFrom, e.target.value);
                  }}
                />
              </label>
            </div>
          )}
          <BarChart
            items={dailyItems}
            color="#b58732"
            emptyText="এই রেঞ্জে কোনো ভিজিট রেকর্ড হয়নি।"
          />
        </article>
      </div>
      {/* R52: দিন ধরে নিবন্ধন — অনুমোদিত (সবুজ) ও প্রত্যাখ্যাত (লাল) দুই রঙের বার */}
      <article className="admin-panel-card">
        <h3 className="ana-card-title">গত ১৪ দিনের নিবন্ধন — অনুমোদিত বনাম প্রত্যাখ্যাত</h3>
        <DualBarChart
          items={d.regDaily.map((x, i) => ({
            label: i % 2 === 1 ? dayBn(x.d) : "",
            day: dayBn(x.d),
            total: x.count,
            a: x.approved ?? 0,
            b: x.rejected ?? 0,
          }))}
          emptyText="গত ১৪ দিনে কোনো নিবন্ধন হয়নি।"
        />
      </article>
      <div className="ana-grid-2">
        <article className="admin-panel-card">
          <h3 className="ana-card-title">
            <Globe2 size={16} /> কোন দেশ থেকে (গত ৩০ দিন)
          </h3>
          <RankList items={d.byCountry} icon={flag} nameOf={countryName} />
        </article>
        <article className="admin-panel-card">
          <h3 className="ana-card-title">
            <MapPin size={16} /> কোন শহর/জেলা থেকে (গত ৩০ দিন)
          </h3>
          <RankList items={d.byCity} nameOf={(k) => k} />
          <p className="ana-note">
            নামগুলো নিজে নিজেই আসে — যে জেলা/শহর থেকে ভিজিট হয়, কেবল সেটিই
            তালিকায় যুক্ত হয়।
          </p>
        </article>
      </div>
      <article className="admin-panel-card">
        <h3 className="ana-card-title">সর্বশেষ ভিজিট (নতুনটি সবার উপরে)</h3>
        {d.recent.length === 0 ? (
          <p className="ana-empty">এখনো কোনো ভিজিট রেকর্ড হয়নি।</p>
        ) : (
          <div className="ana-table-wrap">
            <table className="ana-table">
              <thead>
                <tr>
                  <th>সময়</th>
                  <th>দেশ</th>
                  <th>শহর/জেলা</th>
                  <th>পেজ</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((v, i) => (
                  <tr key={i}>
                    <td>{timeBn(v.at)}</td>
                    <td>
                      {flag(v.country)} {countryName(v.country)}
                    </td>
                    <td>{v.city || "অজানা"}</td>
                    <td>
                      <code>{v.path || "/"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <p className="ana-note">
        গোপনীয়তা: ভিজিটরের নাম/নম্বর/আইপি কিছুই রাখা হয় না — শুধু দেশ, শহর ও সময়।
      </p>
    </div>
  );
}
