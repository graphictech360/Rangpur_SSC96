import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  MapPin,
  PlayCircle,
  X,
} from "lucide-react";
import type { MemoryAlbum, MemoryMedia, Section } from "../types";
import { bn, videoPoster } from "../lib";
import { Eyebrow } from "./UI";

/**
 * R20: আগের সফল আয়োজনের স্মৃতি-দেয়াল।
 * - ছবিগুলো একটার পর একটা নিজে নিজে বদলায় (ক্রসফেড + ধীর জুম)
 * - এক আয়োজনের ছবি শেষ হলে পরের আয়োজন — নাম/তারিখও বদলে যায়
 * - ডানে সেই আয়োজনের ভিডিও (থাকলে), চাপলে বড় করে চলে
 */
const SLIDE_MS = 3800;

const ytId = (url: string) => {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m ? m[1] : null;
};
const isFileVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export default function MemoryWall({
  albums,
  section,
}: {
  albums: MemoryAlbum[];
  /** R22: সেকশনের লেখা অ্যাডমিন প্যানেলের "পেজের লেখা ও ছবি" থেকে আসে (key: past_events) */
  section?: Section;
}) {
  // শুধু সক্রিয়, ছবি-থাকা অ্যালবাম — ক্রম অনুযায়ী
  const shows = useMemo(
    () =>
      albums
        .filter((a) => a.active && a.media.some((m) => m.kind === "image"))
        .map((a) => ({
          ...a,
          images: a.media.filter((m) => m.kind === "image"),
          videos: a.media.filter((m) => m.kind === "video"),
        })),
    [albums],
  );
  // সমতল স্লাইড-তালিকা: [অ্যালবাম-ইনডেক্স, ছবি-ইনডেক্স]
  const slides = useMemo(
    () =>
      shows.flatMap((a, ai) => a.images.map((_, ii) => [ai, ii] as const)),
    [shows],
  );
  const [pos, setPos] = useState(0);
  const [paused, setPaused] = useState(false);
  const [player, setPlayer] = useState<MemoryMedia | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || player || slides.length < 2) return;
    timer.current = setInterval(
      () => setPos((p) => (p + 1) % slides.length),
      SLIDE_MS,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, player, slides.length]);
  useEffect(() => {
    if (pos >= slides.length) setPos(0);
  }, [slides.length, pos]);

  if (!slides.length) return null;
  // অ্যাডমিন সেকশনটি লুকিয়ে দিলে পাবলিক পেজে দেখা যায় না
  if (section && section.visible === false) return null;
  const [ai, ii] = slides[Math.min(pos, slides.length - 1)];
  const album = shows[ai];
  const jump = (d: number) =>
    setPos((p) => (p + d + slides.length) % slides.length);
  const jumpToAlbum = (targetAi: number) => {
    const idx = slides.findIndex(([a]) => a === targetAi);
    if (idx >= 0) setPos(idx);
  };

  return (
    <section className="memory-section container section-padding" id="past-events">
      <div className="memory-head reveal">
        <Eyebrow>{section?.subtitle?.trim() || "আগের আড্ডাগুলো"}</Eyebrow>
        <h2 className="section-title">
          {section?.title?.trim() || "সফল আয়োজনের স্মৃতি"}
        </h2>
        <p className="section-description">
          {section?.body?.trim() ||
            "যেখানে একবার বসেছি, সেখানেই গল্প জমেছে — ছবিগুলো নিজে নিজেই বদলাবে, চাইলে ভিডিও-ও দেখে নিতে পারো।"}
        </p>
      </div>

      <div
        className="memory-stage reveal"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* ── বাঁ: চলমান ছবি ── */}
        <figure className="memory-screen">
          {album.images.map((img, i) => (
            <img
              key={img.id || `${ai}-${i}`}
              src={img.url}
              alt={`${album.title} — ছবি ${i + 1}`}
              loading="lazy"
              className={i === ii ? "memory-img on" : "memory-img"}
            />
          ))}
          <figcaption className="memory-caption">
            <span className="memory-place">
              <MapPin size={17} /> {album.title}
            </span>
            <span className="memory-date">
              <CalendarDays size={15} /> {album.dateLabel}
            </span>
          </figcaption>
          <div className="memory-count">
            ছবি {bn(ii + 1)} / {bn(album.images.length)}
          </div>
          <button
            type="button"
            className="memory-arrow left"
            aria-label="আগের ছবি"
            onClick={() => jump(-1)}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="memory-arrow right"
            aria-label="পরের ছবি"
            onClick={() => jump(1)}
          >
            <ChevronRight size={22} />
          </button>
          <div className="memory-dots" role="tablist">
            {shows.map((a, i) => (
              <button
                key={a.id || i}
                type="button"
                role="tab"
                aria-selected={i === ai}
                title={a.title}
                className={i === ai ? "on" : ""}
                onClick={() => jumpToAlbum(i)}
              />
            ))}
          </div>
        </figure>

        {/* ── ডান: এই আয়োজনের ভিডিও ── */}
        <aside className="memory-videos">
          <h3>
            <Clapperboard size={19} /> এই আয়োজনের ভিডিও
          </h3>
          {album.videos.length ? (
            <ul>
              {album.videos.map((v, i) => {
                const poster = videoPoster(v.url);
                return (
                  <li key={v.id || i}>
                    <button type="button" onClick={() => setPlayer(v)}>
                      {poster ? (
                        <img src={poster} alt="" loading="lazy" />
                      ) : isFileVideo(v.url) ? (
                        // সরাসরি ভিডিও-ফাইল: প্রথম ফ্রেমই প্রিভিউ-ছবি
                        <video
                          src={`${v.url}#t=0.15`}
                          preload="metadata"
                          muted
                          playsInline
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="video-thumb-fallback">
                          <PlayCircle size={30} />
                        </span>
                      )}
                      <span className="video-label">
                        <PlayCircle size={17} />
                        ভিডিও {bn(i + 1)} — {album.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="memory-no-video">
              এই আয়োজনের ভিডিও নেই — ছবিগুলোই গল্প বলছে। 😊
            </p>
          )}
          <p className="memory-hint">
            ছবির উপর মাউস রাখলে স্লাইড থামে · ডটে চেপে অন্য আয়োজন দেখো
          </p>
        </aside>
      </div>

      {/* ── ভিডিও প্লেয়ার (মোডাল) ── */}
      {player && (
        <div
          className="memory-player"
          role="dialog"
          aria-label="ভিডিও প্লেয়ার"
          onClick={() => setPlayer(null)}
        >
          <div className="memory-player-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="memory-player-close"
              aria-label="বন্ধ করুন"
              onClick={() => setPlayer(null)}
            >
              <X size={20} />
            </button>
            {ytId(player.url) ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId(player.url)}?autoplay=1`}
                title="ভিডিও"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : isFileVideo(player.url) ? (
              <video src={player.url} controls autoPlay playsInline />
            ) : (
              <div className="memory-player-link">
                <p>এই ভিডিওটি এখানে চালানো যাচ্ছে না।</p>
                <a
                  className="button button-primary"
                  href={player.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  নতুন ট্যাবে ভিডিও দেখুন
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
