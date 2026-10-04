/** `node:path`-এর ছোট shim (শুধু ডেমো স্টোরের প্রয়োজন মেটায়)। */
export function join(...parts: string[]) {
  return parts
    .filter((p) => p !== "")
    .join("/")
    .replace(/\/{2,}/g, "/");
}

export function resolve(...parts: string[]) {
  const joined = join(...parts);
  return joined.startsWith("/") ? joined : `/${joined}`;
}

export function dirname(file: string) {
  const clean = file.replace(/\/+$/, "");
  const at = clean.lastIndexOf("/");
  return at <= 0 ? "/" : clean.slice(0, at);
}

export function basename(file: string) {
  return file.slice(file.lastIndexOf("/") + 1);
}

export default { join, resolve, dirname, basename };
