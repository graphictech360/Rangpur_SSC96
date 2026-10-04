/**
 * `node:fs/promises`-এর ব্রাউজার shim: ডেমো ডেটা localStorage-এ (না পারলে মেমোরিতে) রাখে।
 * playground/iframe-এ localStorage বন্ধ থাকলেও প্রিভিউ চলবে।
 */
const KEY = "r96-demo:fs";
let memory: Record<string, string> | null = null;

function canUseStorage() {
  try {
    const probe = "r96-demo:probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = canUseStorage();

function load(): Record<string, string> {
  // একাধিক ট্যাব/পেজ একই ডেমো ডেটা ভাগ করে, তাই প্রতিবার localStorage থেকে পড়ি
  if (storageAvailable) {
    try {
      memory = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      memory = memory || {};
    }
    return memory;
  }
  return (memory = memory || {});
}

function save(data: Record<string, string>) {
  memory = data;
  if (!storageAvailable) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* কোটা শেষ হলে মেমোরিতেই চলবে */
  }
}

function enoent(file: string) {
  return Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" });
}

export async function mkdir() {
  return undefined;
}

export async function readFile(file: string) {
  const data = load();
  if (!(file in data)) throw enoent(file);
  return data[file];
}

export async function writeFile(file: string, contents: string | Uint8Array) {
  const data = load();
  data[file] =
    typeof contents === "string"
      ? contents
      : new TextDecoder().decode(contents);
  save(data);
}

export async function rename(from: string, to: string) {
  const data = load();
  if (!(from in data)) throw enoent(from);
  data[to] = data[from];
  delete data[from];
  save(data);
}

export async function unlink(file: string) {
  const data = load();
  delete data[file];
  save(data);
}

export function clearPreviewData() {
  memory = {};
  if (storageAvailable) {
    for (const key of [...Object.keys(localStorage)])
      if (key.startsWith("r96-demo:") || key === "r96-tickets")
        localStorage.removeItem(key);
  }
}

export default { mkdir, readFile, writeFile, rename, unlink };
