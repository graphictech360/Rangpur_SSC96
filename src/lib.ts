import type { Registration } from "./types";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: options.signal || AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "অনুরোধ সম্পন্ন হয়নি।");
  return data;
}
/** ছবি আপলোডের নির্দিষ্ট মাপ — স্টোরেজ ভরে যাওয়া ঠেকাতে সব ছবি এই একই মাপে জমা হয় */
export const PHOTO_SIZE = 512; // ৫১২×৫১২ পিক্সেল (বর্গাকার, প্রোফাইল ছবির মতো)
export const PHOTO_QUALITY = 0.72; // JPEG গুণমান — সাধারণত ৪০–৯০ KB হয়
export const PHOTO_MAX_UPLOAD = 25 * 1024 * 1024; // ব্যবহারকারী সর্বোচ্চ ২৫ MB-এর ছবি দিতে পারবেন

/** যেকোনো সাইজ/ধরনের ছবি নিয়ে ঠিক ৫১২×৫১২ স্কয়ার JPEG (data URI) বানায় — কেউ বড় ফাইল দিলেও জমা হবে ছোট */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("শুধু ছবি (JPG/PNG/WebP) দিতে পারবেন।");
  if (file.size > PHOTO_MAX_UPLOAD)
    throw new Error("ছবিটি ২৫ MB-এর চেয়ে বড়। ছোট ছবি দিয়ে আবার চেষ্টা করুন।");
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("ছবিটি পড়া যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।"));
      };
      img.src = url;
    });
  }
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height)
    throw new Error("ছবিটি পড়া যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।");
  // কেন্দ্র থেকে বর্গাকার অংশ নিয়ে ঠিক ৫১২×৫১২-এ আঁকা হয় — চেহারা বিকৃত হয় না
  const side = Math.min(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("এই ব্রাউজারে ছবি ছোট করা যায় না।");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    (width - side) / 2,
    (height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  if ("close" in source) source.close();
  const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
  if (!/^data:image\/jpeg;base64,/.test(dataUrl) || dataUrl.length < 200)
    throw new Error("ছবিটি প্রস্তুত করা যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।");
  return dataUrl;
}
// হেডারের লোগো: অনুপাত নষ্ট না করে সর্বোচ্চ ৫১২ পিক্সেল চওড়ায় আনা হয়
export async function shrinkLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("শুধু ছবি (JPG/PNG/WebP/SVG থেকে বানানো ছবি) দিতে পারবেন।");
  if (file.size > PHOTO_MAX_UPLOAD)
    throw new Error("ছবিটি ২৫ MB-এর চেয়ে বড়। ছোট ছবি দিয়ে আবার চেষ্টা করুন।");
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("ছবিটি পড়া যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।"));
      };
      img.src = url;
    });
  }
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height)
    throw new Error("ছবিটি পড়া যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।");
  const scale = Math.min(1, 512 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("এই ব্রাউজারে ছবি ছোট করা যায় না।");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  // ⚠️ লোগো PNG হিসেবেই রাখা হয় — JPEG করলে স্বচ্ছ অংশ কালো হয়ে যায়
  // (হেডারে কালো বাক্স দেখানোর আসল কারণ ছিল এটাই)।
  const dataUrl = canvas.toDataURL("image/png");
  if (!/^data:image\/png;base64,/.test(dataUrl) || dataUrl.length < 200)
    throw new Error("ছবিটি প্রস্তুত করা যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।");
  return dataUrl;
}

// বান্ডেল করা লোগো — ডেটাবেজের লিংক ভাঙা থাকলে বা ফাইল হারালে এটাই দেখানো হয়
export const LOGO_URL = "/assets/ssc96-logo-v2.webp";
export function logoFallback(e: { currentTarget: HTMLImageElement }) {
  const img = e.currentTarget;
  if (img.dataset.fallbackDone) return;
  img.dataset.fallbackDone = "1";
  img.src = LOGO_URL;
}

export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const mutate = <T = { ok: boolean }>(action: string, payload: unknown) =>
  post<T>("/admin/mutate", { action, payload });
export const bn = (value: number | string) =>
  String(value).replace(/\d/g, (n) => "০১২৩৪৫৬৭৮৯"[Number(n)]);
export const money = (value: number) =>
  bn(
    new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(value),
  );
export const normalizeMobile = (value: string) =>
  value
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .replace(/[\s()-]/g, "")
    .replace(/^\+?880/, "0");
export const validMobile = (value: string) =>
  /^01[3-9]\d{8}$/.test(normalizeMobile(value));
