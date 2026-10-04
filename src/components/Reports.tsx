import {
  Users,
  Wallet,
  BadgeCheck,
  Clock,
  ScanLine,
  UserX,
  GraduationCap,
  Download,
  BarChart3,
  Shirt,
  UtensilsCrossed,
  Smartphone,
} from "lucide-react";
import type { AdminStats, Registration } from "../types";
import { bn, money, downloadTableCsv, dateTime } from "../lib";

/**
 * অ্যাডমিন রিপোর্ট: স্কুলভিত্তিক হিসাব, টাকা, চেক-ইন, অনুপস্থিত — সব এক জায়গায়।
 * প্রতিটি টেবিল আলাদা CSV হিসেবেও নামানো যায়।
 */
export default function Reports({
  stats,
  registrations,
}: {
  stats: AdminStats;
  registrations: Registration[];
}) {
  const t = stats.totals;
  const percent = Math.max(0, Math.min(100, t.checkInPercent || 0));
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count));

  const exportSchools = () =>
    downloadTableCsv("Rangpur-SSC96-school-report.csv", [
      [
        "স্কুল",
        "নিবন্ধন",
        "অনুমোদিত",
        "মোট মানুষ",
        "প্রত্যাশিত টাকা",
        "যাচাইকৃত টাকা",
        "চেক-ইন",
        "চেক-ইন মানুষ",
        "অনুপস্থিত",
      ],
      ...stats.schools.map((s) => [
        s.school,
        s.registrations,
        s.approved,
        s.people,
        s.expectedAmount,
        s.verifiedAmount,
        s.checkedIn,
        s.checkedInPeople,
        s.absent,
      ]),
    ]);

  const exportSummary = () =>
    downloadTableCsv("Rangpur-SSC96-summary.csv", [
      ["বিষয়", "সংখ্যা"],
      ["মোট নিবন্ধন", t.registrations],
      ["অনুমোদিত পরিবার", t.approved],
      ["যাচাইয়ের অপেক্ষায়", t.pending],
      ["প্রত্যাখ্যাত", t.rejected],
      ["আর্কাইভ করা", stats.archived ?? 0],
      ["বন্ধু (নিবন্ধন)", t.registrations],
      ["জীবনসঙ্গী", t.spouses],
      ["শিশু", t.children],
      ["মোট মানুষ", t.people],
      ["অনুমোদিত মানুষ", t.approvedPeople],
      ["প্রত্যাশিত টাকা", t.expectedAmount],
      ["যাচাইকৃত টাকা", t.verifiedAmount],
      ["যাচাই বাকি টাকা", t.pendingAmount],
      ["চেক-ইন পরিবার", t.checkedIn],
      ["চেক-ইন মানুষ", t.checkedInPeople],
      ["অনুপস্থিত পরিবার", t.absent],
      ["অনুপস্থিত মানুষ", t.absentPeople],
      ["উপস্থিতির হার (%)", t.checkInPercent],
      [],
      ["টি-শার্ট", "সংখ্যা"],
      ...stats.tshirts.map((x) => [x.size, x.count]),
      [],
      ["খাবার", "সংখ্যা"],
      ...stats.foods.map((x) => [x.preference, x.count]),
      [],
      ["মাধ্যম", "নিবন্ধন", "জমা টাকা", "যাচাইকৃত"],
      ...stats.providers.map((x) => [
        x.provider === "bkash" ? "বিকাশ" : "নগদ",
        x.count,
        x.amount,
        x.verifiedAmount,
      ]),
      [],
      ["গ্রহণকারী", "মাধ্যম", "মোবাইল", "নিবন্ধন", "জমা টাকা"],
      ...stats.collectors.map((x) => [
        x.name,
        x.provider === "bkash" ? "বিকাশ" : "নগদ",
        x.mobile,
        x.count,
        x.amount,
      ]),
    ]);

  const exportAttendance = () =>
    downloadTableCsv("Rangpur-SSC96-attendance.csv", [
      [
        "টিকিট",
        "নাম",
        "স্কুল",
        "মোবাইল",
        "কতজন",
        "যাচাইকৃত টাকা",
        "চেক-ইন",
        "চেক-ইনের সময়",
      ],
      ...registrations
        .filter((r) => r.status === "approved" && !r.archivedAt)
        .map((r) => [
          r.ticketNumber,
          r.participant.name,
          r.participant.school,
          r.participant.mobile,
          1 + r.spouse + r.children,
          r.total,
          r.checkedInAt ? "উপস্থিত" : "অনুপস্থিত",
          r.checkedInAt || "",
        ]),
    ]);

  return (
    <div className="report">
      <div className="admin-section-toolbar">
        <p>
          স্কুলভিত্তিক হিসাব, টাকা, উপস্থিতি ও অনুপস্থিত—সব এক জায়গায়। নিচের
          যেকোনো টেবিল CSV আকারে নামিয়ে Excel/Google Sheets-এ খুলতে পারবেন।
        </p>
        <div className="report-toolbar-buttons">
          <button className="button button-primary" onClick={exportSummary}>
            <Download size={17} /> সারসংক্ষেপ CSV
          </button>
          <button className="button button-outline" onClick={exportSchools}>
            <Download size={17} /> স্কুলভিত্তিক CSV
          </button>
          <button className="button button-outline" onClick={exportAttendance}>
            <Download size={17} /> উপস্থিতি CSV
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <Stat
          label="মোট নিবন্ধন"
          value={bn(t.registrations)}
          detail={`অনুমোদিত ${bn(t.approved)} · অপেক্ষায় ${bn(t.pending)}`}
          icon={<Users />}
          color="green"
        />
        <Stat
          label="মোট মানুষ"
          value={bn(t.people)}
          detail={`বন্ধু ${bn(t.registrations)} · সঙ্গী ${bn(t.spouses)} · শিশু ${bn(t.children)}`}
          icon={<GraduationCap />}
          color="coral"
        />
        <Stat
          label="প্রত্যাশিত টাকা"
          value={`৳ ${money(t.expectedAmount)}`}
          detail={`যাচাইকৃত ৳ ${money(t.verifiedAmount)}`}
          icon={<Wallet />}
          color="green"
        />
        <Stat
          label="যাচাই বাকি"
          value={`৳ ${money(t.pendingAmount)}`}
          detail="পেমেন্ট মিলিয়ে অনুমোদন দিন"
          icon={<Clock />}
          color="yellow"
        />
        <Stat
          label="চেক-ইন হয়েছে"
          value={bn(t.checkedIn)}
          detail={`${bn(t.checkedInPeople)} জন দরজা পার হয়েছে`}
          icon={<ScanLine />}
          color="green"
        />
        <Stat
          label="অনুপস্থিত"
          value={bn(t.absent)}
          detail={`${bn(t.absentPeople)} জন আসেনি`}
          icon={<UserX />}
          color="coral"
        />
      </div>

      <div className="admin-panel-card report-progress">
        <div className="report-progress-head">
          <h3>
            <BadgeCheck size={18} /> উপস্থিতির হার
          </h3>
          <b>{bn(percent)}%</b>
        </div>
        <div
          className="report-bar"
          role="img"
          aria-label={`উপস্থিতির হার ${percent}%`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <p>
          অনুমোদিত {bn(t.approved)} পরিবারের মধ্যে {bn(t.checkedIn)} পরিবার
          চেক-ইন করেছে; বাকি {bn(t.absent)} পরিবার এখনো আসেনি।
        </p>
        {stats.generatedAt && (
          <small className="report-stamp">
            হিসাব তৈরি: {dateTime(stats.generatedAt)}
          </small>
        )}
      </div>

      {stats.daily.length > 0 && (
        <div className="admin-panel-card">
          <h3>
            <BarChart3 size={18} /> শেষ ১৪ দিনে নিবন্ধনের ধারা
          </h3>
          <div className="report-bars">
            {stats.daily.map((d) => (
              <div key={d.date} className="report-bar-col">
                <span className="report-bar-value">{bn(d.count)}</span>
                <span
                  className="report-bar-fill"
                  style={{
                    height: `${Math.max(8, (d.count / maxDaily) * 100)}%`,
                  }}
                />
                <small>{d.date.slice(5)}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-panel-card report-table-card">
        <h3>
          <GraduationCap size={18} /> স্কুলভিত্তিক হিসাব
        </h3>
        <div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>স্কুল</th>
                <th>নিবন্ধন</th>
                <th>মানুষ</th>
                <th>প্রত্যাশিত</th>
                <th>যাচাইকৃত</th>
                <th>চেক-ইন</th>
                <th>অনুপস্থিত</th>
              </tr>
            </thead>
            <tbody>
              {stats.schools.length === 0 && (
                <tr>
                  <td colSpan={7} className="report-empty">
                    এখনো কোনো নিবন্ধন আসেনি। প্রথম নিবন্ধন এলেই এখানে হিসাব দেখা
                    যাবে।
                  </td>
                </tr>
              )}
              {stats.schools.map((s) => (
                <tr key={s.school}>
                  <td className="report-school">{s.school}</td>
                  <td>
                    {bn(s.registrations)}
                    <small> · অনুমোদিত {bn(s.approved)}</small>
                  </td>
                  <td>{bn(s.people)}</td>
                  <td>৳ {money(s.expectedAmount)}</td>
                  <td>৳ {money(s.verifiedAmount)}</td>
                  <td>
                    {bn(s.checkedIn)}
                    <small> · {bn(s.checkedInPeople)} জন</small>
                  </td>
                  <td>{bn(s.absent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-grid">
        <div className="admin-panel-card">
          <h3>
            <Shirt size={18} /> টি-শার্ট সাইজ
          </h3>
          <ul className="report-list">
            {stats.tshirts.length === 0 && <li>এখনো তথ্য নেই।</li>}
            {stats.tshirts.map((x) => (
              <li key={x.size}>
                <span>{x.size}</span>
                <b>{bn(x.count)}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-panel-card">
          <h3>
            <UtensilsCrossed size={18} /> খাবারের পছন্দ
          </h3>
          <ul className="report-list">
            {stats.foods.length === 0 && <li>এখনো তথ্য নেই।</li>}
            {stats.foods.map((x) => (
              <li key={x.preference}>
                <span>{x.preference}</span>
                <b>{bn(x.count)}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-panel-card">
          <h3>
            <Smartphone size={18} /> বিকাশ / নগদ হিসাব
          </h3>
          <ul className="report-list">
            {stats.providers.length === 0 && <li>এখনো তথ্য নেই।</li>}
            {stats.providers.map((x) => (
              <li key={x.provider}>
                <span>
                  {x.provider === "bkash" ? "বিকাশ" : "নগদ"}
                  <small> · {bn(x.count)} নিবন্ধন</small>
                </span>
                <b>৳ {money(x.amount)}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-panel-card">
          <h3>
            <Wallet size={18} /> গ্রহণকারীভিত্তিক জমা
          </h3>
          <ul className="report-list">
            {stats.collectors.length === 0 && <li>এখনো তথ্য নেই।</li>}
            {stats.collectors.map((x) => (
              <li key={`${x.provider}-${x.name}-${x.mobile}`}>
                <span>
                  {x.name}
                  <small>
                    {" "}
                    · {x.provider === "bkash" ? "বিকাশ" : "নগদ"} · {x.mobile}
                  </small>
                </span>
                <b>৳ {money(x.amount)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
  color: "green" | "coral" | "yellow";
}) {
  return (
    <div className={`admin-stat admin-stat-${color}`}>
      <div>
        <span>{label}</span>
        <i aria-hidden="true">{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
