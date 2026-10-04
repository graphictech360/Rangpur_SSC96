import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  Loader2,
  LockKeyhole,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import type { Registration, Site } from "../types";
import {
  post,
  savedTickets,
  extractKey,
  ticketLink,
  copyText,
  money,
  bn,
  dateTime,
  saveTicket,
} from "../lib";
import { StatusBadge, useToast } from "./UI";
export default function TicketPanel({
  site,
  initialKey,
}: {
  site: Site;
  initialKey?: string;
}) {
  const stored = savedTickets();
  const [key, setKey] = useState(initialKey || stored[0]?.key || "");
  const [input, setInput] = useState(""),
    [registration, setRegistration] = useState<Registration | null>(null);
  const [busy, setBusy] = useState(false),
    [downloading, setDownloading] = useState(false),
    [error, setError] = useState("");
  const receiptRef = useRef<HTMLDivElement>(null),
    oldStatus = useRef("");
  const toast = useToast();
  const activeKey = useRef(key);
  activeKey.current = key;
  async function load(currentKey: string, automatic = false) {
    if (!automatic) setBusy(true);
    try {
      const r = await post<Registration>("/ticket", {
        trackingKey: currentKey,
      });
      if (activeKey.current !== currentKey) return;
      if (
        automatic &&
        oldStatus.current !== "approved" &&
        r.status === "approved"
      )
        toast("তোমার QR টিকিট প্রস্তুত!");
      oldStatus.current = r.status;
      setRegistration(r);
      setError("");
      saveTicket(currentKey, r);
    } catch (e) {
      if (activeKey.current !== currentKey) return;
      setError((e as Error).message);
      if (!automatic || /পাওয়া যায়নি|বাতিল/.test((e as Error).message))
        setRegistration(null);
    } finally {
      if (!automatic && activeKey.current === currentKey) setBusy(false);
    }
  }
  useEffect(() => {
    if (!key) return;
    setRegistration(null);
    oldStatus.current = "";
    load(key);
    const timer = setInterval(() => load(key, true), 15000);
    return () => clearInterval(timer);
  }, [key]);
  const copy = async () => {
    try {
      await copyText(ticketLink(key));
      toast("গোপন টিকিটের লিংক কপি হয়েছে।");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const download = async () => {
    if (!receiptRef.current || !registration) return;
    setDownloading(true);
    try {
      await document.fonts.ready;
      const data = await toPng(receiptRef.current, {
        pixelRatio: 2,
        backgroundColor: "#fffdf6",
        cacheBust: false,
      });
      const a = document.createElement("a");
      a.download = `${registration.ticketNumber}-digital-ticket.png`;
      a.href = data;
      a.click();
      toast("ডিজিটাল টিকিট ডাউনলোড হয়েছে।");
    } catch {
      toast("ডাউনলোড হয়নি। প্রিন্ট/PDF অপশন ব্যবহার করো।", true);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="ticket-panel">
      {stored.length > 1 && (
        <label className="field">
          এই ব্রাউজারের নিবন্ধন
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            {stored.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} · {s.ticketNumber}
              </option>
            ))}
          </select>
        </label>
      )}
      {!registration && !busy && (
        <div className="ticket-lookup-intro">
          <div className="ticket-intro-icon">
            <Ticket size={28} />
          </div>
          <h3>তোমার টিকিটের খোঁজ</h3>
          <ol className="ticket-find-steps">
            <li>
              <b>নিবন্ধন শেষ হওয়ামাত্র</b> স্ক্রিনে <b>গোপন লিংক</b> ও{" "}
              <b>রিকভারি কোড</b> দেখানো হয় — কপি বা স্ক্রিনশট নিয়ে রাখো।
            </li>
            <li>
              <b>এই ব্রাউজারে</b> আবার এলে “আমার টিকিট”-এ নিজে থেকেই খুলে যাবে;
              নিচের তালিকাতেও পাবে।
            </li>
            <li>
              <b>হারিয়ে গেলে</b> আয়োজককে (নিচের নম্বরে) মোবাইল ও TrxID জানাও —
              নতুন গোপন লিংক দেবেন, পুরোনোটা বাতিল হবে।
            </li>
          </ol>
          <p className="ticket-privacy-note">
            🔒 একটি লিংক/কোড শুধুই একজন বন্ধুর টিকিট খোলে — অন্য কারও নিবন্ধন,
            ফোন নম্বর বা ছবি কেউ দেখতে পারে না। লিংকটি কারও সাথে শেয়ার করো না।
          </p>
        </div>
      )}
      <form
        className="ticket-search"
        onSubmit={(e) => {
          e.preventDefault();
          const found = extractKey(input);
          if (found) {
            if (found === key) load(key);
            else setKey(found);
          } else setError("সঠিক গোপন লিংক বা ৬৪ অক্ষরের রিকভারি কোড দাও।");
        }}
      >
        <input
          aria-label="গোপন টিকিটের লিংক"
          placeholder="গোপন লিংক বা রিকভারি কোড"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="button button-dark"
          disabled={busy}
          aria-label="টিকিট খুঁজুন"
        >
          <Search size={19} />
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          <AlertTriangle size={16} />
          {error}
        </p>
      )}
      {busy && (
        <div className="loading-state">
          <Loader2 className="spin" />
          টিকিট খোঁজা হচ্ছে…
        </div>
      )}
      {registration && (
        <>
          {registration.status !== "approved" ? (
            <div className="pending-ticket">
              <div
                className={`pending-icon ${registration.status === "rejected" ? "rejected-icon" : ""}`}
              >
                {registration.status === "pending" ? (
                  <Clock3 size={28} />
                ) : (
                  <AlertTriangle size={28} />
                )}
              </div>
              <h3>
                {registration.status === "pending"
                  ? "আর একটু অপেক্ষা, বন্ধু!"
                  : "পেমেন্ট আবার যাচাই করতে হবে"}
              </h3>
              <p>
                {registration.status === "pending"
                  ? "তোমার তথ্য জমা হয়েছে। আয়োজকেরা পেমেন্ট যাচাই করে অনুমোদন দিলে এখানে QR টিকিট পাওয়া যাবে।"
                  : registration.payment.reason ||
                    "বিস্তারিত জানতে আয়োজকদের সঙ্গে যোগাযোগ করো।"}
              </p>
              <div className="pending-details">
                <div>
                  <span>নিবন্ধন</span>
                  <b>{registration.ticketNumber}</b>
                </div>
                <div>
                  <span>নাম</span>
                  <b>{registration.participant.name}</b>
                </div>
                <div>
                  <span>ট্রানজেকশন</span>
                  <b>{registration.payment.transactionId}</b>
                </div>
                <div>
                  <span>জমা দেওয়া পরিমাণ</span>
                  <b>৳ {money(registration.total)}</b>
                </div>
                <div>
                  <span>স্ট্যাটাস</span>
                  <StatusBadge status={registration.status} />
                </div>
              </div>
              <div className="approval-progress">
                <span className="complete">
                  <Check size={14} />
                  তথ্য জমা
                </span>
                <i />
                <span className="active">
                  <Clock3 size={14} />
                  যাচাই
                </span>
                <i />
                <span>
                  <Ticket size={14} />
                  QR টিকিট
                </span>
              </div>
              <span className="auto-refresh-note">
                <span className="live-dot" />
                এই পেজ প্রতি ১৫ সেকেন্ডে আপডেট হয়
              </span>
            </div>
          ) : (
            <>
              <div className="ticket-receipt" ref={receiptRef}>
                <div className="ticket-receipt-top">
                  <img
                    src={
                      site.sections.find((s) => s.key === "branding")
                        ?.imageUrl || "/assets/ssc96-logo.webp"
                    }
                    alt="SSC 96"
                  />
                  <div>
                    <small>FRIENDS FOREVER · SINCE 1996</small>
                    <h3>{site.event.name}</h3>
                  </div>
                  <span className="receipt-approved">
                    <Check size={13} />
                    অনুমোদিত
                  </span>
                </div>
                <div className="ticket-receipt-main">
                  <span className="receipt-label">তোমার উৎসবের টিকিট</span>
                  <div
                    className="receipt-holder"
                    data-initial={registration.participant.name.charAt(0)}
                  >
                    {registration.participant.photoUrl ? (
                      <img
                        className="receipt-photo"
                        src={registration.participant.photoUrl}
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          el.parentElement?.classList.add("photo-broken");
                        }}
                        alt={registration.participant.name}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="receipt-photo fallback">
                        {registration.participant.name.charAt(0)}
                      </span>
                    )}
                    <div className="receipt-holder-data">
                      <h2>{registration.participant.name}</h2>
                      <p>{registration.participant.school}</p>
                      <span className="receipt-mobile">
                        <Phone size={15} />
                        {bn(registration.participant.mobile)}
                      </span>
                    </div>
                  </div>
                  <div className="receipt-event">
                    <span>
                      <CalendarDays size={16} />
                      {site.event.dateLabel}
                      {site.event.isDummyDate ? " (প্রস্তাবিত)" : ""}
                    </span>
                    <span>
                      <MapPin size={16} />
                      {site.event.venue}, {site.event.city}
                    </span>
                  </div>
                  <div className="receipt-divider" />
                  <div className="receipt-bottom">
                    <div className="receipt-data">
                      <small>TICKET NUMBER</small>
                      <strong>{registration.ticketNumber}</strong>
                      <span>
                        <Users size={16} />
                        মোট{" "}
                        {bn(1 + registration.spouse + registration.children)} জন
                      </span>
                      <p>
                        বন্ধু ১ · জীবনসঙ্গী {bn(registration.spouse)} · শিশু{" "}
                        {bn(registration.children)}
                      </p>
                      <div className="receipt-fine-details">
                        <span>এসএসসি রোল: {bn(registration.participant.sscRoll)}</span>
                        {registration.participant.sscRegistration ? (
                          <span>
                            রেজিস্ট্রেশন: {bn(registration.participant.sscRegistration)}
                          </span>
                        ) : null}
                        <span>বর্তমান অবস্থান: {registration.participant.location}</span>
                        <span>মোবাইল: {bn(registration.participant.mobile)}</span>
                        <span>টি-শার্ট: {registration.participant.tshirt}</span>
                        {registration.food && (
                          <span>খাবার: {registration.food}</span>
                        )}
                        {Object.entries(registration.answers || {})
                          .filter(([, v]) => String(v || "").trim() !== "")
                          .map(([k, v]) => (
                            <span key={k}>
                              {(site.formFields || []).find((f) => f.key === k)
                                ?.label || k}
                              : {v}
                            </span>
                          ))}
                        <span>
                          {registration.payment.provider === "bkash"
                            ? "bKash"
                            : "Nagad"}{" "}
                          · TrxID: {registration.payment.transactionId}
                        </span>
                        <b>যাচাইকৃত পেমেন্ট: ৳ {money(registration.total)}</b>
                      </div>
                    </div>
                    <div className="receipt-qr">
                      {registration.qrPayload && (
                        <QRCodeSVG
                          value={registration.qrPayload}
                          size={154}
                          level="M"
                          marginSize={2}
                          bgColor="#ffffff"
                          fgColor="#152f2c"
                        />
                      )}
                      <small>গেটে এই QR দেখাও</small>
                    </div>
                  </div>
                  {registration.checkedInAt && (
                    <div className="receipt-checked">
                      <Check size={15} />
                      চেক-ইন সম্পন্ন · {dateTime(registration.checkedInAt)}
                    </div>
                  )}
                </div>
                <div className="receipt-footer">
                  একটি QR-এ নিবন্ধিত পরিবার একসঙ্গে প্রবেশ করবে।
                  <br />
                  শুধু অনুমোদিত স্টাফ চেক-ইন করতে পারবেন।
                  {site.mode === "demo" && (
                    <b>ডেমো টিকিট · বাস্তব ইভেন্টে প্রবেশের জন্য নয়</b>
                  )}
                </div>
              </div>
              <div className="ticket-download-actions">
                <button
                  className="button button-primary"
                  onClick={download}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="spin" size={18} />
                  ) : (
                    <Download size={18} />
                  )}
                  টিকিট ডাউনলোড
                </button>
                <button
                  className="button button-outline"
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                  প্রিন্ট / PDF
                </button>
              </div>
            </>
          )}
          <div className="ticket-secondary-actions">
            <button className="text-button" onClick={() => load(key)}>
              <RefreshCw size={15} />
              স্ট্যাটাস আপডেট
            </button>
            <button className="text-button" onClick={copy}>
              <Copy size={15} />
              গোপন লিংক কপি
            </button>
          </div>
          <p className="small-note">
            <LockKeyhole size={13} />
            লিংক ও QR অন্য কাউকে দিও না। এখানে এসএমএস পাঠানো হয় না।
          </p>
        </>
      )}
      {site.mode === "demo" && site.demoTicketKey && (
        <button
          className="demo-ticket-button"
          onClick={() => {
            if (key === site.demoTicketKey) load(key);
            else setKey(site.demoTicketKey!);
          }}
        >
          <Ticket size={16} />
          একটি অনুমোদিত ডেমো টিকিট দেখো
        </button>
      )}
    </div>
  );
}
