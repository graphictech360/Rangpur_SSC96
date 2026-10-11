/* ── R27: "অ্যাপ ইনস্টল করো" ভাসমান বোতাম ──────────────────────────
   Android/ডেস্কটপ Chrome: beforeinstallprompt ধরে এক চাপে ইনস্টল।
   iPhone/iPad: Safari-র শেয়ার → Add to Home Screen-এর নির্দেশনা দেখায়।
   ইনস্টল হয়ে গেলে (standalone মোডে) বোতামটি আর আসে না;
   কেউ ✕ চাপলে ৭ দিন আর বিরক্ত করা হয় না। */
import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "r96-install-dismissed";
const dismissedRecently = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < 7 * 86400000;
  } catch {
    return false;
  }
};
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosTip, setIosTip] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (isIOS()) setIosTip(true);
    const installed = () => {
      setDeferred(null);
      setIosTip(false);
    };
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (hidden || (!deferred && !iosTip)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
  };
  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setHidden(true);
      setDeferred(null);
    } else setShowIosHelp(!showIosHelp);
  };

  return (
    <div className="install-chip-wrap">
      {showIosHelp && (
        <div className="install-ios-help">
          <b>iPhone/iPad-এ ইনস্টল:</b>
          <ol>
            <li>
              Safari-তে নিচের <Share size={14} /> <b>শেয়ার</b> বোতাম চাপো
            </li>
            <li>
              তালিকা থেকে <b>“Add to Home Screen”</b> বেছে নাও
            </li>
            <li>
              <b>Add</b> চাপলেই হোম স্ক্রিনে অ্যাপ চলে আসবে
            </li>
          </ol>
          <small>
            মেসেঞ্জার/হোয়াটসঅ্যাপের ভেতরের ব্রাউজারে এই অপশন নেই — লিংকটি আগে
            Safari-তে খুলে নাও।
          </small>
        </div>
      )}
      <div className="install-chip">
        <button type="button" className="install-chip-main" onClick={install}>
          <Smartphone size={16} />
          অ্যাপ ইনস্টল করো
        </button>
        <button
          type="button"
          className="install-chip-close"
          aria-label="বন্ধ করো"
          onClick={dismiss}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
