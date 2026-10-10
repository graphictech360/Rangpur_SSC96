/**
 * R19: বাংলা-সহ PDF রিপোর্ট — ব্যাংক স্টেটমেন্টের মতো লেটারহেড।
 *
 * কৌশল: ব্রাউজারই বাংলা টেক্সট নিখুঁত রেন্ডার করে, তাই প্রতিটি A4 পাতা
 * আগে DOM-এ সাজিয়ে html2canvas দিয়ে ছবিতে নিয়ে jsPDF-এ বসানো হয়।
 * - লেটারহেড (লোগো + উৎসবের নাম + ঠিকানা) শুধু ১ম পাতায়
 * - ঠিকানা আসে event.venue/city থেকে — অ্যাডমিনে বদলালে রিপোর্টেও বদলায়
 * - চাইলে প্রতি পাতায় সেই পাতার সারাংশ, শেষ পাতায় গ্র্যান্ড টোটাল
 */
import type { FestivalEvent } from "./types";
import { LOGO_URL } from "./lib";

export type PdfColumn = {
  label: string;
  width: number; // আপেক্ষিক ভাগ (সব কলামের যোগফলের অনুপাতে)
  align?: "left" | "right" | "center";
};
export type PdfSummaryItem = {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "normal" | "good" | "bad";
};

const PAGE_W = 794; // A4 @96dpi
const PAGE_H = 1123;
const PAD = 36;
const ROW_H = 30;
const THEAD_H = 34;
const LETTER_H = 128;
const FOOT_H = 24;
const PAGE_SUM_H = 56;

const GREEN = "#234e40";
const GOLD = "#e9c948";
const CREAM = "#fbf6eb";
const INK = "#203d36";
const MUTED = "#6b7a6e";
const LINE = "#e5decb";

const esc = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const toneColor = (t?: string) =>
  t === "good" ? "#1f6b3f" : t === "bad" ? "#b3402a" : INK;

/** লোগো আগে থেকে লোড করি — ব্যর্থ হলে (যেমন অফলাইন ফাইল) "৯৬" মনোগ্রাম */
function loadLogo(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(LOGO_URL);
    img.onerror = () => resolve(null);
    img.src = LOGO_URL;
    setTimeout(() => resolve(null), 2500);
  });
}

function letterheadHtml(
  event: FestivalEvent,
  reportTitle: string,
  logo: string | null,
  madeOn: string,
) {
  const mark = logo
    ? `<img src="${logo}" alt="" style="width:66px;height:66px;object-fit:contain;flex:none"/>`
    : `<div style="width:66px;height:66px;border-radius:50%;background:${GREEN};color:${GOLD};display:flex;align-items:center;justify-content:center;font:700 26px 'Outfit',sans-serif;flex:none">96</div>`;
  return `
  <div style="display:flex;align-items:center;gap:16px;height:${LETTER_H - 26}px">
    ${mark}
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:25px;line-height:1.2;color:${GREEN}">${esc(event.name)}</div>
      <div style="font-size:12.5px;color:${MUTED};margin-top:5px">${esc(event.venue)}, ${esc(event.city)} · ${esc(event.dateLabel)}</div>
    </div>
    <div style="text-align:right;flex:none">
      <div style="font-weight:700;font-size:15px;color:${GREEN};background:${CREAM};border:1px solid ${LINE};border-radius:8px;padding:5px 12px">${esc(reportTitle)}</div>
      <div style="font-size:11px;color:${MUTED};margin-top:6px">রিপোর্ট তৈরি: ${esc(madeOn)}</div>
    </div>
  </div>
  <div style="height:4px;background:${GREEN};border-radius:2px;margin-top:8px"></div>
  <div style="height:2px;background:${GOLD};border-radius:2px;margin-top:3px"></div>`;
}

