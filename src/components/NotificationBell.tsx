/* ── R26: বেল আইকন — নতুন নিবন্ধনের নোটিফিকেশন ──────────────────────
   • ব্যাজে আনরিড সংখ্যা (সব ডিভাইসে একই — সার্ভারে "কখন পর্যন্ত দেখা" থাকে)
   • ড্রপডাউনে সাম্প্রতিক নিবন্ধনের তালিকা; নতুনগুলো হাইলাইট
   • "এই ডিভাইসে পুশ" টগল: ব্রাউজার/মোবাইলে অ্যাপ বন্ধ থাকলেও নোটিফিকেশন
   • প্রতি ৪৫ সেকেন্ডে ও ট্যাবে ফিরলেই সংখ্যা হালনাগাদ হয় */
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { api } from "../lib";
import type { Registration } from "../types";

interface NotifState {
  seenAt: string;
  unread: number;
}

const base64ToUint8 = (base64: string) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  return new Date(iso).toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "short",
  });
};

export default function NotificationBell({
  registrations,
  onToast,
}: {
  registrations: Registration[];
  onToast: (msg: string, isError?: boolean) => void;
}) {
  const [state, setState] = useState<NotifState | null>(null);
  const [open, setOpen] = useState(false);
  const [pushReady, setPushReady] = useState(false); // ব্রাউজার পুশ পারে + সার্ভারে চাবি আছে
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const publicKey = useRef("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api<NotifState>("/notifications");
      setState(s);
      // ইনস্টল করা অ্যাপের আইকনে সংখ্যা (Badging API — যেখানে আছে)
      const nav = navigator as Navigator & {
        setAppBadge?: (n: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (s.unread > 0) nav.setAppBadge?.(s.unread).catch(() => {});
      else nav.clearAppBadge?.().catch(() => {});
    } catch {
      /* নীরব — পরের পোলে আবার চেষ্টা */
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 45_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // পুশ সম্ভব কি না + এই ডিভাইসে আগে থেকেই চালু কি না
  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window))
          return;
        const cfg = await api<{ enabled: boolean; publicKey: string }>(
          "/push/config",
        );
        if (!cfg.enabled) return;
        publicKey.current = cfg.publicKey;
        setPushReady(true);
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setPushOn(Boolean(sub));
      } catch {
        /* পুশ ছাড়া বাকিসব চলবে */
      }
    })();
  }, []);

  // বাইরে ক্লিকে ড্রপডাউন বন্ধ
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushOn) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api("/push/unsubscribe", {
            method: "POST",
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe();
        }
        setPushOn(false);
        onToast("এই ডিভাইসের পুশ নোটিফিকেশন বন্ধ হলো।");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw new Error(
            "ব্রাউজার নোটিফিকেশনের অনুমতি দেয়নি। সাইট সেটিংস থেকে Notifications: Allow করে আবার চেষ্টা করো।",
          );
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8(publicKey.current) as unknown as ArrayBuffer,
        });
        const json = sub.toJSON();
        await api("/push/subscribe", {
          method: "POST",
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
            label: navigator.userAgent.slice(0, 120),
          }),
        });
        setPushOn(true);
        onToast("দারুণ! নতুন নিবন্ধন এলেই এই ডিভাইসে নোটিফিকেশন আসবে।");
      }
    } catch (e) {
      onToast((e as Error).message, true);
    } finally {
      setPushBusy(false);
    }
  };

  const markSeen = async () => {
    try {
      setState(await api<NotifState>("/notifications/seen", { method: "POST" }));
      (
        navigator as Navigator & { clearAppBadge?: () => Promise<void> }
      ).clearAppBadge?.().catch(() => {});
    } catch (e) {
      onToast((e as Error).message, true);
    }
  };

  const unread = state?.unread ?? 0;
  const seenAt = state?.seenAt || "";
  const recent = [...registrations]
    .filter((r) => !r.archivedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="notif-bell" ref={wrapRef}>
      <button
        type="button"
        className="icon-button notif-bell-button"
        aria-label={
          unread > 0 ? `${unread}টি নতুন নিবন্ধন` : "নোটিফিকেশন"
        }
        onClick={() => {
          setOpen(!open);
          if (!open) refresh();
        }}
      >
        {unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unread > 0 && (
          <span className="notif-badge">{unread > 99 ? "৯৯+" : unread.toLocaleString("bn-BD")}</span>
        )}
      </button>
      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="নোটিফিকেশন">
          <div className="notif-head">
            <b>নতুন নিবন্ধন</b>
            {unread > 0 && (
              <button type="button" onClick={markSeen}>
                সব দেখা হয়েছে ✓
              </button>
            )}
          </div>
          <ul className="notif-list">
            {recent.length === 0 && (
              <li className="notif-empty">এখনো কোনো নিবন্ধন আসেনি।</li>
            )}
            {recent.map((r) => (
              <li
                key={r.id}
                className={seenAt && r.createdAt > seenAt ? "notif-new" : ""}
              >
                <span className="notif-name">
                  {r.participant.name}
                  <small>
                    {r.ticketNumber} · {timeAgo(r.createdAt)}
                  </small>
                </span>
                <i
                  className={
                    r.status === "approved" ? "visible-badge" : "hidden-badge"
                  }
                >
                  {r.status === "approved"
                    ? "অনুমোদিত"
                    : r.status === "pending"
                      ? "অপেক্ষায়"
                      : "বাতিল"}
                </i>
              </li>
            ))}
          </ul>
          <div className="notif-foot">
            {pushReady ? (
              <button
                type="button"
                className="button button-outline"
                disabled={pushBusy}
                onClick={togglePush}
              >
                {pushBusy ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <BellRing size={15} />
                )}
                {pushOn
                  ? "এই ডিভাইসের পুশ বন্ধ করো"
                  : "এই ডিভাইসে পুশ চালু করো"}
              </button>
            ) : (
              <small>
                পুশ নোটিফিকেশন এই ব্রাউজারে নেই — iPhone/iPad-এ আগে অ্যাপটি হোম
                স্ক্রিনে Install করে নাও।
              </small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
