import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const shim = (name: string) =>
  fileURLToPath(new URL(`./preview/shims/${name}`, import.meta.url));

/**
 * একক HTML ডেমো প্রিভিউ বানানোর কনফিগ:
 * `node:*` মডিউলগুলোর জায়গায় ব্রাউজার shim বসে, ফন্ট/ছবি base64 হয়ে ভেতরে ঢুকে যায়।
 */
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.DEMO_DATA_DIR": '"preview-browser"',
    // sandboxed iframe-এ service worker নিষিদ্ধ; তাই register কল বন্ধ রাখি
    "import.meta.env.PROD": "false",
  },
  resolve: {
    alias: [
      { find: /^node:crypto$/, replacement: shim("crypto.ts") },
      { find: /^node:fs\/promises$/, replacement: shim("fs-promises.ts") },
      { find: /^node:path$/, replacement: shim("path.ts") },
      { find: /^node:url$/, replacement: shim("url.ts") },
    ],
  },
  build: {
    outDir: "preview-dist",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./preview/index.html", import.meta.url)),
      // একক ফাইলের জন্য সব ডাইনামিক chunk ভেতরে মিশিয়ে দিই (স্ক্যানার/Zxing সহ)
      output: { inlineDynamicImports: true },
    },
  },
});