function tableHtml(
  columns: PdfColumn[],
  rows: (string | number)[][],
): string {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  const cols = columns
    .map((c) => `<col style="width:${((c.width / totalW) * 100).toFixed(2)}%"/>`)
    .join("");
  const head = columns
    .map(
      (c) =>
        `<th style="text-align:${c.align || "left"};padding:0 8px;font-size:11.5px;font-weight:700;color:#fff;white-space:nowrap">${esc(c.label)}</th>`,
    )
    .join("");
  const body = rows
    .map((r, i) => {
      const bg = i % 2 ? "background:#faf7ee;" : "";
      const tds = r
        .map(
          (cell, j) =>
            `<td style="text-align:${columns[j]?.align || "left"};padding:0 8px;font-size:12px;color:${INK};border-bottom:1px solid ${LINE};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0">${esc(cell)}</td>`,
        )
        .join("");
      return `<tr style="height:${ROW_H}px;${bg}">${tds}</tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
    <colgroup>${cols}</colgroup>
    <thead><tr style="height:${THEAD_H}px;background:${GREEN}">${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function summaryBoxHtml(items: PdfSummaryItem[], title: string | null): string {
  if (title) {
    // গ্র্যান্ড টোটাল: বড় বাক্স, প্রতি লাইনে label—value
    const lines = items
      .map(
        (it) => `
      <div style="display:flex;justify-content:space-between;padding:${it.strong ? "7px" : "4px"} 0;${it.strong ? `border-top:1.5px solid ${GREEN};margin-top:3px;` : ""}">
        <span style="font-size:${it.strong ? "13.5px" : "12.5px"};font-weight:${it.strong ? 700 : 400};color:${toneColor(it.tone)}">${esc(it.label)}</span>
        <span style="font-size:${it.strong ? "13.5px" : "12.5px"};font-weight:700;color:${toneColor(it.tone)}">${esc(it.value)}</span>
      </div>`,
      )
      .join("");
    return `<div style="border:1.5px solid ${GREEN};background:${CREAM};border-radius:10px;padding:12px 16px;margin-top:12px">
      <div style="font-weight:700;font-size:14px;color:${GREEN};margin-bottom:6px">${esc(title)}</div>
      ${lines}
    </div>`;
  }
  // পাতার সারাংশ: এক লাইনের ছোট বাক্স
  const chips = items
    .map(
      (it) =>
        `<span style="font-size:12px;color:${toneColor(it.tone)}">${esc(it.label)}: <b>${esc(it.value)}</b></span>`,
    )
    .join(`<span style="color:${LINE}">|</span>`);
  return `<div style="border:1px solid ${LINE};background:${CREAM};border-radius:8px;padding:9px 14px;margin-top:10px;display:flex;gap:14px;justify-content:flex-end;align-items:center">${chips}</div>`;
}

export async function exportTablePdf(opts: {
  filename: string;
  reportTitle: string;
  event: FestivalEvent;
  columns: PdfColumn[];
  rows: (string | number)[][];
  /** প্রতি পাতার নিচে সেই পাতার সারাংশ — (শুরু, শেষ) সারির ইনডেক্স পায় */
  pageSummary?: (start: number, end: number) => PdfSummaryItem[];
  /** শেষ পাতায় গ্র্যান্ড টোটাল বাক্স */
  grandSummary?: { title: string; items: PdfSummaryItem[] };
}): Promise<void> {
  const { filename, reportTitle, event, columns, rows, pageSummary, grandSummary } = opts;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  const logo = await loadLogo();
  const madeOn = new Date().toLocaleString("bn-BD", {
    dateStyle: "long",
    timeStyle: "short",
  });

  // ── পাতায় ভাগ ──────────────────────────────────────────────
  const capacity = (first: boolean) =>
    Math.max(
      4,
      Math.floor(
        (PAGE_H -
          PAD * 2 -
          (first ? LETTER_H + 10 : 6) -
          THEAD_H -
          (pageSummary ? PAGE_SUM_H + 6 : 0) -
          FOOT_H) /
          ROW_H,
      ),
    );
  const pages: { start: number; end: number }[] = [];
  let i = 0;
  do {
    const cap = capacity(pages.length === 0);
    pages.push({ start: i, end: Math.min(rows.length, i + cap) });
    i += cap;
  } while (i < rows.length);
  if (grandSummary) {
    const grandH = 86 + grandSummary.items.length * 27;
    const last = pages[pages.length - 1];
    const used = (last.end - last.start) * ROW_H;
    const avail =
      PAGE_H - PAD * 2 - (pages.length === 1 ? LETTER_H + 10 : 6) - THEAD_H -
      (pageSummary ? PAGE_SUM_H + 6 : 0) - FOOT_H - used;
    if (avail < grandH) pages.push({ start: rows.length, end: rows.length });
  }

  // ── DOM বানিয়ে প্রতিটি পাতা ক্যানভাসে ─────────────────────
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;z-index:-1;`;
  document.body.appendChild(host);
  try {
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    for (let p = 0; p < pages.length; p++) {
      const { start, end } = pages[p];
      const isFirst = p === 0;
      const isLast = p === pages.length - 1;
      const pageEl = document.createElement("div");
      pageEl.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;background:#ffffff;box-sizing:border-box;padding:${PAD}px;display:flex;flex-direction:column;font-family:'Noto Sans Bengali','Outfit',sans-serif;`;
      pageEl.innerHTML = `
        ${isFirst ? letterheadHtml(event, reportTitle, logo, madeOn) : ""}
        <div style="margin-top:${isFirst ? 10 : 6}px">
          ${end > start || rows.length === 0 ? tableHtml(columns, rows.slice(start, end)) : ""}
        </div>
        <div style="margin-top:auto">
          ${pageSummary && end > start ? summaryBoxHtml(pageSummary(start, end), null) : ""}
          ${isLast && grandSummary ? summaryBoxHtml(grandSummary.items, grandSummary.title) : ""}
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#8a8368;margin-top:9px">
            <span>${esc(event.name)} — ${esc(reportTitle)}</span>
            <span>পাতা ${p + 1} / ${pages.length}</span>
          </div>
        </div>`;
      host.appendChild(pageEl);
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      if (p > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297);
      host.removeChild(pageEl);
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