export const timeLabel = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return `${bn(h % 12 || 12)}:${bn(String(m).padStart(2, "0"))} ${h < 12 ? "AM" : "PM"}`;
};
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("bn-BD", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
export const ticketLink = (key: string) => `${location.origin}/#ticket=${key}`;
export const extractKey = (value: string) =>
  value.match(/[a-f0-9]{64}/)?.[0] || "";
export interface SavedTicket {
  key: string;
  name: string;
  ticketNumber: string;
}
export function savedTickets(): SavedTicket[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("r96-tickets") || "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (x: SavedTicket) =>
              x &&
              typeof x.key === "string" &&
              /^[a-f0-9]{64}$/.test(x.key) &&
              typeof x.name === "string" &&
              typeof x.ticketNumber === "string",
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function saveTicket(key: string, registration: Registration) {
  try {
    const old = savedTickets().filter((x) => x.key !== key);
    localStorage.setItem(
      "r96-tickets",
      JSON.stringify(
        [
          {
            key,
            name: registration.participant.name,
            ticketNumber: registration.ticketNumber,
          },
          ...old,
        ].slice(0, 10),
      ),
    );
  } catch {
    /* Private-mode users can still copy the recovery link. */
  }
}
export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    if (!ok) throw new Error("লিংকটি নির্বাচন করে নিজে কপি করুন।");
  }
}
const csvEscape = (value: unknown) => {
  let s = String(value ?? "");
  // Excel/Sheets formula injection ঠেকাতে: = + @ - ট্যাব/CR দিয়ে শুরু হলে ' বসাই
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

/**
 * ফাইল নামানোর মজবুত পদ্ধতি: লিংকটা DOM-এ যুক্ত করে ক্লিক, URL একটু পরে মুক্ত।
 * (কিছু ব্রাউজার/এমবেড-ভিউ DOM-এর বাইরের লিংকে ক্লিক উপেক্ষা করে — আগে তাই
 * ডেমো প্রিভিউ-প্যানেলে CSV চুপচাপ নামত না।)
 */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

/** যেকোনো টেবিল (সারি × কলাম) CSV হিসেবে নামায় — BOM সহ, তাই Excel-এ বাংলা ঠিক আসে। */
export function downloadTableCsv(
  filename: string,
  rows: (string | number | null | undefined)[][],
) {
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  triggerBlobDownload(blob, filename);
}

export function downloadCsv(registrations: Registration[]) {
  downloadTableCsv("Rangpur-SSC96-registrations.csv", [
    [
      "Ticket",
      "Name",
      "School",
      "SSC Roll",
      "SSC Registration",
      "Mobile",
      "Location",
      "T-Shirt",
      "Spouse",
      "Children",
      "Food",
      "Extra Answers",
      "Amount",
      "Status",
      "Provider",
      "Transaction ID",
      "Sender Mobile",
      "Collector",
      "Collector Mobile",
      "Check-in",
      "Archived",
    ],
    ...registrations.map((r) => [
      r.ticketNumber,
      r.participant.name,
      r.participant.school,
      r.participant.sscRoll,
      r.participant.sscRegistration,
      r.participant.mobile,
      r.participant.location,
      r.participant.tshirt,
      r.spouse,
      r.children,
      r.food,
      Object.entries(r.answers || {})
        .filter(([, v]) => String(v || "").trim() !== "")
        .map(([k, v]) => `${k}=${v}`)
        .join(" | "),
      r.total,
      r.status,
      r.payment.provider,
      r.payment.transactionId,
      r.payment.senderMobile,
      r.payment.collectorName,
      r.payment.collectorMobile,
      r.checkedInAt || "",
      r.archivedAt || "",
    ]),
  ]);
}

/** R22: ভিডিও লিংক থেকে প্রিভিউ-ছবি —
 *  ইউটিউব হলে অফিসিয়াল থাম্বনেইল, Cloudinary হলে ভিডিওর প্রথম ফ্রেমের jpg।
 *  অন্য লিংকে null — তখন UI ভিডিওর নিজের প্রথম ফ্রেম (preload="metadata") দেখায়। */
export const videoPoster = (url: string): string | null => {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  if (/res\.cloudinary\.com\/[^\s]+\/video\/upload\//.test(url))
    return url
      .replace("/video/upload/", "/video/upload/so_0,w_640,h_360,c_fill/")
      .replace(/\.\w+(\?.*)?$/, ".jpg");
  return null;
};
