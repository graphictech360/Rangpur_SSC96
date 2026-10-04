/**
 * সব সাধারণ টেক্সট +২pt করে (main heading ও section heading অপরিবর্তিত)।
 * ব্যবহার: node scripts/bump-text.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const file = path.resolve(import.meta.dirname, "../src/styles.css");
const STEP = 8 / 3; // ২pt = ৮ ⁄ ৩ px

/** যেগুলো heading/হেডিং-সদৃশ — এগুলোর সাইজ অপরিবর্তিত থাকবে। */
const KEEP = [
  ".hero-title",
  ".title-batch",
  ".title-festival",
  ".title-spark",
  ".section-title",
  ".custom-title",
  ".friends-stamp > b",
  ".story-paper strong",
  ".login-art h1",
  ".login-big-number",
  ".scanner-title h1",
  ".admin-page-heading h1",
  ".access-denied h1",
  ".success-card > h3",
  ".ticket-receipt-main > h2",
  ".footer-top h2",
  ".note-emoji",
];

const lines = (await readFile(file, "utf8")).split("\n");
let selector = "";
let depth = 0;
let changed = 0;
let kept = 0;

const output = lines.map((line) => {
  const trimmed = line.trim();
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;

  if (opens && !closes && !trimmed.startsWith("@") && depth >= 0)
    selector = trimmed.replace(/\{$/, "").trim();

  const match = line.match(/^(\s*)font-size:\s*([\d.]+)px;/);
  let result = line;
  if (match) {
    const heading = KEEP.some((k) => selector.includes(k));
    const size = Number(match[2]);
    if (heading) kept++;
    else {
      // main heading-এর মতো বড় display টেক্সটেও হাত দিই না
      const next = Math.round((size + (size >= 60 ? 0 : STEP)) * 100) / 100;
      if (next !== size) {
        result = `${match[1]}font-size: ${next}px;`;
        changed++;
      }
    }
  }
  depth += opens - closes;
  return result;
});

await writeFile(file, output.join("\n"));
console.log(
  `font-size আপডেট: ${changed}টি টেক্সট বড় হয়েছে, ${kept}টি heading অপরিবর্তিত।`,
);
