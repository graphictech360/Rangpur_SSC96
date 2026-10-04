import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";

/**
 * ব্যানার কোলাজ: একাধিক ছবি থাকলে নিজে থেকেই ধীরে ধীরে বদলায়
 * (crossfade + Ken-Burns motion), সাথে ছোট একটা কার্ড পরের ছবি দেখায়।
 * ছবি একটাই হলে ব্যাচ-এমব্লেম কার্ড যোগ হয়ে কোলাজ পূর্ণ হয়।
 */
interface Props {
  images: string[];
  emblem?: string;
}

type Slide = { kind: "image"; url: string; alt: string } | { kind: "emblem" };

const ROTATE_MS = 6500;

export default function BannerCollage({ images, emblem }: Props) {
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = (
      images.length ? images : ["/assets/friends-forever.webp"]
    ).map((url, i) => ({
      kind: "image" as const,
      url,
      alt: `SSC 96 রংপুর ব্যাচের স্মৃতির ছবি ${i + 1}`,
    }));
    if (list.length < 2) list.push({ kind: "emblem" });
    return list.slice(0, 4);
  }, [images]);
  const [index, setIndex] = useState(0);
  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [reduced, slides.length]);

  const active = slides[index % slides.length];
  const next = slides[(index + 1) % slides.length];

  const card = (slide: Slide, key: string, extra = "") => (
    <div className={`collage-card ${extra}`} key={key}>
      {slide.kind === "image" ? (
        <img src={slide.url} alt={slide.alt} fetchPriority="high" />
      ) : (
        <div className="collage-emblem">
          <img
            src={emblem || "/assets/ssc96-logo.webp"}
            alt="SSC 96 ব্যাচ প্রতীক"
          />
          <b>রংপুর • ১৯৯৬</b>
          <span>এক ব্যাচ, এক পরিবার</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="collage" aria-roledescription="ব্যানার কোলাজ">
      <div className="collage-stack">
        {card(next, "mini", "collage-mini")}
        <div className="hero-photo collage-main">
          <div className="photo-tape" />
          <div className="collage-frame">
            {slides.map((slide, i) => (
              <div
                className={`collage-slide ${slide === active ? "is-active" : ""}`}
                key={i}
                aria-hidden={slide !== active}
              >
                {slide.kind === "image" ? (
                  <img
                    src={slide.url}
                    alt={slide.alt}
                    fetchPriority={i === 0 ? "high" : "auto"}
                  />
                ) : (
                  <div className="collage-emblem">
                    <img
                      src={emblem || "/assets/ssc96-logo.webp"}
                      alt="SSC 96 ব্যাচ প্রতীক"
                    />
                    <b>রংপুর • ১৯৯৬</b>
                    <span>এক ব্যাচ, এক পরিবার</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="photo-caption">
            <span>স্কুলবেলার সেই আমরা…</span>
            <Heart size={17} />
          </div>
        </div>
      </div>
      {slides.length > 1 && (
        <div className="collage-dots">
          {slides.map((_, i) => (
            <button
              type="button"
              key={i}
              className={i === index ? "is-active" : ""}
              aria-label={`ব্যানারের ${i + 1} নম্বর ছবি দেখাও`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
