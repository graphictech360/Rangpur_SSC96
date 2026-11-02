import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/UI";
import "./styles.css";

// Only the bare public landing page on the retired hostname moves. The old
// ticket URL is /#ticket=... (the # fragment is invisible to Vercel redirects),
// and recovery/legacy account links may carry a query or fragment. Never send
// those private links, the old API, /admin, or /check-in to a different database.
const retiredPublicLandingPage =
  window.location.hostname.toLowerCase() === "ssc96-rangpur.vercel.app" &&
  window.location.pathname === "/" &&
  window.location.search === "" &&
  window.location.hash === "";

if (retiredPublicLandingPage) {
  window.location.replace("https://www.96rangpur.com/");
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </React.StrictMode>,
  );
}
// ── স্ট্যাটিক শেল ক্যাশ (R15) ──
// sw.js কখনোই HTTP ক্যাশে রাখা হবে না, আর নতুন ভার্সন চালু হওয়ামাত্র পেজ
// একবার রিলোড হবে — তাই লোগো/ছবি বদলালে কেউ পুরোনোটা দেখে আটকে থাকবে না।
if (!retiredPublicLandingPage && "serviceWorker" in navigator && import.meta.env.PROD) {
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshed) return;
    refreshed = true;
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  });
}
