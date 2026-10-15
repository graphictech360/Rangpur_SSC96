import { useEffect, useMemo, useState } from "react";
import { CalendarClock, PlayCircle, Video } from "lucide-react";
import type { Section } from "../types";
import { bn, isVideoUrl, videoPoster } from "../lib";

/**
 * R33: "বন্ধুর সাথে, পরিবারও আসুক" সেকশনের ঠিক নিচে ও নিবন্ধন ফর্মের উপরে —
 * বামে নিবন্ধনের শেষ তারিখ + লাইভ কাউন্টডাউন, ডানে কীভাবে নিবন্ধন করতে হয় তার ভিডিও।
 * সবকিছু অ্যাডমিন প্যানেলের "পেজের লেখা ও ছবি → নিবন্ধনের কাউন্টডাউন" থেকে সম্পাদনাযোগ্য;
 * "মূল পেজে দেখাবে" আনচেক করলেই পুরো সেকশন লুকিয়ে যায়।
 */

const ytId = (url: string) => {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m ? m[1] : null;
};

/** imageUrl-এর লাইনগুলো থেকে ভিডিও ও পোস্টার আলাদা করা হয় — ক্রম যেটাই হোক */
export function parseCountdownMedia(imageUrl: string) {
  const lines = (imageUrl || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const video = lines.find((x) => isVideoUrl(x)) || "";
  const poster = lines.find((x) => !isVideoUrl(x)) || "";
  return { video, poster };
}

/** subtitle-এ রাখা তারিখ (YYYY-MM-DD) → ওই দিনের শেষ মুহূর্ত, বাংলাদেশ সময় */
export function parseDeadline(subtitle: string): Date | null {
  const m = (subtitle || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59+06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];
const bnDate = (subtitle: string) => {
  const m = (subtitle || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return subtitle;
  return `${bn(Number(m[3]))} ${BN_MONTHS[Number(m[2]) - 1]} ${bn(m[1])}`;
};

function remaining(deadline: Date) {
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export default function CountdownGuide({ section }: { section: Section }) {
  const deadline = useMemo(
    () => parseDeadline(section.subtitle || ""),
    [section.subtitle],
  );
  const { video, poster } = useMemo(
    () => parseCountdownMedia(section.imageUrl || ""),
    [section.imageUrl],
  );
  const [left, setLeft] = useState(() => (deadline ? remaining(deadline) : null));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!deadline) return;
    setLeft(remaining(deadline));
    const t = setInterval(() => setLeft(remaining(deadline)), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const posterUrl = poster || (video ? videoPoster(video) : null);
  const yid = video ? ytId(video) : null;
  return (
    <section className="countdown-section section-padding" id="countdown">
      <div className="container">
        <div className="countdown-grid">
          <div className="countdown-card reveal">
            <span className="countdown-icon">
              <CalendarClock size={23} />
            </span>
            <h2 className="section-title">{section.title}</h2>
            {section.body && (
              <p className="countdown-body" style={{ whiteSpace: "pre-line" }}>
                {section.body}
              </p>
            )}
            {deadline && (
              <p className="countdown-deadline">
                নিবন্ধনের শেষ তারিখ:{" "}
                <b>{bnDate(section.subtitle || "")}</b>
              </p>
            )}
            {deadline && left ? (
              <div className="countdown-clock" role="timer" aria-live="off">
                {(
                  [
                    [left.days, "দিন"],
                    [left.hours, "ঘণ্টা"],
                    [left.minutes, "মিনিট"],
                    [left.seconds, "সেকেন্ড"],
                  ] as const
                ).map(([value, label]) => (
                  <span className="countdown-box" key={label}>
                    <b>{bn(String(value).padStart(2, "0"))}</b>
                    <small>{label}</small>
                  </span>
                ))}
              </div>
            ) : deadline ? (
              <p className="countdown-over">
                নিবন্ধনের নির্ধারিত সময় শেষ হয়েছে। প্রয়োজনে আয়োজকদের সাথে
                যোগাযোগ করো।
              </p>
            ) : null}
            {deadline && left && (
              <a className="button button-primary countdown-cta" href="#registration">
                এখনই নিবন্ধন করি
              </a>
            )}
          </div>
          <div className="countdown-video reveal">
            {video ? (
              yid ? (
                playing ? (
                  <div className="countdown-video-frame">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${yid}?autoplay=1`}
                      title="নিবন্ধনের নিয়মের ভিডিও"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="countdown-video-poster"
                    onClick={() => setPlaying(true)}
                    aria-label="ভিডিও চালাও"
                  >
                    {posterUrl && <img src={posterUrl} alt="নিবন্ধনের নিয়মের ভিডিও" loading="lazy" />}
                    <span className="countdown-play">
                      <PlayCircle size={56} />
                      <small>কীভাবে নিবন্ধন করবে — ভিডিওটি দেখো</small>
                    </span>
                  </button>
                )
              ) : (
                <div className="countdown-video-frame">
                  <video
                    src={video}
                    controls
                    playsInline
                    preload="metadata"
                    poster={posterUrl || undefined}
                  />
                </div>
              )
            ) : (
              <div className="countdown-video-empty">
                {posterUrl ? (
                  <img src={posterUrl} alt={section.title} loading="lazy" />
                ) : (
                  <>
                    <Video size={42} />
                    <p>নিবন্ধনের নিয়মের ভিডিও শিগগিরই যুক্ত হবে।</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
