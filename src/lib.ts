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

/** যেকোনো টেবিল (সারি × কলাম) CSV হিসেবে নামায় — BOM সহ, তাই Excel-এ বাংলা ঠিক আসে। */
export function downloadTableCsv(
  filename: string,
  rows: (string | number | null | undefined)[][],
) {
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
