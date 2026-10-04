import { installDemoApi, mountPreviewBadge } from "./api";
import "../src/main";

/**
 * একক ফাইল (file://) প্রিভিউতে history.pushState("/admin") কাজ করে না,
 * তাই URL বদলানো যায় না — অ্যাপের ভেতরের রাউটিং অপরিবর্তিত থাকে।
 */
function patchHistory() {
  for (const name of ["pushState", "replaceState"] as const) {
    const original = history[name].bind(history);
    history[name] = ((
      state: unknown,
      title: string,
      url?: string | URL | null,
    ) => {
      try {
        original(state as never, title, url as never);
      } catch {
        /* file:// বা sandboxed iframe: চুপচাপ এগিয়ে যাই */
      }
    }) as typeof history.pushState;
  }
}

patchHistory();
installDemoApi();
mountPreviewBadge();
