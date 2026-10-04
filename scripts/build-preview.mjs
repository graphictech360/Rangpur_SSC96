/**
 * একক ফাইল ডেমো প্রিভিউ বিল্ড করে: `Rangpur-SSC96-Preview.html`
 * ব্যবহার: node scripts/build-preview.mjs
 */
import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const assetsDir = path.join(root, "public", "assets");
const outDir = path.join(root, "preview-dist");
const singleFile = "/home/user/Rangpur-SSC96-Preview.html";

const MIME = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const inline = (data) => data.toString("base64");

/** preview-dist-এর ভেতরে বিল্ট index.html খুঁজে বের করে। */
async function findHtml(dir) {
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findHtml(full);
      if (nested) return nested;
    } else if (entry.name === "index.html") return full;
  }
  return null;
}

async function buildBundle() {
  await build({ configFile: path.join(root, "vite.preview.config.ts") });
  const htmlPath = await findHtml(outDir);
  if (!htmlPath) throw new Error("বিল্ড আউটপুটে index.html পাওয়া যায়নি।");
  const html = await readFile(htmlPath, "utf8");
  const dir = path.dirname(htmlPath);
  const cssFile = html.match(/href="([^"]+\.css)"/)?.[1];
  const jsFile = html.match(/src="([^"]+\.js)"/)?.[1];
  if (!cssFile || !jsFile) throw new Error("বিল্ড আউটপুটে CSS/JS পাওয়া যায়নি।");
  const resolve = (file) =>
    file.startsWith("/")
      ? path.join(outDir, file.slice(1))
      : path.join(dir, file);
  return {
    html,
    css: await readFile(resolve(cssFile), "utf8"),
    js: await readFile(resolve(jsFile), "utf8"),
  };
}

/** public/assets-এর সব ফাইল data URI হিসেবে বসানোর ম্যাপ বানায়। */
async function assetMap() {
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(assetsDir);
  const map = new Map();
  for (const name of names) {
    const ext = path.extname(name);
    if (!MIME[ext]) continue;
    const data = await readFile(path.join(assetsDir, name));
    map.set(`/assets/${name}`, `data:${MIME[ext]};base64,${inline(data)}`);
  }
  return map;
}

function replaceAll(value, map) {
  let output = value;
  for (const [from, to] of map) output = output.split(from).join(to);
  return output;
}

const { html, css, js } = await buildBundle();
const map = await assetMap();

// ফন্ট CSS (@import) কে সরাসরি ভেতরে বসিয়ে দিই; ফন্ট ফাইল আজই data URI হয়ে যায়।
const fontsCss = replaceAll(
  await readFile(path.join(assetsDir, "fonts.css"), "utf8"),
  map,
);
let inlinedCss = replaceAll(css, map).replace(
  /@import\s+url\(["']?\/assets\/fonts\.css["']?\);?/,
  fontsCss,
);
const inlinedJs = replaceAll(js, map).replace(/<\/script/gi, "<\\/script");

// ট্যাগগুলো সরিয়ে সরাসরি <head>-এ CSS/JS বসাই (regex replacement-এ $ সমস্যা এড়াতে ফাংশন ব্যবহার)।
let output = html
  .replace(/<script[^>]*type="module"[^>]*><\/script>/i, () => "")
  .replace(/<link[^>]+rel="stylesheet"[^>]*>/i, () => "")
  .replace(
    /<link[^>]+rel="(?:manifest|icon|apple-touch-icon)"[^>]*>/gi,
    () => "",
  )
  .replace(/<link[^>]+as="font"[^>]*>/gi, () => "")
  .replace(
    /<\/head>/i,
    () =>
      `<style>\n${fontsCss}\n${inlinedCss}\n</style>\n<script type="module">\n${inlinedJs}\n</script>\n</head>`,
  );

const leftoverSrc = output.match(/<script[^>]+src=/i);
const leftoverAssets = output.match(
  /\/assets\/[a-z0-9.-]+\.(?:js|css|webp|woff2|png)/gi,
);
if (leftoverSrc || leftoverAssets)
  throw new Error(
    `inline করা যায়নি: ${leftoverSrc?.[0] || leftoverAssets?.slice(0, 3).join(", ")}`,
  );

await writeFile(path.join(outDir, "index.html"), output);
await mkdir(path.dirname(singleFile), { recursive: true });
await writeFile(singleFile, output);

const kb = (Buffer.byteLength(output) / 1024).toFixed(0);
console.log(
  `একক ফাইল প্রিভিউ তৈরি: ${singleFile} (${kb} KB) এবং preview-dist/index.html`,
);
