import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/UI";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
// ── স্ট্যাটিক শেল ক্যাশ (R15) ──
// sw.js কখনোই HTTP ক্যাশে রাখা হবে না, আর নতুন ভার্সন চালু হওয়ামাত্র পেজ
// একবার রিলোড হবে — তাই লোগো/ছবি বদলালে কেউ পুরোনোটা দেখে আটকে থাকবে না।
if ("serviceWorker" in navigator && import.meta.env.PROD) {
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
