/**
 * ব্রাউজার প্রিভিউর জন্য `node:crypto`-এর ছোট shim।
 * শুধু ডেমো প্রিভিউতে ব্যবহৃত হয়: sha256 হ্যাশ, randomBytes, randomUUID, timingSafeEqual।
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number) {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(input: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const length = input.length;
  const withOne = length + 1;
  const total = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const message = new Uint8Array(total);
  message.set(input);
  message[length] = 0x80;
  const bitLength = length * 8;
  const view = new DataView(message.buffer);
  view.setUint32(total - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(total - 4, bitLength >>> 0);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) H[i] = (H[i] + next[i]) >>> 0;
  }
  return new Uint8Array(H.buffer.slice(0));
}

const encoder = new TextEncoder();

export function createHash(algorithm: string) {
  if (!/^sha-?256$/i.test(algorithm))
    throw new Error(`প্রিভিউতে ${algorithm} সমর্থিত নয়।`);
  const chunks: Uint8Array[] = [];
  return {
    update(chunk: string | Uint8Array) {
      chunks.push(
        typeof chunk === "string"
          ? encoder.encode(chunk)
          : new Uint8Array(chunk),
      );
      return this;
    },
    digest(encoding?: string) {
      const size = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        all.set(c, at);
        at += c.length;
      }
      const digest = sha256Bytes(all);
      if (encoding === "hex")
        return Array.from(digest)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      return digest;
    },
  };
}

function withHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const buffer = bytes as Uint8Array & { toString(encoding?: string): string };
  buffer.toString = (encoding?: string) => (encoding === "hex" ? hex : hex);
  return buffer;
}

export function randomBytes(size: number) {
  return withHex(size) as unknown as Buffer & { toString(): string };
}

export function randomUUID() {
  return crypto.randomUUID();
}

export function timingSafeEqual(
  a: string | Uint8Array,
  b: string | Uint8Array,
) {
  const left = typeof a === "string" ? encoder.encode(a) : a;
  const right = typeof b === "string" ? encoder.encode(b) : b;
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export default { createHash, randomBytes, randomUUID, timingSafeEqual };

// Node-এর Buffer টাইপ শুধু টাইপচেকের জন্য; ব্রাউজার রানটাইমে ব্যবহার হয় না।
type Buffer = Uint8Array & { toString(encoding?: string): string };
