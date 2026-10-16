import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Film,
  ImagePlus,
  Link2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { MemoryAlbum, MemoryMedia } from "../types";
import { bn, post, shrinkPhoto, videoPoster, videoPosterFallback } from "../lib";
import { useToast } from "./UI";

/**
 * R20: অ্যাডমিন — আগের আয়োজনের অ্যালবাম ব্যবস্থাপনা।
 * লোকেশন/নাম + তারিখ + যত খুশি ছবি (সরাসরি আপলোড বা লিংক) + ভিডিও লিংক।
 * যোগ, সরানো, লুকানো, ক্রম বদল — সব এখান থেকেই।
 */
export default function AlbumManager({
  albums,
  onSave,
  onAskDelete,
}: {
  albums: MemoryAlbum[];
  onSave: (action: string, payload: unknown) => Promise<unknown>;
  onAskDelete: (id: string, title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const sorted = [...albums].sort((a, b) => a.order - b.order);
  const swap = async (i: number, j: number) => {
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await onSave("album.save", { ...a, order: b.order });
    await onSave("album.save", { ...b, order: a.order });
  };
  return (
    <section className="album-manager">
      <div className="admin-section-toolbar">
        <p>
          <b>আগের আয়োজনের অ্যালবাম</b> — লোকেশন/আয়োজনের নাম, তারিখ আর ছবি-ভিডিও
          দিন; পাবলিক পেজে “সফল আয়োজনের স্মৃতি” অংশে একটার পর একটা চলতে থাকবে।
        </p>
        <button
          className="button button-primary"
          onClick={() => setAdding(true)}
        >
          <Plus size={17} /> নতুন অ্যালবাম
        </button>
      </div>
      {adding && (
        <AlbumCard
          album={{
            title: "",
            dateLabel: "",
            media: [],
            active: true,
            order: albums.length,
          }}
          isNew
          onSave={async (a) => {
            await onSave("album.save", a);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
          onAskDelete={() => setAdding(false)}
        />
      )}
      {sorted.map((a, i) => (
        <AlbumCard
          key={a.id}
          album={a}
          onSave={(x) => onSave("album.save", x)}
          onAskDelete={() => a.id && onAskDelete(a.id, a.title)}
          onMoveUp={() => swap(i, i - 1)}
          onMoveDown={() => swap(i, i + 1)}
        />
      ))}
      {!sorted.length && !adding && (
        <p className="album-empty">
          এখনো কোনো অ্যালবাম নেই — “নতুন অ্যালবাম” চেপে প্রথম আয়োজনের ছবি দিন।
        </p>
      )}
    </section>
  );
}

function AlbumCard({
  album,
  isNew,
  onSave,
  onCancel,
  onAskDelete,
  onMoveUp,
  onMoveDown,
}: {
  album: MemoryAlbum;
  isNew?: boolean;
  onSave: (a: MemoryAlbum) => Promise<unknown> | unknown;
  onCancel?: () => void;
  onAskDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<MemoryAlbum>({ ...album });
  const [dirty, setDirty] = useState(isNew || false);
  const [busy, setBusy] = useState(false);
  const [linkKind, setLinkKind] = useState<"image" | "video" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<MemoryAlbum>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };
  const media = draft.media || [];
  const setMedia = (m: MemoryMedia[]) => patch({ media: m });
  const moveMedia = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j], next[i]];
    setMedia(next);
  };
  // R36: আপলোড শেষে বিদ্যমান অ্যালবাম নিজে থেকেই সেভ হয় — সহ-অ্যাডমিনের
  // কাজ "সেভ করুন" চাপতে ভুলে গেলেও আর হারাবে না; ভুল হলে স্পষ্ট বার্তা
  const persist = async (next: MemoryAlbum) => {
    if (isNew || !next.id) {
      setDirty(true); // নতুন অ্যালবাম: নাম-তারিখ লিখে “সেভ করুন” চাপতে হবে
      return;
    }
    try {
      await onSave(next);
      setDirty(false);
    } catch {
      setDirty(true); // এরর-টোস্ট আগেই দেখানো হয়েছে; সেভ-বোতাম থেকে আবার চেষ্টা
    }
  };
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      // R38: প্রতিটি ছবি আলাদাভাবে ওঠে (১ বার স্বয়ংক্রিয় পুনঃচেষ্টা-সহ) —
      // একটি ব্যর্থ হলেও বাকিগুলো ঠিকই সেভ হয়, আর কারণটা স্পষ্ট দেখা যায়
      const added: MemoryMedia[] = [];
      let failedCount = 0;
      let lastError = "";
      for (const f of Array.from(files).slice(0, 15)) {
        try {
          const small = await shrinkPhoto(f);
          let up: { url: string };
          try {
            up = await post<{ url: string }>("/admin/memory-photo", {
              photo: small,
            });
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
            up = await post<{ url: string }>("/admin/memory-photo", {
              photo: small,
            });
          }
          added.push({ kind: "image", url: up.url });
        } catch (e) {
          failedCount += 1;
          lastError = (e as Error).message || "";
        }
      }
      if (added.length) {
        const next = { ...draft, media: [...(draft.media || []), ...added] };
        setDraft(next);
        await persist(next);
      }
      if (failedCount)
        toast(
          `${bn(failedCount)}টি ছবি আপলোড হয়নি${lastError ? ` (${lastError})` : ""} — ওগুলো আবার দিন।`,
          true,
        );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const addLink = async () => {
    const url = linkUrl.trim();
    if (!linkKind || !/^https:\/\//.test(url)) return;
    const next = { ...draft, media: [...media, { kind: linkKind, url }] };
    setDraft(next);
    setLinkKind(null);
    setLinkUrl("");
    await persist(next);
  };
  const save = async () => {
    setBusy(true);
    try {
      await onSave(draft);
      setDirty(false);
    } finally {
      setBusy(false);
    }
  };
  const images = media.filter((m) => m.kind === "image").length;
  const videos = media.filter((m) => m.kind === "video").length;

  return (
    <article className={`admin-panel-card album-card${draft.active ? "" : " muted"}`}>
      <div className="album-card-head">
        <div className="album-fields">
          <label className="field">
            লোকেশন / আয়োজনের নাম
            <input
              value={draft.title}
              placeholder="যেমন: শেখের টেক, বদরগঞ্জ"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="field">
            তারিখ (লেখা আকারে)
            <input
              value={draft.dateLabel}
              placeholder="যেমন: ১১ সেপ্টেম্বর ২০২৬"
              onChange={(e) => patch({ dateLabel: e.target.value })}
            />
          </label>
        </div>
        <div className="album-actions">
          {onMoveUp && (
            <button className="icon-button" title="উপরে" onClick={onMoveUp}>
              <ArrowUp size={16} />
            </button>
          )}
          {onMoveDown && (
            <button className="icon-button" title="নিচে" onClick={onMoveDown}>
              <ArrowDown size={16} />
            </button>
          )}
          {!isNew && (
            <button
              className="icon-button"
              title={draft.active ? "লুকাও" : "দেখাও"}
              onClick={async () => {
                const next = { ...draft, active: !draft.active };
                setDraft(next);
                await onSave(next);
              }}
            >
              {draft.active ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          <button
            className="icon-button danger"
            title={isNew ? "বাতিল" : "অ্যালবাম মুছুন"}
            onClick={isNew ? onCancel : onAskDelete}
          >
            {isNew ? <X size={16} /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <div className="album-media-grid">
        {media.map((m, i) => (
          <div className="album-media" key={m.id || `${m.kind}-${i}`}>
            {m.kind === "image" ? (
              <img src={m.url} alt={`ছবি ${i + 1}`} loading="lazy" />
            ) : videoPoster(m.url) ? (
              // R22: ভিডিওর নিজের প্রিভিউ-ছবি (ইউটিউব/Cloudinary থাম্বনেইল)
              <span className="album-video-thumb">
                <img src={videoPoster(m.url)!} onLoad={videoPosterFallback} onError={videoPosterFallback} alt={`ভিডিও ${i + 1}`} loading="lazy" />
                <Film size={16} />
              </span>
            ) : (
              <span className="album-video-chip">
                <Film size={22} />
                ভিডিও
              </span>
            )}
            <div className="album-media-tools">
              <button title="বাঁয়ে" onClick={() => moveMedia(i, -1)}>
                ←
              </button>
              <button
                title="মুছুন"
                className="danger"
                onClick={() => setMedia(media.filter((_, j) => j !== i))}
              >
                <Trash2 size={13} />
              </button>
              <button title="ডানে" onClick={() => moveMedia(i, 1)}>
                →
              </button>
            </div>
          </div>
        ))}
        {!media.length && (
          <p className="album-empty small">এখনো ছবি/ভিডিও নেই।</p>
        )}
      </div>

      <div className="album-add-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          className="button button-outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={16} /> ছবি আপলোড
        </button>
        <button
          className="button button-outline"
          onClick={() => setLinkKind(linkKind === "image" ? null : "image")}
        >
          <Link2 size={16} /> ছবির লিংক
        </button>
        <button
          className="button button-outline"
          onClick={() => setLinkKind(linkKind === "video" ? null : "video")}
        >
          <Film size={16} /> ভিডিও লিংক
        </button>
        <span className="album-counts">
          {bn(images)} ছবি · {bn(videos)} ভিডিও
        </span>
        {dirty && (
          <span className="album-unsaved" role="status">
            এখনো সেভ হয়নি
          </span>
        )}
        {dirty && (
          <button className="button button-primary" disabled={busy} onClick={save}>
            <Save size={16} /> {busy ? "হচ্ছে…" : "সেভ করুন"}
          </button>
        )}
      </div>
      {linkKind && (
        <div className="album-link-row">
          <input
            placeholder={
              linkKind === "image"
                ? "https:// ছবির সরাসরি লিংক"
                : "https:// ইউটিউব বা .mp4 ভিডিও লিংক"
            }
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <button className="button button-primary" onClick={addLink}>
            যোগ করুন
          </button>
        </div>
      )}
    </article>
  );
}
