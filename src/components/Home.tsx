import { useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  MapPin,
  Ticket,
  Menu,
  X,
  Heart,
  Coffee,
  Camera,
  Music2,
  Users,
  Baby,
  ShieldCheck,
  ChevronDown,
  ScanLine,
  Sparkles,
} from "lucide-react";
import type { Site } from "../types";
import BannerCollage from "./BannerCollage";
import { bn, logoFallback, money, timeLabel } from "../lib";
import { Eyebrow, Star, useReveal } from "./UI";
import RegistrationForm from "./RegistrationForm";
interface Props {
  site: Site;
  onTicket: (key?: string) => void;
  navigate: (path: string) => void;
}
/**
 * একটা সেকশনের imageUrl থেকে ছবির তালিকা বানায়।
 * লাইন বা কমা দিয়ে আলাদা করা যায়; তবে data: লিংকের ভেতরের কমা ভাঙা যাবে না।
 */
export function parseImageList(value: string) {
  return value
    .split("\n")
    .flatMap((line) => (line.includes("data:") ? [line] : line.split(",")))
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
}
export default function Home({ site, onTicket, navigate }: Props) {
  const [menu, setMenu] = useState(false);
  const [period, setPeriod] = useState("সব");
  useReveal([site, period]);
  const section = (key: string) => site.sections.find((s) => s.key === key);
  const hero = section("hero"),
    story = section("story"),
    registration = section("registration"),
    schedule = section("schedule"),
    footer = section("footer");
  const navItems = (site.nav || [])
    .filter((n) => n.visible !== false)
    .slice()
    .sort((a, b) => a.order - b.order);
  // টিকিট লিংকটি হেডারের ডান দিকের বোতাম হিসেবেই থাকে (মোবাইলেও সবসময় দেখা যায়)
  const navLinks = navItems.filter((n) => n.kind !== "ticket");
  const ticketItem = navItems.find((n) => n.kind === "ticket");
  const branding = section("branding"),
    ribbon = section("marquee"),
    festival = section("festival"),
    faq = section("faq");
  // ব্যানার কোলাজ: hero সেকশনে একাধিক ছবি (প্রতি লাইনে একটি, অথবা কমা দিয়ে) দিলে
  // সবগুলোই ঘুরে ঘুরে দেখা যায়। কিছু না দিলে ব্যাচের দুইটি স্মৃতিচিত্র নিজে থেকেই আসে।
  const heroImageList = hero?.imageUrl
    ? parseImageList(hero.imageUrl)
    : ["/assets/friends-forever.webp", "/assets/friends-together.webp"];
  const items = site.schedule.filter(
    (x) => period === "সব" || x.period === period,
  );
  // সেকশনে যাওয়া: আগে মসৃণ স্ক্রল, না হলে হ্যাশ-লিংক (সব পরিবেশে কাজ করে)
  const goTo = (id: string) => (e: ReactMouseEvent) => {
    e.preventDefault();
    setMenu(false);
    const target = document.getElementById(id);
    if (!target) return;
    try {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    } catch {
      /* কিছু ব্রাউজারে/প্রিভিউ-ফ্রেমে স্মুথ স্ক্রল আটকে যায় */
    }
    // ফলব্যাক: সেকশন না এলে হ্যাশ-লিংক, তাতেও না হলে নিজেই হিসাব করে স্ক্রল
    window.setTimeout(() => {
      const box = target.getBoundingClientRect();
      if (box.top < 0 || box.top > window.innerHeight * 0.6) {
        window.location.hash = id;
        if (document.getElementById(id) !== target) return;
        const still = target.getBoundingClientRect();
        if (still.top < 0 || still.top > window.innerHeight * 0.6) {
          const y = window.scrollY + still.top - 96;
          try {
            window.scrollTo({ top: Math.max(y, 0), behavior: "auto" });
          } catch {
            window.scrollTo(0, Math.max(y, 0));
          }
        }
      }
    }, 600);
    if (history.replaceState) history.replaceState(null, "", `#${id}`);
  };
  return (
    <div className="festival-page">
      {site.mode === "demo" && (
        <div className="demo-bar">
          <span className="demo-dot" />
          ডেমো প্রিভিউ <span className="demo-separator">/</span> বাস্তব টাকা
          পাঠাবেন না{" "}
          <span className="demo-desktop">· Supabase এখনও সংযুক্ত নয়</span>
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          {branding && (
            <a
              className="brand"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <img
                src={branding?.imageUrl || "/assets/ssc96-logo-v2.webp"}
                onError={logoFallback}
                alt="রংপুর এসএসসি ব্যাচ ১৯৯৬ লোগো"
                width="49"
                height="49"
              />
              <span>
                {branding?.title?.endsWith("96") ? (
                  <>
                    {branding.title.slice(0, -2)}
                    <b>96</b>
                  </>
                ) : (
                  branding?.title || "RANGPUR SSC 96"
                )}
                <small>{branding?.subtitle || site.event.tagline}</small>
              </span>
            </a>
          )}
          <nav
            className={menu ? "main-nav nav-open" : "main-nav"}
            aria-label="প্রধান নেভিগেশন"
          >
            {navLinks.map((item) =>
              item.kind === "link" ? (
                <a
                  key={item.id}
                  href={item.target || "#"}
                  target={/^https?:/i.test(item.target) ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              ) : (
                <a
                  key={item.id}
                  href={`#${item.target}`}
                  onClick={goTo(item.target)}
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>
          <div className="header-actions">
            {ticketItem && (
              <button
                className="button button-ghost ticket-nav"
                onClick={() => onTicket()}
              >
                <Ticket size={17} />
                <span>{ticketItem.label || "আমার টিকিট"}</span>
              </button>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        {hero && (
          <section className="hero container" aria-label={site.event.name}>
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <span className="live-dot" />
                {hero.subtitle}
                <span className="tiny-line" />
              </div>
              <h1 className="hero-title" aria-label={site.event.name}>
                {site.event.name === "Rangpur SSC 96 Festival" ? (
                  <>
                    <span className="title-line title-rangpur">
                      RANGPUR<span className="title-spark">✳</span>
                    </span>
                    <span className="title-line title-batch">
                      SSC{" "}
                      <span className="number-96">
                        96
                        <svg viewBox="0 0 250 20" aria-hidden="true">
                          <path d="M4 13Q125-2 246 12M35 19Q140 8 219 18" />
                        </svg>
                      </span>
                    </span>
                    <span className="title-line title-festival">
                      Festival<span className="title-period">.</span>
                    </span>
                  </>
                ) : (
                  <span className="custom-title">{site.event.name}</span>
                )}
              </h1>
              <h2 className="hero-subtitle">
                {hero.title.split("\n").map((line, i) => (
                  <span key={i}>
                    {line}
                    {i === 0 && <br />}
                  </span>
                ))}
              </h2>
              <p className="hero-description">{hero.body}</p>
              <div className="hero-buttons">
                <a
                  className="button button-primary"
                  href="#registration"
                  onClick={goTo("registration")}
                >
                  নিবন্ধন করি
                  <ArrowUpRight size={21} />
                </a>
                <a
                  className="text-button"
                  href="#schedule"
                  onClick={goTo("schedule")}
                >
                  দিনের আয়োজন <ArrowRight size={18} />
                </a>
              </div>
              <div className="hero-event-info">
                <div>
                  <span className="info-icon">
                    <CalendarDays size={21} />
                  </span>
                  <p>
                    <b>{site.event.dateLabel}</b>
                    <small>
                      {site.event.isDummyDate
                        ? "প্রস্তাবিত তারিখ · ডেমো"
                        : "উৎসবের দিন"}
                    </small>
                  </p>
                </div>
                <i />
                <div>
                  <span className="info-icon">
                    <MapPin size={21} />
                  </span>
                  <p>
                    <b>
                      {site.event.venue}, {site.event.city}
                    </b>
                    <small>{site.event.venueEnglish}</small>
                  </p>
                </div>
              </div>
            </div>
            <div
              className="hero-visual"
              onMouseMove={(e) => {
                if (matchMedia("(prefers-reduced-motion: reduce)").matches)
                  return;
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty(
                  "--px",
                  `${((e.clientX - r.left) / r.width - 0.5) * 9}px`,
                );
                e.currentTarget.style.setProperty(
                  "--py",
                  `${((e.clientY - r.top) / r.height - 0.5) * 7}px`,
                );
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.setProperty("--px", "0px");
                e.currentTarget.style.setProperty("--py", "0px");
              }}
            >
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />
              <Star className="hero-star" color="#ea654b" />
              <svg
                className="hero-scribble"
                viewBox="0 0 90 80"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 36C7 6 38-1 39 22C39 45 24 66 49 61C79 55 76 22 68 33C52 54 78 70 86 65M9 66L25 71M9 57L22 61"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
              <BannerCollage
                images={heroImageList}
                emblem={branding?.imageUrl}
              />
              <div className="memory-note">
                <span className="note-emoji">✌</span>
                <div>
                  <b>ব্যাচ ’৯৬</b>
                  <span>বন্ধুত্বটা এখনো সেই আগের মতো!</span>
                </div>
              </div>
              <div className="friends-stamp">
                <span>FRIENDS • FOREVER</span>
                <b>96</b>
                <small>এক ব্যাচ, এক পরিবার</small>
              </div>
              <span className="visual-label">
                GOOD OLD DAYS, GREAT NEW MEMORIES.
              </span>
            </div>
          </section>
        )}
        {ribbon && (
          <div className="marquee" aria-hidden="true">
            <div className="marquee-track">
              {Array.from({ length: 4 }, (_, i) => (
                <span className="marquee-part" key={i}>
                  {ribbon.imageUrl && <img src={ribbon.imageUrl} alt="" />}
                  {ribbon.body
                    .split("|")
                    .filter(Boolean)
                    .map((word, j) => (
                      <span className="ribbon-word" key={j}>
                        <span
                          className={
                            /^[A-Z ]+$/.test(word.trim())
                              ? "marquee-outline"
                              : ""
                          }
                        >
                          {word.trim()}
                        </span>
                        <Star />
                      </span>
                    ))}
                </span>
              ))}
            </div>
          </div>
        )}
        {story && (
          <section
            className="story-section container section-padding"
            id="memories"
          >
            <div className="story-art reveal">
              {story.imageUrl ? (
                <div className="story-upload">
                  <img src={story.imageUrl} alt={story.title} loading="lazy" />
                </div>
              ) : (
                <div className="story-paper">
                  <span className="paper-label">THE CLASS OF</span>
                  <strong>
                    19<span>96</span>
                  </strong>
                  <div className="paper-rule" />
                  <span className="paper-bangla">
                    টিফিনের ভাগ থেকে
                    <br />
                    জীবনের গল্প—একসাথে।
                  </span>
                  <svg
                    viewBox="0 0 230 55"
                    className="paper-doodle"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 40Q55-6 111 27T225 10M148 19L158 6L164 21L180 21L167 32L173 45L158 37L146 46L149 31L136 23Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
              <div className="story-sticky">
                <Heart size={21} fill="currentColor" />
                <span>
                  শেষ বেঞ্চের বন্ধু,
                  <br />
                  আজও হৃদয়ের কাছাকাছি।
                </span>
              </div>
              <Star className="story-star" color="#eac843" />
            </div>
            <div className="story-copy reveal">
              <Eyebrow>{story.subtitle}</Eyebrow>
              <h2 className="section-title">{story.title}</h2>
              <p className="section-description">{story.body}</p>
              <div className="story-promises">
                <span>
                  <Coffee size={18} />
                  পিঠা আর প্রাণখোলা আড্ডা
                </span>
                <span>
                  <Camera size={18} />
                  স্মৃতির ফ্রেমে প্রিয় মুখ
                </span>
                <span>
                  <Music2 size={18} />
                  গান, গল্প আর আনন্দ
                </span>
              </div>
              <div className="signature">
                আবার দেখা হবে, বন্ধু!{" "}
                <svg viewBox="0 0 110 30" aria-hidden="true">
                  <path
                    d="M3 15Q51 3 103 18M86 2L106 18L87 26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </section>
        )}
        {festival && (
          <section className="festival-section section-padding" id="festival">
            <div className="container">
              <div className="section-heading reveal">
                <div>
                  <Eyebrow>{festival.subtitle}</Eyebrow>
                  <h2 className="section-title">{festival.title}</h2>
                </div>
                <p style={{ whiteSpace: "pre-line" }}>{festival.body}</p>
              </div>
              {festival.imageUrl && (
                <img
                  className="section-extra-image"
                  src={festival.imageUrl}
                  alt={festival.title}
                  loading="lazy"
                />
              )}
              <div className="fee-grid">
                <FeeCard
                  icon={<Users />}
                  title="বন্ধু"
                  english="THE ORIGINAL ’96"
                  amount={site.fees.friend}
                  note="প্রতি বন্ধু · মূল নিবন্ধন"
                  color="green"
                  index="01"
                />
                <FeeCard
                  icon={<Heart />}
                  title="জীবনসঙ্গী"
                  english="BETTER TOGETHER"
                  amount={site.fees.spouse}
                  note="প্রতি জীবনসঙ্গী · ঐচ্ছিক"
                  color="peach"
                  index="02"
                />
                <FeeCard
                  icon={<Baby />}
                  title="ছোট্ট অতিথি"
                  english="LITTLE ONES, BIG JOY"
                  amount={site.fees.child}
                  note="প্রতি শিশু · সংখ্যা অনুযায়ী"
                  color="yellow"
                  index="03"
                />
              </div>
              <div className="fee-footnote">
                <Sparkles size={17} />
                নিবন্ধনে খাবারের পছন্দ ও বন্ধুর টি-শার্টের সাইজ জানিয়ে দিও।
              </div>
            </div>
          </section>
        )}
        {registration && (
          <section
            className="registration-section container section-padding"
            id="registration"
          >
            <div className="registration-intro reveal">
              <Eyebrow>{registration.subtitle}</Eyebrow>
              <h2 className="section-title">{registration.title}</h2>
              <p className="section-description">{registration.body}</p>
              {registration.imageUrl && (
                <img
                  className="section-extra-image"
                  src={registration.imageUrl}
                  alt={registration.title}
                  loading="lazy"
                />
              )}
              <div className="registration-guide">
                <h3>তিন ধাপেই তোমার নিবন্ধন</h3>
                {[
                  ["01", "নিজের তথ্য দাও", "নাম, স্কুল আর পরিবারের তথ্য।"],
                  [
                    "02",
                    "পেমেন্ট তথ্য জমা দাও",
                    "বিকাশ/নগদে Send Money-এর ট্রানজেকশন আইডি।",
                  ],
                  [
                    "03",
                    "অনুমোদনের পর টিকিট",
                    "এই অ্যাপেই পাবে তোমার ডিজিটাল QR টিকিট।",
                  ],
                ].map(([n, t, b]) => (
                  <div className="guide-row" key={n}>
                    <span>{n}</span>
                    <div>
                      <b>{t}</b>
                      <p>{b}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="trust-note">
                <ShieldCheck size={24} />
                <p>
                  <b>যাচাইয়ের পরেই QR টিকিট</b>
                  <span>
                    পেমেন্ট স্ট্যাটাস আয়োজকেরা নিশ্চিত করবেন। তোমার গোপন টিকিটের
                    লিংক সংরক্ষণ করো।
                  </span>
                </p>
              </div>
            </div>
            <div className="registration-form-wrap reveal">
              <RegistrationForm site={site} onTicket={onTicket} />
            </div>
          </section>
        )}
        {schedule && (
          <section className="schedule-section section-padding" id="schedule">
            <div className="container">
              <div className="section-heading reveal">
                <div>
                  <Eyebrow>{schedule.subtitle}</Eyebrow>
                  <h2 className="section-title">{schedule.title}</h2>
                </div>
                <span className="draft-chip">
                  <span />
                  খসড়া সময়সূচি
                </span>
              </div>
              <p className="schedule-intro reveal">{schedule.body}</p>
              {schedule.imageUrl && (
                <img
                  className="section-extra-image"
                  src={schedule.imageUrl}
                  alt={schedule.title}
                  loading="lazy"
                />
              )}
              <div
                className="schedule-tabs"
                role="group"
                aria-label="সময়সূচির সময় বাছাই"
              >
                {["সব", "সকাল", "দুপুর", "বিকেল", "সন্ধ্যা"].map((p) => (
                  <button
                    className={period === p ? "active" : ""}
                    key={p}
                    onClick={() => setPeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div
                className="schedule-grid"
                style={{
                  gridTemplateRows: `repeat(${Math.ceil(items.length / 2)}, auto)`,
                }}
              >
                {items.map((item) => (
                  <div className="schedule-item reveal" key={item.id}>
                    <div className="schedule-dot">
                      <span />
                    </div>
                    <div className="schedule-time">
                      <b>{timeLabel(item.time)}</b>
                      <small>{item.period}</small>
                    </div>
                    <div className="schedule-detail">
                      <h3>{item.title}</h3>
                      {item.note && <p>{item.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="schedule-notice">
                <CalendarDays size={18} />
                সময় ও আয়োজনের পরিবর্তন হলে এখানেই জানানো হবে।
              </div>
            </div>
          </section>
        )}
        {site.sections
          .filter(
            (s) =>
              ![
                "hero",
                "story",
                "registration",
                "schedule",
                "footer",
                "branding",
                "marquee",
                "festival",
                "faq",
              ].includes(s.key) && !s.key.startsWith("faq_"),
          )
          .map((s) => (
            <section
              className="custom-section container section-padding reveal"
              key={s.id}
              id={s.key}
            >
              <Eyebrow>{s.subtitle}</Eyebrow>
              <h2 className="section-title">{s.title}</h2>
              <p className="section-description">{s.body}</p>
              {s.imageUrl && (
                <img src={s.imageUrl} alt={s.title} loading="lazy" />
              )}
            </section>
          ))}
        {faq && (
          <section className="faq-section container section-padding">
            <div>
              <Eyebrow>{faq.subtitle}</Eyebrow>
              <h2 className="section-title">{faq.title}</h2>
              <p className="section-description">{faq.body}</p>
              {faq.imageUrl && (
                <img
                  className="section-extra-image"
                  src={faq.imageUrl}
                  alt={faq.title}
                  loading="lazy"
                />
              )}
            </div>
            <div className="faq-list">
              {site.sections
                .filter((s) => s.key.startsWith("faq_"))
                .map((s) => (
                  <details key={s.id}>
                    <summary>
                      {s.title}
                      <ChevronDown size={18} />
                    </summary>
                    <p>{s.body}</p>
                    {s.imageUrl && (
                      <img
                        className="section-extra-image"
                        src={s.imageUrl}
                        alt={s.title}
                        loading="lazy"
                      />
                    )}
                  </details>
                ))}
            </div>
          </section>
        )}
      </main>
      {footer && (
        <footer className="site-footer">
          <div className="container">
            <div className="footer-top">
              <div>
                <span className="footer-eyebrow">{footer.subtitle}</span>
                <h2>
                  {footer.title}
                  <Star color="#e9c948" />
                </h2>
                <p>{footer.body}</p>
                {footer.imageUrl && (
                  <img
                    className="footer-extra-image"
                    src={footer.imageUrl}
                    alt={footer.title}
                    loading="lazy"
                  />
                )}
              </div>
              <a
                className="button button-primary"
                href="#registration"
                onClick={goTo("registration")}
              >
                নিবন্ধন করি <ArrowUpRight size={20} />
              </a>
            </div>
            <div className="footer-bottom">
              {branding && (
                <a className="footer-brand" href="/">
                  {branding.title}
                </a>
              )}
              <span>{site.event.tagline}</span>
              <div>
                <button onClick={() => navigate("/admin")}>
                  <ShieldCheck size={15} />
                  আয়োজক প্যানেল
                </button>
                <button onClick={() => navigate("/check-in")}>
                  <ScanLine size={15} />
                  গেট চেক-ইন
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
function FeeCard({
  icon,
  title,
  english,
  amount,
  note,
  color,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  english: string;
  amount: number;
  note: string;
  color: string;
  index: string;
}) {
  return (
    <article className={`fee-card fee-${color} reveal`}>
      <div className="fee-card-top">
        <span className="fee-icon">{icon}</span>
        <span className="fee-index">{index}</span>
      </div>
      <small className="fee-english">{english}</small>
      <h3>{title}</h3>
      <div className="fee-amount">
        ৳ <strong>{money(amount)}</strong>
        <span>/-</span>
      </div>
      <p>{note}</p>
      <svg className="fee-doodle" viewBox="0 0 90 40" aria-hidden="true">
        <path
          d="M6 31Q45 4 82 18M67 4L85 18L71 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </article>
  );
}
